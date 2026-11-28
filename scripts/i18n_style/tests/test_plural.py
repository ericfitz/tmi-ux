"""Tests for scripts.i18n_style.plural and plural-group handling in the i18n tools."""

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.i18n_style import usage_map_builder
from scripts.i18n_style.plural import is_plural_group

_CHECK_I18N = Path(__file__).resolve().parents[2] / "check-i18n.py"


def _load_check_i18n():
    spec = importlib.util.spec_from_file_location("check_i18n", _CHECK_I18N)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TestIsPluralGroup(unittest.TestCase):
    def test_accepts_category_objects_with_other(self):
        self.assertTrue(is_plural_group({"other": "x"}))
        self.assertTrue(is_plural_group({"one": "a", "few": "b", "many": "c", "other": "d"}))

    def test_rejects_objects_without_other(self):
        self.assertFalse(is_plural_group({"one": "a", "few": "b"}))

    def test_rejects_objects_with_non_category_keys(self):
        self.assertFalse(is_plural_group({"one": "a", "other": "b", "title": "c"}))

    def test_rejects_non_objects(self):
        self.assertFalse(is_plural_group("other"))
        self.assertFalse(is_plural_group(None))
        self.assertFalse(is_plural_group(["other"]))


class TestCheckI18nPluralGroups(unittest.TestCase):
    def test_plural_group_is_one_key_so_locales_with_more_categories_match(self):
        check = _load_check_i18n()
        en = {"a": {"count": {"one": "1", "other": "n"}, "title": "T"}}
        ru = {"a": {"count": {"one": "1", "few": "f", "many": "m", "other": "n"}, "title": "T"}}
        self.assertEqual(check.get_all_keys(en), check.get_all_keys(ru))
        self.assertIn("a.count", check.get_all_keys(ru))
        self.assertNotIn("a.count.few", check.get_all_keys(ru))


class TestUsageMapPluralGroups(unittest.TestCase):
    def test_category_leaves_are_scanned_by_the_group_key(self):
        data = {"a": {"count": {"one": "{{count}} note", "other": "{{count}} notes"}}}
        with tempfile.TemporaryDirectory() as tmp:
            en_us = Path(tmp) / "en-US.json"
            en_us.write_text(json.dumps(data), encoding="utf-8")
            with mock.patch.object(usage_map_builder, "scan_for_key", return_value=[]) as scan, \
                mock.patch.object(usage_map_builder, "scan_for_partial_key", return_value=[]):
                usage_map_builder.build_usage_map(en_us, Path(tmp))
        self.assertEqual({c.args[0] for c in scan.call_args_list}, {"a.count"})


if __name__ == "__main__":
    unittest.main()
