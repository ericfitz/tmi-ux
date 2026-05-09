"""Orchestrates the i18n style check across all validators."""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from scripts.i18n_style.config import load_lists
from scripts.i18n_style.sentence_case import validate_sentence_case
from scripts.i18n_style.punctuation import (
    validate_period_rule,
    validate_no_trailing_bang,
    validate_no_forbidden_phrases,
)
from scripts.i18n_style.comment_siblings import (
    validate_required_comment_siblings,
    validate_no_comment_in_non_en,
)


@dataclass
class CheckResult:
    blocking_violations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    skipped_keys: List[str] = field(default_factory=list)


def _flatten(obj, prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                out.update(_flatten(value, full_key))
            elif isinstance(value, str):
                out[full_key] = value
    return out


def _has_lint_skip(data: Dict, key: str) -> bool:
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return False
    return isinstance(cur, dict) and f"{parts[-1]}.lint-skip" in cur


def _primary_surface(surfaces: List[str]) -> str:
    """Pick a single surface for surface-aware validators (e.g., period rule).

    Priority order: error > snackbar > validation > placeholder > tooltip >
    label > button > menu-item > dialog-title > page-title > description >
    general.
    """
    priority = [
        "error", "snackbar", "validation", "placeholder", "tooltip",
        "label", "button", "menu-item", "dialog-title", "page-title",
        "description", "general",
    ]
    for s in priority:
        if s in surfaces:
            return s
    return "general"


def run_check(locale_path: Path, usage_path: Path) -> CheckResult:
    """Run all validators against en-US.json + the sidecar.

    Returns a CheckResult with blocking_violations and warnings populated.
    """
    with open(locale_path, "r", encoding="utf-8") as f:
        locale_data = json.load(f)
    with open(usage_path, "r", encoding="utf-8") as f:
        usage_map = json.load(f)

    lists = load_lists()
    result = CheckResult()

    # Comment-sibling: missing required `.comment` keys.
    result.blocking_violations.extend(
        validate_required_comment_siblings(locale_data, usage_map)
    )

    # Per-key string validation.
    flat = _flatten(locale_data)
    for key, value in flat.items():
        # Exclude meta keys (handled elsewhere).
        if key.endswith(".comment") or key.endswith(".lint-skip"):
            continue
        if _has_lint_skip(locale_data, key):
            result.skipped_keys.append(key)
            continue

        entry = usage_map.get(key, {})
        surfaces = entry.get("surfaces", ["general"])
        primary_surface = _primary_surface(surfaces)

        # Sentence case.
        for err in validate_sentence_case(value, lists):
            result.blocking_violations.append(f"{key}: {err}")
        # Period rule.
        for err in validate_period_rule(value, primary_surface):
            result.blocking_violations.append(f"{key}: {err}")
        # Trailing bang.
        for err in validate_no_trailing_bang(value):
            result.blocking_violations.append(f"{key}: {err}")
        # Forbidden phrases.
        for err in validate_no_forbidden_phrases(value, lists):
            result.blocking_violations.append(f"{key}: {err}")

        # Ellipsis: warning only.
        if entry.get("ellipsis_candidate") and not value.rstrip().endswith("..."):
            result.warnings.append(
                f"{key}: button/menu opening dialog; consider trailing '...': {value!r}"
            )

    return result


def run_non_en_check(locale_paths: List[Path]) -> List[str]:
    """Verify no non-en-US file contains `.comment` keys."""
    errors: List[str] = []
    for path in locale_paths:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for err in validate_no_comment_in_non_en(data):
            errors.append(f"{path}: {err}")
    return errors
