"""Tests for scripts.i18n_style.usage_scanner."""

import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.usage_scanner import scan_for_key, KeyUsage


class TestScanForKey(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, relpath: str, content: str):
        full = self.root / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)

    def test_finds_template_pipe_usage(self):
        self._write(
            "src/foo.component.html",
            '<button>{{ \'common.save\' | transloco }}</button>\n',
        )
        usages = scan_for_key("common.save", self.root)
        self.assertEqual(len(usages), 1)
        self.assertEqual(usages[0].file.name, "foo.component.html")
        self.assertEqual(usages[0].line, 1)

    def test_finds_translate_method_usage(self):
        self._write(
            "src/foo.service.ts",
            "this.transloco.translate('errors.generic');\n",
        )
        usages = scan_for_key("errors.generic", self.root)
        self.assertEqual(len(usages), 1)

    def test_returns_empty_when_no_match(self):
        self._write("src/foo.ts", "// nothing here\n")
        usages = scan_for_key("missing.key", self.root)
        self.assertEqual(usages, [])

    def test_skips_node_modules_and_dist(self):
        self._write(
            "node_modules/foo/x.ts",
            "{{ 'common.save' | transloco }}",
        )
        self._write(
            "dist/foo/x.ts",
            "{{ 'common.save' | transloco }}",
        )
        self._write(
            "src/real.ts",
            "{{ 'common.save' | transloco }}",
        )
        usages = scan_for_key("common.save", self.root)
        self.assertEqual(len(usages), 1)
        self.assertIn("src", str(usages[0].file))

    def test_captures_classes_when_html(self):
        self._write(
            "src/foo.html",
            '<button class="btn-primary big">{{ \'common.save\' | transloco }}</button>\n',
        )
        usages = scan_for_key("common.save", self.root)
        self.assertEqual(len(usages), 1)
        self.assertIn("btn-primary", usages[0].classes)
        self.assertIn("big", usages[0].classes)


if __name__ == "__main__":
    unittest.main()
