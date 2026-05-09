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


if __name__ == "__main__":
    unittest.main()
