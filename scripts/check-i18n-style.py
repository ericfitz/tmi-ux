#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Run the i18n style check against en-US.json.

Usage:
  uv run scripts/check-i18n-style.py             # CI mode
  uv run scripts/check-i18n-style.py --audit     # audit mode (write report)

Exits 0 on success, 1 on blocking violations (CI mode only).
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.checker import run_check, run_non_en_check  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="i18n style check")
    parser.add_argument("--audit", action="store_true", help="Audit mode: write markdown report.")
    parser.add_argument("--report", default="docs/i18n-audit-review.md", type=str)
    parser.add_argument("--locale", default="src/assets/i18n/en-US.json", type=str)
    parser.add_argument("--usage", default="src/assets/i18n/en-US.usage.json", type=str)
    parser.add_argument("--locales-dir", default="src/assets/i18n", type=str)
    args = parser.parse_args()

    locale_path = REPO_ROOT / args.locale
    usage_path = REPO_ROOT / args.usage
    locales_dir = REPO_ROOT / args.locales_dir

    result = run_check(locale_path, usage_path)

    # Also check non-en-US files for stray .comment keys.
    non_en = sorted(
        p for p in locales_dir.glob("*.json")
        if p.name != "en-US.json"
        and p.name != "en-US.usage.json"
        and p.name != "i18n-allowlist.json"
    )
    non_en_errors = run_non_en_check(non_en)
    result.blocking_violations.extend(non_en_errors)

    if args.audit:
        report_path = REPO_ROOT / args.report
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# i18n style audit report\n\n")
            f.write(f"## Blocking violations ({len(result.blocking_violations)})\n\n")
            for v in result.blocking_violations:
                f.write(f"- {v}\n")
            f.write(f"\n## Warnings ({len(result.warnings)})\n\n")
            for w in result.warnings:
                f.write(f"- {w}\n")
            f.write(f"\n## Skipped (lint-skip) ({len(result.skipped_keys)})\n\n")
            for s in result.skipped_keys:
                f.write(f"- {s}\n")
        print(f"Wrote {report_path}")
        sys.exit(0)

    if result.skipped_keys:
        print(f"Skipping {len(result.skipped_keys)} keys with lint-skip siblings.")
    if result.warnings:
        print(f"Warnings ({len(result.warnings)}):")
        for w in result.warnings[:50]:
            print(f"  WARN {w}")
        if len(result.warnings) > 50:
            print(f"  ... and {len(result.warnings) - 50} more")

    if result.blocking_violations:
        print(f"\nBlocking violations ({len(result.blocking_violations)}):")
        for v in result.blocking_violations:
            print(f"  FAIL {v}")
        sys.exit(1)

    print("i18n style check: OK.")
    sys.exit(0)


if __name__ == "__main__":
    main()
