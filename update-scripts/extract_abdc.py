import json
import os
import re
import sys

from xlsx_utils import iter_xlsx_rows


def normalize_issn(value):
    cleaned = re.sub(r'[^0-9Xx]', '', value or '').upper()
    return cleaned if len(cleaned) == 8 else ''


def normalize_title(value):
    return ' '.join((value or '').strip().lower().split())


def extract_abdc_rankings(xlsx_file_path, output_file='abdc_rankings.json'):
    by_title = {}
    by_issn = {}

    for row_number, row in enumerate(iter_xlsx_rows(xlsx_file_path, sheet_name='2025 JQL'), start=1):
        if row_number <= 8:
            continue

        title = normalize_title(row.get(2, ''))
        print_issn = normalize_issn(row.get(4, ''))
        online_issn = normalize_issn(row.get(5, ''))
        rating = row.get(8, '').strip().upper()

        if not title or rating not in {'A*', 'A', 'B', 'C'}:
            continue

        issns = [issn for issn in [print_issn, online_issn] if issn]
        by_title[title] = {'abdc': rating, 'issns': issns}
        for issn in issns:
            by_issn[issn] = {'abdc': rating, 'title': title}

    result = {'byTitle': by_title, 'byIssn': by_issn}
    with open(output_file, 'w', encoding='utf-8') as output:
        json.dump(result, output, indent=2, ensure_ascii=False)

    print(f'ABDC rankings saved in {output_file}')
    print(f'  Titles: {len(by_title)}')
    print(f'  ISSNs: {len(by_issn)}')
    return result


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python extract_abdc.py ABDC-JQL.xlsx')
        sys.exit(1)

    if not os.path.exists(sys.argv[1]):
        print('Import file does not exist')
        sys.exit(1)

    extract_abdc_rankings(sys.argv[1])
