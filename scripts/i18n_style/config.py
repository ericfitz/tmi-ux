"""Loads the maintained-lists config used by the i18n style check."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Set


@dataclass(frozen=True)
class StyleLists:
    """Maintained lists driving the i18n style check."""

    proper_nouns: Set[str]
    acronyms: Set[str]
    domain_nouns: Set[str]
    ambiguous_words: Set[str]
    forbidden_phrases: Set[str]


def load_lists(path: Optional[Path] = None) -> StyleLists:
    """Load the maintained lists from JSON.

    Defaults to scripts/i18n_style/lists.json relative to this module.
    """
    if path is None:
        path = Path(__file__).parent / "lists.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return StyleLists(
        proper_nouns=set(data.get("proper_nouns", [])),
        acronyms=set(data.get("acronyms", [])),
        domain_nouns=set(data.get("domain_nouns", [])),
        ambiguous_words=set(data.get("ambiguous_words", [])),
        forbidden_phrases=set(data.get("forbidden_phrases", [])),
    )
