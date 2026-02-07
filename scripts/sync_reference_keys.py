#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

"""
Sync i18n reference keys across all locale files.

Reference keys are entries in en-US.json whose value is purely a reference
to another key, e.g. "savedSuccessfully": "{{common.savedSuccessfully}}".
These values must be identical across all locale files since the i18n system
resolves them at runtime.

Usage:
  uv run scripts/sync_reference_keys.py                  # dry-run (report only)
  uv run scripts/sync_reference_keys.py --fix            # fix mismatches in place
  uv run scripts/sync_reference_keys.py --verbose        # show all checked keys
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

I18N_DIR = Path(__file__).resolve().parent.parent / "src" / "assets" / "i18n"
MASTER_FILE = "en-US.json"

# Matches values that are exactly a single {{dotted.path}} reference.
# Excludes simple variables (no dot) and mixed-content templates.
REFERENCE_RE = re.compile(r"^\{\{[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z0-9_.]+\}\}$")


def flatten_json(data: Any, prefix: str = "") -> Dict[str, Any]:
    """Flatten nested JSON into dot-separated key paths."""
    items: Dict[str, Any] = {}
    if isinstance(data, dict):
        for key, value in data.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                items.update(flatten_json(value, full_key))
            else:
                items[full_key] = value
    return items


def unflatten_set(flat_key: str, data: dict, value: Any) -> None:
    """Set a value in a nested dict using a dot-separated key path."""
    parts = flat_key.split(".")
    current = data
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def find_reference_keys(master_data: dict) -> Dict[str, str]:
    """Find all keys in master file whose values are pure references."""
    flat = flatten_json(master_data)
    return {
        key: value
        for key, value in flat.items()
        if isinstance(value, str) and REFERENCE_RE.match(value)
    }


def check_locale_file(
    locale_path: Path, reference_keys: Dict[str, str]
) -> List[Tuple[str, str, str]]:
    """Check a locale file for mismatched reference keys.

    Returns list of (key, expected_value, actual_value) tuples.
    """
    locale_data = load_json(locale_path)
    flat = flatten_json(locale_data)
    mismatches = []

    for key, expected in reference_keys.items():
        actual = flat.get(key)
        if actual is None:
            mismatches.append((key, expected, "<missing>"))
        elif actual != expected:
            mismatches.append((key, expected, actual))

    return mismatches


def fix_locale_file(
    locale_path: Path,
    reference_keys: Dict[str, str],
    mismatches: List[Tuple[str, str, str]],
) -> int:
    """Fix mismatched reference keys in a locale file. Returns count of fixes."""
    if not mismatches:
        return 0

    locale_data = load_json(locale_path)

    fixed = 0
    for key, expected, actual in mismatches:
        if actual == "<missing>":
            continue  # don't add keys that don't exist in the target
        try:
            unflatten_set(key, locale_data, expected)
            fixed += 1
        except KeyError:
            pass  # skip if the nested path doesn't exist

    if fixed > 0:
        save_json(locale_path, locale_data)

    return fixed


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync i18n reference keys across all locale files."
    )
    parser.add_argument(
        "--fix", action="store_true", help="Fix mismatches in place"
    )
    parser.add_argument(
        "--verbose", action="store_true", help="Show all checked keys"
    )
    args = parser.parse_args()

    master_path = I18N_DIR / MASTER_FILE
    if not master_path.exists():
        print(f"Error: master file not found: {master_path}", file=sys.stderr)
        return 1

    master_data = load_json(master_path)
    reference_keys = find_reference_keys(master_data)

    print(f"Found {len(reference_keys)} reference keys in {MASTER_FILE}")

    if args.verbose:
        print("\nReference keys:")
        for key, value in sorted(reference_keys.items()):
            print(f"  {key}: {value}")
        print()

    locale_files = sorted(
        p
        for p in I18N_DIR.glob("*.json")
        if p.name != MASTER_FILE and p.name != "i18n-allowlist.json"
    )

    total_mismatches = 0
    total_fixes = 0

    for locale_path in locale_files:
        mismatches = check_locale_file(locale_path, reference_keys)

        if mismatches:
            print(f"\n{locale_path.name}: {len(mismatches)} mismatch(es)")
            for key, expected, actual in mismatches:
                print(f"  {key}")
                print(f"    expected: {expected}")
                print(f"    actual:   {actual}")
            total_mismatches += len(mismatches)

            if args.fix:
                fixed = fix_locale_file(locale_path, reference_keys, mismatches)
                total_fixes += fixed
                if fixed:
                    print(f"  -> fixed {fixed} key(s)")
        elif args.verbose:
            print(f"\n{locale_path.name}: OK")

    print(f"\n{'='*60}")
    print(f"Total reference keys: {len(reference_keys)}")
    print(f"Locale files checked: {len(locale_files)}")
    print(f"Total mismatches: {total_mismatches}")

    if args.fix:
        print(f"Total fixes applied: {total_fixes}")
        unfixed = total_mismatches - total_fixes
        if unfixed > 0:
            print(f"Unfixed (missing keys): {unfixed}")

    if total_mismatches > 0 and not args.fix:
        print("\nRun with --fix to correct mismatches.")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
