"""Infer the UI surface of an i18n key from its usage records.

Surface taxonomy:
- page-title, dialog-title
- button, menu-item
- tooltip, placeholder, label
- error, validation, snackbar
- description, general

A key may have multiple surfaces (used in more than one place).
"""

import re
from typing import Iterable, Set

from scripts.i18n_style.usage_scanner import KeyUsage


_DIALOG_TITLE_PATTERNS = [
    re.compile(r"\bmat-dialog-title\b"),
    re.compile(r"\[matDialogTitle\]"),
]
_PAGE_TITLE_PATTERNS = [
    re.compile(r"<h[1-6]\b"),
]
_BUTTON_PATTERNS = [
    re.compile(r"<button\b"),
    re.compile(r"\bmat-raised-button\b"),
    re.compile(r"\bmat-flat-button\b"),
    re.compile(r"\bmat-stroked-button\b"),
    re.compile(r"\bmat-icon-button\b"),
    re.compile(r"\bmat-mdc-button\b"),
]
_MENU_ITEM_PATTERNS = [
    re.compile(r"\bmat-menu-item\b"),
    re.compile(r"\bMatMenuItem\b"),
]
_TOOLTIP_PATTERNS = [
    re.compile(r"\[matTooltip\]"),
    re.compile(r"\bmatTooltip\s*="),
]
_PLACEHOLDER_PATTERNS = [
    re.compile(r"\[?placeholder\]?\s*="),
]
_LABEL_PATTERNS = [
    re.compile(r"<mat-label\b"),
]
_ERROR_PATTERNS = [
    re.compile(r"<mat-error\b"),
]
_SNACKBAR_PATTERNS = [
    re.compile(r"\bsnackBar\.open\b", re.IGNORECASE),
    re.compile(r"\bsnackbar\.open\b", re.IGNORECASE),
    re.compile(r"\bnotify\b"),
    re.compile(r"\bMatSnackBar\b"),
]


def _surfaces_for_usage(usage: KeyUsage) -> Set[str]:
    ctx = usage.context
    surfaces: Set[str] = set()

    for p in _DIALOG_TITLE_PATTERNS:
        if p.search(ctx):
            surfaces.add("dialog-title")
            break
    if "dialog-title" not in surfaces:
        for p in _PAGE_TITLE_PATTERNS:
            if p.search(ctx):
                surfaces.add("page-title")
                break

    for p in _MENU_ITEM_PATTERNS:
        if p.search(ctx):
            surfaces.add("menu-item")
            break
    if "menu-item" not in surfaces:
        for p in _BUTTON_PATTERNS:
            if p.search(ctx):
                surfaces.add("button")
                break

    for p in _TOOLTIP_PATTERNS:
        if p.search(ctx):
            surfaces.add("tooltip")
            break

    for p in _PLACEHOLDER_PATTERNS:
        if p.search(ctx):
            surfaces.add("placeholder")
            break

    for p in _LABEL_PATTERNS:
        if p.search(ctx):
            surfaces.add("label")
            break

    for p in _ERROR_PATTERNS:
        if p.search(ctx):
            surfaces.add("error")
            break

    for p in _SNACKBAR_PATTERNS:
        if p.search(ctx):
            surfaces.add("snackbar")
            break

    return surfaces


def infer_surfaces(usages: Iterable[KeyUsage]) -> Set[str]:
    """Return the set of inferred surfaces across all usage records.

    Returns {"general"} as a fallback when no specific surface signal is
    present in any usage.
    """
    surfaces: Set[str] = set()
    for usage in usages:
        surfaces |= _surfaces_for_usage(usage)
    if not surfaces:
        return {"general"}
    return surfaces
