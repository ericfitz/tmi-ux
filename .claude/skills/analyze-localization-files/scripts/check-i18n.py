#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = []
# ///

"""Sort i18n JSON files and report key/value drift against a master locale.

What it does
------------
For a master locale JSON file and a set of target locale files, this script:
  1. Recursively sorts each file's keys and writes a sorted copy in place
     (the original is moved to ``$TMPDIR/old-<basename>``).
  2. Reports keys present in the master but missing in each target.
  3. Reports keys present in a target but missing in the master.
  4. Reports keys whose values are identical to the master's value
     ("potentially untranslated"), excluding template references, URLs,
     and email addresses, and respecting per-locale allow-lists and
     in-file ``.comment`` annotations of the form
     ``"... should not be translated."``.

Configuration discovery
-----------------------
When invoked without positional arguments the script walks up from the
current working directory looking for ``.claude/i18n.config.json``
(see `find_i18n_config`). If found, it derives the master file and the
list of target files from the config:

  - ``locales_dir`` (required)
  - ``master_locale`` (required, basename without extension)
  - ``file_extension`` (default ``"json"``)

Explicit arguments always override config-derived paths so existing
``pnpm run check-i18n`` invocations remain backward compatible.

Dependencies
------------
Standard library only (no third-party packages). PEP 723 inline metadata
declares ``dependencies = []`` so ``uv run`` reuses the system Python.

Usage examples
--------------
  # Backward-compatible explicit invocation:
  uv run check-i18n.py src/assets/i18n/en-US.json --diff src/assets/i18n/* -y

  # Config-driven invocation (reads .claude/i18n.config.json):
  uv run check-i18n.py -y

  # Override config file path:
  uv run check-i18n.py --config path/to/i18n.config.json -y
"""

import argparse
import glob
import json
import os
import sys
import tempfile
from collections import OrderedDict
from pathlib import Path
from typing import Optional


CONFIG_FILENAME = ".claude/i18n.config.json"


def find_i18n_config(start: Optional[Path] = None, override: Optional[str] = None):
    """Locate an i18n config file by walking up the directory tree.

    Args:
        start: Directory to start from (defaults to cwd).
        override: Explicit path to a config file; returned as-is if it exists.

    Returns:
        Path to the config file, or None if not found.
    """
    if override:
        path = Path(override).expanduser()
        return path if path.is_file() else None
    start = (start or Path.cwd()).resolve()
    for d in [start, *start.parents]:
        candidate = d / CONFIG_FILENAME
        if candidate.is_file():
            return candidate
    return None


def load_i18n_config(config_path: Path):
    """Load and minimally validate an i18n config file."""
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
    for required in ("locales_dir", "master_locale"):
        if required not in config:
            raise ValueError(
                f"i18n config {config_path} is missing required field: {required!r}"
            )
    config.setdefault("file_extension", "json")
    return config


