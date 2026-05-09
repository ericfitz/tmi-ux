#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Apply mechanical i18n style corrections to en-US.json.

Default is dry-run: prints proposed changes and exits without writing.
Use --apply to write changes.

Usage:
  uv run scripts/fix-i18n-style.py            # dry run
  uv run scripts/fix-i18n-style.py --apply    # apply changes
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.config import load_lists  # noqa: E402
from scripts.i18n_style.corrector import (  # noqa: E402
    correct_sentence_case,
    correct_trailing_bang,
)


def _walk_apply(obj, lists, prefix=""):
    """Yield (key, old_value, new_value) for each leaf string changed.

    Skips keys that have a sibling ``<key>.lint-skip`` entry — those are
    explicitly opted-out of automated corrections.
    """
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if full_key.endswith(".comment") or full_key.endswith(".lint-skip"):
                continue
            if isinstance(value, dict):
                yield from _walk_apply(value, lists, full_key)
            elif isinstance(value, str):
                # Skip if this key has a sibling lint-skip entry.
                if f"{key}.lint-skip" in obj:
                    continue
                fixed = correct_trailing_bang(correct_sentence_case(value, lists))
                if fixed != value:
                    yield (full_key, value, fixed)


def _set_value(data, key, new_value):
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = new_value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run).")
    parser.add_argument("--locale", default="src/assets/i18n/en-US.json")
    args = parser.parse_args()

    lists = load_lists()
    locale_path = REPO_ROOT / args.locale
    with open(locale_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = list(_walk_apply(data, lists))
    print(f"{'APPLIED' if args.apply else 'WOULD APPLY'} {len(changes)} corrections:\n")
    for key, old, new in changes:
        print(f"  {key}")
        print(f"    - {old!r}")
        print(f"    + {new!r}")

    if args.apply:
        for key, _, new in changes:
            _set_value(data, key, new)
        with open(locale_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nWrote {locale_path}.")


if __name__ == "__main__":
    main()
