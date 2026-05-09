"""Validate `.comment` sibling presence and absence per locale."""

from typing import Dict, List, Any


def _get_comment_sibling(data: Dict, key: str) -> bool:
    """Return True if a `.comment` sibling exists for the given dotted key."""
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return False
    return isinstance(cur, dict) and f"{parts[-1]}.comment" in cur


def validate_required_comment_siblings(
    en_us_data: Dict, usage_map: Dict[str, Dict[str, Any]]
) -> List[str]:
    """Return a list of keys missing a required `.comment` sibling in en-US."""
    errors: List[str] = []
    for key, entry in usage_map.items():
        if entry.get("needs_translator_comment"):
            if not _get_comment_sibling(en_us_data, key):
                errors.append(f"{key}: missing `.comment` sibling for ambiguous short string")
    return errors


def _walk_comment_keys(obj, prefix: str = ""):
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if full_key.endswith(".comment"):
                yield full_key
            elif isinstance(value, dict):
                yield from _walk_comment_keys(value, full_key)


def validate_no_comment_in_non_en(locale_data: Dict) -> List[str]:
    """Return a list of error messages for `.comment` keys present in non-en-US data."""
    errors: List[str] = []
    for full_key in _walk_comment_keys(locale_data):
        errors.append(
            f"`.comment` keys are en-US-only; remove from non-en-US locale: {full_key}"
        )
    return errors
