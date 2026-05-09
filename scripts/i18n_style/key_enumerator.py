"""Enumerate translatable keys from a Transloco JSON file.

A "translatable key" is the dotted path to a leaf string value, excluding
any key whose final segment is `.comment` or `.lint-skip` (these are
sibling-metadata keys, not translatable content).
"""

import json
from pathlib import Path
from typing import Iterator, List


_META_SUFFIXES = (".comment", ".lint-skip")


def _walk(obj, prefix: str = "") -> Iterator[str]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if any(full_key.endswith(suffix) for suffix in _META_SUFFIXES):
                continue
            if isinstance(value, dict):
                yield from _walk(value, full_key)
            else:
                yield full_key


def enumerate_keys(path: Path) -> List[str]:
    """Return the list of translatable keys in a Transloco JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return list(_walk(data))
