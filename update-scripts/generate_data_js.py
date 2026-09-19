import hashlib
import json
import os
import re
from pathlib import Path


def load_verified_sjr_edition(
    dataset_path='sjr_rankings.json',
    metadata_path='sjr_rankings.metadata.json',
):
    """Return the sidecar edition only when it matches the bundled JSON."""
    try:
        with open(metadata_path, 'r', encoding='utf-8') as source:
            metadata = json.load(source)
        dataset_sha256 = hashlib.sha256(Path(dataset_path).read_bytes()).hexdigest()
    except (FileNotFoundError, json.JSONDecodeError):
        print('  WARNING: SJR metadata is unavailable; using unknown edition.')
        return 'unknown'

    if metadata.get('datasetSha256') != dataset_sha256:
        print('  WARNING: SJR metadata does not match sjr_rankings.json; using unknown edition.')
        return 'unknown'

    edition = metadata.get('edition')
    return edition if isinstance(edition, str) and edition else 'unknown'


def latest_core_edition(core_rankings):
    """Derive the global CORE label from editions in the bundled rank values."""
    years = {
        int(year)
        for rank in core_rankings.values()
        for year in re.findall(r'\[((?:19|20)\d{2})\]', str(rank))
    }
    if not years:
        return 'unknown'
    latest = str(max(years))
    return f'{latest} + historical editions' if len(years) > 1 else latest


def build_dataset_metadata(core_rankings):
    """Describe the editions actually bound to the generator inputs."""
    return {
        'sjr': {
            'label': 'SCImago Journal Rank',
            'edition': load_verified_sjr_edition(),
            'source': 'SCImago Journal & Country Rank',
        },
        'core': {
            'label': 'CORE Conference Rankings',
            'edition': latest_core_edition(core_rankings),
            'source': 'ICORE/CORE conference ranking export',
        },
        'abs': {
            'label': 'Academic Journal Guide',
            'edition': '2024',
            'source': 'Chartered Association of Business Schools',
        },
        'qualisCapes': {
            'label': 'Qualis CAPES',
            'edition': '2021-2024',
            'source': 'CAPES published classifications',
        },
        'capesNova': {
            'label': 'Nova CAPES (Area 27, local calculation)',
            'edition': '2025-2028',
            'source': 'Local classification from bundled sources',
        },
        'abdc': {
            'label': 'ABDC Journal Quality List',
            'edition': '2025',
            'source': 'Australian Business Deans Council',
        },
        'jcr': {
            'label': 'Journal Citation Reports',
            'edition': 'unknown',
            'source': 'Bundled local JCR-derived dataset',
        },
        'spell': {
            'label': 'SPELL Impact Ranking',
            'edition': '2024',
            'source': 'SPELL Impacto de Periodicos',
        },
        'scielo': {
            'label': 'SciELO Brasil Current Journals',
            'edition': 'unknown',
            'source': 'SciELO Brasil current journal list',
        },
        'ft50': {
            'label': 'Financial Times 50',
            'edition': 'unknown',
            'source': 'Bundled FT50 list',
        },
    }


def candidate_count(dataset):
    return sum(len(value) if isinstance(value, list) else 1 for value in dataset.values())


def load_json(path, description, required=True, default=None):
    print(f"Loading {description}...")
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"  Loaded {description}")
        return data
    except FileNotFoundError:
        if required:
            print(f"  ERROR: {path} not found.")
            raise
        print(f"  WARNING: {path} not found. Using empty dataset.")
        return default if default is not None else {}


def load_embedded_json(path, variable_name, description):
    """Recover a JSON-compatible variable from an existing generated data file."""
    with open(path, 'r', encoding='utf-8') as source:
        contents = source.read()

    marker = f'var {variable_name} = '
    start = contents.find(marker)
    if start < 0:
        raise ValueError(f'{variable_name} was not found in {path}')

    value, _ = json.JSONDecoder().raw_decode(contents[start + len(marker):])
    print(f"  Recovered {description} from {path}")
    return value


