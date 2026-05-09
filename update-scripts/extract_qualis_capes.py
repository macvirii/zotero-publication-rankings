import json
import os
import re
import sys

from xlsx_utils import iter_xlsx_rows


QUALIS_ORDER = {
    'A1': 8,
    'A2': 7,
    'A3': 6,
    'A4': 5,
    'B1': 4,
    'B2': 3,
    'B3': 2,
    'B4': 1,
    'C': 0,
}


def normalize_issn(value):
    cleaned = re.sub(r'[^0-9Xx]', '', value or '').upper()
    return cleaned if len(cleaned) == 8 else ''


def normalize_title(value):
    return ' '.join((value or '').strip().lower().split())


def better_qualis(current, candidate):
    if not current:
        return candidate
    return candidate if QUALIS_ORDER.get(candidate, -1) > QUALIS_ORDER.get(current, -1) else current


def extract_qualis_capes(xlsx_file_path, output_file='qualis_capes_2021_2024_rankings.json'):
    by_title = {}
    by_issn = {}

    for row_number, row in enumerate(iter_xlsx_rows(xlsx_file_path, sheet_name='RelatorioQualis'), start=1):
        if row_number == 1:
            continue

        issn = normalize_issn(row.get(1, ''))
        title = normalize_title(row.get(2, ''))
        qualis = row.get(4, '').strip().upper()

        if not title or qualis not in QUALIS_ORDER:
            continue

        title_entry = by_title.setdefault(title, {'qualis': qualis, 'issns': []})
        title_entry['qualis'] = better_qualis(title_entry['qualis'], qualis)
        if issn and issn not in title_entry['issns']:
            title_entry['issns'].append(issn)

        if issn:
            issn_entry = by_issn.setdefault(issn, {'qualis': qualis, 'titles': []})
            issn_entry['qualis'] = better_qualis(issn_entry['qualis'], qualis)
            if title and title not in issn_entry['titles']:
                issn_entry['titles'].append(title)

    result = {'byTitle': by_title, 'byIssn': by_issn}
    with open(output_file, 'w', encoding='utf-8') as output:
        json.dump(result, output, indent=2, ensure_ascii=False)

    print(f'Qualis CAPES 2021-2024 saved in {output_file}')
    print(f'  Titles: {len(by_title)}')
    print(f'  ISSNs: {len(by_issn)}')
    return result


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extract_qualis_capes.py classificacoes.xlsx')
        sys.exit(1)

    if not os.path.exists(sys.argv[1]):
        print('Import file does not exist')
        sys.exit(1)

    extract_qualis_capes(sys.argv[1])
