import csv
import hashlib
import json
import os
import re
from pathlib import Path


def normalize_issn(value):
    cleaned = re.sub(r'[^0-9Xx]', '', value or '').upper()
    return cleaned if len(cleaned) == 8 else ''


def find_latest_sjr_source(source_dir='source-data'):
    """Return the newest year-labelled SCImago CSV in ``source_dir``."""
    candidates = []
    for path in Path(source_dir).glob('scimagojr *.csv'):
        match = re.search(r'(19|20)\d{2}', path.name)
        if match:
            candidates.append((int(match.group(0)), path))

    if not candidates:
        raise FileNotFoundError(f'No year-labelled scimagojr CSV found in {source_dir}')

    return max(candidates, key=lambda candidate: (candidate[0], candidate[1].name))[1]


def write_sjr_metadata(csv_file_path, output_file, metadata_file):
    """Bind an SJR edition label to the exact generated JSON bytes."""
    match = re.search(r'(19|20)\d{2}', Path(csv_file_path).name)
    edition = match.group(0) if match else 'unknown'
    dataset_sha256 = hashlib.sha256(Path(output_file).read_bytes()).hexdigest()
    metadata = {
        'edition': edition,
        'datasetSha256': dataset_sha256,
        'sourceFile': Path(csv_file_path).name,
    }
    with open(metadata_file, 'w', encoding='utf-8') as output:
        json.dump(metadata, output, indent=2, ensure_ascii=False)
        output.write('\n')
    print(f'SJR metadata saved to {metadata_file}')


def build_sjr_rankings(rows):
    """Preserve every ranked SCImago source record under its title key."""
    candidates_by_title = {}

    for row in rows:
        title = row.get('Title', '').strip('"').strip().lower()
        sjr_value = row.get('SJR', '').strip()
        quartile = row.get('SJR Best Quartile', '').strip()
        if not title:
            continue

        issns = [
            issn
            for issn in [normalize_issn(part) for part in row.get('Issn', '').split(',')]
            if issn
        ]

        try:
            entry = {
                'sjr': float(sjr_value.replace(',', '.')),
                'quartile': quartile if quartile else '-',
                'issns': issns,
            }
        except ValueError:
            print(f"Warning: Could not convert SJR value '{sjr_value}' for journal '{title}'")
            continue

        source_id = row.get('Sourceid', '').strip()
        if source_id:
            entry['sourceId'] = source_id
        candidates_by_title.setdefault(title, []).append(entry)

    return {
        title: candidates[0] if len(candidates) == 1 else candidates
        for title, candidates in candidates_by_title.items()
    }


def extract_sjr_rankings(
    csv_file_path,
    output_file='sjr_rankings.json',
    metadata_file=None,
):
    """
    Extract SJR rankings and quartiles from the scimagojr CSV file and create a dictionary.
    
    Args:
        csv_file_path: Path to the scimagojr CSV file
        output_file: Path to save the JSON output (optional)
    
    Returns:
        Dictionary with journal titles (lowercase) as keys and dict with SJR + quartile as values
    """
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        # CSV uses semicolon as delimiter
        reader = csv.DictReader(file, delimiter=';')
        sjr_dict = build_sjr_rankings(reader)
    
    # Save to JSON file if output_file is specified
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sjr_dict, f, indent=2, ensure_ascii=False)
        print(f"SJR rankings saved to {output_file}")
        if metadata_file:
            write_sjr_metadata(csv_file_path, output_file, metadata_file)
    
    return sjr_dict

def generate_javascript_dict(sjr_dict, output_file='sjr_rankings.js'):
    """
    Generate a JavaScript file with the SJR rankings and quartiles dictionary.
    
    Args:
        sjr_dict: Dictionary with journal titles and SJR data (sjr + quartile)
        output_file: Path to save the JavaScript file
    """
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('var sjr_rankings = ')
        json.dump(sjr_dict, f, indent=2, ensure_ascii=False)
        f.write(';\n')
    
    print(f"JavaScript dictionary saved to {output_file}")

if __name__ == "__main__":
    try:
        csv_file = find_latest_sjr_source()
    except FileNotFoundError as error:
        print(f'!!! {error}')
        raise SystemExit(1)
    
    if os.path.exists(csv_file):
        print(f'Import file exists: {csv_file}')
    else:
        print('!!! Import file does not exist')
        exit()

    print("Extracting SJR rankings from CSV...")
    sjr_dict = extract_sjr_rankings(
        csv_file,
        metadata_file='sjr_rankings.metadata.json',
    )
    
    record_count = sum(len(value) if isinstance(value, list) else 1 for value in sjr_dict.values())
    print(f"Found {record_count} SJR source records across {len(sjr_dict)} title keys")
    
    # Generate JavaScript file
    generate_javascript_dict(sjr_dict)
    
    # Print some sample entries
    print("\nSample entries:")
    for title, data in list(sjr_dict.items())[:5]:
        sample = data[0] if isinstance(data, list) else data
        print(f"  {title}: SJR={sample['sjr']}, Quartile={sample['quartile']}")
