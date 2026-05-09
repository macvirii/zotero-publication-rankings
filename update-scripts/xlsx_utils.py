from zipfile import ZipFile
from xml.etree import ElementTree as ET


NS = {
    'a': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}


def _shared_strings(zip_file):
    if 'xl/sharedStrings.xml' not in zip_file.namelist():
        return []

    root = ET.fromstring(zip_file.read('xl/sharedStrings.xml'))
    strings = []
    for si in root.findall('a:si', NS):
        strings.append(''.join(
            text.text or ''
            for text in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
        ))
    return strings


def _column_index(cell_ref):
    letters = ''.join(char for char in cell_ref if char.isalpha())
    index = 0
    for char in letters:
        index = index * 26 + ord(char.upper()) - 64
    return index


def iter_xlsx_rows(file_path, sheet_name=None):
    with ZipFile(file_path) as zip_file:
        shared = _shared_strings(zip_file)
        workbook = ET.fromstring(zip_file.read('xl/workbook.xml'))
        rels = ET.fromstring(zip_file.read('xl/_rels/workbook.xml.rels'))
        rel_by_id = {rel.attrib['Id']: rel.attrib['Target'] for rel in rels}

        for sheet in workbook.findall('a:sheets/a:sheet', NS):
            current_name = sheet.attrib['name']
            if sheet_name and current_name != sheet_name:
                continue

            rel_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            target = rel_by_id[rel_id]
            sheet_path = 'xl/' + target.lstrip('/') if not target.startswith('xl/') else target
            root = ET.fromstring(zip_file.read(sheet_path))

            for row in root.findall('a:sheetData/a:row', NS):
                values = {}
                for cell in row.findall('a:c', NS):
                    col = _column_index(cell.attrib.get('r', ''))
                    cell_type = cell.attrib.get('t')
                    value = cell.find('a:v', NS)
                    inline_string = cell.find('a:is', NS)

                    if cell_type == 's' and value is not None:
                        text = shared[int(value.text)]
                    elif cell_type == 'inlineStr' and inline_string is not None:
                        text = ''.join(
                            part.text or ''
                            for part in inline_string.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')
                        )
                    elif value is not None:
                        text = value.text or ''
                    else:
                        text = ''

                    values[col] = text.strip()

                if values:
                    yield values
            return

        raise ValueError(f'Sheet not found: {sheet_name}')
