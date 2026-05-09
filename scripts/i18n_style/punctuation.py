"""Punctuation validator for en-US strings.

Implements three independent checks:
- Period rule: full sentences end with `.`, fragments do not.
- No trailing `!` on any string.
- No forbidden phrases (case-insensitive substring match).
"""

import re
from typing import List

from scripts.i18n_style.config import StyleLists


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_PURE_DELEGATION_RE = re.compile(r"^\{\{[a-zA-Z][\w.]*\}\}$")

# Surfaces where the string is universally a fragment (period rule says
# "no period"): placeholders, helper hints, tooltips that are short labels,
# titles (page-, dialog-, section-), buttons, and menu items. These elements
# are labels by convention; a "complete sentence" rendered in any of them
# would be a UX bug regardless of grammar.
_FRAGMENT_SURFACES = {
    "placeholder",
    "label",
    "tooltip",
    "page-title",
    "dialog-title",
    "button",
    "menu-item",
}

# Verb-detection: very rough. Token ends in -ed, -ing, -s, or is in this small
# list of irregulars. False positives/negatives are expected — borderline cases
# go to human review during the audit.
_AUXILIARIES = {
    "is", "was", "are", "were", "be", "been", "being", "has", "have", "had",
    "do", "does", "did", "will", "would", "should", "could", "must", "may",
    "might", "can", "shall",
}
_IRREGULAR_VERBS = {
    "go", "goes", "went", "make", "made", "take", "took", "see", "saw",
    "give", "gave", "find", "found", "get", "got", "say", "said", "know",
    "knew", "think", "thought", "come", "came", "send", "sent", "save",
    "load", "fail", "succeed",
}


def _should_skip(value: str) -> bool:
    """Return True if this value should be exempted from the period rule."""
    return bool(_URL_RE.match(value)) or bool(_PURE_DELEGATION_RE.match(value))


def _looks_like_sentence(value: str) -> bool:
    """Best-effort heuristic: ≥3 tokens AND contains a probable verb."""
    words = value.split()
    if len(words) < 3:
        return False
    for word in words:
        bare = word.rstrip(".,!?:;").lower()
        if bare in _AUXILIARIES or bare in _IRREGULAR_VERBS:
            return True
        if bare.endswith("ed") or bare.endswith("ing") or bare.endswith("s"):
            # Filter out plurals and noun forms with a small heuristic: skip
            # words ending in -s if they're 1-3 chars (likely "is", "was", etc.
            # already in auxiliaries; words like "as", "us", "his").
            if len(bare) > 3:
                return True
    return False


def validate_period_rule(value: str, surface: str) -> List[str]:
    """Validate that the string ends (or doesn't end) with a period appropriately.

    Args:
        value: The string to check.
        surface: The UI surface tag (e.g., "error", "placeholder", "general").
    """
    if _should_skip(value):
        return []

    stripped = value.rstrip()
    if not stripped:
        return []

    ends_with_period = stripped.endswith(".")

    if surface in _FRAGMENT_SURFACES:
        if ends_with_period:
            return [
                f"{surface} surface must not end with '.': {stripped[-30:]!r}"
            ]
        return []

    if _looks_like_sentence(stripped.rstrip(".")):
        if not ends_with_period and not stripped.endswith(("?",)):
            return [
                f"complete sentence must end with '.': {stripped[-30:]!r}"
            ]
    else:
        # Fragment in a non-fragment surface (e.g., a button label).
        # Period not allowed.
        if ends_with_period:
            return [
                f"fragment must not end with '.': {stripped[-30:]!r}"
            ]

    return []


def validate_no_trailing_bang(value: str) -> List[str]:
    """Validate that the string does not end with '!'."""
    if value.rstrip().endswith("!"):
        return [f"string must not end with '!': {value[-30:]!r}"]
    return []


def validate_no_forbidden_phrases(value: str, lists: StyleLists) -> List[str]:
    """Validate that the string contains no forbidden phrases."""
    errors: List[str] = []
    lowered = value.lower()
    for phrase in lists.forbidden_phrases:
        if phrase.lower() in lowered:
            errors.append(f"forbidden phrase '{phrase}' in: {value!r}")
    return errors
