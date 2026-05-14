#!/usr/bin/env python3
"""Extract tone-audit candidate keys from en-US.json.

A candidate is any key whose inferred surfaces include at least one of:
- error
- snackbar
- validation (mat-error, which we tag as 'error')
- description

Outputs JSON to stdout: a list of {key, value, surfaces, files} records,
sorted by key. Skips keys with .lint-skip siblings and skips .comment keys.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
I18N_DIR = ROOT / "src" / "assets" / "i18n"
EN_JSON = I18N_DIR / "en-US.json"
USAGE_JSON = I18N_DIR / "en-US.usage.json"

TARGET_SURFACES = {"error", "snackbar", "description", "validation"}


def flatten(obj, prefix=""):
    """Yield (key, value) for every string leaf in nested dict obj."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            full = f"{prefix}.{k}" if prefix else k
            yield from flatten(v, full)
    elif isinstance(obj, str):
        yield prefix, obj


def main() -> int:
    en = json.loads(EN_JSON.read_text(encoding="utf-8"))
    usage = json.loads(USAGE_JSON.read_text(encoding="utf-8"))

    # Build set of lint-skip keys (siblings <key>.lint-skip)
    lint_skip_keys = set()
    for k, _v in flatten(en):
        if k.endswith(".lint-skip"):
            lint_skip_keys.add(k[: -len(".lint-skip")])

    candidates = []
    for key, value in flatten(en):
        if key.endswith(".comment") or key.endswith(".lint-skip"):
            continue
        if key in lint_skip_keys:
            continue
        if not isinstance(value, str) or not value.strip():
            continue
        # Skip pure delegation strings (e.g., "{{another.key}}")
        v_stripped = value.strip()
        if v_stripped.startswith("{{") and v_stripped.endswith("}}") and v_stripped.count("{{") == 1:
            continue

        info = usage.get(key)
        if not info:
            continue
        surfaces = set(info.get("surfaces", []))
        if not (surfaces & TARGET_SURFACES):
            continue

        files = sorted({u["file"].replace(str(ROOT) + "/", "") for u in info.get("uses", [])})
        candidates.append(
            {
                "key": key,
                "value": value,
                "surfaces": sorted(surfaces),
                "files": files,
            }
        )

    candidates.sort(key=lambda c: c["key"])
    json.dump(candidates, sys.stdout, indent=2, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
