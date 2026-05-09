import json
import re
from html import unescape
from urllib.request import Request, urlopen


SCIELO_URL = 'https://www.scielo.br/journals/alpha?status=current'


def normalize_issn(value):
    cleaned = re.sub(r'[^0-9Xx]', '', value or '').upper()
    return cleaned if len(cleaned) == 8 else ''


def normalize_title(value):
    return ' '.join((value or '').strip().lower().split())


def extract_scielo_rankings(output_file='scielo_rankings.json'):
    request = Request(SCIELO_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urlopen(request, timeout=60) as response:
        html = response.read().decode('utf-8', errors='replace')

    by_title = {}
    by_issn = {}
    rows = re.findall(r'<tr>\s*<td colspan="2">(.*?)</td>\s*</tr>', html, flags=re.S)

    for row in rows:
        title_match = re.search(r'<strong class="journalTitle">(.*?)</strong>', row, flags=re.S)
        if not title_match:
            continue

        title = normalize_title(unescape(re.sub(r'<.*?>', '', title_match.group(1))))
        issns = []
        for raw_issn in re.findall(r'journal=([0-9Xx\-]+)', row):
            issn = normalize_issn(raw_issn)
            if issn and issn not in issns:
                issns.append(issn)

        by_title[title] = {'scielo': True, 'issns': issns}
        for issn in issns:
            by_issn[issn] = {'scielo': True, 'title': title}

    result = {'byTitle': by_title, 'byIssn': by_issn}
    with open(output_file, 'w', encoding='utf-8') as output:
        json.dump(result, output, indent=2, ensure_ascii=False)

    print(f'SciELO rankings saved in {output_file}')
    print(f'  Titles: {len(by_title)}')
    print(f'  ISSNs: {len(by_issn)}')
    return result


if __name__ == '__main__':
    extract_scielo_rankings()
