import argparse
import csv
import json
import os
import re
import sys

from xlsx_utils import iter_xlsx_rows


QUARTILE_VALUE = {
    'Q1': 4,
    'Q2': 3,
    'Q3': 2,
    'Q4': 1,
}


def canonical_header(value):
    text = (value or '').strip().lower().replace('&', 'and')
    return re.sub(r'[^a-z0-9]+', '', text)


def normalize_issn(value):
    cleaned = re.sub(r'[^0-9Xx]', '', value or '').upper()
    return cleaned if len(cleaned) == 8 else ''


def extract_issns(value):
    issns = []
    for match in re.findall(r'[0-9Xx]{4}[- ]?[0-9Xx]{4}', value or ''):
        issn = normalize_issn(match)
        if issn and issn not in issns:
            issns.append(issn)
    return issns


def normalize_title(value):
    return ' '.join((value or '').strip().lower().split())


def normalize_quartile(value):
    match = re.search(r'\bQ\s*([1-4])\b', value or '', flags=re.I)
    return 'Q' + match.group(1) if match else ''


def normalize_number(value):
    text = (value or '').strip()
    if not text or text.upper() in {'N/A', 'NA', 'NOT AVAILABLE', '-'}:
        return ''

    if ',' in text and '.' not in text:
        text = text.replace(',', '.')
    else:
        text = text.replace(',', '')

    try:
        number = float(text)
    except ValueError:
        return (value or '').strip()

    if number.is_integer():
        return int(number)
    return number


def read_csv_rows(file_path):
    for encoding in ('utf-8-sig', 'utf-8', 'latin-1'):
        try:
            with open(file_path, 'r', encoding=encoding, newline='') as source:
                sample = source.read(8192)
                source.seek(0)
                try:
                    dialect = csv.Sniffer().sniff(sample, delimiters=',;\t')
                except csv.Error:
                    dialect = csv.excel
                return [row for row in csv.reader(source, dialect)]
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError('utf-8', b'', 0, 1, 'Unable to decode CSV file')


def read_xlsx_rows(file_path, sheet_name=None):
    rows = []
    for row in iter_xlsx_rows(file_path, sheet_name=sheet_name):
        max_column = max(row.keys())
        rows.append([row.get(index, '') for index in range(1, max_column + 1)])
    return rows


def read_rows(file_path, sheet_name=None):
    extension = os.path.splitext(file_path)[1].lower()
    if extension == '.csv':
        return read_csv_rows(file_path)
    if extension == '.xlsx':
        return read_xlsx_rows(file_path, sheet_name=sheet_name)
    raise ValueError('Unsupported file type. Use a CSV or XLSX export.')


def detect_columns(header):
    columns = {
        'title': None,
        'quartile': None,
        'jif': None,
        'category': None,
        'rank': None,
        'percentile': None,
        'year': None,
        'issns': [],
    }

    title_headers = {
        'journalname',
        'journaltitle',
        'fulljournaltitle',
        'sourcetitle',
        'title',
        'name',
    }
    jif_headers = {
        'jif',
        'journalimpactfactor',
        'impactfactor',
    }
    rank_headers = {
        'rank',
        'jifrank',
        'rankincategory',
        'rankinjcrcategory',
    }
    percentile_headers = {
        'jifpercentile',
        'percentile',
        'journalimpactfactorpercentile',
    }
    year_headers = {
        'year',
        'jcryear',
    }

    for index, raw_header in enumerate(header):
        name = canonical_header(raw_header)
        if not name:
            continue

        if columns['title'] is None and (
            name in title_headers or
            ('journal' in name and ('name' in name or 'title' in name))
        ):
            columns['title'] = index

        if 'issn' in name:
            columns['issns'].append(index)

        if columns['quartile'] is None and 'quartile' in name:
            columns['quartile'] = index

        if columns['jif'] is None and (
            name in jif_headers or
            name.endswith('jif') or
            ('impactfactor' in name and 'quartile' not in name and 'percentile' not in name and 'rank' not in name)
        ):
            columns['jif'] = index

        if columns['category'] is None and (
            name in {'category', 'jcrcategory', 'webofsciencecategory', 'woscategory', 'subjectcategory'} or
            ('category' in name and 'quartile' not in name and 'rank' not in name)
        ):
            columns['category'] = index

        if columns['rank'] is None and (
            name in rank_headers or
            ('rank' in name and 'quartile' not in name)
        ):
            columns['rank'] = index

        if columns['percentile'] is None and name in percentile_headers:
            columns['percentile'] = index

        if columns['year'] is None and name in year_headers:
            columns['year'] = index

    return columns


