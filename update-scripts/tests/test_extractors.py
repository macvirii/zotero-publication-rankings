import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SCRIPT_DIR))

from extract_full_core import build_core_rankings  # noqa: E402
from extract_qualis_capes import build_qualis_rankings  # noqa: E402
from extract_sjr import build_sjr_rankings  # noqa: E402
from generate_data_js import latest_core_edition, load_verified_sjr_edition  # noqa: E402


def qualis_row(issn, title, grade):
    return {1: issn, 2: title, 4: grade}


def sjr_row(source_id, title, issns, sjr, quartile):
    return {
        'Sourceid': source_id,
        'Title': title,
        'Issn': issns,
        'SJR': sjr,
        'SJR Best Quartile': quartile,
    }


class SjrIdentityTests(unittest.TestCase):
    def test_same_title_preserves_distinct_source_records(self):
        rankings = build_sjr_rankings([
            sjr_row('100', 'Engineering', '2095-8099', '1,899', 'Q1'),
            sjr_row('200', 'Engineering', '0013-7782', '0,100', 'Q4'),
        ])

        candidates = rankings['engineering']
        self.assertIsInstance(candidates, list)
        self.assertEqual([candidate['sourceId'] for candidate in candidates], ['100', '200'])
        self.assertEqual([candidate['issns'] for candidate in candidates], [['20958099'], ['00137782']])

    def test_shared_issn_conflicting_sources_remain_ambiguous(self):
        rankings = build_sjr_rankings([
            sjr_row('300', 'COLING', '2951-2093', '0,395', 'Q2'),
            sjr_row('400', 'COLING', '2951-2093', '0,328', 'Q3'),
        ])

        candidates = rankings['coling']
        self.assertEqual(len(candidates), 2)
        self.assertEqual({candidate['sourceId'] for candidate in candidates}, {'300', '400'})
        self.assertEqual({candidate['sjr'] for candidate in candidates}, {0.395, 0.328})


class QualisIdentityTests(unittest.TestCase):
    def test_same_title_with_distinct_issns_stays_ambiguous(self):
        result = build_qualis_rankings([
            {},
            qualis_row('1234-5678', 'Shared Journal', 'A1'),
            qualis_row('8765-4321', 'Shared Journal', 'B1'),
        ])

        candidates = result['byTitle']['shared journal']
        self.assertIsInstance(candidates, list)
        self.assertEqual(
            {candidate['issns'][0]: candidate['qualis'] for candidate in candidates},
            {'12345678': 'A1', '87654321': 'B1'},
        )

    def test_same_issn_aggregates_best_grade_and_title_aliases(self):
        result = build_qualis_rankings([
            {},
            qualis_row('1234-5678', 'Journal Name', 'B2'),
            qualis_row('1234-5678', 'Journal Name', 'A2'),
            qualis_row('1234-5678', 'Earlier Journal Name', 'A3'),
        ])

        self.assertEqual(result['byIssn']['12345678'], {
            'qualis': 'A2',
            'titles': ['journal name', 'earlier journal name'],
        })
        self.assertEqual(result['byTitle']['journal name'], {
            'qualis': 'A2',
            'issns': ['12345678'],
        })
        self.assertEqual(result['byTitle']['earlier journal name']['qualis'], 'A2')

    def test_blank_issn_does_not_merge_into_identified_candidate(self):
        result = build_qualis_rankings([
            {},
            qualis_row('', 'Shared Journal', 'A1'),
            qualis_row('1234-5678', 'Shared Journal', 'B1'),
        ])

        candidates = result['byTitle']['shared journal']
        self.assertEqual(len(candidates), 2)
        self.assertIn({'qualis': 'A1', 'issns': []}, candidates)
        self.assertIn({'qualis': 'B1', 'issns': ['12345678']}, candidates)


class CoreEditionTests(unittest.TestCase):
    def test_newest_edition_wins_regardless_of_row_order(self):
        old_row = ['1', 'Example Conference', 'EX', 'CORE2023', 'A*']
        new_row = ['1', 'Example Conference', 'EX', 'ICORE2026', 'B']

        for rows in ([old_row, new_row], [new_row, old_row]):
            with self.subTest(rows=rows):
                rankings = build_core_rankings(rows)
                self.assertEqual(rankings['Example Conference'], 'B [2026]')

    def test_icore_wins_tied_source_year(self):
        rankings = build_core_rankings([
            ['1', 'Example Conference', 'EX', 'CORE2026', 'A'],
            ['1', 'Example Conference', 'EX', 'ICORE2026', 'A*'],
        ])
        self.assertEqual(rankings['Example Conference'], 'A* [2026]')


class DatasetMetadataTests(unittest.TestCase):
    def test_sjr_edition_requires_matching_dataset_hash(self):
        with tempfile.TemporaryDirectory() as directory:
            dataset = Path(directory) / 'sjr_rankings.json'
            metadata = Path(directory) / 'sjr_rankings.metadata.json'
            dataset.write_text('{"journal": {"sjr": 1.0}}\n', encoding='utf-8')
            dataset_sha256 = hashlib.sha256(dataset.read_bytes()).hexdigest()
            metadata.write_text(json.dumps({
                'edition': '2025',
                'datasetSha256': dataset_sha256,
            }), encoding='utf-8')

            self.assertEqual(load_verified_sjr_edition(dataset, metadata), '2025')

            dataset.write_text('{"journal": {"sjr": 2.0}}\n', encoding='utf-8')
            self.assertEqual(load_verified_sjr_edition(dataset, metadata), 'unknown')

    def test_core_metadata_comes_from_bundled_rank_values(self):
        self.assertEqual(
            latest_core_edition({
                'Old Conference': 'A* [2023]',
                'Current Conference': 'B [2026]',
                'National Conference': 'Nat: USA',
            }),
            '2026 + historical editions',
        )


if __name__ == '__main__':
    unittest.main()