def derive_paths_from_config(config_path: Path, config: dict):
    """Return (master_file, list_of_diff_files) derived from config."""
    base = config_path.parent.parent  # parent of .claude/
    locales_dir = (base / config["locales_dir"]).resolve()
    ext = config["file_extension"]
    master = locales_dir / f"{config['master_locale']}.{ext}"
    diff_files = sorted(str(p) for p in locales_dir.glob(f"*.{ext}") if p != master)
    return str(master), diff_files


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
    """Recursively collect all keys with their full dot-path.

    Args:
        obj: The JSON object to traverse.
        prefix: Current key path prefix.
        skip_comments: If True, skip keys ending in ``.comment``.
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
    """Recursively collect leaf key-value pairs with their full dot-path."""
    values = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if skip_comments and full_key.endswith(".comment"):
                continue
            if isinstance(value, dict):
                values.update(get_leaf_values(value, full_key, skip_comments))
            else:
                values[full_key] = value
    return values


def get_non_translatable_keys(obj, prefix=""):
    """Find keys whose ``.comment`` value contains "should not be translated."."""
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
                associated_key = full_key[: -len(".comment")]
                non_translatable.add(associated_key)
    return non_translatable


def load_allowlist(main_file_path):
    """Load ``i18n-allowlist.json`` co-located with the master file, if any.

    Schema: ``{"<lang>": ["key.path", ...], "*": [...]}``. The ``*`` key
    lists allow-listed keys that apply to every locale.
    """
    allowlist_path = os.path.join(os.path.dirname(main_file_path), "i18n-allowlist.json")
    if os.path.exists(allowlist_path):
        try:
            with open(allowlist_path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Warning: Failed to load allowlist from {allowlist_path}: {e}")
    return {}


def get_allowed_keys(allowlist, lang_code):
    """Get the set of allow-listed keys for a specific language."""
    allowed = set()
    if "*" in allowlist:
        allowed.update(allowlist["*"])
    if lang_code in allowlist:
        allowed.update(allowlist[lang_code])
    return allowed


def compare_keys(data1, data2, file1_name, file2_name, allowlist=None):
    """Compare keys between two locale objects and report differences."""
    keys1 = get_all_keys(data1)
    keys2 = get_all_keys(data2)

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

    values1 = get_leaf_values(data1)
    values2 = get_leaf_values(data2)

    allowed_keys = set()
    if allowlist:
        lang_code = os.path.basename(file2_name).replace(".json", "")
        allowed_keys = get_allowed_keys(allowlist, lang_code)

    untranslated = []
    common_keys = set(values1.keys()) & set(values2.keys())
    for key in common_keys:
        if key in non_translatable:
            continue
        if key in allowed_keys:
            continue
        val1 = values1[key]
        val2 = values2[key]
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
        print("\nNo untranslated placeholders detected.")


def confirm_overwrite(file_path, auto_yes):
    """Check if file exists and prompt for overwrite unless auto_yes is True."""
    if os.path.exists(file_path):
        if auto_yes:
            return True
        response = input(f"File {file_path} already exists. Overwrite? (y/n): ").strip().lower()
        return response == "y"
    return True


def rename_and_save_json(data, original_path, auto_yes, dry_run=False):
    """Move original to ``$TMPDIR/old-<basename>`` and save sorted JSON in place."""
    base_name = os.path.basename(original_path)
    tmp_dir = tempfile.gettempdir()
    old_path = os.path.join(tmp_dir, f"old-{base_name}")

    if dry_run:
        print(f"[DRY RUN] Would rename {original_path} to {old_path}")
        print(f"[DRY RUN] Would save sorted JSON to {original_path}")
        return True

    if not confirm_overwrite(old_path, auto_yes):
        print(f"Error: Cannot overwrite {old_path}. Operation aborted.")
        return False
    if not confirm_overwrite(original_path, auto_yes):
        print(f"Error: Cannot overwrite {original_path}. Operation aborted.")
        return False

    if os.path.exists(original_path):
        try:
            os.rename(original_path, old_path)
            print(f"Renamed {original_path} to {old_path}")
        except OSError as e:
            print(f"Error: Failed to rename {original_path} to {old_path}: {e}")
            return False

    try:
        with open(original_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"Saved sorted JSON to {original_path}")
        return True
    except OSError as e:
        print(f"Error: Failed to save sorted JSON to {original_path}: {e}")
        return False


def main(main_file_path, diff_files=None, auto_yes=False, dry_run=False):
    main_data = load_and_sort_json(main_file_path)
    if main_data is None:
        return False

    success = rename_and_save_json(main_data, main_file_path, auto_yes, dry_run)
    if not success:
        return False

    allowlist = load_allowlist(main_file_path)

    if diff_files:
        for diff_file in diff_files:
            if os.path.abspath(diff_file) == os.path.abspath(main_file_path):
                continue
            if os.path.basename(diff_file) == "i18n-allowlist.json":
                continue
            if not os.path.exists(diff_file):
                print(f"Warning: Diff file {diff_file} not found, skipping.")
                continue

            diff_data = load_and_sort_json(diff_file)
            if diff_data is None:
                print(f"Warning: Failed to load {diff_file}, skipping comparison.")
                continue

            print(f"\n=== Comparing {main_file_path} with {diff_file} ===")
            compare_keys(main_data, diff_data, main_file_path, diff_file, allowlist)

            diff_success = rename_and_save_json(diff_data, diff_file, auto_yes, dry_run)
            if not diff_success:
                success = False

    return success


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Sort JSON file(s) and compare key/value coverage against a master locale.",
        epilog="""
Examples:
  %(prog)s config.json                          # Sort config.json
  %(prog)s config.json --diff other.json        # Sort both and compare other.json with config.json
  %(prog)s config.json --diff *.json            # Compare every match against config.json
  %(prog)s config.json --dry-run                # Show what would happen
  %(prog)s -y                                    # Read .claude/i18n.config.json from cwd
  %(prog)s --config path/to/i18n.config.json -y  # Read explicit config file
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "file",
        nargs="?",
        help="Path to master JSON file. If omitted, derived from --config or .claude/i18n.config.json.",
    )
    parser.add_argument(
        "--diff",
        nargs="+",
        help="Files or glob patterns to compare against the master file.",
    )
    parser.add_argument(
        "--config",
        help="Path to i18n config file (defaults to walking up for .claude/i18n.config.json).",
    )
    parser.add_argument(
        "-y", "--yes", action="store_true",
        help="Automatically overwrite files without prompting.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be done without actually writing files.",
    )
    args = parser.parse_args()

    main_file = args.file
    diff_inputs = args.diff or []

    if not main_file:
        # Derive from config.
        config_path = find_i18n_config(override=args.config)
        if not config_path:
            print(
                "Error: no master file argument provided and no .claude/i18n.config.json found "
                "by walking up from the current directory. Pass an explicit file or --config.",
                file=sys.stderr,
            )
            sys.exit(2)
        config = load_i18n_config(config_path)
        main_file, derived_diffs = derive_paths_from_config(config_path, config)
        if not diff_inputs:
            diff_inputs = derived_diffs
        print(f"Using i18n config: {config_path}")
        print(f"Master file:       {main_file}")
        print(f"Diff files:        {len(diff_inputs)} locale file(s)")

    # Expand glob patterns in diff inputs.
    diff_files = []
    for pattern in diff_inputs:
        expanded = glob.glob(pattern)
        if expanded:
            diff_files.extend(expanded)
        else:
            diff_files.append(pattern)

    if not main(main_file, diff_files, args.yes, args.dry_run):
        sys.exit(1)
