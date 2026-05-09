"""Sentence-case validator for en-US strings."""

import re
from typing import List

from scripts.i18n_style.config import StyleLists


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_CODE_LIKE_RE = re.compile(r"^e\.g\.,|=\s*['\"`]")
_PURE_DELEGATION_RE = re.compile(r"^\{\{[a-zA-Z][\w.]*\}\}$")
_LEADING_PLACEHOLDER_RE = re.compile(r"^\{\{[^}]+\}\}\s*")
# Sentence-terminator chars; word after one of these is "first word of new sentence".
_SENTENCE_END_CHARS = ".!?"


def _should_skip(value: str) -> bool:
    if _URL_RE.match(value):
        return True
    if _CODE_LIKE_RE.match(value):
        return True
    if _PURE_DELEGATION_RE.match(value):
        return True
    return False


def _strip_leading_placeholder(value: str) -> str:
    return _LEADING_PLACEHOLDER_RE.sub("", value).strip()


def _is_canonical_form(word: str, canonical_set: set) -> bool:
    """Check if `word` (or word stripped of trailing punctuation) is in canonical_set
    with exact case."""
    stripped = word.rstrip(".,!?:;")
    return stripped in canonical_set


def _matches_any_proper_noun_lowercase(word: str, proper_nouns: set) -> bool:
    """Check whether `word`'s lowercased form matches any proper noun's lowercased form
    (signaling that the word is intended to be a proper noun but case is wrong)."""
    stripped = word.rstrip(".,!?:;").lower()
    return any(p.lower() == stripped for p in proper_nouns)


def _matches_acronym_case_insensitive(word: str, acronyms: set) -> bool:
    stripped = word.rstrip(".,!?:;").upper()
    return stripped in acronyms


def _is_domain_noun_capitalized(value: str, domain_nouns: set) -> List[str]:
    """Return list of domain-noun violations (Title-Case usage mid-sentence)."""
    errors = []
    # Split into sentences (rough): on . ! ?
    sentences = re.split(r"(?<=[.!?])\s+", value)
    for sentence in sentences:
        # Skip the first word of a sentence (allowed to be capitalized).
        words = sentence.split()
        if not words:
            continue
        rest = " ".join(words[1:]) if len(words) > 1 else ""
        for domain_noun in domain_nouns:
            # Build a Title-Case version: each word capitalized.
            title_case = " ".join(w.capitalize() for w in domain_noun.split())
            # Avoid matching mid-word (use word-boundary regex).
            pattern = re.compile(rf"\b{re.escape(title_case)}\b")
            if pattern.search(rest):
                errors.append(
                    f"Domain noun '{domain_noun}' should be lowercase mid-sentence, "
                    f"found '{title_case}'"
                )
    return errors


def validate_sentence_case(value: str, lists: StyleLists) -> List[str]:
    """Return a list of human-readable error messages for sentence-case violations.

    An empty list means the string passes.
    """
    if _should_skip(value):
        return []

    errors: List[str] = []

    # Strip leading {{...}} placeholder if present (the rule applies to the
    # first literal word after it).
    stripped_value = _strip_leading_placeholder(value)
    if not stripped_value:
        return []

    # Pre-pass: domain-noun Title Case mid-sentence.
    errors.extend(_is_domain_noun_capitalized(value, lists.domain_nouns))

    # Walk words, tracking whether the next word starts a new sentence.
    words = re.findall(r"\S+", stripped_value)

    # If the original value started with a placeholder, the first literal word
    # follows the post-placeholder rule (lowercase unless proper noun/acronym).
    sentence_start = not bool(_LEADING_PLACEHOLDER_RE.match(value))

    for word in words:
        # Skip placeholders mid-string.
        if word.startswith("{{") and word.endswith("}}"):
            sentence_start = False
            continue

        # Word may have trailing sentence-end punctuation.
        bare = word.rstrip(",.;:!?)")

        # Acronym? Must be canonical (exact upper case).
        if _matches_acronym_case_insensitive(bare, lists.acronyms):
            if bare.rstrip(".,!?:;") not in lists.acronyms:
                errors.append(f"Acronym must be uppercase: '{bare}'")
            sentence_start = _word_ends_sentence(word)
            continue

        # Proper noun? Must be canonical (exact case).
        if _matches_any_proper_noun_lowercase(bare, lists.proper_nouns):
            if not _is_canonical_form(bare, lists.proper_nouns):
                errors.append(f"Proper noun must use canonical case: '{bare}'")
            sentence_start = _word_ends_sentence(word)
            continue

        # Symbol-joined: split on '/' or '-' and check each segment.
        if "/" in bare or "-" in bare:
            segments = re.split(r"[\-/]", bare)
            for seg in segments:
                if not seg:
                    continue
                if not seg[0].isupper():
                    errors.append(
                        f"Symbol-joined segment must be capitalized: '{seg}' in '{word}'"
                    )
            sentence_start = _word_ends_sentence(word)
            continue

        # Standard word.
        if sentence_start:
            if not bare or not bare[0].isupper():
                errors.append(f"First word of sentence must be capitalized: '{bare}'")
        else:
            if bare and bare[0].isupper():
                errors.append(
                    f"Word should be lowercase mid-sentence: '{bare}'"
                )

        sentence_start = _word_ends_sentence(word)

    return errors


def _word_ends_sentence(word: str) -> bool:
    """True if the word ends in . ! ? (so the next word starts a new sentence)."""
    bare = word.rstrip(")")
    return bool(bare) and bare[-1] in _SENTENCE_END_CHARS
