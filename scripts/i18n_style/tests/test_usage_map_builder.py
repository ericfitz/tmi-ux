"""Tests for the minimum-viable usage map builder (stages 1, 2, 7, 9)."""

import json
import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.usage_map_builder import build_usage_map


class TestBuildUsageMap(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "src").mkdir()

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write_locale(self, data):
        path = self.root / "en-US.json"
        with open(path, "w") as f:
            json.dump(data, f)
        return path

    def _write_src(self, relpath, content):
        full = self.root / "src" / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)

    def test_map_has_entry_per_key(self):
        locale = self._write_locale({"common": {"save": "Save", "cancel": "Cancel"}})
        self._write_src(
            "foo.html",
            '<button>{{ \'common.save\' | transloco }}</button>\n',
        )
        usage_map = build_usage_map(locale, self.root)
        self.assertIn("common.save", usage_map)
        self.assertIn("common.cancel", usage_map)

    def test_found_key_has_uses_and_surfaces(self):
        locale = self._write_locale({"common": {"save": "Save"}})
        self._write_src(
            "foo.html",
            '<button>{{ \'common.save\' | transloco }}</button>\n',
        )
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["common.save"]
        self.assertEqual(len(entry["uses"]), 1)
        self.assertIn("button", entry["surfaces"])
        self.assertEqual(entry["confidence"], "high")

    def test_unfound_key_has_empty_uses(self):
        locale = self._write_locale({"orphan": "Orphan"})
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["orphan"]
        self.assertEqual(entry["uses"], [])
        self.assertEqual(entry["surfaces"], ["general"])
        self.assertEqual(entry["confidence"], "low")

    def test_default_fields_present(self):
        locale = self._write_locale({"foo": "Foo"})
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["foo"]
        self.assertIn("ellipsis_candidate", entry)
        self.assertIn("ambiguous_word", entry)
        self.assertIn("needs_translator_comment", entry)
        self.assertIn("found_by", entry)


class TestAmbiguousWordFlag(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "src").mkdir()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_short_ambiguous_word_flagged(self):
        # "Filter" is in the ambiguous_words list; ≤3 words.
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["ambiguous_word"])

    def test_existing_comment_marks_no_translator_need(self):
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump(
                {
                    "common": {
                        "filter": "Filter",
                        "filter.comment": "Verb. Used on filter buttons.",
                    }
                },
                f,
            )
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["ambiguous_word"])
        self.assertFalse(entry["needs_translator_comment"])

    def test_missing_comment_marks_translator_need(self):
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["needs_translator_comment"])

    def test_long_string_not_flagged(self):
        # > 3 words, even if it contains an ambiguous word.
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter the list of users by role"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertFalse(entry["ambiguous_word"])
        self.assertFalse(entry["needs_translator_comment"])


if __name__ == "__main__":
    unittest.main()
