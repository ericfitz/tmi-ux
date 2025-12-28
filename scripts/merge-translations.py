# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""
Merge translations from a flat-format translation file into a nested localization JSON file.

Usage:
    uv run scripts/merge-translations.py <localization_file> <translations_file>

Arguments:
    localization_file: Path to the nested JSON localization file (e.g., src/assets/i18n/ar-SA.json)
    translations_file: Path to the flat JSON translations file from sub-agent

The translations file should have the format:
{
    "translations": {
        "admin.addons.addButton": "Translated value",
        "about.title": "Another translation"
    },
    "skipped": [...],
    "errors": [...]
}
"""

import json
import sys
import os
from datetime import datetime


def get_intermediate_paths(nested: dict, prefix: str = "") -> set[str]:
    """
    Get all intermediate paths (paths that contain dicts, not leaf values).
    These represent the actual nesting structure boundaries.
    """
    paths = set()
    if prefix:
        paths.add(prefix)  # Current path is intermediate (it's a dict)
    for key, value in nested.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            # This is an intermediate node - recurse
            paths.update(get_intermediate_paths(value, full_key))
        # Leaf values are NOT added to intermediate paths
    return paths


def flatten_json_with_structure(
    nested: dict, valid_paths: set[str], prefix: str = ""
) -> dict[str, str]:
    """
    Convert nested JSON to flat dot-notation keys.
    Uses valid_paths to know which paths represent actual nesting vs keys with dots.
    """
    flat = {}
    for key, value in nested.items():
        full_key = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(flatten_json_with_structure(value, valid_paths, full_key))
        else:
            flat[full_key] = value
    return flat


def unflatten_json_with_structure(flat: dict[str, str], valid_paths: set[str]) -> dict:
    """
    Convert flat dot-notation keys back to nested JSON.
    Uses valid_paths to know where the real nesting boundaries are.
    """
    nested: dict = {}

    for flat_key, value in flat.items():
        # Find the correct path segments by checking valid_paths
        parts = find_path_segments(flat_key, valid_paths)

        current = nested
        for part in parts[:-1]:
            if part not in current:
                current[part] = {}
            elif not isinstance(current[part], dict):
                # This shouldn't happen if valid_paths is correct
                current[part] = {}
            current = current[part]
        current[parts[-1]] = value

    return nested


def find_path_segments(flat_key: str, intermediate_paths: set[str]) -> list[str]:
    """
    Find the correct segmentation of a flat key based on intermediate paths.

    For example, if flat_key is "threatEditor.threatPriority.0.description"
    and intermediate_paths contains "threatEditor.threatPriority" but not
    "threatEditor.threatPriority.0", then we know "0.description" is a
    single key, not two segments.

    intermediate_paths contains only paths that are dicts (have children),
    not leaf value paths.
    """
    parts = flat_key.split(".")
    result = []
    current_segment_parts: list[str] = []

    for i, part in enumerate(parts):
        current_segment_parts.append(part)
        current_path = ".".join(parts[: i + 1])

        # Check if this path is in intermediate_paths (is a dict, not a leaf)
        if current_path in intermediate_paths:
            # This is a nesting boundary - emit the current segment and start new one
            result.append(".".join(current_segment_parts))
            current_segment_parts = []

    # Don't forget the last segment
    if current_segment_parts:
        result.append(".".join(current_segment_parts))

    return result


def sort_nested_json(obj: dict) -> dict:
    """Recursively sort all keys in a nested JSON object."""
    if isinstance(obj, dict):
        return {k: sort_nested_json(v) for k, v in sorted(obj.items())}
    return obj


def load_json_file(path: str) -> dict:
    """Load and parse a JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json_file(path: str, data: dict) -> None:
    """Save data to a JSON file with proper formatting."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")  # Trailing newline


def validate_json_file(path: str) -> tuple[bool, str]:
    """Validate that a file contains valid JSON."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            json.load(f)
        return True, ""
    except json.JSONDecodeError as e:
        return False, str(e)
    except Exception as e:
        return False, str(e)


