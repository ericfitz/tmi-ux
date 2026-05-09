"""Tests for ellipsis candidate detection."""

import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.ellipsis_detector import is_ellipsis_candidate
from scripts.i18n_style.usage_scanner import KeyUsage


def _u(file: str, line: int, context: str) -> KeyUsage:
    return KeyUsage(file=Path(file), line=line, context=context, classes=[])


class TestIsEllipsisCandidate(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, relpath: str, content: str):
        full = self.root / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)

    def test_detects_dialog_open_in_handler(self):
        self._write(
            "src/foo.component.ts",
            """
            export class FooComponent {
              openEditor() {
                this.dialog.open(EditDialogComponent);
              }
            }
            """,
        )
        self._write(
            "src/foo.component.html",
            "<button (click)=\"openEditor()\">{{ 'foo.edit' | transloco }}</button>",
        )
        usage = _u(str(self.root / "src/foo.component.html"), 1,
                   "<button (click)=\"openEditor()\">{{ 'foo.edit' | transloco }}</button>")
        self.assertTrue(is_ellipsis_candidate([usage], self.root))

    def test_does_not_flag_immediate_action(self):
        self._write(
            "src/foo.component.ts",
            """
            export class FooComponent {
              save() {
                this.service.save();
              }
            }
            """,
        )
        self._write(
            "src/foo.component.html",
            "<button (click)=\"save()\">{{ 'foo.save' | transloco }}</button>",
        )
        usage = _u(str(self.root / "src/foo.component.html"), 1,
                   "<button (click)=\"save()\">{{ 'foo.save' | transloco }}</button>")
        self.assertFalse(is_ellipsis_candidate([usage], self.root))

    def test_returns_false_for_non_button_usage(self):
        usage = _u(str(self.root / "src/foo.html"), 1,
                   "<h1>{{ 'foo.title' | transloco }}</h1>")
        self.assertFalse(is_ellipsis_candidate([usage], self.root))

    def test_detects_dialog_open_multiline_template(self):
        """Key reference is on a <span> inside a multi-line <button> — real Angular pattern."""
        self._write(
            "src/bar.component.ts",
            """
            export class BarComponent {
              onAddItem() {
                this.dialog.open(AddItemDialogComponent, { width: '500px' });
              }
            }
            """,
        )
        html_content = (
            "        <button\n"
            "          mat-raised-button\n"
            "          color=\"primary\"\n"
            "          (click)=\"onAddItem()\"\n"
            "        >\n"
            "          <mat-icon>add</mat-icon>\n"
            "          <span [transloco]=\"'bar.addButton'\">Add Item</span>\n"
            "        </button>\n"
        )
        self._write("src/bar.component.html", html_content)
        # The context line is the <span> line (line 7); no button/click on that line.
        usage = _u(
            str(self.root / "src/bar.component.html"),
            7,
            "          <span [transloco]=\"'bar.addButton'\">Add Item</span>",
        )
        self.assertTrue(is_ellipsis_candidate([usage], self.root))

    def test_does_not_flag_multiline_immediate_action(self):
        """Multi-line button whose handler does not open a dialog."""
        self._write(
            "src/baz.component.ts",
            """
            export class BazComponent {
              onSave() {
                this.service.save(this.form.value);
              }
            }
            """,
        )
        html_content = (
            "        <button\n"
            "          mat-raised-button\n"
            "          (click)=\"onSave()\"\n"
            "        >\n"
            "          <span [transloco]=\"'baz.saveButton'\">Save</span>\n"
            "        </button>\n"
        )
        self._write("src/baz.component.html", html_content)
        usage = _u(
            str(self.root / "src/baz.component.html"),
            5,
            "          <span [transloco]=\"'baz.saveButton'\">Save</span>",
        )
        self.assertFalse(is_ellipsis_candidate([usage], self.root))


if __name__ == "__main__":
    unittest.main()
