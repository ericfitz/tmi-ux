"""Tests for punctuation validator."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.punctuation import (
    validate_period_rule,
    validate_no_trailing_bang,
    validate_no_forbidden_phrases,
)


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns=set(),
        acronyms=set(),
        domain_nouns=set(),
        ambiguous_words=set(),
        forbidden_phrases={"Please try again", "Sorry,", "Oops"},
    )


class TestPeriodRule(unittest.TestCase):
    def test_complete_sentence_with_period_passes(self):
        self.assertEqual(
            validate_period_rule("Failed to save the document.", "error"),
            [],
        )

    def test_complete_sentence_without_period_fails(self):
        errors = validate_period_rule("Failed to save the document", "error")
        self.assertTrue(errors)

    def test_fragment_without_period_passes(self):
        self.assertEqual(validate_period_rule("Required", "validation"), [])

    def test_fragment_with_period_fails(self):
        errors = validate_period_rule("Required.", "validation")
        self.assertTrue(errors)

    def test_placeholder_no_period(self):
        self.assertEqual(
            validate_period_rule("Search by name or email", "placeholder"), []
        )

    def test_skips_url(self):
        self.assertEqual(
            validate_period_rule("https://example.com", "general"), []
        )

    def test_skips_pure_delegation(self):
        self.assertEqual(
            validate_period_rule("{{another.key}}", "general"), []
        )


class TestNoTrailingBang(unittest.TestCase):
    def test_no_bang_passes(self):
        self.assertEqual(validate_no_trailing_bang("Saved successfully."), [])

    def test_trailing_bang_fails(self):
        errors = validate_no_trailing_bang("Saved!")
        self.assertTrue(errors)

    def test_bang_in_middle_passes(self):
        # Mid-string '!' is allowed (rare but possible).
        self.assertEqual(validate_no_trailing_bang("Saved! Now what."), [])


class TestForbiddenPhrases(unittest.TestCase):
    def test_clean_message_passes(self):
        self.assertEqual(
            validate_no_forbidden_phrases("Failed to save.", _lists()), []
        )

    def test_please_try_again_fails(self):
        errors = validate_no_forbidden_phrases(
            "Failed to save. Please try again.", _lists()
        )
        self.assertTrue(errors)
        self.assertIn("Please try again", errors[0])

    def test_case_insensitive_match(self):
        errors = validate_no_forbidden_phrases(
            "failed to save. please try again.", _lists()
        )
        self.assertTrue(errors)

    def test_sorry_comma_fails(self):
        errors = validate_no_forbidden_phrases(
            "Sorry, that didn't work.", _lists()
        )
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
