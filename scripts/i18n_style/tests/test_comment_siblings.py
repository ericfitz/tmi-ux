"""Tests for comment-sibling validator."""

import unittest

from scripts.i18n_style.comment_siblings import (
    validate_required_comment_siblings,
    validate_no_comment_in_non_en,
)


class TestRequiredCommentSiblings(unittest.TestCase):
    def test_short_ambiguous_word_with_comment_passes(self):
        data = {
            "common": {
                "filter": "Filter",
                "filter.comment": "Verb on a filter button.",
            }
        }
        usage_map = {
            "common.filter": {
                "ambiguous_word": True,
                "needs_translator_comment": False,
            }
        }
        self.assertEqual(
            validate_required_comment_siblings(data, usage_map), []
        )

    def test_short_ambiguous_word_without_comment_fails(self):
        data = {"common": {"filter": "Filter"}}
        usage_map = {
            "common.filter": {
                "ambiguous_word": True,
                "needs_translator_comment": True,
            }
        }
        errors = validate_required_comment_siblings(data, usage_map)
        self.assertTrue(errors)
        self.assertIn("common.filter", errors[0])

    def test_long_string_no_comment_required(self):
        data = {"common": {"filter": "Filter the list of users by role"}}
        usage_map = {
            "common.filter": {
                "ambiguous_word": False,
                "needs_translator_comment": False,
            }
        }
        self.assertEqual(
            validate_required_comment_siblings(data, usage_map), []
        )


class TestNoCommentInNonEn(unittest.TestCase):
    def test_clean_locale_passes(self):
        data = {"common": {"save": "Guardar"}}
        self.assertEqual(validate_no_comment_in_non_en(data), [])

    def test_comment_key_in_non_en_fails(self):
        data = {
            "common": {
                "save": "Guardar",
                "save.comment": "Verb. Used on submit buttons.",
            }
        }
        errors = validate_no_comment_in_non_en(data)
        self.assertTrue(errors)
        self.assertIn("comment", errors[0])


if __name__ == "__main__":
    unittest.main()
