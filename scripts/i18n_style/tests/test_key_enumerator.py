"""Tests for scripts.i18n_style.key_enumerator."""

import json
import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.key_enumerator import enumerate_keys


class TestEnumerateKeys(unittest.TestCase):
    def test_flat_keys(self):
        data = {"foo": "value1", "bar": "value2"}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            f.flush()
            keys = enumerate_keys(Path(f.name))
        self.assertEqual(set(keys), {"foo", "bar"})

    def test_nested_keys(self):
        data = {"common": {"save": "Save", "cancel": "Cancel"}}
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            f.flush()
            keys = enumerate_keys(Path(f.name))
        self.assertEqual(set(keys), {"common.save", "common.cancel"})

    def test_excludes_comment_siblings(self):
        data = {
            "common": {
                "save": "Save",
                "save.comment": "Verb. Used on submit buttons.",
            }
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            f.flush()
            keys = enumerate_keys(Path(f.name))
        self.assertEqual(set(keys), {"common.save"})

    def test_excludes_lint_skip_siblings(self):
        data = {
            "foo": "Bar",
            "foo.lint-skip": "Reason for skipping lint",
        }
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump(data, f)
            f.flush()
            keys = enumerate_keys(Path(f.name))
        self.assertEqual(set(keys), {"foo"})


if __name__ == "__main__":
    unittest.main()