def create_backup(original_path: str) -> str:
    """Create a timestamped backup of the original file."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"{original_path}.{timestamp}.bak"
    os.rename(original_path, backup_path)
    return backup_path


def merge_translations(localization_path: str, translations_path: str) -> dict:
    """
    Merge translations into a localization file.

    Returns a summary dict with statistics.
    """

    def make_summary(
        keys_updated: int = 0,
        keys_added: int = 0,
        keys_unchanged: int = 0,
        total_keys: int = 0,
        backup_file: str | None = None,
        success: bool = False,
        error: str | None = None,
    ) -> dict:
        return {
            "localization_file": localization_path,
            "translations_file": translations_path,
            "keys_updated": keys_updated,
            "keys_added": keys_added,
            "keys_unchanged": keys_unchanged,
            "total_keys": total_keys,
            "backup_file": backup_file,
            "success": success,
            "error": error,
        }

    # Load original localization file
    try:
        original = load_json_file(localization_path)
    except Exception as e:
        return make_summary(error=f"Failed to load localization file: {e}")

    # Load translations file
    try:
        translations_data = load_json_file(translations_path)
    except Exception as e:
        return make_summary(error=f"Failed to load translations file: {e}")

    # Extract translations dict (handle both formats)
    if "translations" in translations_data:
        translations = translations_data["translations"]
    else:
        translations = translations_data

    # Get intermediate paths from the original structure (to handle keys with dots)
    valid_paths = get_intermediate_paths(original)

    # Flatten the original to work with dot-notation keys
    flat_original = flatten_json_with_structure(original, valid_paths)

    # Merge translations
    flat_merged = flat_original.copy()
    keys_updated = 0
    keys_added = 0
    keys_unchanged = 0

    for key, value in translations.items():
        if key in flat_merged:
            if flat_merged[key] != value:
                flat_merged[key] = value
                keys_updated += 1
            else:
                keys_unchanged += 1
        else:
            flat_merged[key] = value
            keys_added += 1
            # Add new key to valid_paths so unflatten knows about it
            valid_paths.add(key)

    # Count unchanged keys (those not in translations)
    for key in flat_original:
        if key not in translations:
            keys_unchanged += 1

    total_keys = len(flat_merged)

    # Convert back to nested format
    merged_nested = unflatten_json_with_structure(flat_merged, valid_paths)

    # Sort keys for consistency
    merged_sorted = sort_nested_json(merged_nested)

    # Write to temporary file
    temp_path = f"{localization_path}.tmp"
    try:
        save_json_file(temp_path, merged_sorted)
    except Exception as e:
        return make_summary(
            keys_updated=keys_updated,
            keys_added=keys_added,
            keys_unchanged=keys_unchanged,
            total_keys=total_keys,
            error=f"Failed to write temporary file: {e}",
        )

    # Validate the temporary file
    valid, validation_error = validate_json_file(temp_path)
    if not valid:
        os.remove(temp_path)
        return make_summary(
            keys_updated=keys_updated,
            keys_added=keys_added,
            keys_unchanged=keys_unchanged,
            total_keys=total_keys,
            error=f"Validation failed: {validation_error}",
        )

    # Create backup and swap files
    try:
        backup_path = create_backup(localization_path)
        os.rename(temp_path, localization_path)
    except Exception as e:
        # Try to clean up
        if os.path.exists(temp_path):
            os.remove(temp_path)
        return make_summary(
            keys_updated=keys_updated,
            keys_added=keys_added,
            keys_unchanged=keys_unchanged,
            total_keys=total_keys,
            error=f"Failed to swap files: {e}",
        )

    return make_summary(
        keys_updated=keys_updated,
        keys_added=keys_added,
        keys_unchanged=keys_unchanged,
        total_keys=total_keys,
        backup_file=backup_path,
        success=True,
    )


def print_summary(summary: dict) -> None:
    """Print a formatted summary of the merge operation."""
    print("\n" + "=" * 60)
    print("MERGE TRANSLATIONS SUMMARY")
    print("=" * 60)

    print(f"\nLocalization file: {summary['localization_file']}")
    print(f"Translations file: {summary['translations_file']}")

    if summary["success"]:
        print(f"\nStatus: SUCCESS")
        print(f"Backup created: {summary['backup_file']}")
        print(f"\nStatistics:")
        print(f"  Keys updated:   {summary['keys_updated']}")
        print(f"  Keys added:     {summary['keys_added']}")
        print(f"  Keys unchanged: {summary['keys_unchanged']}")
        print(f"  Total keys:     {summary['total_keys']}")
    else:
        print(f"\nStatus: FAILED")
        print(f"Error: {summary['error']}")

    print("\n" + "=" * 60)


def main():
    if len(sys.argv) != 3:
        print("Usage: uv run scripts/merge-translations.py <localization_file> <translations_file>")
        print("\nExample:")
        print("  uv run scripts/merge-translations.py src/assets/i18n/ar-SA.json /tmp/ar-SA-translations.json")
        sys.exit(1)

    localization_path = sys.argv[1]
    translations_path = sys.argv[2]

    # Validate inputs exist
    if not os.path.exists(localization_path):
        print(f"Error: Localization file not found: {localization_path}")
        sys.exit(1)

    if not os.path.exists(translations_path):
        print(f"Error: Translations file not found: {translations_path}")
        sys.exit(1)

    # Perform merge
    summary = merge_translations(localization_path, translations_path)

    # Print summary
    print_summary(summary)

    # Exit with appropriate code
    sys.exit(0 if summary["success"] else 1)


if __name__ == "__main__":
    main()