def find_header(rows):
    for row_number, row in enumerate(rows):
        columns = detect_columns(row)
        if columns['title'] is not None and columns['quartile'] is not None:
            return row_number, columns
    raise ValueError('Could not find a header row with journal title and quartile columns.')


def row_value(row, index):
    if index is None or index >= len(row):
        return ''
    return (row[index] or '').strip()


def better_quartile(current, candidate):
    if not current:
        return candidate
    if not candidate:
        return current
    return candidate if QUARTILE_VALUE[candidate] > QUARTILE_VALUE[current] else current


def merge_entry(existing, incoming):
    if not existing:
        return incoming

    best_quartile = better_quartile(existing.get('quartile', ''), incoming.get('quartile', ''))
    existing['jcr'] = best_quartile
    existing['quartile'] = best_quartile

    if incoming.get('jif') not in (None, ''):
        existing['jif'] = incoming['jif']
    if incoming.get('year') and not existing.get('year'):
        existing['year'] = incoming['year']

    for issn in incoming.get('issns', []):
        if issn not in existing['issns']:
            existing['issns'].append(issn)

    for category in incoming.get('categories', []):
        if category not in existing['categories']:
            existing['categories'].append(category)

    return existing


def make_category(row, columns, quartile):
    category = {}
    name = row_value(row, columns['category'])
    rank = row_value(row, columns['rank'])
    percentile = row_value(row, columns['percentile'])

    if name:
        category['name'] = name
    if quartile:
        category['quartile'] = quartile
    if rank:
        category['rank'] = rank
    if percentile:
        category['percentile'] = percentile

    return category


def extract_jcr_rankings(file_path, output_file='jcr_rankings.json', sheet_name=None):
    rows = read_rows(file_path, sheet_name=sheet_name)
    header_row, columns = find_header(rows)

    by_title = {}
    skipped = 0

    for row in rows[header_row + 1:]:
        title = normalize_title(row_value(row, columns['title']))
        quartile = normalize_quartile(row_value(row, columns['quartile']))

        if not title or not quartile:
            skipped += 1
            continue

        issns = []
        for issn_column in columns['issns']:
            for issn in extract_issns(row_value(row, issn_column)):
                if issn not in issns:
                    issns.append(issn)

        category = make_category(row, columns, quartile)
        entry = {
            'jcr': quartile,
            'quartile': quartile,
            'issns': issns,
            'categories': [category] if category else [],
        }

        jif = normalize_number(row_value(row, columns['jif']))
        if jif != '':
            entry['jif'] = jif

        year = row_value(row, columns['year'])
        if year:
            entry['year'] = year

        by_title[title] = merge_entry(by_title.get(title), entry)

    by_issn = {}
    for title, entry in by_title.items():
        for issn in entry.get('issns', []):
            by_issn[issn] = {
                'title': title,
                'jcr': entry.get('jcr'),
                'quartile': entry.get('quartile'),
                'jif': entry.get('jif', ''),
                'year': entry.get('year', ''),
                'categories': entry.get('categories', []),
            }

    result = {
        'byTitle': by_title,
        'byIssn': by_issn,
    }

    with open(output_file, 'w', encoding='utf-8') as output:
        json.dump(result, output, indent=2, ensure_ascii=False)

    print(f'JCR rankings saved in {output_file}')
    print(f'  Titles: {len(by_title)}')
    print(f'  ISSNs: {len(by_issn)}')
    print(f'  Skipped rows: {skipped}')
    return result


def main():
    parser = argparse.ArgumentParser(
        description='Extract rankings from an authorized local JCR CSV/XLSX export.'
    )
    parser.add_argument('input_file', help='Path to the JCR CSV or XLSX export')
    parser.add_argument(
        'output_file',
        nargs='?',
        default='jcr_rankings.json',
        help='Output JSON file, default: jcr_rankings.json'
    )
    parser.add_argument('--sheet', help='XLSX sheet name. Defaults to the first sheet.')
    args = parser.parse_args()

    if not os.path.exists(args.input_file):
        print('Import file does not exist')
        sys.exit(1)

    extract_jcr_rankings(args.input_file, args.output_file, sheet_name=args.sheet)


if __name__ == '__main__':
    main()
