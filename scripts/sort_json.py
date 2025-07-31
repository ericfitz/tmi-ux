# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

import json
import os
import argparse
from collections import OrderedDict

def sort_json(obj):
    """Recursively sort a JSON object by keys."""
    if isinstance(obj, dict):
        return OrderedDict(
            sorted((k, sort_json(v)) for k, v in obj.items())
        )
    if isinstance(obj, list):
        return [sort_json(item) for item in obj]
    return obj

def load_and_sort_json(file_path):
    """Load a JSON file and sort its keys."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return sort_json(data)
    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return None
    except json.JSONDecodeError:
        print(f"Error: File {file_path} is not valid JSON.")
        return None

def get_all_keys(obj, prefix=''):
    """Recursively collect all keys in a JSON object with their full path."""
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.add(full_key)
            keys.update(get_all_keys(value, full_key))
    return keys

def compare_keys(data1, data2, file1_name, file2_name):
    """Compare keys between two JSON objects and report differences."""
    keys1 = get_all_keys(data1)
    keys2 = get_all_keys(data2)
    
    missing_in_file2 = keys1 - keys2
    missing_in_file1 = keys2 - keys1
    
    if missing_in_file2:
        print(f"\nKeys present in {file1_name} but missing in {file2_name}:")
        for key in sorted(missing_in_file2):
            print(f"  {key}")
    else:
        print(f"\nNo keys missing in {file2_name}.")
        
    if missing_in_file1:
        print(f"\nKeys present in {file2_name} but missing in {file1_name}:")
        for key in sorted(missing_in_file1):
            print(f"  {key}")
    else:
        print(f"\nNo keys missing in {file1_name}.")

def confirm_overwrite(file_path, auto_yes):
    """Check if file exists and prompt for overwrite permission unless auto_yes is True."""
    if os.path.exists(file_path):
        if auto_yes:
            return True
        response = input(f"File {file_path} already exists. Overwrite? (y/n): ").strip().lower()
        return response == 'y'
    return True

def rename_and_save_json(data, original_path, auto_yes):
    """Rename original file to old- prefix and save sorted JSON with original filename."""
    # Define paths
    dir_name = os.path.dirname(original_path) or '.'
    base_name = os.path.basename(original_path)
    old_path = os.path.join(dir_name, f"old-{base_name}")
    
    # Check if old- file exists and prompt for overwrite
    if not confirm_overwrite(old_path, auto_yes):
        print(f"Error: Cannot overwrite {old_path}. Operation aborted.")
        return False
    
    # Check if original path (for new sorted file) exists and prompt for overwrite
    if not confirm_overwrite(original_path, auto_yes):
        print(f"Error: Cannot overwrite {original_path}. Operation aborted.")
        return False
    
    # Rename original file
    if os.path.exists(original_path):
        try:
            os.rename(original_path, old_path)
            print(f"Renamed {original_path} to {old_path}")
        except OSError as e:
            print(f"Error: Failed to rename {original_path} to {old_path}: {e}")
            return False
    
    # Save sorted JSON
    try:
        with open(original_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Saved sorted JSON to {original_path}")
        return True
    except OSError as e:
        print(f"Error: Failed to save sorted JSON to {original_path}: {e}")
        return False

def main(file1_path, file2_path=None, auto_yes=False):
    # Load and sort first JSON file
    data1 = load_and_sort_json(file1_path)
    if data1 is None:
        return False
    
    # Single file mode: sort and save
    if file2_path is None:
        return rename_and_save_json(data1, file1_path, auto_yes)
    
    # Two file mode: sort, compare, and save both
    data2 = load_and_sort_json(file2_path)
    if data2 is None:
        return False
    
    # Compare keys
    compare_keys(data1, data2, file1_path, file2_path)
    
    # Rename and save sorted JSON files
    success1 = rename_and_save_json(data1, file1_path, auto_yes)
    success2 = rename_and_save_json(data2, file2_path, auto_yes)
    
    return success1 and success2

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sort one JSON file or sort and compare two JSON files.")
    parser.add_argument("file1", help="Path to first JSON file")
    parser.add_argument("file2", nargs='?', help="Path to second JSON file (optional)")
    parser.add_argument("-y", "--yes", action="store_true", help="Automatically overwrite files without prompting")
    args = parser.parse_args()
    
    success = main(args.file1, args.file2, args.yes)
    if not success:
        exit(1)