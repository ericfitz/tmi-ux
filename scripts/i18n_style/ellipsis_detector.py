"""Detect whether a button/menu-item key opens a dialog before completing.

Best-effort static analysis. For each usage of a button/menu-item key:
1. Extract the click handler name from the (click)="handler()" binding in the
   usage context line or a surrounding window of HTML lines (Angular templates
   commonly split button attributes across lines, so the key reference and the
   click binding may appear on different lines).
2. Locate the handler in the corresponding .ts component.
3. Check whether the handler body invokes MatDialog.open or similar.

Patterns considered "opens a dialog":
- this.dialog.open(...)
- MatDialog.open(...)
- *Dialog.open(...) on any service named ending in Dialog
- *Picker.* invocation (file picker services)
- this.router.navigate(...) to a route that hosts a dialog (out of scope;
  handled by the model-verification stage if needed)
"""

import re
from pathlib import Path
from typing import Iterable, Optional

from scripts.i18n_style.usage_scanner import KeyUsage


# Window size (lines before and after the matched line) to search for a
# (click)="handler()" binding when it is not on the same line as the key.
_CONTEXT_WINDOW = 8

_CLICK_BINDING = re.compile(r'\(click\)\s*=\s*["\']([a-zA-Z_$][\w$]*)\(')
_BUTTON_HINT = re.compile(r"<button\b|mat-menu-item|MatMenuItem", re.IGNORECASE)
_DIALOG_OPEN_PATTERNS = [
    re.compile(r"\bdialog\.open\s*\("),
    re.compile(r"\bMatDialog\b.*?\.open\s*\("),
    re.compile(r"\b\w*Dialog\.open\s*\("),
    re.compile(r"\b\w*Picker\w*\.(open|invoke|pick|show)\s*\("),
    re.compile(r"\bbottomSheet\.open\s*\("),
]


def _find_component_ts(html_path: Path) -> Path:
    """Given a .component.html path, return the sibling .component.ts."""
    if html_path.suffix == ".html":
        ts_path = html_path.with_suffix(".ts")
        if ts_path.exists():
            return ts_path
    return html_path  # caller will skip if not a .ts


def _handler_opens_dialog(handler_name: str, ts_path: Path) -> bool:
    """Check whether the named handler in `ts_path` calls dialog.open or similar."""
    if not ts_path.exists() or ts_path.suffix != ".ts":
        return False
    try:
        source = ts_path.read_text(encoding="utf-8")
    except OSError:
        return False

    # Find the handler method body (best-effort: grab from method-name to next
    # top-level `}` at the same indentation, capped to a fixed number of lines).
    pattern = re.compile(
        rf"\b{re.escape(handler_name)}\s*\([^)]*\)\s*[:\w<>,\s]*\{{",
    )
    match = pattern.search(source)
    if not match:
        return False
    start = match.end()
    # Naive brace-matching, capped at 8000 characters from start.
    depth = 1
    pos = start
    line_count = 0
    while pos < len(source) and depth > 0 and line_count < 8000:
        char = source[pos]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        elif char == "\n":
            line_count += 1
        pos += 1
    body = source[start:pos]
    return any(p.search(body) for p in _DIALOG_OPEN_PATTERNS)


def _click_handler_from_context(context: str) -> Optional[str]:
    """Extract click handler name from a single context line, or None."""
    m = _CLICK_BINDING.search(context)
    return m.group(1) if m else None


def _click_handler_from_file(file_path: Path, line_no: int) -> Optional[str]:
    """Search lines preceding `line_no` (1-based) in an HTML file for a
    (click)="handler()" binding that belongs to an enclosing <button>.

    Angular templates frequently split button attributes across lines, so the
    i18n key reference (e.g. on a child <span>) and the (click) binding on the
    parent <button> element appear on different lines.  We scan only *before*
    the matched line: the button opening tag must precede the key reference
    in the DOM.  Scanning forward would incorrectly associate a sibling
    button (below the key in the file) with the key.

    A match is only accepted when a <button> opening tag also appears in the
    same backward window, ensuring the click binding is on a button element
    rather than some other interactive element.
    """
    if file_path.suffix != ".html" or not file_path.exists():
        return None
    try:
        lines = file_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None
    idx = line_no - 1  # convert to 0-based
    start = max(0, idx - _CONTEXT_WINDOW)
    # Only look backwards — the enclosing <button> opens before the key line.
    window_lines = lines[start:idx]
    window = " ".join(window_lines)
    if not _BUTTON_HINT.search(window):
        return None
    m = _CLICK_BINDING.search(window)
    return m.group(1) if m else None


def is_ellipsis_candidate(usages: Iterable[KeyUsage], root: Path) -> bool:
    """Return True if any usage is a button/menu-item whose click handler opens a dialog.

    Strategy:
    1. First check the single context line for a (click) binding and button hint
       (fast path — works when both are on the same line).
    2. If the context doesn't contain a (click) binding but the file is an HTML
       file, read the surrounding window to locate the enclosing button element
       and its click handler (handles multi-line Angular template patterns).
    """
    for usage in usages:
        # Fast path: button hint and click binding both on the context line.
        if _BUTTON_HINT.search(usage.context):
            handler = _click_handler_from_context(usage.context)
            if handler:
                ts_path = _find_component_ts(usage.file)
                if _handler_opens_dialog(handler, ts_path):
                    return True

        # Fallback: read surrounding HTML lines to find an enclosing button/click.
        if usage.file.suffix == ".html":
            handler = _click_handler_from_file(usage.file, usage.line)
            if handler:
                ts_path = _find_component_ts(usage.file)
                if _handler_opens_dialog(handler, ts_path):
                    return True

    return False
