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


@dataclass
class PartialKeyCandidate:
    """A candidate usage location matching a partial key."""

    file: Path
    line: int
    context: str
    confidence: str  # "medium" or "low"


def scan_for_partial_key(key: str, root: Path) -> List[PartialKeyCandidate]:
    """Search for keys whose path is constructed dynamically.

    Looks for two patterns:

    1. Parent-prefix match (medium confidence): any ancestor prefix of the key
       as a quoted string, e.g., 'admin.users.' for the key 'admin.users.x'.
       All ancestor prefixes are tried (from shortest to longest) so that
       dynamic construction patterns like ``'admin.users.' + state + '.label'``
       are found for a 4-segment key.
    2. Leaf-only match (low confidence): the final segment of the key as a
       quoted string, e.g., `'filterLabel'` for the key 'admin.users.filterLabel'.

    Returns a list of candidates with confidence levels.
    """
    parts = key.split(".")
    if len(parts) < 2:
        return []

    # All ancestor prefixes (with trailing dot), from shortest to longest,
    # excluding the full key itself.
    ancestor_prefixes = [
        ".".join(parts[:i]) + "." for i in range(1, len(parts))
    ]
    leaf = parts[-1]

    candidates: List[PartialKeyCandidate] = []
    seen: set[tuple[Path, int]] = set()

    def _search(pattern: str, confidence: str, quoted: bool = True) -> None:
        """Run ripgrep for `pattern` and record candidates."""
        quote_variants = ("'", '"', "`") if quoted else ("",)
        for quote in quote_variants:
            cmd = ["rg", "-F", "-n", f"{quote}{pattern}"]
            cmd.extend(["-g", "*.ts", "-g", "*.html", "-g", "*.scss"])
            for d in _EXCLUDE_DIRS:
                cmd.extend(["-g", f"!**/{d}/**"])
            cmd.append(str(root))
            result = subprocess.run(cmd, capture_output=True, text=True)
            if result.returncode not in (0, 1):
                continue
            for raw_line in result.stdout.splitlines():
                parts2 = raw_line.split(":", 2)
                if len(parts2) != 3:
                    continue
                file_str, line_str, context = parts2
                try:
                    line = int(line_str)
                except ValueError:
                    continue
                dedup = (Path(file_str), line)
                if dedup in seen:
                    continue
                seen.add(dedup)
                candidates.append(
                    PartialKeyCandidate(
                        file=Path(file_str),
                        line=line,
                        context=context.strip(),
                        confidence=confidence,
                    )
                )

    for prefix in ancestor_prefixes:
        _search(prefix, "medium")

    # Low-confidence leaf search: look for the leaf as a quoted token,
    # or as a dot-prefixed bare token inside template literals (e.g. `.filterLabel`).
    _search(leaf, "low")
    _search(f".{leaf}", "low", quoted=False)

    return candidates
