#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Build the en-US usage map sidecar.

Walks src/**/*.{ts,html,scss} for transloco usages of every key in
src/assets/i18n/en-US.json and writes src/assets/i18n/en-US.usage.json.

Usage:
  uv run scripts/build-i18n-usage-map.py
  uv run scripts/build-i18n-usage-map.py --en-us <path> --out <path> --root <path>
"""

import argparse
import sys
from pathlib import Path

# Add repo root to sys.path so we can import scripts.i18n_style.*
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.usage_map_builder import build_usage_map, write_usage_map


def main():
    parser = argparse.ArgumentParser(description="Build en-US usage map sidecar.")
    parser.add_argument(
        "--en-us",
        type=Path,
        default=REPO_ROOT / "src/assets/i18n/en-US.json",
        help="Path to en-US.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "src/assets/i18n/en-US.usage.json",
        help="Path to write usage map",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=REPO_ROOT,
        help="Root directory to scan for usages",
    )
    args = parser.parse_args()

    print(f"Building usage map from {args.en_us}")
    print(f"Scanning {args.root}")
    usage_map = build_usage_map(args.en_us, args.root)
    write_usage_map(usage_map, args.out)
    found = sum(1 for v in usage_map.values() if v["uses"])
    total = len(usage_map)
    print(f"Wrote {args.out}: {found}/{total} keys found in source.")


if __name__ == "__main__":
    main()
