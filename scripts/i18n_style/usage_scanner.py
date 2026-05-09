"""Scan source files for usages of i18n keys via ripgrep.

Stage 2 of the usage-map pipeline. Uses fully-qualified key names.
"""

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


_INCLUDE_GLOBS = ["*.ts", "*.html", "*.scss"]
_EXCLUDE_DIRS = {"node_modules", "dist", "coverage", ".angular", ".git"}


@dataclass
class KeyUsage:
    """A single occurrence of a key in source code."""

    file: Path
    line: int
    context: str
    classes: List[str] = field(default_factory=list)


def _extract_classes(html_line: str) -> List[str]:
    """Extract CSS class names from a single HTML line.

    Best-effort: looks for class="..." attributes on the same line. Multi-line
    attribute splits are not handled (rare in practice).
    """
    classes: List[str] = []
    for match in re.finditer(r'class\s*=\s*"([^"]+)"', html_line):
        classes.extend(match.group(1).split())
    return classes


def scan_for_key(key: str, root: Path) -> List[KeyUsage]:
    """Run ripgrep for a fully-qualified key under `root`.

    Searches the same patterns the existing check-unused-i18n-keys.cjs uses:
    string literals containing the key followed by transloco/translate
    invocations, or attribute bindings.
    """
    # Fixed-string search for the literal key surrounded by quotes.
    # ripgrep's -F is fixed-string mode; -n adds line numbers.
    patterns = [f"'{key}'", f'"{key}"', f"`{key}`"]

    found: dict[tuple[Path, int], KeyUsage] = {}
    for pattern in patterns:
        cmd = ["rg", "-F", "-n", pattern, str(root)]
        for glob in _INCLUDE_GLOBS:
            cmd.extend(["-g", glob])
        for d in _EXCLUDE_DIRS:
            cmd.extend(["-g", f"!**/{d}/**"])

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode not in (0, 1):
            # 0 = matches, 1 = no matches; anything else is an error.
            raise RuntimeError(f"rg failed: {result.stderr}")

        for raw_line in result.stdout.splitlines():
            # ripgrep output: <file>:<line>:<content>
            parts = raw_line.split(":", 2)
            if len(parts) != 3:
                continue
            file_str, line_str, context = parts
            try:
                line = int(line_str)
            except ValueError:
                continue
            file_path = Path(file_str)
            dedup_key = (file_path, line)
            if dedup_key in found:
                continue
            classes = (
                _extract_classes(context) if file_path.suffix == ".html" else []
            )
            found[dedup_key] = KeyUsage(
                file=file_path,
                line=line,
                context=context.strip(),
                classes=classes,
            )

    return list(found.values())
