"""Mechanical corrections for clear-cut style violations.

Conservative: only applies fixes where the rule is unambiguous. Strings whose
correction requires judgment (forbidden-phrase replacement, period rule when
verb detection is uncertain) are left alone.
"""

import re
from typing import Set

from scripts.i18n_style.config import StyleLists


def _is_canonical_proper_noun_token(token_lower: str, proper_nouns: Set[str]) -> str:
    """If `token_lower` matches a proper noun's lowercased form, return the canonical
    case form. Returns empty string if no match."""
    for pn in proper_nouns:
        if pn.lower() == token_lower:
            return pn
    return ""


def _is_canonical_acronym_token(token_lower: str, acronyms: Set[str]) -> str:
    """If `token_lower` matches an acronym's lowercased form, return the canonical
    case form. Returns empty string if no match."""
    for ac in acronyms:
        if ac.lower() == token_lower:
            return ac
    return ""


# Matches common abbreviations like e.g., i.e., vs. whose trailing dot is not a sentence end.
_ABBREV_RE = re.compile(r"^([a-z]\.)+[a-z]?$")


def correct_sentence_case(value: str, lists: StyleLists) -> str:
    """Lower-case mid-sentence words to sentence case, preserving proper nouns,
    acronyms, and (lowercased) domain nouns."""
    if not value:
        return value
    # Skip strings that should be skipped by validators.
    if value.startswith(("http://", "https://")):
        return value
    if re.match(r"^\{\{[a-zA-Z][\w.]*\}\}$", value):
        return value
    # Skip non-sentence strings: email addresses, icon identifiers, slugs (no spaces,
    # contain only alphanumeric + hyphens/underscores/dots/@/:).
    if re.match(r"^[\w@.\-:]+$", value) and " " not in value:
        return value

    out_words = []
    sentence_start = True
    words = value.split(" ")
    for word in words:
        # Strip leading and trailing punctuation to isolate the token.
        bare_with_trail = word.rstrip(".,!?:;)]}")
        trail = word[len(bare_with_trail):]
        # Determine leading punctuation prefix (e.g. opening parens, quotes).
        prefix = ""
        bare = bare_with_trail
        for i, ch in enumerate(bare_with_trail):
            if ch in "([{\"'":
                prefix += ch
            else:
                bare = bare_with_trail[i:]
                break
        else:
            # All characters were prefix punctuation; keep as-is.
            out_words.append(word)
            continue

        bare_lower = bare.lower()
        # Sentence ends when trailing punctuation contains a sentence-ending char,
        # BUT NOT for common abbreviations (e.g., i.e., vs., etc.) whose bare form
        # looks like an abbreviation pattern (single letters separated by dots).
        is_abbreviation = bool(_ABBREV_RE.match(bare_lower))
        ends_sentence = (not is_abbreviation) and any(ch in trail for ch in ".!?")
        # Proper noun?
        canonical_pn = _is_canonical_proper_noun_token(bare_lower, lists.proper_nouns)
        if canonical_pn:
            out_words.append(prefix + canonical_pn + trail)
            sentence_start = ends_sentence
            continue

        # Acronym?
        canonical_ac = _is_canonical_acronym_token(bare_lower, lists.acronyms)
        if canonical_ac:
            out_words.append(prefix + canonical_ac + trail)
            sentence_start = ends_sentence
            continue

        # Sentence start: capitalize first letter; rest lowercase.
        if sentence_start:
            if bare:
                fixed = bare[0].upper() + bare[1:].lower()
            else:
                fixed = bare
            out_words.append(prefix + fixed + trail)
        else:
            # Mid-sentence: lowercase everything.
            out_words.append(prefix + bare.lower() + trail)

        sentence_start = ends_sentence

    return " ".join(out_words)


def correct_trailing_bang(value: str) -> str:
    """Replace a trailing '!' with '.'."""
    stripped = value.rstrip()
    if stripped.endswith("!"):
        trailing_ws = value[len(stripped):]
        return stripped[:-1] + "." + trailing_ws
    return value
