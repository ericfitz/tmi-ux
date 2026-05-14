#!/usr/bin/env python3
"""Apply translations.json to each non-en-US locale file.

Reads scripts/i18n_tone_audit/translations.json, then for each locale,
sets the dot-path keys to the translated values. Writes the JSON back
preserving the existing key order (json.load + json.dump with sort_keys=False
preserves insertion order in Python 3.7+).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
I18N_DIR = ROOT / "src" / "assets" / "i18n"
TRANSLATIONS_FILE = Path(__file__).parent / "translations.json"


def set_dot_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        if not isinstance(cur, dict) or p not in cur:
            return False
        cur = cur[p]
    leaf = parts[-1]
    if not isinstance(cur, dict) or leaf not in cur:
        return False
    if not isinstance(cur[leaf], str):
        return False
    cur[leaf] = value
    return True


def main() -> int:
    translations = json.loads(TRANSLATIONS_FILE.read_text(encoding="utf-8"))
    locales = [k for k in translations.keys() if not k.startswith("_")]
    missing_overall = []
    for locale in locales:
        path = I18N_DIR / f"{locale}.json"
        if not path.exists():
            print(f"[skip] {locale}: file not found")
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        keys = translations[locale]
        applied = 0
        missing = []
        for dotted, value in keys.items():
            if set_dot_path(data, dotted, value):
                applied += 1
            else:
                missing.append(dotted)
                missing_overall.append(f"{locale}:{dotted}")
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{locale}: applied {applied} of {len(keys)}; missing: {missing}")
    if missing_overall:
        print("\nMissing keys overall:")
        for m in missing_overall:
            print(f"  {m}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
