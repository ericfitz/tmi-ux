#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

"""
Tool to sort JSON files and optionally compare keys between JSON files.
"""

import json
import os
import argparse
import glob
import tempfile
from collections import OrderedDict


def sort_json(obj):
    """Recursively sort a JSON object by keys."""
    if isinstance(obj, dict):
        return OrderedDict(sorted((k, sort_json(v)) for k, v in obj.items()))
    if isinstance(obj, list):
        return [sort_json(item) for item in obj]
    return obj


def load_and_sort_json(file_path):
    """Load a JSON file and sort its keys."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return sort_json(data)
    except FileNotFoundError:
        print(f"Error: File {file_path} not found.")
        return None
    except json.JSONDecodeError:
        print(f"Error: File {file_path} is not valid JSON.")
        return None


def get_all_keys(obj, prefix="", skip_comments=True):
    """Recursively collect all keys in a JSON object with their full path.

    Args:
        obj: The JSON object to traverse
        prefix: Current key path prefix
        skip_comments: If True, skip keys ending in '.comment'
    """
    keys = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            # Skip .comment keys - these are translator notes, not translatable content
            if skip_comments and full_key.endswith(".comment"):
                continue
            keys.add(full_key)
            keys.update(get_all_keys(value, full_key, skip_comments))
    return keys


def get_leaf_values(obj, prefix="", skip_comments=True):
    """Recursively collect all leaf key-value pairs (non-dict values) with their full path.

    Args:
        obj: The JSON object to traverse
        prefix: Current key path prefix
        skip_comments: If True, skip keys ending in '.comment'
    """
    values = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            # Skip .comment keys - these are translator notes, not translatable content
            if skip_comments and full_key.endswith(".comment"):
                continue
            if isinstance(value, dict):
                values.update(get_leaf_values(value, full_key, skip_comments))
            else:
                values[full_key] = value
    return values


def get_non_translatable_keys(obj, prefix=""):
    """Find keys that have a .comment indicating they should not be translated.

    Looks for comment keys (ending in .comment) whose value contains
    "should not be translated." and returns the set of associated keys.
    """
    non_translatable = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                non_translatable.update(get_non_translatable_keys(value, full_key))
            elif (
                full_key.endswith(".comment")
                and isinstance(value, str)
                and "should not be translated." in value
            ):
                # The associated key is the comment key without the .comment suffix
                associated_key = full_key[: -len(".comment")]
                non_translatable.add(associated_key)
    return non_translatable


def load_allowlist(main_file_path):
    """Load the i18n allowlist file if it exists.

    The allowlist is a JSON file with language codes as keys and arrays of
    key paths as values. The special key '*' contains keys that apply to all
    languages.

    Returns:
        dict: The allowlist data, or empty dict if file doesn't exist
    """
    # Look for allowlist in the same directory as the main file
    allowlist_path = os.path.join(os.path.dirname(main_file_path), "i18n-allowlist.json")
    if os.path.exists(allowlist_path):
        try:
            with open(allowlist_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Warning: Failed to load allowlist from {allowlist_path}: {e}")
    return {}


def get_allowed_keys(allowlist, lang_code):
    """Get the set of allowed keys for a specific language.

    Args:
        allowlist: The allowlist dictionary
        lang_code: The language code (e.g., 'de-DE')

    Returns:
        set: Keys that are allowed to be identical to English
    """
    allowed = set()
    # Add global allowlist keys (apply to all languages)
    if "*" in allowlist:
        allowed.update(allowlist["*"])
    # Add language-specific allowlist keys
    if lang_code in allowlist:
        allowed.update(allowlist[lang_code])
    return allowed


def compare_keys(data1, data2, file1_name, file2_name, allowlist=None):
    """Compare keys between two JSON objects and report differences."""
    keys1 = get_all_keys(data1)
    keys2 = get_all_keys(data2)

    # Get keys marked as non-translatable via .comment
    non_translatable = get_non_translatable_keys(data1)

    missing_in_file2 = keys1 - keys2 - non_translatable
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

    # Check for untranslated placeholders (keys that exist in both but have identical values)
    values1 = get_leaf_values(data1)
    values2 = get_leaf_values(data2)

    # Get allowed keys from allowlist based on the target language file
    allowed_keys = set()
    if allowlist:
        # Extract language code from file2_name (e.g., 'de-DE' from '.../de-DE.json')
        lang_code = os.path.basename(file2_name).replace(".json", "")
        allowed_keys = get_allowed_keys(allowlist, lang_code)

    # Find keys that exist in both and have the same string value
    untranslated = []
    common_keys = set(values1.keys()) & set(values2.keys())
    for key in common_keys:
        # Skip keys marked as non-translatable
        if key in non_translatable:
            continue
        # Skip keys in the allowlist
        if key in allowed_keys:
            continue
        val1 = values1[key]
        val2 = values2[key]
        # Only flag string values that are identical
        # Skip values that are intentionally not translated
        if (
            isinstance(val1, str)
            and isinstance(val2, str)
            and val1 == val2
            and not val1.startswith("{{")  # not a template reference
            and not val1.startswith("http")  # not a URL
            and "@" not in val1  # not an email address
        ):
            untranslated.append(key)

    if untranslated:
        print(f"\nPotentially untranslated (same value as {file1_name}):")
        for key in sorted(untranslated):
            print(f"  {key}")
    else:
        print(f"\nNo untranslated placeholders detected.")


def confirm_overwrite(file_path, auto_yes):
    """Check if file exists and prompt for overwrite permission unless auto_yes is True."""
    if os.path.exists(file_path):
        if auto_yes:
            return True
        response = (
            input(f"File {file_path} already exists. Overwrite? (y/n): ")
            .strip()
            .lower()
        )
        return response == "y"
    return True


def rename_and_save_json(data, original_path, auto_yes, dry_run=False):
    """Rename original file to backup in $TMPDIR and save sorted JSON with original filename."""
    # Define paths
    base_name = os.path.basename(original_path)
    tmp_dir = tempfile.gettempdir()
    old_path = os.path.join(tmp_dir, f"old-{base_name}")

    if dry_run:
        print(f"[DRY RUN] Would rename {original_path} to {old_path}")
        print(f"[DRY RUN] Would save sorted JSON to {original_path}")
        return True

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
        with open(original_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")  # Add trailing newline
        print(f"Saved sorted JSON to {original_path}")
        return True
    except OSError as e:
        print(f"Error: Failed to save sorted JSON to {original_path}: {e}")
        return False


def main(main_file_path, diff_files=None, auto_yes=False, dry_run=False):
    # Load and sort main JSON file
    main_data = load_and_sort_json(main_file_path)
    if main_data is None:
        return False

    # Always sort and save the main file
    success = rename_and_save_json(main_data, main_file_path, auto_yes, dry_run)
    if not success:
        return False

    # Load the allowlist for untranslated key checking
    allowlist = load_allowlist(main_file_path)

    # If diff files specified, compare each one against the main file
    if diff_files:
        for diff_file in diff_files:
            # Skip if this diff file is the same as the main file
            if os.path.abspath(diff_file) == os.path.abspath(main_file_path):
                continue

            # Skip the allowlist file - it's not a translation file
            if os.path.basename(diff_file) == "i18n-allowlist.json":
                continue

            if not os.path.exists(diff_file):
                print(f"Warning: Diff file {diff_file} not found, skipping.")
                continue

            # Load and sort diff file
            diff_data = load_and_sort_json(diff_file)
            if diff_data is None:
                print(f"Warning: Failed to load {diff_file}, skipping comparison.")
                continue

            # Compare keys between main file and this diff file
            print(f"\n=== Comparing {main_file_path} with {diff_file} ===")
            compare_keys(main_data, diff_data, main_file_path, diff_file, allowlist)

            # Sort and save the diff file
            diff_success = rename_and_save_json(diff_data, diff_file, auto_yes, dry_run)
            if not diff_success:
                success = False

    return success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sort JSON file(s) and optionally compare with other files.",
        epilog="""
Examples:
  %(prog)s config.json                          # Sort config.json
  %(prog)s config.json --diff other.json        # Sort both files and compare other.json with config.json
  %(prog)s config.json --diff *.json            # Sort all JSON files and compare each file in diff with config.json
  %(prog)s config.json --dry-run                # Show what would be done
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("file", help="Path to JSON file to sort")
    parser.add_argument(
        "--diff",
        nargs="+",
        help="Files or glob patterns to compare against the main file",
    )
    parser.add_argument(
        "-y",
        "--yes",
        action="store_true",
        help="Automatically overwrite files without prompting",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would be done without actually writing files",
    )
    args = parser.parse_args()

    # Expand glob patterns in diff files
    diff_files = []
    if args.diff:
        for pattern in args.diff:
            expanded = glob.glob(pattern)
            if expanded:
                diff_files.extend(expanded)
            else:
                diff_files.append(pattern)  # Keep original if no glob match

    success = main(args.file, diff_files, args.yes, args.dry_run)
    if not success:
        exit(1)
