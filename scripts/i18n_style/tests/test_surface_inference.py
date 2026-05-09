"""Tests for scripts.i18n_style.surface_inference."""

import unittest
from pathlib import Path

from scripts.i18n_style.surface_inference import infer_surfaces
from scripts.i18n_style.usage_scanner import KeyUsage


def _u(file: str, line: int, context: str, classes=None) -> KeyUsage:
    return KeyUsage(
        file=Path(file), line=line, context=context, classes=classes or []
    )


class TestInferSurfaces(unittest.TestCase):
    def test_dialog_title(self):
        usages = [_u("foo.html", 1, '<h2 mat-dialog-title>{{ "x" | transloco }}</h2>')]
        self.assertEqual(infer_surfaces(usages), {"dialog-title"})

    def test_page_title_from_h1(self):
        usages = [_u("foo.html", 1, '<h1>{{ "x" | transloco }}</h1>')]
        self.assertEqual(infer_surfaces(usages), {"page-title"})

    def test_button_from_button_tag(self):
        usages = [
            _u("foo.html", 1, '<button mat-raised-button>{{ "x" | transloco }}</button>')
        ]
        self.assertEqual(infer_surfaces(usages), {"button"})

    def test_tooltip_from_mat_tooltip(self):
        usages = [_u("foo.html", 1, '<i [matTooltip]="\'x\' | transloco"></i>')]
        self.assertEqual(infer_surfaces(usages), {"tooltip"})

    def test_placeholder_from_attr(self):
        usages = [_u("foo.html", 1, '<input placeholder="{{ \'x\' | transloco }}">')]
        self.assertEqual(infer_surfaces(usages), {"placeholder"})

    def test_label_from_mat_label(self):
        usages = [_u("foo.html", 1, '<mat-label>{{ "x" | transloco }}</mat-label>')]
        self.assertEqual(infer_surfaces(usages), {"label"})

    def test_error_from_mat_error(self):
        usages = [_u("foo.html", 1, '<mat-error>{{ "x" | transloco }}</mat-error>')]
        self.assertEqual(infer_surfaces(usages), {"error"})

    def test_snackbar_from_open_call(self):
        usages = [
            _u(
                "foo.ts",
                1,
                "this.snackBar.open(this.transloco.translate('x'), 'OK', { duration: 3000 });",
            )
        ]
        self.assertEqual(infer_surfaces(usages), {"snackbar"})

    def test_menu_item_from_mat_menu_item(self):
        usages = [
            _u("foo.html", 1, '<button mat-menu-item>{{ "x" | transloco }}</button>')
        ]
        self.assertEqual(infer_surfaces(usages), {"menu-item"})

    def test_multi_surface(self):
        usages = [
            _u("a.html", 1, '<h1>{{ "x" | transloco }}</h1>'),
            _u("b.html", 1, '<button>{{ "x" | transloco }}</button>'),
        ]
        self.assertEqual(infer_surfaces(usages), {"page-title", "button"})

    def test_general_fallback(self):
        usages = [_u("foo.ts", 1, "const x = this.transloco.translate('x');")]
        self.assertEqual(infer_surfaces(usages), {"general"})


import tempfile


class TestMultiLineSurfaceInference(unittest.TestCase):
    """Tests for surface inference when the surface signal is on a parent element."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, relpath: str, content: str) -> Path:
        full = self.root / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)
        return full

    def test_button_signal_on_parent_line(self):
        path = self._write(
            "src/foo.html",
            '<button mat-menu-item (click)="x()">\n  <mat-icon>foo</mat-icon>\n  <span>{{ \'foo.menu\' | transloco }}</span>\n</button>\n',
        )
        # The key is on line 3; the parent button signal is on line 1.
        usage = KeyUsage(file=path, line=3, context='<span>{{ \'foo.menu\' | transloco }}</span>', classes=[])
        self.assertIn("menu-item", infer_surfaces([usage]))

    def test_button_with_span_child(self):
        path = self._write(
            "src/foo.html",
            '<button mat-flat-button (click)="x()">\n  <span>{{ \'foo.button\' | transloco }}</span>\n</button>\n',
        )
        usage = KeyUsage(file=path, line=2, context='<span>{{ \'foo.button\' | transloco }}</span>', classes=[])
        self.assertIn("button", infer_surfaces([usage]))

    def test_dialog_title_with_span_child(self):
        path = self._write(
            "src/foo.html",
            '<h2 mat-dialog-title>\n  {{ \'foo.title\' | transloco }}\n</h2>\n',
        )
        usage = KeyUsage(file=path, line=2, context='{{ \'foo.title\' | transloco }}', classes=[])
        self.assertIn("dialog-title", infer_surfaces([usage]))


class TestMatCardTitleSurfaceInference(unittest.TestCase):
    def test_mat_card_title_is_page_title(self):
        usages = [KeyUsage(file=Path("foo.html"), line=1, context='<mat-card-title [transloco]="\'foo\'">title</mat-card-title>', classes=[])]
        self.assertEqual(infer_surfaces(usages), {"page-title"})

    def test_mat_card_subtitle_is_page_title(self):
        usages = [KeyUsage(file=Path("foo.html"), line=1, context='<mat-card-subtitle>{{ \'foo\' | transloco }}</mat-card-subtitle>', classes=[])]
        self.assertEqual(infer_surfaces(usages), {"page-title"})


if __name__ == "__main__":
    unittest.main()
