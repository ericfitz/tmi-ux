"""Tests for the orchestrator/checker."""

import json
import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.checker import run_check, CheckResult


class TestRunCheck(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.locale_path = self.root / "en-US.json"
        self.usage_path = self.root / "en-US.usage.json"

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, locale_data, usage_map):
        with open(self.locale_path, "w") as f:
            json.dump(locale_data, f)
        with open(self.usage_path, "w") as f:
            json.dump(usage_map, f)

    def test_clean_strings_pass(self):
        self._write(
            {"about": {"title": "About TMI"}},
            {
                "about.title": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertEqual(result.blocking_violations, [])

    def test_title_case_violation_blocks(self):
        self._write(
            {"about": {"title": "About Threat Model"}},
            {
                "about.title": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertTrue(result.blocking_violations)

    def test_lint_skip_sibling_skips_check(self):
        self._write(
            {
                "verbatim": {
                    "thing": "About Threat Model",
                    "thing.lint-skip": "Verbatim quote, do not edit.",
                }
            },
            {
                "verbatim.thing": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertEqual(result.blocking_violations, [])
        self.assertEqual(len(result.skipped_keys), 1)


if __name__ == "__main__":
    unittest.main()
