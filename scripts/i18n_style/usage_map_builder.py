"""Build the en-US.usage.json sidecar from source-code analysis.

Implements the minimum-viable pipeline (stages 1, 2, 7, 9). Subsequent tasks
add stages 3 (partial-key search), 6 (model verification), and 8 (ellipsis
candidate detection) to populate additional fields on each entry.

Output schema:
{
  "<key>": {
    "surfaces": ["button", "tooltip", ...],
    "uses": [{"file": "...", "line": N, "context": "...", "classes": [...]}],
    "ellipsis_candidate": false,
    "ambiguous_word": false,
    "needs_translator_comment": false,
    "confidence": "high" | "medium" | "low",
    "found_by": "fully-qualified" | "leaf" | "model-verified" | "none"
  }
}
"""

import json
from pathlib import Path
from typing import Dict, Any

from scripts.i18n_style.key_enumerator import enumerate_keys
from scripts.i18n_style.usage_scanner import scan_for_key
from scripts.i18n_style.surface_inference import infer_surfaces


def _entry_for_unfound_key() -> Dict[str, Any]:
    return {
        "surfaces": ["general"],
        "uses": [],
        "ellipsis_candidate": False,
        "ambiguous_word": False,
        "needs_translator_comment": False,
        "confidence": "low",
        "found_by": "none",
    }


def _serialize_use(usage) -> Dict[str, Any]:
    return {
        "file": str(usage.file),
        "line": usage.line,
        "context": usage.context,
        "classes": usage.classes,
    }


def build_usage_map(en_us_path: Path, repo_root: Path) -> Dict[str, Dict[str, Any]]:
    """Build the usage map for en-US.json.

    Args:
        en_us_path: Path to en-US.json.
        repo_root: Root of the repository (search scope).

    Returns:
        Dict mapping each translatable key to its usage record.
    """
    keys = enumerate_keys(en_us_path)
    usage_map: Dict[str, Dict[str, Any]] = {}

    for key in keys:
        usages = scan_for_key(key, repo_root)
        if not usages:
            usage_map[key] = _entry_for_unfound_key()
            continue
        surfaces = infer_surfaces(usages)
        usage_map[key] = {
            "surfaces": sorted(surfaces),
            "uses": [_serialize_use(u) for u in usages],
            "ellipsis_candidate": False,
            "ambiguous_word": False,
            "needs_translator_comment": False,
            "confidence": "high",
            "found_by": "fully-qualified",
        }

    return usage_map


def write_usage_map(usage_map: Dict[str, Dict[str, Any]], out_path: Path) -> None:
    """Write the usage map to disk as pretty-printed JSON."""
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(usage_map, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
