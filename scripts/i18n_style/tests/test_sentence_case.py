"""Tests for sentence-case validator."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.sentence_case import validate_sentence_case


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns={"TMI", "Timmy", "Google Drive", "GitHub"},
        acronyms={"CVSS", "URL", "API"},
        domain_nouns={"threat model", "diagram", "asset"},
        ambiguous_words={"Filter", "Save"},
        forbidden_phrases=set(),
    )


class TestSentenceCase(unittest.TestCase):
    def test_simple_sentence_case_passes(self):
        self.assertEqual(validate_sentence_case("Add document", _lists()), [])

    def test_title_case_fails(self):
        errors = validate_sentence_case("Add Document", _lists())
        self.assertTrue(errors)
        self.assertIn("Document", errors[0])

    def test_first_letter_must_be_upper(self):
        errors = validate_sentence_case("add document", _lists())
        self.assertTrue(errors)

    def test_proper_noun_preserved(self):
        self.assertEqual(validate_sentence_case("Open in TMI", _lists()), [])

    def test_acronym_preserved(self):
        self.assertEqual(validate_sentence_case("CVSS score", _lists()), [])

    def test_acronym_lowercase_fails(self):
        errors = validate_sentence_case("Cvss score", _lists())
        self.assertTrue(errors)

    def test_domain_noun_lowercase_mid_sentence(self):
        self.assertEqual(validate_sentence_case("Add threat model", _lists()), [])

    def test_domain_noun_capitalized_mid_sentence_fails(self):
        errors = validate_sentence_case("Add Threat Model", _lists())
        self.assertTrue(errors)

    def test_proper_noun_at_start(self):
        self.assertEqual(validate_sentence_case("TMI is great", _lists()), [])

    def test_first_word_after_period_capitalized(self):
        self.assertEqual(
            validate_sentence_case("Failed to save. Try again later.", _lists()),
            [],
        )

    def test_single_word_passes(self):
        self.assertEqual(validate_sentence_case("Save", _lists()), [])

    def test_skips_pure_delegation(self):
        self.assertEqual(
            validate_sentence_case("{{some.other.key}}", _lists()), []
        )

    def test_skips_url(self):
        self.assertEqual(
            validate_sentence_case("https://example.com/path", _lists()), []
        )

    def test_skips_code_like(self):
        self.assertEqual(
            validate_sentence_case("e.g., {key} = 'value'", _lists()), []
        )

    def test_string_starting_with_placeholder(self):
        self.assertEqual(
            validate_sentence_case("{{count}} items selected", _lists()), []
        )

    def test_string_starting_with_placeholder_titlecase_fails(self):
        errors = validate_sentence_case("{{count}} Items selected", _lists())
        self.assertTrue(errors)

    def test_symbol_joined_each_capitalized(self):
        self.assertEqual(validate_sentence_case("Yes/No", _lists()), [])

    def test_symbol_joined_lowercase_second_fails(self):
        errors = validate_sentence_case("Yes/no", _lists())
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
