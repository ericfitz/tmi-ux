"""Tests for scripts.i18n_style.config."""

import unittest
from pathlib import Path

from scripts.i18n_style.config import load_lists, StyleLists


class TestLoadLists(unittest.TestCase):
    def test_loads_all_categories(self):
        lists = load_lists()
        self.assertIsInstance(lists, StyleLists)
        self.assertIn("TMI", lists.proper_nouns)
        self.assertIn("CVSS", lists.acronyms)
        self.assertIn("threat model", lists.domain_nouns)
        self.assertIn("Filter", lists.ambiguous_words)
        self.assertIn("Please try again", lists.forbidden_phrases)

    def test_proper_nouns_are_case_sensitive_set(self):
        lists = load_lists()
        # 'tmi' (lowercase) should not be in the set; only 'TMI' is canonical.
        self.assertNotIn("tmi", lists.proper_nouns)

    def test_load_from_explicit_path(self):
        config_path = Path(__file__).parent.parent / "lists.json"
        lists = load_lists(config_path)
        self.assertIn("TMI", lists.proper_nouns)


if __name__ == "__main__":
    unittest.main()
