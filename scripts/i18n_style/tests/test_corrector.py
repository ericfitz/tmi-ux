"""Tests for the mechanical corrector."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.corrector import (
    correct_sentence_case,
    correct_trailing_bang,
)


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns={"TMI", "Timmy", "Google Drive"},
        acronyms={"CVSS", "URL", "API"},
        domain_nouns={"threat model", "diagram"},
        ambiguous_words=set(),
        forbidden_phrases=set(),
    )


class TestCorrectSentenceCase(unittest.TestCase):
    def test_already_correct_unchanged(self):
        self.assertEqual(
            correct_sentence_case("Add document", _lists()), "Add document"
        )

    def test_title_case_lowered_mid_sentence(self):
        self.assertEqual(
            correct_sentence_case("Add Document", _lists()), "Add document"
        )

    def test_proper_noun_preserved(self):
        self.assertEqual(
            correct_sentence_case("About TMI", _lists()), "About TMI"
        )

    def test_acronym_preserved(self):
        self.assertEqual(
            correct_sentence_case("CVSS Score Calculator", _lists()),
            "CVSS score calculator",
        )

    def test_domain_noun_lowered(self):
        self.assertEqual(
            correct_sentence_case("Add Threat Model", _lists()),
            "Add threat model",
        )


class TestCorrectTrailingBang(unittest.TestCase):
    def test_no_bang_unchanged(self):
        self.assertEqual(correct_trailing_bang("Saved."), "Saved.")

    def test_trailing_bang_replaced_with_period(self):
        self.assertEqual(correct_trailing_bang("Saved!"), "Saved.")


if __name__ == "__main__":
    unittest.main()
