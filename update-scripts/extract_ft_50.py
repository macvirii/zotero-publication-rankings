import csv
import json
import os
import sys

def extract_ft_50_rankings(csv_file_path, output_file='ft_50_rankings.json'):
    """
    Extracts FT50 rankings from a CSV file and creates a dictionary.
    
    Args:
        csv_file_path: Path to the CSV file
        output_file: Path to save the JSON output (optional)
    
    Returns:
        Dictionary with journal titles (lowercase) as keys and dict with ABS Ranking
    """
    ft_50_list = []
    
    with open(csv_file_path, 'r', encoding='utf-8') as file:
        # CSV here uses , as delimiter
        reader = csv.reader(file, delimiter=',')
        header=next(reader) # Skip the first line that contains the headers

        for row in reader:
            ft_50_list.append(row[0].strip().lower())
 
    print(f"{len(ft_50_list)} journal added\n")

    # Save to JSON file
    if output_file:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(ft_50_list, f, indent=2, ensure_ascii=False)
        print(f"FT50 rankings saved in {output_file}\n")

    return ft_50_list

def generate_javascript_dict(ft_50_list, output_file = 'ft_50_rankings.js'):
    """
    Generate a JavaScript file with the FT50 rankings dictionary.
    
    Args:
        ft_50_list: An array with the journal titles
        output_file: Path to save the JavaScript file
    """

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('var ft_50_rankings = [\n')
        
        for i, (title) in enumerate(sorted(ft_50_list)):
            # Add comma for all lines except the last one
            comma = ',' if i < len(ft_50_list) - 1 else ''
            f.write(f"    '{title}'{comma}\n")
        
        f.write('];\n')
    
    print(f"FT50 JavaScript array saved to {output_file}")




if __name__ == "__main__":
    
    if len(sys.argv) < 2:
        print('!!! Filename not provided. Execute the script with the filename in the command line (e.g., python extract_xxx.py xxx-2024.csv)')
        exit()

    csv_file = sys.argv[1]
    
    if os.path.exists(csv_file):
        print('Import file exists')
    else:
        print('!!! Import file does not exist')
        exit()

    print("Extracting FT50 rankings from CSV...")
    ft_50_list = extract_ft_50_rankings(csv_file)
    
    print(f"Found {len(ft_50_list)} journals with rankings\n")
    
    # Generate JavaScript file
    generate_javascript_dict(ft_50_list)
    
    # Print some sample entries
    print("\nSample entries:")
    for i, (title) in enumerate(list(ft_50_list)[:5]):
        print(f"  {title}")



