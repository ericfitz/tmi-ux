"""Build the en-US.usage.json sidecar from source-code analysis.

Implements stages 1, 2, 3, 7, and 9 of the usage-map pipeline. Subsequent
tasks add stages 6 (model verification) and 8 (ellipsis candidate detection)
to populate additional fields on each entry.

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

from scripts.i18n_style.config import load_lists
from scripts.i18n_style.ellipsis_detector import is_ellipsis_candidate
from scripts.i18n_style.key_enumerator import enumerate_keys
from scripts.i18n_style.usage_scanner import scan_for_key, scan_for_partial_key
from scripts.i18n_style.surface_inference import infer_surfaces


def _value_for_key(data, key: str):
    """Return the string value for a dotted key in a nested dict, or None."""
    parts = key.split(".")
    cur = data
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur if isinstance(cur, str) else None


def _has_comment_sibling(data, key: str) -> bool:
    """Return True if a sibling '<leaf>.comment' key exists in the same dict."""
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return False
    return isinstance(cur, dict) and f"{parts[-1]}.comment" in cur


def _is_ambiguous(value: str, ambiguous_words: set) -> bool:
    """Return True if the string is ≤3 words and contains an ambiguous word."""
    if not isinstance(value, str):
        return False
    words = value.split()
    if len(words) > 3:
        return False
    # Match case-insensitively against the ambiguous-words set
    # (the set canonicalizes case, e.g., 'Filter').
    lowered_set = {w.lower() for w in ambiguous_words}
    return any(w.lower().rstrip(".,!?:;") in lowered_set for w in words)


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
    with open(en_us_path, "r", encoding="utf-8") as f:
        en_us_data = json.load(f)

    lists = load_lists()

    keys = enumerate_keys(en_us_path)
    usage_map: Dict[str, Dict[str, Any]] = {}

    for key in keys:
        value = _value_for_key(en_us_data, key)
        ambiguous = _is_ambiguous(value, lists.ambiguous_words) if value else False
        has_comment = _has_comment_sibling(en_us_data, key)
        needs_comment = ambiguous and not has_comment

        usages = scan_for_key(key, repo_root)
        if usages:
            surfaces = infer_surfaces(usages)
            # The surface guard is intentionally omitted here: surface inference
            # operates on single context lines and misclassifies button keys
            # whose i18n reference is inside a child <span> (the common Angular
            # multi-line pattern).  The detector itself filters non-button
            # usages via its internal button hint and surrounding-window logic.
            ellipsis = is_ellipsis_candidate(usages, repo_root)
            usage_map[key] = {
                "surfaces": sorted(surfaces),
                "uses": [_serialize_use(u) for u in usages],
                "ellipsis_candidate": ellipsis,
                "ambiguous_word": ambiguous,
                "needs_translator_comment": needs_comment,
                "confidence": "high",
                "found_by": "fully-qualified",
            }
            continue

        # Stage 3: try partial-key search.
        candidates = scan_for_partial_key(key, repo_root)
        if candidates:
            best = "medium" if any(c.confidence == "medium" for c in candidates) else "low"
            usage_map[key] = {
                "surfaces": ["general"],
                "uses": [
                    {
                        "file": str(c.file),
                        "line": c.line,
                        "context": c.context,
                        "classes": [],
                        "partial_match": c.confidence,
                    }
                    for c in candidates[:10]  # cap to avoid blowing up the file
                ],
                "ellipsis_candidate": False,
                "ambiguous_word": ambiguous,
                "needs_translator_comment": needs_comment,
                "confidence": best,
                "found_by": "leaf",
            }
        else:
            entry = _entry_for_unfound_key()
            entry["ambiguous_word"] = ambiguous
            entry["needs_translator_comment"] = needs_comment
            usage_map[key] = entry

    return usage_map


def write_usage_map(usage_map: Dict[str, Dict[str, Any]], out_path: Path) -> None:
    """Write the usage map to disk as pretty-printed JSON."""
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(usage_map, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
