import json
import math
import re
from html import unescape
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SPELL_URL = 'https://www.spell.org.br/impacto/index'


def normalize_title(value):
    return ' '.join((value or '').strip().lower().split())


def fetch_page(page):
    data = urlencode({
        'area': '',
        'ano': '2024',
        'keyword': '',
        'ordem': 'impacto_5anos_semautocitacao',
        'pg': str(page),
    }).encode('utf-8')
    request = Request(SPELL_URL, data=data, headers={
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/x-www-form-urlencoded',
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Referer': 'https://www.spell.org.br/impacto',
    })
    with urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode('utf-8'))


def extract_titles(html):
    return [
        normalize_title(unescape(match))
        for match in re.findall(r'<td class="titulo"><a [^>]+>(.*?)</a>', html, flags=re.S)
    ]


def extract_spell_rankings(output_file='spell_rankings.json'):
    titles = []
    page = 1

    while True:
        payload = fetch_page(page)
        page_titles = extract_titles(payload.get('listaImpacto', ''))
        if not page_titles:
            break

        titles.extend(page_titles)
        pagination = payload.get('paginacao', '')
        if f'rel="{page + 1}"' not in pagination:
            break
        page += 1

    total = len(titles)
    top_10 = math.ceil(total * 0.10)
    top_40 = math.ceil(total * 0.40)
    top_70 = math.ceil(total * 0.70)

    by_title = {}
    for index, title in enumerate(titles, start=1):
        if index <= top_10:
            spell_class = 'top10'
        elif index <= top_40:
            spell_class = 'next30'
        elif index <= top_70:
            spell_class = 'next30_2'
        else:
            spell_class = 'bottom30'

        by_title[title] = {'spell': spell_class, 'rank': index}

    result = {'byTitle': by_title}
    with open(output_file, 'w', encoding='utf-8') as output:
        json.dump(result, output, indent=2, ensure_ascii=False)

    print(f'SPELL rankings saved in {output_file}')
    print(f'  Titles: {len(by_title)}')
    return result


if __name__ == '__main__':
    extract_spell_rankings()