def load_jcr_rankings(output_path):
    """Load JCR data without ever replacing a bundled dataset with emptiness."""
    try:
        jcr_rankings = load_json('jcr_rankings.json', 'JCR rankings')
        if jcr_rankings.get('byTitle') or jcr_rankings.get('byIssn'):
            return jcr_rankings
        print('  WARNING: jcr_rankings.json is empty; recovering bundled JCR data instead.')
    except FileNotFoundError:
        print('  jcr_rankings.json not found; recovering bundled JCR data instead.')

    jcr_rankings = load_embedded_json(output_path, 'jcrRankings', 'JCR rankings')
    if not jcr_rankings.get('byTitle') and not jcr_rankings.get('byIssn'):
        raise ValueError('Refusing to generate data.js with an empty JCR dataset')
    return jcr_rankings

def generate_data_js():
    """
    Combines all rankings into the plugin's data.js file.
    Reads from sjr_rankings.json, core_rankings.json, abs_rankings.json, optional jcr_rankings.json,
    and ft_50_rankings.json (generated by extract scripts)
    and creates the data.js file for the Zotero plugin.
    """
    
    output_path = '../src/data/data.js'

    # Load SJR rankings
    try:
        sjr_rankings = load_json('sjr_rankings.json', 'SJR journal rankings')
        sjr_record_count = candidate_count(sjr_rankings)
        print(f"  SJR source records: {sjr_record_count}")
        print(f"  SJR title keys: {len(sjr_rankings)}")
    except FileNotFoundError:
        print("  Run extract_sjr.py first.")
        return
    
    # Load CORE rankings
    try:
        core_rankings = load_json('core_rankings.json', 'CORE conference rankings')
        print(f"  CORE conferences: {len(core_rankings)}")
    except FileNotFoundError:
        print("  Run extract_full_core.py first.")
        return

    dataset_metadata = build_dataset_metadata(core_rankings)

    # Load ABS rankings
    try:
        abs_rankings = load_json('abs_rankings.json', 'ABS journal rankings')
        print(f"  ABS journals: {len(abs_rankings)}")
    except FileNotFoundError:
        print("  Run extract_abs.py first.")
        return

    try:
        qualis_capes_rankings = load_json('qualis_capes_2021_2024_rankings.json', 'Qualis CAPES 2021-2024 rankings')
        print(f"  Qualis titles: {len(qualis_capes_rankings.get('byTitle', {}))}")
    except FileNotFoundError:
        print("  Run extract_qualis_capes.py first.")
        return

    try:
        abdc_rankings = load_json('abdc_rankings.json', 'ABDC rankings')
        print(f"  ABDC titles: {len(abdc_rankings.get('byTitle', {}))}")
    except FileNotFoundError:
        print("  Run extract_abdc.py first.")
        return

    jcr_rankings = load_jcr_rankings(output_path)
    print(f"  JCR titles: {len(jcr_rankings.get('byTitle', {}))}")

    try:
        spell_rankings = load_json('spell_rankings.json', 'SPELL rankings')
        print(f"  SPELL titles: {len(spell_rankings.get('byTitle', {}))}")
    except FileNotFoundError:
        print("  Run extract_spell.py first.")
        return

    try:
        scielo_rankings = load_json('scielo_rankings.json', 'SciELO rankings')
        print(f"  SciELO titles: {len(scielo_rankings.get('byTitle', {}))}")
    except FileNotFoundError:
        print("  Run extract_scielo.py first.")
        return
    
    # Load FT50 rankings
    print("Loading FT50 rankings...")
    try:
        ft_50_rankings = ''
        with open('ft_50_rankings.json', 'r', encoding='utf-8') as f:
            ft_50_rankings = f.read()
    
        print(f"  Loaded {len(ft_50_rankings.splitlines()) - 2} FT50 journal rankings")
    except FileNotFoundError:
        print("  ERROR: ft_50_rankings.json not found. Run extract_ft_50.py first.")
        return
    
    # Generate data.js file
    print(f"\nGenerating {output_path}...")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        # Write header
        f.write('// Combined publication ranking datasets\n')
        f.write('// Auto-generated data file from update-scripts/extract_*.py\n')
        f.write('// Use this with rankings.js\n')
        f.write('\n')

        f.write('// Edition and source labels for runtime provenance displays\n')
        f.write('var rankingDatasetMetadata = ')
        json.dump(dataset_metadata, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        # Write SJR rankings
        f.write(f"// SJR Journal Rankings (edition {dataset_metadata['sjr']['edition']})\n")
        f.write('// Total source records: ' + str(sjr_record_count) + '\n')
        f.write('// Total title keys: ' + str(len(sjr_rankings)) + '\n')
        f.write('var sjrRankings = ')
        json.dump(sjr_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')
        
        # Write CORE rankings
        f.write(f"// CORE Conference Rankings ({dataset_metadata['core']['edition']})\n")
        f.write('// Total conferences: ' + str(len(core_rankings)) + '\n')
        f.write('var coreRankings = ')
        json.dump(core_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        # Write ABS rankings
        f.write('// ABS Rankings\n')
        f.write('// Total journals: ' + str(len(abs_rankings)) + '\n')
        f.write('var absRankings = ')
        json.dump(abs_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        # Write Qualis CAPES rankings
        f.write('// Qualis CAPES Rankings (2021-2024)\n')
        f.write('// Total journal titles: ' + str(len(qualis_capes_rankings.get('byTitle', {}))) + '\n')
        f.write('var qualisCapes2021Rankings = ')
        json.dump(qualis_capes_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        # Write CAPES source rankings
        f.write('// ABDC Journal Quality List (2025)\n')
        f.write('// Total journal titles: ' + str(len(abdc_rankings.get('byTitle', {}))) + '\n')
        f.write('var abdcRankings = ')
        json.dump(abdc_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        f.write('// JCR Rankings\n')
        f.write('// Total journal titles: ' + str(len(jcr_rankings.get('byTitle', {}))) + '\n')
        f.write('var jcrRankings = ')
        json.dump(jcr_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        f.write('// SPELL Rankings (2024 impact percentiles)\n')
        f.write('// Total journal titles: ' + str(len(spell_rankings.get('byTitle', {}))) + '\n')
        f.write('var spellRankings = ')
        json.dump(spell_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')

        f.write('// SciELO Brasil Current Journals\n')
        f.write('// Total journal titles: ' + str(len(scielo_rankings.get('byTitle', {}))) + '\n')
        f.write('var scieloRankings = ')
        json.dump(scielo_rankings, f, indent=2, ensure_ascii=False)
        f.write(';\n\n')
    
        # Write FT50 rankings
        # **** Note that ft_50_rankings is not a json formated string ****
        f.write('// FT50 Rankings\n')
        f.write('// Total journals: ' + str(len(ft_50_rankings.splitlines()) - 2) + '\n')
        f.write('var ft50Rankings = ')
        f.write(ft_50_rankings)
        f.write(';\n\n');

    # Calculate file size
    file_size = os.path.getsize(output_path)
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"\n✓ Successfully generated {output_path}")
    print(f"  File size: {file_size_mb:.2f} MB")
    print(f"  SJR source records: {sjr_record_count:,}")
    print(f"  SJR title keys: {len(sjr_rankings):,}")
    print(f"  CORE conferences: {len(core_rankings):,}")
    print(f"  ABS journals: {len(abs_rankings):,}")
    print(f"  FT50 journals: {len(ft_50_rankings.splitlines()) - 2}")
    print(f"  Qualis titles: {len(qualis_capes_rankings.get('byTitle', {})):,}")
    print(f"  ABDC titles: {len(abdc_rankings.get('byTitle', {})):,}")
    print(f"  JCR titles: {len(jcr_rankings.get('byTitle', {})):,}")
    print(f"  SPELL titles: {len(spell_rankings.get('byTitle', {})):,}")
    print(f"  SciELO titles: {len(scielo_rankings.get('byTitle', {})):,}")
    print(f"  Total entries: {sjr_record_count + len(core_rankings) + len(abs_rankings) + len(qualis_capes_rankings.get('byTitle', {})) + len(abdc_rankings.get('byTitle', {})) + len(jcr_rankings.get('byTitle', {})) + len(spell_rankings.get('byTitle', {})) + len(scielo_rankings.get('byTitle', {})) + len(ft_50_rankings.splitlines()) - 2:,}")
    
    print("\nNext steps:")
    print("  1. cd zotero-rankings-plugin")
    print("  2. .\\build.ps1")
    print("  3. Install the generated .xpi file in Zotero")

if __name__ == '__main__':
    generate_data_js()
