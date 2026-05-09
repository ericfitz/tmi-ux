# i18n style guide and capitalization audit — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an authoritative en-US capitalization/punctuation/tone style guide, build a mechanical analysis pipeline that maps every i18n key to its UI usage surface, implement a `lint:i18n` check enforced via `pnpm run lint:all`, correct en-US.json to conform, and regenerate affected translations across the 16 non-English locale files.

**Architecture:** A configuration-driven style-check Python script (uv-run, sibling of existing `scripts/check-i18n.py`) reads a maintained-lists JSON config and a sidecar usage map (`src/assets/i18n/en-US.usage.json`) to validate `en-US.json`. The usage map is built by a separate mechanical-analysis script that ripgreps transloco usages across `src/**/*.{ts,html,scss}`, augmented by a small model-verification step for low-confidence keys. The check runs in CI mode (exit non-zero on blocking violations) and audit mode (emit markdown report).

**Tech Stack:** Python 3 with `uv run` (PEP 723 inline deps) for new analysis scripts; existing `scripts/check-i18n.py` patterns as template; `ripgrep` (`rg`) for source scanning; `transloco` translation library (Angular); `MatDialog` / `MatMenuItem` / `MatSnackBar` Material conventions; `pnpm` for npm scripts; existing skills `translate_to_language`, `validate_translation`, `validate_localization_coverage`, `analyze_localization_files` for translation work.

**Spec:** [docs/superpowers/specs/2026-05-09-i18n-style-guide-design.md](../specs/2026-05-09-i18n-style-guide-design.md)

---

## Reading conventions for this plan

- File paths are absolute or relative to `/Users/efitz/Projects/tmi-ux/`.
- All Python scripts use `uv run` with PEP 723 inline metadata (matching existing `scripts/check-i18n.py`).
- When a step says "commit", use a conventional-commit message and end with the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer per `CLAUDE.md`.
- Python tests use `unittest` invoked via `uv run python -m unittest <module>`. No new test framework added.
- Phase boundaries are real checkpoints: at each phase boundary, `pnpm run lint:all` should pass and the work to date should be commitable as a coherent unit.

---

## File map

### New files (created by this plan)

- `src/assets/i18n/STYLE-GUIDE.md` — the rubric, expanded with examples.
- `src/assets/i18n/en-US.usage.json` — committed sidecar mapping every en-US key to its UI usage records.
- `scripts/i18n_style/__init__.py` — Python package for the style check.
- `scripts/i18n_style/config.py` — loads maintained-lists JSON.
- `scripts/i18n_style/lists.json` — maintained lists (proper nouns, acronyms, domain nouns, ambiguous words, forbidden phrases).
- `scripts/i18n_style/sentence_case.py` — sentence-case validator.
- `scripts/i18n_style/punctuation.py` — period-rule + forbidden-phrase + `!` validator.
- `scripts/i18n_style/comment_siblings.py` — `.comment` sibling requirement validator.
- `scripts/i18n_style/usage_map.py` — sidecar reader; provides surface lookup.
- `scripts/i18n_style/checker.py` — orchestrator (combines all validators); main entry point.
- `scripts/check-i18n-style.py` — uv-run wrapper invoking `scripts.i18n_style.checker`.
- `scripts/build-i18n-usage-map.py` — uv-run script implementing the mechanical pipeline (stages 1-9).
- `scripts/i18n_style/tests/__init__.py`
- `scripts/i18n_style/tests/test_sentence_case.py`
- `scripts/i18n_style/tests/test_punctuation.py`
- `scripts/i18n_style/tests/test_comment_siblings.py`
- `scripts/i18n_style/tests/test_checker.py`
- `scripts/i18n_style/tests/test_usage_map_builder.py`
- `docs/i18n-audit-review.md` — transient working document (deleted at end of Phase 5).

### Files modified

- `src/assets/i18n/en-US.json` — strings corrected per rubric; new `.comment` siblings added where required.
- `src/assets/i18n/<locale>.json` — for each of 16 non-English locales, regenerate keys whose en-US value changed.
- `src/assets/i18n/i18n-allowlist.json` — minor allowlist updates if regenerated translations match en-US.
- `package.json` — new `lint:i18n` script; `lint:all` invokes it.

---

## Phase 0 — Branch setup and skill announcement

### Task 0.1: Confirm working branch

**Files:** none

- [ ] **Step 1: Verify current branch**

Run: `git branch --show-current`
Expected: `dev/1.4.0`

- [ ] **Step 2: Verify clean working tree**

Run: `git status`
Expected: clean (or only the spec from the brainstorming session, which is already committed).

- [ ] **Step 3: Verify spec commit is in place**

Run: `git log --oneline -1 docs/superpowers/specs/2026-05-09-i18n-style-guide-design.md`
Expected: a commit hash and message starting with `docs: add design spec for i18n style guide and capitalization audit (#676)`.

---

## Phase 1 — Style guide document and maintained-lists config

### Task 1.1: Write `STYLE-GUIDE.md`

**Files:**
- Create: `src/assets/i18n/STYLE-GUIDE.md`

- [ ] **Step 1: Write the style guide document**

Create `src/assets/i18n/STYLE-GUIDE.md` with the following content:

```markdown
# en-US localization style guide

**Audience:** Contributors editing `en-US.json`, and translators referencing en-US as the source of truth for the 16 supported locales.

**Enforcement:** The rules in this document marked **[lint]** are enforced by `pnpm run lint:i18n`, which is invoked by `pnpm run lint:all`.

## Capitalization

### Sentence case is the default

All en-US strings use **sentence case**: only the first letter of the string is capitalized, all other letters are lowercase, except as called out below.

**[lint]** Examples:

- ✅ `Add document`
- ❌ `Add Document` (Title Case is not used)
- ✅ `Save`
- ❌ `SAVE` (all-caps is not used)

### Proper nouns preserve canonical capitalization

The following terms keep their canonical case wherever they appear:

`TMI`, `Timmy`, `OAuth`, `JWT`, `Google Drive`, `Google Workspace`, `Microsoft`, `GitHub`.

This list is maintained in `scripts/i18n_style/lists.json` (`proper_nouns`). Add to it via PR when a new product/brand name enters the application.

### Acronyms preserve canonical case

`CVSS`, `CWE`, `STRIDE`, `LINDDUN`, `PASTA`, `ID`, `URL`, `API`, `DFD`, `SSE`.

Maintained in `scripts/i18n_style/lists.json` (`acronyms`).

### Domain object types are common nouns

`threat model`, `diagram`, `document`, `asset`, `repository`, `note`, `threat`, `source`, `addon`, `survey`, `group`, `quota`, `webhook`, `template`.

These are lowercase mid-sentence. Capitalized only at the start of a string. Do **not** treat them as proper nouns.

- ✅ `Add threat model`
- ❌ `Add Threat Model`
- ✅ `Threat model created.`
- ❌ `Threat Model created.`

Maintained in `scripts/i18n_style/lists.json` (`domain_nouns`).

### Single-word strings

First letter capitalized. Same result under any convention; codified for clarity.

### Symbol-joined enum values

Each segment is first-letter capitalized: `Yes/No`, `A/B`, `Read-write` (note hyphen treated as separator).

### Strings starting with a placeholder

`{{count}} items selected` — the first literal word after the placeholder follows sentence case (lowercase unless a proper noun).

### Pure delegation strings and code-like values

Strings whose entire value is `{{another.key}}` are skipped by the lint. URLs, code expressions (`e.g., {key} = 'value'`), and email addresses are skipped.

## Punctuation

### Period rule

**[lint]** Apply uniformly across all surfaces:

- Complete sentence (subject + verb) → end with period.
- Multiple sentences → period after each.
- Fragment / label / phrase → no period.

Examples:

- ✅ `Failed to invoke addon. Check the addon configuration.`
- ✅ `Required` (fragment, no period)
- ✅ `Filter by name or email` (placeholder, no period — placeholders are labels, not sentences)
- ❌ `Failed to invoke addon` (sentence, missing period)

### No exclamation marks

**[lint]** No string ends with `!`. The `!` character is permitted mid-string only if a placeholder result genuinely requires it (rare).

### Ellipsis convention

**[lint, warning only]** Buttons and menu items that lead to a further dialog/picker before the action completes end with `...`:

- ✅ `Data assets...` (opens a picker dialog)
- ✅ `Save` (action completes immediately)
- ✅ `Edit threat model...` (opens edit dialog)

The lint flags candidates based on the click handler in the sidecar; humans confirm. This rule produces warnings, not blocking failures.

## Tone (errors, snackbars, validation, descriptions)

- State what happened plainly. Tell the user the next step when there is one.
- Use past-tense action constructions: `Couldn't connect`, `Failed to save`.
- Validation messages state the requirement (`Email address is required`), not the failure mode (`Email address is missing`).

### Forbidden phrases

**[lint]** Case-insensitive substring match. Never use:

- `Please try again`
- `Sorry,`
- `We're sorry`
- `Oops`
- `Whoops`
- `Unfortunately,`
- `Apologies`
- `My apologies`

The replacement should be context-specific. Example: `Failed to invoke addon. Please try again.` becomes `Failed to invoke addon. Check the addon configuration.` or simply `Failed to invoke addon.` if no specific next step exists.

Maintained in `scripts/i18n_style/lists.json` (`forbidden_phrases`).

### Uniform tone

The tone rules apply to all surfaces. Admin pages do not get a separate tone bar — all users of TMI are engineers.

## Translator notes (`.comment` siblings)

### When required

**[lint]** A sibling `<key>.comment` is required when:

- The translatable string is ≤3 words, AND
- It contains a noun-verb-ambiguous word from the maintained list:

  `Filter`, `Search`, `Sort`, `Edit`, `Order`, `Save`, `Display`, `Help`, `Comment`, `Cancel`, `Open`, `Close`, `Lock`, `View`, `Print`, `Share`, `Copy`, `Move`, `Run`, `Stop`, `Pause`, `Send`, `Reply`, `Sign`, `Show`, `Hide`, `Add`, `Remove`, `Delete`.

The `.comment` value should clarify part of speech and UI context for translators.

Maintained in `scripts/i18n_style/lists.json` (`ambiguous_words`).

### Format

```jsonc
{
  "common": {
    "filter": "Filter",
    "filter.comment": "Used as a verb on a button that initiates filtering."
  }
}
```

The `.comment` siblings live only in `en-US.json`. They are translator-facing guidance for translating into the other 16 locales. **[lint]** The lint rejects `.comment` keys in non-en-US locale files.

### Mechanical usage info lives in the sidecar

Where each key is *used* in the codebase (file path, line number, surface type, classes) lives in `src/assets/i18n/en-US.usage.json`, not inline. Translators don't need that detail; the lint and audit do.

## Lint escape hatch

Add a sibling `<key>.lint-skip` with a brief reason if a string legitimately violates a rule (e.g., a quoted phrase from a third party that must be preserved verbatim). The lint skips that key but logs the skip at the start of each run for visibility. Use sparingly.

```jsonc
{
  "about": {
    "thirdPartyQuote": "Don't be evil",
    "thirdPartyQuote.lint-skip": "Verbatim quote from Google's former motto; preserved as-is."
  }
}
```

## Versioning this guide

This document is the source of truth. When the rules change, update this file and the maintained-lists JSON together in the same commit.
```

- [ ] **Step 2: Verify the file is valid markdown**

Run: `cat src/assets/i18n/STYLE-GUIDE.md | head -20`
Expected: shows the document title and intro section.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/STYLE-GUIDE.md
git commit -m "$(cat <<'EOF'
docs: add en-US localization style guide (#676)

Establishes sentence case + period rule + forbidden-phrase blacklist as
the canonical rubric for en-US strings. References lint config that will
be added in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: Write maintained-lists JSON config

**Files:**
- Create: `scripts/i18n_style/lists.json`
- Create: `scripts/i18n_style/__init__.py` (empty file to mark package)

- [ ] **Step 1: Create the package directory marker**

```bash
mkdir -p scripts/i18n_style/tests
touch scripts/i18n_style/__init__.py scripts/i18n_style/tests/__init__.py
```

- [ ] **Step 2: Write the lists JSON**

Create `scripts/i18n_style/lists.json` with the following content:

```json
{
  "proper_nouns": [
    "TMI",
    "Timmy",
    "OAuth",
    "JWT",
    "Google Drive",
    "Google Workspace",
    "Microsoft",
    "GitHub"
  ],
  "acronyms": [
    "CVSS",
    "CWE",
    "STRIDE",
    "LINDDUN",
    "PASTA",
    "ID",
    "URL",
    "API",
    "DFD",
    "SSE"
  ],
  "domain_nouns": [
    "threat model",
    "threat models",
    "diagram",
    "diagrams",
    "document",
    "documents",
    "asset",
    "assets",
    "repository",
    "repositories",
    "note",
    "notes",
    "threat",
    "threats",
    "source",
    "sources",
    "addon",
    "addons",
    "survey",
    "surveys",
    "group",
    "groups",
    "quota",
    "quotas",
    "webhook",
    "webhooks",
    "template",
    "templates"
  ],
  "ambiguous_words": [
    "Filter",
    "Search",
    "Sort",
    "Edit",
    "Order",
    "Save",
    "Display",
    "Help",
    "Comment",
    "Cancel",
    "Open",
    "Close",
    "Lock",
    "View",
    "Print",
    "Share",
    "Copy",
    "Move",
    "Run",
    "Stop",
    "Pause",
    "Send",
    "Reply",
    "Sign",
    "Show",
    "Hide",
    "Add",
    "Remove",
    "Delete"
  ],
  "forbidden_phrases": [
    "Please try again",
    "Sorry,",
    "We're sorry",
    "Oops",
    "Whoops",
    "Unfortunately,",
    "Apologies",
    "My apologies"
  ]
}
```

- [ ] **Step 3: Validate the JSON is well-formed**

Run: `python3 -c "import json; json.load(open('scripts/i18n_style/lists.json'))"`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/i18n_style/__init__.py scripts/i18n_style/tests/__init__.py scripts/i18n_style/lists.json
git commit -m "$(cat <<'EOF'
feat: add maintained-lists config for i18n style check (#676)

Lists proper nouns, acronyms, domain nouns, ambiguous noun-verb words,
and forbidden tone phrases. Drives the lint check added in subsequent
commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 1.3: Write the config loader module

**Files:**
- Create: `scripts/i18n_style/config.py`
- Test: `scripts/i18n_style/tests/test_config.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_config.py`:

```python
"""Tests for scripts.i18n_style.config."""

import unittest
from pathlib import Path

from scripts.i18n_style.config import load_lists, StyleLists


class TestLoadLists(unittest.TestCase):
    def test_loads_all_categories(self):
        lists = load_lists()
        self.assertIsInstance(lists, StyleLists)
        self.assertIn("TMI", lists.proper_nouns)
        self.assertIn("CVSS", lists.acronyms)
        self.assertIn("threat model", lists.domain_nouns)
        self.assertIn("Filter", lists.ambiguous_words)
        self.assertIn("Please try again", lists.forbidden_phrases)

    def test_proper_nouns_are_case_sensitive_set(self):
        lists = load_lists()
        # 'tmi' (lowercase) should not be in the set; only 'TMI' is canonical.
        self.assertNotIn("tmi", lists.proper_nouns)

    def test_load_from_explicit_path(self):
        config_path = Path(__file__).parent.parent / "lists.json"
        lists = load_lists(config_path)
        self.assertIn("TMI", lists.proper_nouns)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_config -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.i18n_style.config'`.

- [ ] **Step 3: Write the config module**

Create `scripts/i18n_style/config.py`:

```python
"""Loads the maintained-lists config used by the i18n style check."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Set


@dataclass(frozen=True)
class StyleLists:
    """Maintained lists driving the i18n style check."""

    proper_nouns: Set[str]
    acronyms: Set[str]
    domain_nouns: Set[str]
    ambiguous_words: Set[str]
    forbidden_phrases: Set[str]


def load_lists(path: Optional[Path] = None) -> StyleLists:
    """Load the maintained lists from JSON.

    Defaults to scripts/i18n_style/lists.json relative to this module.
    """
    if path is None:
        path = Path(__file__).parent / "lists.json"
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return StyleLists(
        proper_nouns=set(data.get("proper_nouns", [])),
        acronyms=set(data.get("acronyms", [])),
        domain_nouns=set(data.get("domain_nouns", [])),
        ambiguous_words=set(data.get("ambiguous_words", [])),
        forbidden_phrases=set(data.get("forbidden_phrases", [])),
    )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_config -v`
Expected: PASS, 3 tests OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/config.py scripts/i18n_style/tests/test_config.py
git commit -m "$(cat <<'EOF'
feat: add config loader for i18n style lists (#676)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Usage-map pipeline

The pipeline scans `src/**/*.{ts,html,scss}` for transloco usages and emits `src/assets/i18n/en-US.usage.json`.

### Task 2.1: Stage 1 — enumerate keys

**Files:**
- Create: `scripts/i18n_style/key_enumerator.py`
- Test: `scripts/i18n_style/tests/test_key_enumerator.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_key_enumerator.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_key_enumerator -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the module**

Create `scripts/i18n_style/key_enumerator.py`:

```python
"""Enumerate translatable keys from a Transloco JSON file.

A "translatable key" is the dotted path to a leaf string value, excluding
any key whose final segment is `.comment` or `.lint-skip` (these are
sibling-metadata keys, not translatable content).
"""

import json
from pathlib import Path
from typing import Iterator, List


_META_SUFFIXES = (".comment", ".lint-skip")


def _walk(obj, prefix: str = "") -> Iterator[str]:
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if any(full_key.endswith(suffix) for suffix in _META_SUFFIXES):
                continue
            if isinstance(value, dict):
                yield from _walk(value, full_key)
            else:
                yield full_key


def enumerate_keys(path: Path) -> List[str]:
    """Return the list of translatable keys in a Transloco JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return list(_walk(data))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_key_enumerator -v`
Expected: PASS, 4 tests OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/key_enumerator.py scripts/i18n_style/tests/test_key_enumerator.py
git commit -m "$(cat <<'EOF'
feat: add i18n key enumerator (#676)

Walks Transloco JSON files producing the flat list of translatable keys,
excluding .comment and .lint-skip sibling metadata.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: Stage 2 — fully-qualified ripgrep search

**Files:**
- Create: `scripts/i18n_style/usage_scanner.py`
- Test: `scripts/i18n_style/tests/test_usage_scanner.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_usage_scanner.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_scanner -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the scanner module**

Create `scripts/i18n_style/usage_scanner.py`:

```python
"""Scan source files for usages of i18n keys via ripgrep.

Stage 2 of the usage-map pipeline. Uses fully-qualified key names.
"""

import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Set


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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_scanner -v`
Expected: PASS, 5 tests OK.

If tests fail because `rg` is not in PATH, run `which rg` to verify; ripgrep is required for this and downstream tasks. If missing, install via `brew install ripgrep` first.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/usage_scanner.py scripts/i18n_style/tests/test_usage_scanner.py
git commit -m "$(cat <<'EOF'
feat: add ripgrep-based i18n usage scanner (#676)

Stage 2 of the usage-map pipeline. Searches src/**/*.{ts,html,scss} for
fully-qualified key names, captures file/line/context/classes per hit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: Stage 7 — surface inference

**Files:**
- Create: `scripts/i18n_style/surface_inference.py`
- Test: `scripts/i18n_style/tests/test_surface_inference.py`

(Stages 3, 4, 6, 8 are added later as separate tasks since they're each substantial. We do surface inference next because it's pure logic over a usage record and stage 9 — emit usage map — needs it.)

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_surface_inference.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_surface_inference -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the module**

Create `scripts/i18n_style/surface_inference.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_surface_inference -v`
Expected: PASS, 11 tests OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/surface_inference.py scripts/i18n_style/tests/test_surface_inference.py
git commit -m "$(cat <<'EOF'
feat: add surface inference for i18n usage records (#676)

Stage 7 of the usage-map pipeline. Maps usage context to surface tags
(page-title, dialog-title, button, menu-item, tooltip, placeholder,
label, error, snackbar, general) using regex over the surrounding line.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: Stage 9 — emit usage map (excluding stages 3/4/6/8 for now)

**Files:**
- Create: `scripts/build-i18n-usage-map.py`
- Test: `scripts/i18n_style/tests/test_usage_map_builder.py`

This task implements a *minimum-viable* usage map builder that runs stages 1, 2, 7, 9. Stages 3 (partial-key search), 4 (CSS class lookup), 6 (model verification), and 8 (ellipsis detection) are added in subsequent tasks; the map structure already accommodates their fields, populated as defaults until those stages run.

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_usage_map_builder.py`:

```python
"""Tests for the minimum-viable usage map builder (stages 1, 2, 7, 9)."""

import json
import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.usage_map_builder import build_usage_map


class TestBuildUsageMap(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "src").mkdir()

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write_locale(self, data):
        path = self.root / "en-US.json"
        with open(path, "w") as f:
            json.dump(data, f)
        return path

    def _write_src(self, relpath, content):
        full = self.root / "src" / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)

    def test_map_has_entry_per_key(self):
        locale = self._write_locale({"common": {"save": "Save", "cancel": "Cancel"}})
        self._write_src(
            "foo.html",
            '<button>{{ \'common.save\' | transloco }}</button>\n',
        )
        usage_map = build_usage_map(locale, self.root)
        self.assertIn("common.save", usage_map)
        self.assertIn("common.cancel", usage_map)

    def test_found_key_has_uses_and_surfaces(self):
        locale = self._write_locale({"common": {"save": "Save"}})
        self._write_src(
            "foo.html",
            '<button>{{ \'common.save\' | transloco }}</button>\n',
        )
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["common.save"]
        self.assertEqual(len(entry["uses"]), 1)
        self.assertIn("button", entry["surfaces"])
        self.assertEqual(entry["confidence"], "high")

    def test_unfound_key_has_empty_uses(self):
        locale = self._write_locale({"orphan": "Orphan"})
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["orphan"]
        self.assertEqual(entry["uses"], [])
        self.assertEqual(entry["surfaces"], ["general"])
        self.assertEqual(entry["confidence"], "low")

    def test_default_fields_present(self):
        locale = self._write_locale({"foo": "Foo"})
        usage_map = build_usage_map(locale, self.root)
        entry = usage_map["foo"]
        self.assertIn("ellipsis_candidate", entry)
        self.assertIn("ambiguous_word", entry)
        self.assertIn("needs_translator_comment", entry)
        self.assertIn("found_by", entry)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the module**

Create `scripts/i18n_style/usage_map_builder.py`:

```python
"""Build the en-US.usage.json sidecar from source-code analysis.

Implements the minimum-viable pipeline (stages 1, 2, 7, 9). Subsequent tasks
add stages 3 (partial-key search), 4 (CSS class lookup), 6 (model
verification), and 8 (ellipsis candidate detection) to populate additional
fields on each entry.

Output schema:
{
  "<key>": {
    "surfaces": ["button", "tooltip", ...],
    "uses": [{"file": "...", "line": N, "element": "...", "classes": [...]}],
    "ellipsis_candidate": false,
    "ambiguous_word": false,
    "needs_translator_comment": false,
    "confidence": "high" | "medium" | "low",
    "found_by": "fully-qualified" | "leaf" | "model-verified" | "none"
  }
}
"""

import json
from pathlib import Path
from typing import Dict, Any

from scripts.i18n_style.key_enumerator import enumerate_keys
from scripts.i18n_style.usage_scanner import scan_for_key
from scripts.i18n_style.surface_inference import infer_surfaces


def _entry_for_unfound_key() -> Dict[str, Any]:
    return {
        "surfaces": ["general"],
        "uses": [],
        "ellipsis_candidate": False,
        "ambiguous_word": False,
        "needs_translator_comment": False,
        "confidence": "low",
        "found_by": "none",
    }


def _serialize_use(usage) -> Dict[str, Any]:
    return {
        "file": str(usage.file),
        "line": usage.line,
        "context": usage.context,
        "classes": usage.classes,
    }


def build_usage_map(en_us_path: Path, repo_root: Path) -> Dict[str, Dict[str, Any]]:
    """Build the usage map for en-US.json.

    Args:
        en_us_path: Path to en-US.json.
        repo_root: Root of the repository (search scope).

    Returns:
        Dict mapping each translatable key to its usage record.
    """
    keys = enumerate_keys(en_us_path)
    usage_map: Dict[str, Dict[str, Any]] = {}

    for key in keys:
        usages = scan_for_key(key, repo_root)
        if not usages:
            usage_map[key] = _entry_for_unfound_key()
            continue
        surfaces = infer_surfaces(usages)
        usage_map[key] = {
            "surfaces": sorted(surfaces),
            "uses": [_serialize_use(u) for u in usages],
            "ellipsis_candidate": False,
            "ambiguous_word": False,
            "needs_translator_comment": False,
            "confidence": "high",
            "found_by": "fully-qualified",
        }

    return usage_map


def write_usage_map(usage_map: Dict[str, Dict[str, Any]], out_path: Path) -> None:
    """Write the usage map to disk as pretty-printed JSON."""
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(usage_map, f, indent=2, ensure_ascii=False, sort_keys=True)
        f.write("\n")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder -v`
Expected: PASS, 4 tests OK.

- [ ] **Step 5: Write the uv-run wrapper script**

Create `scripts/build-i18n-usage-map.py`:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Build the en-US usage map sidecar.

Walks src/**/*.{ts,html,scss} for transloco usages of every key in
src/assets/i18n/en-US.json and writes src/assets/i18n/en-US.usage.json.

Usage:
  uv run scripts/build-i18n-usage-map.py
  uv run scripts/build-i18n-usage-map.py --en-us <path> --out <path> --root <path>
"""

import argparse
import sys
from pathlib import Path

# Add repo root to sys.path so we can import scripts.i18n_style.*
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.usage_map_builder import build_usage_map, write_usage_map


def main():
    parser = argparse.ArgumentParser(description="Build en-US usage map sidecar.")
    parser.add_argument(
        "--en-us",
        type=Path,
        default=REPO_ROOT / "src/assets/i18n/en-US.json",
        help="Path to en-US.json",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=REPO_ROOT / "src/assets/i18n/en-US.usage.json",
        help="Path to write usage map",
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=REPO_ROOT,
        help="Root directory to scan for usages",
    )
    args = parser.parse_args()

    print(f"Building usage map from {args.en_us}")
    print(f"Scanning {args.root}")
    usage_map = build_usage_map(args.en_us, args.root)
    write_usage_map(usage_map, args.out)
    found = sum(1 for v in usage_map.values() if v["uses"])
    total = len(usage_map)
    print(f"Wrote {args.out}: {found}/{total} keys found in source.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Make the script executable**

Run: `chmod +x scripts/build-i18n-usage-map.py`

- [ ] **Step 7: Run the script against the real codebase**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`
Expected: prints `Wrote src/assets/i18n/en-US.usage.json: <N>/1925 keys found in source.` Where N is reasonably high (likely 1500+ on first pass; the gap closes with later stages).

- [ ] **Step 8: Spot-check the output**

Run: `python3 -c "import json; m = json.load(open('src/assets/i18n/en-US.usage.json')); k = list(m.keys()); print('total:', len(k)); print('sample:', k[:5]); import collections; print('confidence:', collections.Counter(v['confidence'] for v in m.values()))"`
Expected: total of ~1925 keys, confidence histogram showing mostly `high` and some `low`.

- [ ] **Step 9: Commit**

```bash
git add scripts/i18n_style/usage_map_builder.py scripts/i18n_style/tests/test_usage_map_builder.py scripts/build-i18n-usage-map.py src/assets/i18n/en-US.usage.json
git commit -m "$(cat <<'EOF'
feat: add minimum-viable i18n usage map builder (#676)

Implements stages 1, 2, 7, 9 of the pipeline. Subsequent commits add
partial-key search, CSS class lookup, model verification, and ellipsis
detection. Initial commit of en-US.usage.json sidecar.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: Stage 3 — partial-key search for unfound keys

**Files:**
- Modify: `scripts/i18n_style/usage_scanner.py:1-end` (add `scan_for_partial_key`)
- Modify: `scripts/i18n_style/usage_map_builder.py:1-end` (call partial search for unfound keys)
- Modify: `scripts/i18n_style/tests/test_usage_scanner.py:1-end` (add partial-key tests)
- Modify: `scripts/i18n_style/tests/test_usage_map_builder.py:1-end` (verify medium/low confidence assignment)

- [ ] **Step 1: Write the failing tests**

Append to `scripts/i18n_style/tests/test_usage_scanner.py` (before `if __name__`):

```python
class TestScanForPartialKey(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, relpath: str, content: str):
        full = self.root / relpath
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content)

    def test_finds_dynamic_key_with_parent_prefix(self):
        # Code constructs keys dynamically: 'admin.users.' + state + '.label'
        from scripts.i18n_style.usage_scanner import scan_for_partial_key

        self._write(
            "src/foo.ts",
            "const k = 'admin.users.' + this.state + '.label';\n",
        )
        candidates = scan_for_partial_key("admin.users.active.label", self.root)
        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].confidence, "medium")

    def test_finds_leaf_only_match(self):
        from scripts.i18n_style.usage_scanner import scan_for_partial_key

        self._write(
            "src/foo.ts",
            "const k = `${prefix}.filterLabel`;\n",
        )
        candidates = scan_for_partial_key("admin.users.filterLabel", self.root)
        leaf_matches = [c for c in candidates if c.confidence == "low"]
        self.assertGreater(len(leaf_matches), 0)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_scanner.TestScanForPartialKey -v`
Expected: FAIL with `ImportError: cannot import name 'scan_for_partial_key'`.

- [ ] **Step 3: Add `scan_for_partial_key` to `usage_scanner.py`**

Append to `scripts/i18n_style/usage_scanner.py`:

```python
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

    1. Parent-prefix match (medium confidence): a string ending with the parent
       segment of the key, e.g., 'admin.users.' for the key 'admin.users.x'.
    2. Leaf-only match (low confidence): the final segment of the key as a
       quoted string, e.g., `'filterLabel'` for the key 'admin.users.filterLabel'.

    Returns a list of candidates with confidence levels.
    """
    parts = key.split(".")
    if len(parts) < 2:
        return []

    parent_prefix = ".".join(parts[:-1]) + "."
    leaf = parts[-1]

    candidates: List[PartialKeyCandidate] = []

    for pattern, confidence in (
        (parent_prefix, "medium"),
        (leaf, "low"),
    ):
        # Wrap in quotes for ripgrep fixed-string search.
        for quote in ("'", '"', "`"):
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
                candidates.append(
                    PartialKeyCandidate(
                        file=Path(file_str),
                        line=line,
                        context=context.strip(),
                        confidence=confidence,
                    )
                )

    return candidates
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_scanner -v`
Expected: PASS, 7 tests OK.

- [ ] **Step 5: Wire partial-key search into the builder**

Replace the body of `build_usage_map` in `scripts/i18n_style/usage_map_builder.py`:

```python
def build_usage_map(en_us_path: Path, repo_root: Path) -> Dict[str, Dict[str, Any]]:
    """Build the usage map for en-US.json.

    Args:
        en_us_path: Path to en-US.json.
        repo_root: Root of the repository (search scope).

    Returns:
        Dict mapping each translatable key to its usage record.
    """
    from scripts.i18n_style.usage_scanner import scan_for_partial_key

    keys = enumerate_keys(en_us_path)
    usage_map: Dict[str, Dict[str, Any]] = {}

    for key in keys:
        usages = scan_for_key(key, repo_root)
        if usages:
            surfaces = infer_surfaces(usages)
            usage_map[key] = {
                "surfaces": sorted(surfaces),
                "uses": [_serialize_use(u) for u in usages],
                "ellipsis_candidate": False,
                "ambiguous_word": False,
                "needs_translator_comment": False,
                "confidence": "high",
                "found_by": "fully-qualified",
            }
            continue

        # Stage 3: try partial-key search.
        candidates = scan_for_partial_key(key, repo_root)
        if candidates:
            best = "medium" if any(c.confidence == "medium" for c in candidates) else "low"
            usage_map[key] = {
                "surfaces": ["general"],
                "uses": [
                    {
                        "file": str(c.file),
                        "line": c.line,
                        "context": c.context,
                        "classes": [],
                        "partial_match": c.confidence,
                    }
                    for c in candidates[:10]  # cap to avoid blowing up the file
                ],
                "ellipsis_candidate": False,
                "ambiguous_word": False,
                "needs_translator_comment": False,
                "confidence": best,
                "found_by": "leaf",
            }
        else:
            usage_map[key] = _entry_for_unfound_key()

    return usage_map
```

- [ ] **Step 6: Update the unfound-key test (key with no usages anywhere)**

Modify the `test_unfound_key_has_empty_uses` test in `test_usage_map_builder.py` — the key `"orphan"` has no parent prefix to match, so the test still holds. Verify by running:

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder -v`
Expected: PASS, 4 tests still OK.

- [ ] **Step 7: Regenerate the usage map**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`
Expected: prints found/total — should be higher now (more keys resolved via partial search).

- [ ] **Step 8: Spot-check that medium/low confidence keys are present**

Run: `python3 -c "import json, collections; m = json.load(open('src/assets/i18n/en-US.usage.json')); print(collections.Counter(v['confidence'] for v in m.values()))"`
Expected: histogram now includes `medium` and possibly `low` counts.

- [ ] **Step 9: Commit**

```bash
git add scripts/i18n_style/usage_scanner.py scripts/i18n_style/tests/test_usage_scanner.py scripts/i18n_style/usage_map_builder.py src/assets/i18n/en-US.usage.json
git commit -m "$(cat <<'EOF'
feat: add partial-key search for dynamic i18n key references (#676)

Stage 3 of usage-map pipeline. Resolves keys constructed at runtime via
parent-prefix or leaf-segment matching with medium/low confidence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.6: Stage 8 — ellipsis candidate detection

**Files:**
- Create: `scripts/i18n_style/ellipsis_detector.py`
- Test: `scripts/i18n_style/tests/test_ellipsis_detector.py`
- Modify: `scripts/i18n_style/usage_map_builder.py:1-end` (call detector for button/menu-item surfaces)

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_ellipsis_detector.py`:

```python
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


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_ellipsis_detector -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the detector module**

Create `scripts/i18n_style/ellipsis_detector.py`:

```python
"""Detect whether a button/menu-item key opens a dialog before completing.

Best-effort static analysis. For each usage of a button/menu-item key:
1. Extract the click handler name from the (click)="handler()" binding.
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
from typing import Iterable, List

from scripts.i18n_style.usage_scanner import KeyUsage


_CLICK_BINDING = re.compile(r"\(click\)\s*=\s*\"([a-zA-Z_$][\w$]*)\(")
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
    # Naive brace-matching, capped at 200 lines from start.
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


def is_ellipsis_candidate(usages: Iterable[KeyUsage], root: Path) -> bool:
    """Return True if any usage is a button/menu-item whose click handler opens a dialog."""
    for usage in usages:
        if not _BUTTON_HINT.search(usage.context):
            continue
        binding = _CLICK_BINDING.search(usage.context)
        if not binding:
            continue
        handler = binding.group(1)
        ts_path = _find_component_ts(usage.file)
        if _handler_opens_dialog(handler, ts_path):
            return True
    return False
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_ellipsis_detector -v`
Expected: PASS, 3 tests OK.

- [ ] **Step 5: Wire detector into usage_map_builder**

In `scripts/i18n_style/usage_map_builder.py`, modify the high-confidence branch in `build_usage_map`:

```python
        if usages:
            surfaces = infer_surfaces(usages)
            ellipsis = (
                ("button" in surfaces or "menu-item" in surfaces)
                and is_ellipsis_candidate(usages, repo_root)
            )
            usage_map[key] = {
                "surfaces": sorted(surfaces),
                "uses": [_serialize_use(u) for u in usages],
                "ellipsis_candidate": ellipsis,
                "ambiguous_word": False,
                "needs_translator_comment": False,
                "confidence": "high",
                "found_by": "fully-qualified",
            }
            continue
```

Add the import at the top of `usage_map_builder.py`:

```python
from scripts.i18n_style.ellipsis_detector import is_ellipsis_candidate
```

- [ ] **Step 6: Run all builder tests**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder -v`
Expected: PASS.

- [ ] **Step 7: Regenerate the usage map**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`

- [ ] **Step 8: Spot-check ellipsis candidates**

Run: `python3 -c "import json; m = json.load(open('src/assets/i18n/en-US.usage.json')); cands = [k for k,v in m.items() if v['ellipsis_candidate']]; print('candidates:', len(cands)); print(cands[:20])"`
Expected: a list of plausible button/menu-item keys (e.g., things like `*.edit*`, `*.add*`, `*.create*` that open dialogs).

- [ ] **Step 9: Commit**

```bash
git add scripts/i18n_style/ellipsis_detector.py scripts/i18n_style/tests/test_ellipsis_detector.py scripts/i18n_style/usage_map_builder.py src/assets/i18n/en-US.usage.json
git commit -m "$(cat <<'EOF'
feat: detect ellipsis candidates for button/menu i18n keys (#676)

Stage 8 of usage-map pipeline. Static analysis of click handlers to
identify buttons/menu items that open dialogs and should end with '...'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.7: Mark ambiguous-word and needs-translator-comment flags

**Files:**
- Modify: `scripts/i18n_style/usage_map_builder.py:1-end` (set the flags based on en-US value)

These are derived from the en-US value itself, not from source-code scanning, so no new pipeline stage is needed — just augment the builder.

- [ ] **Step 1: Write the failing test**

Append to `scripts/i18n_style/tests/test_usage_map_builder.py` (before `if __name__`):

```python
class TestAmbiguousWordFlag(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        (self.root / "src").mkdir()

    def tearDown(self):
        self.tmpdir.cleanup()

    def test_short_ambiguous_word_flagged(self):
        # "Filter" is in the ambiguous_words list; ≤3 words.
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["ambiguous_word"])

    def test_existing_comment_marks_no_translator_need(self):
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump(
                {
                    "common": {
                        "filter": "Filter",
                        "filter.comment": "Verb. Used on filter buttons.",
                    }
                },
                f,
            )
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["ambiguous_word"])
        self.assertFalse(entry["needs_translator_comment"])

    def test_missing_comment_marks_translator_need(self):
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertTrue(entry["needs_translator_comment"])

    def test_long_string_not_flagged(self):
        # > 3 words, even if it contains an ambiguous word.
        locale_path = self.root / "en-US.json"
        with open(locale_path, "w") as f:
            json.dump({"common": {"filter": "Filter the list of users by role"}}, f)
        usage_map = build_usage_map(locale_path, self.root)
        entry = usage_map["common.filter"]
        self.assertFalse(entry["ambiguous_word"])
        self.assertFalse(entry["needs_translator_comment"])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder.TestAmbiguousWordFlag -v`
Expected: FAIL — current code always sets the flags to False.

- [ ] **Step 3: Modify the builder to compute the flags**

In `scripts/i18n_style/usage_map_builder.py`, add at the top:

```python
from scripts.i18n_style.config import load_lists
```

Replace the body of `build_usage_map` to thread in value lookups and flag computation:

```python
def _value_for_key(data, key: str):
    parts = key.split(".")
    cur = data
    for p in parts:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return None
    return cur if isinstance(cur, str) else None


def _has_comment_sibling(data, key: str) -> bool:
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return False
    return isinstance(cur, dict) and f"{parts[-1]}.comment" in cur


def _is_ambiguous(value: str, ambiguous_words: set) -> bool:
    """Return True if the string is ≤3 words and contains an ambiguous word."""
    if not isinstance(value, str):
        return False
    words = value.split()
    if len(words) > 3:
        return False
    # Match case-insensitively against the ambiguous-words set
    # (the set canonicalizes case, e.g., 'Filter').
    lowered_set = {w.lower() for w in ambiguous_words}
    return any(w.lower().rstrip(".,!?:;") in lowered_set for w in words)


def build_usage_map(en_us_path: Path, repo_root: Path) -> Dict[str, Dict[str, Any]]:
    from scripts.i18n_style.usage_scanner import scan_for_partial_key

    with open(en_us_path, "r", encoding="utf-8") as f:
        en_us_data = json.load(f)

    lists = load_lists()

    keys = enumerate_keys(en_us_path)
    usage_map: Dict[str, Dict[str, Any]] = {}

    for key in keys:
        value = _value_for_key(en_us_data, key)
        ambiguous = _is_ambiguous(value, lists.ambiguous_words) if value else False
        has_comment = _has_comment_sibling(en_us_data, key)
        needs_comment = ambiguous and not has_comment

        usages = scan_for_key(key, repo_root)
        if usages:
            surfaces = infer_surfaces(usages)
            ellipsis = (
                ("button" in surfaces or "menu-item" in surfaces)
                and is_ellipsis_candidate(usages, repo_root)
            )
            usage_map[key] = {
                "surfaces": sorted(surfaces),
                "uses": [_serialize_use(u) for u in usages],
                "ellipsis_candidate": ellipsis,
                "ambiguous_word": ambiguous,
                "needs_translator_comment": needs_comment,
                "confidence": "high",
                "found_by": "fully-qualified",
            }
            continue

        candidates = scan_for_partial_key(key, repo_root)
        if candidates:
            best = "medium" if any(c.confidence == "medium" for c in candidates) else "low"
            usage_map[key] = {
                "surfaces": ["general"],
                "uses": [
                    {
                        "file": str(c.file),
                        "line": c.line,
                        "context": c.context,
                        "classes": [],
                        "partial_match": c.confidence,
                    }
                    for c in candidates[:10]
                ],
                "ellipsis_candidate": False,
                "ambiguous_word": ambiguous,
                "needs_translator_comment": needs_comment,
                "confidence": best,
                "found_by": "leaf",
            }
        else:
            entry = _entry_for_unfound_key()
            entry["ambiguous_word"] = ambiguous
            entry["needs_translator_comment"] = needs_comment
            usage_map[key] = entry

    return usage_map
```

- [ ] **Step 4: Run all builder tests**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_usage_map_builder -v`
Expected: PASS, 8 tests OK (4 original + 4 new).

- [ ] **Step 5: Regenerate the usage map**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`

- [ ] **Step 6: Spot-check the flags**

Run: `python3 -c "import json; m = json.load(open('src/assets/i18n/en-US.usage.json')); needs = [k for k,v in m.items() if v['needs_translator_comment']]; print('keys needing translator comment:', len(needs)); print(needs[:30])"`
Expected: a list of short ambiguous keys (e.g., `*.filter`, `*.search`, `*.edit`).

- [ ] **Step 7: Commit**

```bash
git add scripts/i18n_style/usage_map_builder.py scripts/i18n_style/tests/test_usage_map_builder.py src/assets/i18n/en-US.usage.json
git commit -m "$(cat <<'EOF'
feat: flag ambiguous-word i18n keys needing translator comment (#676)

Builder now sets ambiguous_word and needs_translator_comment fields
based on the en-US value (≤3 words containing a word from the
ambiguous-words config) and presence of a sibling .comment key.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2.8: Manual spot-check of usage map accuracy

**Files:** none (validation step only)

- [ ] **Step 1: Pick 20 keys across surfaces and verify the map**

Pick the following 20 keys (5 per major surface) and read each entry in `en-US.usage.json`:

- Titles: `about.title`, `admin.addons.listTitle`, `dashboard.welcomeTitle` (use what exists), `threatModels.title`, `dfd.title`
- Buttons: `common.save`, `common.cancel`, `common.delete`, `common.add`, `common.edit`
- Tooltips: `admin.groups.viewMembersTooltip`, `notes.sharableTooltip`, `threatModels.permissionsTooltip`
- Errors: `chat.errors.connectionFailed`, `chat.errors.generic`
- Snackbars: `auditTrail.rollback.success`, `documentAccess.checkNow.success`
- Menu items: `contextMenu.lockLayout`, `contextMenu.moveBackward`

For each, run:

Run: `python3 -c "import json; m = json.load(open('src/assets/i18n/en-US.usage.json')); k = '<key>'; print(k, json.dumps(m.get(k), indent=2))"`

For each, verify by reading the actual file/line in the entry's `uses` array that the surface inferred matches the actual rendering. If 18+ of 20 are correct, the map is acceptable. If fewer, investigate the failures and tighten the surface-inference patterns or partial-key search.

- [ ] **Step 2: If all 20 spot-checks pass, no commit needed (validation only)**

If patterns required, fix them in `surface_inference.py` and `usage_scanner.py`, regenerate the map, and commit those fixes as a separate commit.

---

## Phase 3 — Lint check

### Task 3.1: Sentence-case validator

**Files:**
- Create: `scripts/i18n_style/sentence_case.py`
- Test: `scripts/i18n_style/tests/test_sentence_case.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_sentence_case.py`:

```python
"""Tests for sentence-case validator."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.sentence_case import validate_sentence_case


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns={"TMI", "Timmy", "Google Drive", "GitHub"},
        acronyms={"CVSS", "URL", "API"},
        domain_nouns={"threat model", "diagram", "asset"},
        ambiguous_words={"Filter", "Save"},
        forbidden_phrases=set(),
    )


class TestSentenceCase(unittest.TestCase):
    def test_simple_sentence_case_passes(self):
        self.assertEqual(validate_sentence_case("Add document", _lists()), [])

    def test_title_case_fails(self):
        errors = validate_sentence_case("Add Document", _lists())
        self.assertTrue(errors)
        self.assertIn("Document", errors[0])

    def test_first_letter_must_be_upper(self):
        errors = validate_sentence_case("add document", _lists())
        self.assertTrue(errors)

    def test_proper_noun_preserved(self):
        self.assertEqual(validate_sentence_case("Open in TMI", _lists()), [])

    def test_acronym_preserved(self):
        self.assertEqual(validate_sentence_case("CVSS score", _lists()), [])

    def test_acronym_lowercase_fails(self):
        errors = validate_sentence_case("Cvss score", _lists())
        self.assertTrue(errors)

    def test_domain_noun_lowercase_mid_sentence(self):
        self.assertEqual(validate_sentence_case("Add threat model", _lists()), [])

    def test_domain_noun_capitalized_mid_sentence_fails(self):
        errors = validate_sentence_case("Add Threat Model", _lists())
        self.assertTrue(errors)

    def test_proper_noun_at_start(self):
        self.assertEqual(validate_sentence_case("TMI is great", _lists()), [])

    def test_first_word_after_period_capitalized(self):
        self.assertEqual(
            validate_sentence_case("Failed to save. Try again later.", _lists()),
            [],
        )

    def test_single_word_passes(self):
        self.assertEqual(validate_sentence_case("Save", _lists()), [])

    def test_skips_pure_delegation(self):
        self.assertEqual(
            validate_sentence_case("{{some.other.key}}", _lists()), []
        )

    def test_skips_url(self):
        self.assertEqual(
            validate_sentence_case("https://example.com/path", _lists()), []
        )

    def test_skips_code_like(self):
        self.assertEqual(
            validate_sentence_case("e.g., {key} = 'value'", _lists()), []
        )

    def test_string_starting_with_placeholder(self):
        self.assertEqual(
            validate_sentence_case("{{count}} items selected", _lists()), []
        )

    def test_string_starting_with_placeholder_titlecase_fails(self):
        errors = validate_sentence_case("{{count}} Items selected", _lists())
        self.assertTrue(errors)

    def test_symbol_joined_each_capitalized(self):
        self.assertEqual(validate_sentence_case("Yes/No", _lists()), [])

    def test_symbol_joined_lowercase_second_fails(self):
        errors = validate_sentence_case("Yes/no", _lists())
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_sentence_case -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the validator**

Create `scripts/i18n_style/sentence_case.py`:

```python
"""Sentence-case validator for en-US strings."""

import re
from typing import List

from scripts.i18n_style.config import StyleLists


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_CODE_LIKE_RE = re.compile(r"^e\.g\.,|=\s*['\"`]")
_PURE_DELEGATION_RE = re.compile(r"^\{\{[a-zA-Z][\w.]*\}\}$")
_LEADING_PLACEHOLDER_RE = re.compile(r"^\{\{[^}]+\}\}\s*")
# Word boundary characters used to split into words for case checks.
_WORD_BOUNDARY_RE = re.compile(r"[\s\-/]+")
# Sentence-terminator chars; word after one of these is "first word of new sentence".
_SENTENCE_END_CHARS = ".!?:"


def _should_skip(value: str) -> bool:
    if _URL_RE.match(value):
        return True
    if _CODE_LIKE_RE.match(value):
        return True
    if _PURE_DELEGATION_RE.match(value):
        return True
    return False


def _strip_leading_placeholder(value: str) -> str:
    return _LEADING_PLACEHOLDER_RE.sub("", value).strip()


def _is_canonical_form(word: str, canonical_set: set) -> bool:
    """Check if `word` (or word stripped of trailing punctuation) is in canonical_set
    with exact case."""
    stripped = word.rstrip(".,!?:;")
    return stripped in canonical_set


def _matches_any_proper_noun_lowercase(word: str, proper_nouns: set) -> bool:
    """Check whether `word`'s lowercased form matches any proper noun's lowercased form
    (signaling that the word is intended to be a proper noun but case is wrong)."""
    stripped = word.rstrip(".,!?:;").lower()
    return any(p.lower() == stripped for p in proper_nouns)


def _matches_acronym_case_insensitive(word: str, acronyms: set) -> bool:
    stripped = word.rstrip(".,!?:;").upper()
    return stripped in acronyms


def _is_domain_noun_capitalized(value: str, domain_nouns: set) -> List[str]:
    """Return list of domain-noun violations (Title-Case usage mid-sentence)."""
    errors = []
    # Split into sentences (rough): on . ! ?
    # For each sentence, look for occurrences of any domain noun in Title Case.
    sentences = re.split(r"(?<=[.!?])\s+", value)
    for sentence in sentences:
        # Skip the first word of a sentence (allowed to be capitalized).
        words = sentence.split()
        if not words:
            continue
        rest = " ".join(words[1:]) if len(words) > 1 else ""
        for domain_noun in domain_nouns:
            # Build a Title-Case version: each word capitalized.
            title_case = " ".join(w.capitalize() for w in domain_noun.split())
            # Avoid matching mid-word (use word-boundary regex).
            pattern = re.compile(rf"\b{re.escape(title_case)}\b")
            if pattern.search(rest):
                errors.append(
                    f"Domain noun '{domain_noun}' should be lowercase mid-sentence, "
                    f"found '{title_case}'"
                )
    return errors


def validate_sentence_case(value: str, lists: StyleLists) -> List[str]:
    """Return a list of human-readable error messages for sentence-case violations.

    An empty list means the string passes.
    """
    if _should_skip(value):
        return []

    errors: List[str] = []

    # Strip leading {{...}} placeholder if present (the rule applies to the
    # first literal word after it).
    stripped_value = _strip_leading_placeholder(value)
    if not stripped_value:
        return []

    # Split into words (preserving sentence-end markers).
    # Pre-pass: domain-noun Title Case mid-sentence.
    errors.extend(_is_domain_noun_capitalized(value, lists.domain_nouns))

    # Walk words, tracking whether the next word starts a new sentence.
    words = re.findall(r"\S+", stripped_value)
    sentence_start = True

    for word in words:
        # Skip placeholders mid-string.
        if word.startswith("{{") and word.endswith("}}"):
            sentence_start = False
            continue

        # Word may have trailing sentence-end punctuation; we'll check that
        # afterwards.
        bare = word.rstrip(",.;:!?)")

        # Acronym? Must be canonical (exact upper case).
        if _matches_acronym_case_insensitive(bare, lists.acronyms):
            if bare.rstrip(".,!?:;") not in lists.acronyms:
                errors.append(f"Acronym must be uppercase: '{bare}'")
            sentence_start = _word_ends_sentence(word)
            continue

        # Proper noun? Must be canonical (exact case).
        if _matches_any_proper_noun_lowercase(bare, lists.proper_nouns):
            if not _is_canonical_form(bare, lists.proper_nouns):
                errors.append(f"Proper noun must use canonical case: '{bare}'")
            sentence_start = _word_ends_sentence(word)
            continue

        # Symbol-joined: split on '/' or '-' and check each segment.
        if "/" in bare or "-" in bare:
            segments = re.split(r"[\-/]", bare)
            for i, seg in enumerate(segments):
                if not seg:
                    continue
                if not seg[0].isupper():
                    errors.append(
                        f"Symbol-joined segment must be capitalized: '{seg}' in '{word}'"
                    )
            sentence_start = _word_ends_sentence(word)
            continue

        # Standard word.
        if sentence_start:
            if not bare or not bare[0].isupper():
                errors.append(f"First word of sentence must be capitalized: '{bare}'")
        else:
            if bare and bare[0].isupper():
                errors.append(
                    f"Word should be lowercase mid-sentence: '{bare}'"
                )

        sentence_start = _word_ends_sentence(word)

    return errors


def _word_ends_sentence(word: str) -> bool:
    """True if the word ends in . ! ? (so the next word starts a new sentence)."""
    bare = word.rstrip(")")
    return bool(bare) and bare[-1] in ".!?"
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_sentence_case -v`
Expected: PASS, 18 tests OK. If a test fails, fix the validator and re-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/sentence_case.py scripts/i18n_style/tests/test_sentence_case.py
git commit -m "$(cat <<'EOF'
feat: add sentence-case validator for i18n strings (#676)

Validates en-US strings against sentence-case rules: first letter
upper, rest lower, proper nouns and acronyms preserved, domain nouns
lowercase mid-sentence, symbol-joined segments capitalized.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Punctuation validator (period rule, `!`, forbidden phrases)

**Files:**
- Create: `scripts/i18n_style/punctuation.py`
- Test: `scripts/i18n_style/tests/test_punctuation.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_punctuation.py`:

```python
"""Tests for punctuation validator."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.punctuation import (
    validate_period_rule,
    validate_no_trailing_bang,
    validate_no_forbidden_phrases,
)


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns=set(),
        acronyms=set(),
        domain_nouns=set(),
        ambiguous_words=set(),
        forbidden_phrases={"Please try again", "Sorry,", "Oops"},
    )


class TestPeriodRule(unittest.TestCase):
    def test_complete_sentence_with_period_passes(self):
        self.assertEqual(
            validate_period_rule("Failed to save the document.", "error"),
            [],
        )

    def test_complete_sentence_without_period_fails(self):
        errors = validate_period_rule("Failed to save the document", "error")
        self.assertTrue(errors)

    def test_fragment_without_period_passes(self):
        self.assertEqual(validate_period_rule("Required", "validation"), [])

    def test_fragment_with_period_fails(self):
        errors = validate_period_rule("Required.", "validation")
        self.assertTrue(errors)

    def test_placeholder_no_period(self):
        self.assertEqual(
            validate_period_rule("Search by name or email", "placeholder"), []
        )

    def test_skips_url(self):
        self.assertEqual(
            validate_period_rule("https://example.com", "general"), []
        )

    def test_skips_pure_delegation(self):
        self.assertEqual(
            validate_period_rule("{{another.key}}", "general"), []
        )


class TestNoTrailingBang(unittest.TestCase):
    def test_no_bang_passes(self):
        self.assertEqual(validate_no_trailing_bang("Saved successfully."), [])

    def test_trailing_bang_fails(self):
        errors = validate_no_trailing_bang("Saved!")
        self.assertTrue(errors)

    def test_bang_in_middle_passes(self):
        # Mid-string '!' is allowed (rare but possible).
        self.assertEqual(validate_no_trailing_bang("Saved! Now what."), [])


class TestForbiddenPhrases(unittest.TestCase):
    def test_clean_message_passes(self):
        self.assertEqual(
            validate_no_forbidden_phrases("Failed to save.", _lists()), []
        )

    def test_please_try_again_fails(self):
        errors = validate_no_forbidden_phrases(
            "Failed to save. Please try again.", _lists()
        )
        self.assertTrue(errors)
        self.assertIn("Please try again", errors[0])

    def test_case_insensitive_match(self):
        errors = validate_no_forbidden_phrases(
            "failed to save. please try again.", _lists()
        )
        self.assertTrue(errors)

    def test_sorry_comma_fails(self):
        errors = validate_no_forbidden_phrases(
            "Sorry, that didn't work.", _lists()
        )
        self.assertTrue(errors)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_punctuation -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the validator**

Create `scripts/i18n_style/punctuation.py`:

```python
"""Punctuation validator for en-US strings.

Implements three independent checks:
- Period rule: full sentences end with `.`, fragments do not.
- No trailing `!` on any string.
- No forbidden phrases (case-insensitive substring match).
"""

import re
from typing import List

from scripts.i18n_style.config import StyleLists


_URL_RE = re.compile(r"^https?://", re.IGNORECASE)
_PURE_DELEGATION_RE = re.compile(r"^\{\{[a-zA-Z][\w.]*\}\}$")

# Surfaces where the string is universally a fragment (period rule says
# "no period"): placeholders, helper hints, tooltips that are short labels.
_FRAGMENT_SURFACES = {"placeholder", "label", "tooltip"}

# Verb-detection: very rough. Token ends in -ed, -ing, -s, or is in this small
# list of irregulars. False positives/negatives are expected — borderline cases
# go to human review during the audit.
_AUXILIARIES = {
    "is", "was", "are", "were", "be", "been", "being", "has", "have", "had",
    "do", "does", "did", "will", "would", "should", "could", "must", "may",
    "might", "can", "shall",
}
_IRREGULAR_VERBS = {
    "go", "goes", "went", "make", "made", "take", "took", "see", "saw",
    "give", "gave", "find", "found", "get", "got", "say", "said", "know",
    "knew", "think", "thought", "come", "came", "send", "sent", "save",
    "load", "fail", "succeed",
}


def _should_skip(value: str) -> bool:
    return bool(_URL_RE.match(value)) or bool(_PURE_DELEGATION_RE.match(value))


def _looks_like_sentence(value: str) -> bool:
    """Best-effort heuristic: ≥3 tokens AND contains a probable verb."""
    words = value.split()
    if len(words) < 3:
        return False
    for word in words:
        bare = word.rstrip(".,!?:;").lower()
        if bare in _AUXILIARIES or bare in _IRREGULAR_VERBS:
            return True
        if bare.endswith("ed") or bare.endswith("ing") or bare.endswith("s"):
            # Filter out plurals and noun forms with a small heuristic: skip
            # words ending in -s if they're 1-3 chars (likely "is", "was", etc.
            # already in auxiliaries; words like "as", "us", "his").
            if len(bare) > 3:
                return True
    return False


def validate_period_rule(value: str, surface: str) -> List[str]:
    """Validate that the string ends (or doesn't end) with a period appropriately.

    Args:
        value: The string to check.
        surface: The UI surface tag (e.g., "error", "placeholder", "general").
    """
    if _should_skip(value):
        return []

    stripped = value.rstrip()
    if not stripped:
        return []

    ends_with_period = stripped.endswith(".")

    if surface in _FRAGMENT_SURFACES:
        if ends_with_period:
            return [
                f"{surface} surface must not end with '.': {stripped[-30:]!r}"
            ]
        return []

    if _looks_like_sentence(stripped.rstrip(".")):
        if not ends_with_period and not stripped.endswith(("?",)):
            return [
                f"complete sentence must end with '.': {stripped[-30:]!r}"
            ]
    else:
        # Fragment in a non-fragment surface (e.g., a button label).
        # Period not allowed.
        if ends_with_period:
            return [
                f"fragment must not end with '.': {stripped[-30:]!r}"
            ]

    return []


def validate_no_trailing_bang(value: str) -> List[str]:
    """Validate that the string does not end with '!'."""
    if value.rstrip().endswith("!"):
        return [f"string must not end with '!': {value[-30:]!r}"]
    return []


def validate_no_forbidden_phrases(value: str, lists: StyleLists) -> List[str]:
    """Validate that the string contains no forbidden phrases."""
    errors: List[str] = []
    lowered = value.lower()
    for phrase in lists.forbidden_phrases:
        if phrase.lower() in lowered:
            errors.append(f"forbidden phrase '{phrase}' in: {value!r}")
    return errors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_punctuation -v`
Expected: PASS, 14 tests OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/punctuation.py scripts/i18n_style/tests/test_punctuation.py
git commit -m "$(cat <<'EOF'
feat: add punctuation/forbidden-phrase validators for i18n (#676)

Three independent checks: period rule (sentences end with .,
fragments do not), no trailing '!', no forbidden phrases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.3: Comment-sibling validator

**Files:**
- Create: `scripts/i18n_style/comment_siblings.py`
- Test: `scripts/i18n_style/tests/test_comment_siblings.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_comment_siblings.py`:

```python
"""Tests for comment-sibling validator."""

import unittest

from scripts.i18n_style.comment_siblings import (
    validate_required_comment_siblings,
    validate_no_comment_in_non_en,
)


class TestRequiredCommentSiblings(unittest.TestCase):
    def test_short_ambiguous_word_with_comment_passes(self):
        data = {
            "common": {
                "filter": "Filter",
                "filter.comment": "Verb on a filter button.",
            }
        }
        usage_map = {
            "common.filter": {
                "ambiguous_word": True,
                "needs_translator_comment": False,
            }
        }
        self.assertEqual(
            validate_required_comment_siblings(data, usage_map), []
        )

    def test_short_ambiguous_word_without_comment_fails(self):
        data = {"common": {"filter": "Filter"}}
        usage_map = {
            "common.filter": {
                "ambiguous_word": True,
                "needs_translator_comment": True,
            }
        }
        errors = validate_required_comment_siblings(data, usage_map)
        self.assertTrue(errors)
        self.assertIn("common.filter", errors[0])

    def test_long_string_no_comment_required(self):
        data = {"common": {"filter": "Filter the list of users by role"}}
        usage_map = {
            "common.filter": {
                "ambiguous_word": False,
                "needs_translator_comment": False,
            }
        }
        self.assertEqual(
            validate_required_comment_siblings(data, usage_map), []
        )


class TestNoCommentInNonEn(unittest.TestCase):
    def test_clean_locale_passes(self):
        data = {"common": {"save": "Guardar"}}
        self.assertEqual(validate_no_comment_in_non_en(data), [])

    def test_comment_key_in_non_en_fails(self):
        data = {
            "common": {
                "save": "Guardar",
                "save.comment": "Verb. Used on submit buttons.",
            }
        }
        errors = validate_no_comment_in_non_en(data)
        self.assertTrue(errors)
        self.assertIn("comment", errors[0])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_comment_siblings -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the validator**

Create `scripts/i18n_style/comment_siblings.py`:

```python
"""Validate `.comment` sibling presence and absence per locale."""

from typing import Dict, List, Any


def validate_required_comment_siblings(
    en_us_data: Dict, usage_map: Dict[str, Dict[str, Any]]
) -> List[str]:
    """Return a list of keys missing a required `.comment` sibling in en-US."""
    errors: List[str] = []
    for key, entry in usage_map.items():
        if entry.get("needs_translator_comment"):
            errors.append(f"{key}: missing `.comment` sibling for ambiguous short string")
    return errors


def _walk_comment_keys(obj, prefix: str = ""):
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if full_key.endswith(".comment"):
                yield full_key
            elif isinstance(value, dict):
                yield from _walk_comment_keys(value, full_key)


def validate_no_comment_in_non_en(locale_data: Dict) -> List[str]:
    """Return a list of error messages for `.comment` keys present in non-en-US data."""
    errors: List[str] = []
    for full_key in _walk_comment_keys(locale_data):
        errors.append(
            f"`.comment` keys are en-US-only; remove from non-en-US locale: {full_key}"
        )
    return errors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_comment_siblings -v`
Expected: PASS, 5 tests OK.

- [ ] **Step 5: Commit**

```bash
git add scripts/i18n_style/comment_siblings.py scripts/i18n_style/tests/test_comment_siblings.py
git commit -m "$(cat <<'EOF'
feat: add comment-sibling validators for i18n (#676)

Validates that ambiguous short en-US strings have .comment siblings,
and that non-en-US locale files don't contain .comment keys.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.4: Checker orchestrator + main entry

**Files:**
- Create: `scripts/i18n_style/checker.py`
- Create: `scripts/check-i18n-style.py`
- Test: `scripts/i18n_style/tests/test_checker.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_checker.py`:

```python
"""Tests for the orchestrator/checker."""

import json
import tempfile
import unittest
from pathlib import Path

from scripts.i18n_style.checker import run_check, CheckResult


class TestRunCheck(unittest.TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tmpdir.name)
        self.locale_path = self.root / "en-US.json"
        self.usage_path = self.root / "en-US.usage.json"

    def tearDown(self):
        self.tmpdir.cleanup()

    def _write(self, locale_data, usage_map):
        with open(self.locale_path, "w") as f:
            json.dump(locale_data, f)
        with open(self.usage_path, "w") as f:
            json.dump(usage_map, f)

    def test_clean_strings_pass(self):
        self._write(
            {"about": {"title": "About TMI"}},
            {
                "about.title": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertEqual(result.blocking_violations, [])

    def test_title_case_violation_blocks(self):
        self._write(
            {"about": {"title": "About Threat Model"}},
            {
                "about.title": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertTrue(result.blocking_violations)

    def test_lint_skip_sibling_skips_check(self):
        self._write(
            {
                "verbatim": {
                    "thing": "About Threat Model",
                    "thing.lint-skip": "Verbatim quote, do not edit.",
                }
            },
            {
                "verbatim.thing": {
                    "surfaces": ["page-title"],
                    "uses": [],
                    "ellipsis_candidate": False,
                    "ambiguous_word": False,
                    "needs_translator_comment": False,
                }
            },
        )
        result = run_check(self.locale_path, self.usage_path)
        self.assertEqual(result.blocking_violations, [])
        self.assertEqual(len(result.skipped_keys), 1)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_checker -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the orchestrator**

Create `scripts/i18n_style/checker.py`:

```python
"""Orchestrates the i18n style check across all validators."""

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from scripts.i18n_style.config import load_lists
from scripts.i18n_style.sentence_case import validate_sentence_case
from scripts.i18n_style.punctuation import (
    validate_period_rule,
    validate_no_trailing_bang,
    validate_no_forbidden_phrases,
)
from scripts.i18n_style.comment_siblings import (
    validate_required_comment_siblings,
    validate_no_comment_in_non_en,
)


@dataclass
class CheckResult:
    blocking_violations: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    skipped_keys: List[str] = field(default_factory=list)


def _flatten(obj, prefix: str = "") -> Dict[str, str]:
    out: Dict[str, str] = {}
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if isinstance(value, dict):
                out.update(_flatten(value, full_key))
            elif isinstance(value, str):
                out[full_key] = value
    return out


def _has_lint_skip(data: Dict, key: str) -> bool:
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        if isinstance(cur, dict) and p in cur:
            cur = cur[p]
        else:
            return False
    return isinstance(cur, dict) and f"{parts[-1]}.lint-skip" in cur


def _primary_surface(surfaces: List[str]) -> str:
    """Pick a single surface for surface-aware validators (e.g., period rule).

    Priority order: error > snackbar > validation > placeholder > tooltip >
    label > button > menu-item > dialog-title > page-title > description >
    general.
    """
    priority = [
        "error", "snackbar", "validation", "placeholder", "tooltip",
        "label", "button", "menu-item", "dialog-title", "page-title",
        "description", "general",
    ]
    for s in priority:
        if s in surfaces:
            return s
    return "general"


def run_check(locale_path: Path, usage_path: Path) -> CheckResult:
    """Run all validators against en-US.json + the sidecar.

    Returns a CheckResult with blocking_violations and warnings populated.
    """
    with open(locale_path, "r", encoding="utf-8") as f:
        locale_data = json.load(f)
    with open(usage_path, "r", encoding="utf-8") as f:
        usage_map = json.load(f)

    lists = load_lists()
    result = CheckResult()

    # Comment-sibling: missing required `.comment` keys.
    result.blocking_violations.extend(
        validate_required_comment_siblings(locale_data, usage_map)
    )

    # Per-key string validation.
    flat = _flatten(locale_data)
    for key, value in flat.items():
        # Exclude meta keys (handled elsewhere).
        if key.endswith(".comment") or key.endswith(".lint-skip"):
            continue
        if _has_lint_skip(locale_data, key):
            result.skipped_keys.append(key)
            continue

        entry = usage_map.get(key, {})
        surfaces = entry.get("surfaces", ["general"])
        primary_surface = _primary_surface(surfaces)

        # Sentence case.
        for err in validate_sentence_case(value, lists):
            result.blocking_violations.append(f"{key}: {err}")
        # Period rule.
        for err in validate_period_rule(value, primary_surface):
            result.blocking_violations.append(f"{key}: {err}")
        # Trailing bang.
        for err in validate_no_trailing_bang(value):
            result.blocking_violations.append(f"{key}: {err}")
        # Forbidden phrases.
        for err in validate_no_forbidden_phrases(value, lists):
            result.blocking_violations.append(f"{key}: {err}")

        # Ellipsis: warning only.
        if entry.get("ellipsis_candidate") and not value.rstrip().endswith("..."):
            result.warnings.append(
                f"{key}: button/menu opening dialog; consider trailing '...': {value!r}"
            )

    return result


def run_non_en_check(locale_paths: List[Path]) -> List[str]:
    """Verify no non-en-US file contains `.comment` keys."""
    errors: List[str] = []
    for path in locale_paths:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for err in validate_no_comment_in_non_en(data):
            errors.append(f"{path}: {err}")
    return errors
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_checker -v`
Expected: PASS, 3 tests OK.

- [ ] **Step 5: Write the uv-run wrapper script**

Create `scripts/check-i18n-style.py`:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Run the i18n style check against en-US.json.

Usage:
  uv run scripts/check-i18n-style.py             # CI mode
  uv run scripts/check-i18n-style.py --audit     # audit mode (write report)

Exits 0 on success, 1 on blocking violations (CI mode only).
"""

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.checker import run_check, run_non_en_check  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description="i18n style check")
    parser.add_argument("--audit", action="store_true", help="Audit mode: write markdown report.")
    parser.add_argument("--report", default="docs/i18n-audit-review.md", type=str)
    parser.add_argument("--locale", default="src/assets/i18n/en-US.json", type=str)
    parser.add_argument("--usage", default="src/assets/i18n/en-US.usage.json", type=str)
    parser.add_argument("--locales-dir", default="src/assets/i18n", type=str)
    args = parser.parse_args()

    locale_path = REPO_ROOT / args.locale
    usage_path = REPO_ROOT / args.usage
    locales_dir = REPO_ROOT / args.locales_dir

    result = run_check(locale_path, usage_path)

    # Also check non-en-US files for stray .comment keys.
    non_en = sorted(
        p for p in locales_dir.glob("*.json")
        if p.name != "en-US.json"
        and p.name != "en-US.usage.json"
        and p.name != "i18n-allowlist.json"
    )
    non_en_errors = run_non_en_check(non_en)
    result.blocking_violations.extend(non_en_errors)

    if args.audit:
        report_path = REPO_ROOT / args.report
        with open(report_path, "w", encoding="utf-8") as f:
            f.write("# i18n style audit report\n\n")
            f.write(f"## Blocking violations ({len(result.blocking_violations)})\n\n")
            for v in result.blocking_violations:
                f.write(f"- {v}\n")
            f.write(f"\n## Warnings ({len(result.warnings)})\n\n")
            for w in result.warnings:
                f.write(f"- {w}\n")
            f.write(f"\n## Skipped (lint-skip) ({len(result.skipped_keys)})\n\n")
            for s in result.skipped_keys:
                f.write(f"- {s}\n")
        print(f"Wrote {report_path}")
        sys.exit(0)

    if result.skipped_keys:
        print(f"Skipping {len(result.skipped_keys)} keys with lint-skip siblings.")
    if result.warnings:
        print(f"Warnings ({len(result.warnings)}):")
        for w in result.warnings[:50]:
            print(f"  WARN {w}")
        if len(result.warnings) > 50:
            print(f"  ... and {len(result.warnings) - 50} more")

    if result.blocking_violations:
        print(f"\nBlocking violations ({len(result.blocking_violations)}):")
        for v in result.blocking_violations:
            print(f"  FAIL {v}")
        sys.exit(1)

    print("i18n style check: OK.")
    sys.exit(0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Make executable**

Run: `chmod +x scripts/check-i18n-style.py`

- [ ] **Step 7: Run audit mode against the real codebase**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit`
Expected: prints `Wrote docs/i18n-audit-review.md` and exits 0.

- [ ] **Step 8: Inspect the report**

Run: `wc -l docs/i18n-audit-review.md && head -50 docs/i18n-audit-review.md`
Expected: a meaningful number of blocking violations (likely several hundred Title-Case strings, missing periods, missing comments).

This report is the input to Phase 4. The report file is transient — do NOT commit it yet. We'll commit at the end of Phase 4 / regenerate at the start of Phase 5.

- [ ] **Step 9: Commit the checker code (not the report)**

```bash
git add scripts/i18n_style/checker.py scripts/i18n_style/tests/test_checker.py scripts/check-i18n-style.py
git commit -m "$(cat <<'EOF'
feat: add i18n style check orchestrator and main script (#676)

Combines sentence-case, punctuation, forbidden-phrase, comment-sibling,
and ellipsis-candidate validators into a single check. Provides CI mode
(exits non-zero on blocking violations) and audit mode (writes markdown
report). Honors .lint-skip sibling escape hatch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 3.5: Wire `lint:i18n` into `lint:all`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current `lint` and `lint:all` scripts in package.json**

Run: `cat package.json | python3 -c "import json,sys; d=json.load(sys.stdin); s=d['scripts']; print(repr(s.get('lint:all'))); print(repr(s.get('lint'))); print(repr(s.get('lint:scss')))"`
Expected: `lint:all` is `'pnpm run lint && pnpm run lint:scss'`, `lint` and `lint:scss` exist.

- [ ] **Step 2: Modify `package.json` to add `lint:i18n` and chain it**

Use the Edit tool to add a `lint:i18n` script and modify `lint:all`. Find the `"lint:scss"` line in the scripts section and add after it (in `package.json`):

Add new script:
```json
"lint:i18n": "uv run scripts/check-i18n-style.py",
```

Modify `lint:all`:
```json
"lint:all": "pnpm run lint && pnpm run lint:scss && pnpm run lint:i18n",
```

- [ ] **Step 3: Verify the JSON is still valid**

Run: `python3 -c "import json; json.load(open('package.json'))"`
Expected: no output, exit 0.

- [ ] **Step 4: Verify the new script runs**

Run: `pnpm run lint:i18n`
Expected: exits non-zero (we have not yet fixed en-US.json), printing many `FAIL` lines. **This is expected** — the audit report from Task 3.4.8 already showed these. We'll fix them in Phase 4.

- [ ] **Step 5: Skip lint:all check for now**

Do NOT run `pnpm run lint:all` until Phase 4 is complete (it will fail on lint:i18n). At Phase 5 it must pass clean.

- [ ] **Step 6: Commit**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
build: wire lint:i18n into pnpm run lint:all (#676)

Adds new lint:i18n script invoking the i18n style check. Currently
fails — Phase 4 corrects en-US.json to bring the lint to green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Corrections to en-US.json

The lint and audit machinery now exist. Phase 4 brings en-US.json to a state where `pnpm run lint:i18n` exits clean.

### Task 4.1: Mechanical corrector script

**Files:**
- Create: `scripts/fix-i18n-style.py`
- Create: `scripts/i18n_style/corrector.py`
- Test: `scripts/i18n_style/tests/test_corrector.py`

- [ ] **Step 1: Write the failing test**

Create `scripts/i18n_style/tests/test_corrector.py`:

```python
"""Tests for the mechanical corrector."""

import unittest

from scripts.i18n_style.config import StyleLists
from scripts.i18n_style.corrector import (
    correct_sentence_case,
    correct_trailing_bang,
)


def _lists() -> StyleLists:
    return StyleLists(
        proper_nouns={"TMI", "Timmy", "Google Drive"},
        acronyms={"CVSS", "URL", "API"},
        domain_nouns={"threat model", "diagram"},
        ambiguous_words=set(),
        forbidden_phrases=set(),
    )


class TestCorrectSentenceCase(unittest.TestCase):
    def test_already_correct_unchanged(self):
        self.assertEqual(
            correct_sentence_case("Add document", _lists()), "Add document"
        )

    def test_title_case_lowered_mid_sentence(self):
        self.assertEqual(
            correct_sentence_case("Add Document", _lists()), "Add document"
        )

    def test_proper_noun_preserved(self):
        self.assertEqual(
            correct_sentence_case("About TMI", _lists()), "About TMI"
        )

    def test_acronym_preserved(self):
        self.assertEqual(
            correct_sentence_case("CVSS Score Calculator", _lists()),
            "CVSS score calculator",
        )

    def test_domain_noun_lowered(self):
        self.assertEqual(
            correct_sentence_case("Add Threat Model", _lists()),
            "Add threat model",
        )


class TestCorrectTrailingBang(unittest.TestCase):
    def test_no_bang_unchanged(self):
        self.assertEqual(correct_trailing_bang("Saved."), "Saved.")

    def test_trailing_bang_replaced_with_period(self):
        self.assertEqual(correct_trailing_bang("Saved!"), "Saved.")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_corrector -v`
Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Write the corrector**

Create `scripts/i18n_style/corrector.py`:

```python
"""Mechanical corrections for clear-cut style violations.

Conservative: only applies fixes where the rule is unambiguous. Strings whose
correction requires judgment (forbidden-phrase replacement, period rule when
verb detection is uncertain) are left alone.
"""

import re
from typing import Set

from scripts.i18n_style.config import StyleLists


def _is_canonical_proper_noun_token(token_lower: str, proper_nouns: Set[str]) -> str:
    """If `token_lower` matches a proper noun's lowercased form, return the canonical
    case form. Returns empty string if no match."""
    for pn in proper_nouns:
        if pn.lower() == token_lower:
            return pn
    return ""


def _is_canonical_acronym_token(token_lower: str, acronyms: Set[str]) -> str:
    for ac in acronyms:
        if ac.lower() == token_lower:
            return ac
    return ""


def correct_sentence_case(value: str, lists: StyleLists) -> str:
    """Lower-case mid-sentence words to sentence case, preserving proper nouns,
    acronyms, and (lowercased) domain nouns."""
    if not value:
        return value
    # Skip strings that should be skipped by validators.
    if value.startswith(("http://", "https://")):
        return value
    if re.match(r"^\{\{[a-zA-Z][\w.]*\}\}$", value):
        return value

    out_words = []
    sentence_start = True
    words = value.split(" ")
    for word in words:
        bare = word.rstrip(".,!?:;")
        trail = word[len(bare):]

        bare_lower = bare.lower()
        # Proper noun?
        canonical_pn = _is_canonical_proper_noun_token(bare_lower, lists.proper_nouns)
        if canonical_pn:
            out_words.append(canonical_pn + trail)
            sentence_start = bare.endswith((".", "!", "?"))
            continue

        # Acronym?
        canonical_ac = _is_canonical_acronym_token(bare_lower, lists.acronyms)
        if canonical_ac:
            out_words.append(canonical_ac + trail)
            sentence_start = bare.endswith((".", "!", "?"))
            continue

        # Sentence start: capitalize first letter; rest lowercase.
        if sentence_start:
            if bare:
                fixed = bare[0].upper() + bare[1:].lower()
            else:
                fixed = bare
            out_words.append(fixed + trail)
        else:
            # Mid-sentence: lowercase everything.
            out_words.append(bare.lower() + trail)

        sentence_start = bare.endswith((".", "!", "?"))

    return " ".join(out_words)


def correct_trailing_bang(value: str) -> str:
    """Replace a trailing '!' with '.'."""
    stripped = value.rstrip()
    if stripped.endswith("!"):
        trailing_ws = value[len(stripped):]
        return stripped[:-1] + "." + trailing_ws
    return value
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run python -m unittest scripts.i18n_style.tests.test_corrector -v`
Expected: PASS, 7 tests OK.

- [ ] **Step 5: Write the dry-run script**

Create `scripts/fix-i18n-style.py`:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.10"
# dependencies = []
# ///

"""Apply mechanical i18n style corrections to en-US.json.

Default is dry-run: prints proposed changes and exits without writing.
Use --apply to write changes.

Usage:
  uv run scripts/fix-i18n-style.py            # dry run
  uv run scripts/fix-i18n-style.py --apply    # apply changes
"""

import argparse
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from scripts.i18n_style.config import load_lists  # noqa: E402
from scripts.i18n_style.corrector import (  # noqa: E402
    correct_sentence_case,
    correct_trailing_bang,
)


def _walk_apply(obj, lists, prefix=""):
    """Yield (key, old_value, new_value) for each leaf string changed."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            if full_key.endswith(".comment") or full_key.endswith(".lint-skip"):
                continue
            if isinstance(value, dict):
                yield from _walk_apply(value, lists, full_key)
            elif isinstance(value, str):
                fixed = correct_trailing_bang(correct_sentence_case(value, lists))
                if fixed != value:
                    yield (full_key, value, fixed)


def _set_value(data, key, new_value):
    parts = key.split(".")
    cur = data
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = new_value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="Write changes (default: dry run).")
    parser.add_argument("--locale", default="src/assets/i18n/en-US.json")
    args = parser.parse_args()

    lists = load_lists()
    locale_path = REPO_ROOT / args.locale
    with open(locale_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    changes = list(_walk_apply(data, lists))
    print(f"{'APPLIED' if args.apply else 'WOULD APPLY'} {len(changes)} corrections:\n")
    for key, old, new in changes:
        print(f"  {key}")
        print(f"    - {old!r}")
        print(f"    + {new!r}")

    if args.apply:
        for key, _, new in changes:
            _set_value(data, key, new)
        with open(locale_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print(f"\nWrote {locale_path}.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Make executable**

Run: `chmod +x scripts/fix-i18n-style.py`

- [ ] **Step 7: Run dry-run on real en-US.json**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/fix-i18n-style.py | tee /tmp/i18n-dry-run.txt`
Expected: prints `WOULD APPLY <N> corrections` followed by N entries. Inspect a sample to verify the corrections look right.

- [ ] **Step 8: Spot-check the dry-run output**

Run: `head -100 /tmp/i18n-dry-run.txt`
Expected: corrections that visually match the rubric. Look for problems (e.g., a proper noun being lowered incorrectly — would indicate a missing entry in `proper_nouns`).

If you find systematic problems (a brand name not in the proper-noun list, an acronym not recognized), update `scripts/i18n_style/lists.json` and re-run the dry run. Iterate until the dry-run output is clean.

- [ ] **Step 9: Commit the corrector code (without applying yet)**

```bash
git add scripts/i18n_style/corrector.py scripts/i18n_style/tests/test_corrector.py scripts/fix-i18n-style.py
git commit -m "$(cat <<'EOF'
feat: add mechanical i18n corrector script (#676)

Conservative auto-fixer: lower-cases Title-Case mid-sentence words,
replaces trailing '!' with '.', preserves proper nouns and acronyms.
Defaults to dry-run; --apply writes changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.2: Apply mechanical corrections

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Apply the corrections**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/fix-i18n-style.py --apply`
Expected: writes `src/assets/i18n/en-US.json` with corrections applied.

- [ ] **Step 2: Verify the JSON is still well-formed**

Run: `python3 -c "import json; json.load(open('src/assets/i18n/en-US.json'))"`
Expected: no output, exit 0.

- [ ] **Step 3: Re-run lint to see remaining violations**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit && wc -l docs/i18n-audit-review.md`
Expected: substantially fewer blocking violations than before. The remaining violations are the human-judgment cases (forbidden-phrase replacements, period-rule edge cases, missing `.comment` siblings, ellipsis suggestions).

- [ ] **Step 4: Spot-check a few of the mechanically-corrected strings**

Run: `python3 -c "import json; d=json.load(open('src/assets/i18n/en-US.json')); print('about.title:', d['about']['title']); print('common.delete:', d.get('common',{}).get('delete'))"`
Expected: titles and buttons in sentence case. Confirm no obvious miscorrections (e.g., proper nouns lowercased).

- [ ] **Step 5: Commit the en-US.json corrections**

```bash
git add src/assets/i18n/en-US.json
git commit -m "$(cat <<'EOF'
style: apply mechanical sentence-case corrections to en-US (#676)

Lower-cases Title-Case mid-sentence words, replaces trailing '!' with
'.', preserves proper nouns and acronyms per the rubric. Generated by
scripts/fix-i18n-style.py --apply. Human-review violations remain
to be addressed in subsequent commits.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.3: Add `.comment` siblings for required keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

The audit report lists every key with `needs_translator_comment: true`. Each requires a sibling `<key>.comment` value supplying part-of-speech and UI context.

- [ ] **Step 1: Regenerate the usage map**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`
(Updates `needs_translator_comment` flags now that en-US has been corrected.)

- [ ] **Step 2: Extract the list of keys needing comments**

Run: `python3 -c "import json; m=json.load(open('src/assets/i18n/en-US.usage.json')); needs=[(k,v.get('surfaces',['general'])) for k,v in m.items() if v.get('needs_translator_comment')]; [print(k, surfaces) for k,surfaces in needs]" | tee /tmp/needs-comments.txt`
Expected: list of ambiguous-short-word keys with their inferred surfaces (e.g., `common.filter ['button']`, `admin.users.filterLabel ['label']`).

- [ ] **Step 3: For each key, decide on a comment and write it**

For each key in `/tmp/needs-comments.txt`, manually:
- Read the key's `uses` array in `en-US.usage.json` to confirm part-of-speech.
- Add a `<key>.comment` sibling to `en-US.json` with format:
  - `"<key>.comment": "Verb. Used on a button that initiates filtering."` for verb-on-button.
  - `"<key>.comment": "Noun. Labels a filter form field."` for noun-as-label.
  - `"<key>.comment": "Used in <surface>. <part of speech>. <disambiguation>."` general format.

Use the Edit tool one key at a time. The number of keys is bounded (likely 30-80), so this is per-key human work rather than batch.

For example, for `common.filter`:

Use Edit on `src/assets/i18n/en-US.json`:
```jsonc
// Find:
    "filter": "Filter",
// Replace with:
    "filter": "Filter",
    "filter.comment": "Used as a noun labeling a filter input field. See common.filterButton for the verb form.",
```

(Note: depending on the actual key context — verb vs. noun — the comment differs. Read the usage map.)

- [ ] **Step 4: Re-run the lint to verify all comment-sibling violations cleared**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit`
Expected: report shows zero `missing .comment sibling` violations.

- [ ] **Step 5: Verify JSON well-formedness**

Run: `python3 -c "import json; json.load(open('src/assets/i18n/en-US.json'))"`
Expected: no output, exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "$(cat <<'EOF'
feat: add translator .comment siblings for ambiguous short i18n keys (#676)

Adds disambiguation comments for short en-US strings containing words
that could be either nouns or verbs (Filter, Search, Edit, etc.).
Comments give translators part-of-speech and UI context.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.4: Resolve forbidden-phrase violations

**Files:**
- Modify: `src/assets/i18n/en-US.json`
- Modify: `docs/i18n-audit-review.md` (track decisions)

- [ ] **Step 1: Re-run the audit**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit`

- [ ] **Step 2: Extract forbidden-phrase violations**

Run: `grep -A0 "forbidden phrase" docs/i18n-audit-review.md | tee /tmp/forbidden-phrase-violations.txt`
Expected: a list of keys whose values contain `Please try again`, `Sorry,`, `Oops`, etc.

- [ ] **Step 3: For each, decide on a context-appropriate replacement**

For each violation, read the key's surface in `en-US.usage.json` and the value, then choose a replacement:

- If the next step is unknown: drop the forbidden phrase entirely. `'Failed to invoke addon. Please try again.'` → `'Failed to invoke addon.'`.
- If a specific next step is reasonable: replace with it. `'Could not connect to Timmy. Check your connection and try again.'` is already good (no forbidden phrase) — verify the audit caught it because of `try again` if the lint flags `Please try again` substring (it shouldn't if the substring match is exact).
- If the message is purely apologetic with no information: rewrite to state what happened. `'Sorry, that didn't work.'` → `'Operation failed.'` plus context if available.

Apply each fix with the Edit tool on `en-US.json`.

- [ ] **Step 4: Re-run lint**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit && grep -c "forbidden phrase" docs/i18n-audit-review.md`
Expected: count is 0.

- [ ] **Step 5: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "$(cat <<'EOF'
style: replace forbidden tone phrases in en-US strings (#676)

Removes 'Please try again', 'Sorry,', and similar reflexive politeness
phrases per the style guide. Replacements are context-specific: drop
when no next step is known, or substitute a specific next step.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.5: Resolve period-rule violations and ellipsis warnings

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Re-run audit**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit`

- [ ] **Step 2: Extract period-rule violations**

Run: `grep -E "must (not )?end with '\\.'" docs/i18n-audit-review.md | tee /tmp/period-violations.txt`
Expected: a list of keys with period-rule violations.

- [ ] **Step 3: For each, edit the en-US value**

For each violation, read the value in `en-US.json` and decide:
- "must end with '.'": the string is a complete sentence; add a trailing period.
- "must not end with '.'": the string is a fragment / placeholder / button label; remove the trailing period.

Use Edit one key at a time.

- [ ] **Step 4: Re-run lint and verify period violations cleared**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py --audit && grep -cE "must (not )?end with '\\.'" docs/i18n-audit-review.md`
Expected: count is 0.

- [ ] **Step 5: Address ellipsis warnings**

Run: `grep "consider trailing" docs/i18n-audit-review.md | tee /tmp/ellipsis-warnings.txt`

For each warning, verify in the source code that the click handler does open a dialog (the detector is best-effort; verify by reading the .ts file referenced in the usage map). Then either:
- Add `...` to the en-US value (the lint warning will clear).
- Add a `<key>.lint-skip` sibling with `"Confirmed: handler does not open a dialog despite static analysis match."` if the detector misfired.

- [ ] **Step 6: Re-run lint clean**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/check-i18n-style.py`
Expected: exits 0, prints `i18n style check: OK.`. (Warnings may still remain — those are non-blocking.)

If ANY blocking violations remain, repeat the read-decide-edit cycle until clean.

- [ ] **Step 7: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "$(cat <<'EOF'
style: resolve period-rule and ellipsis violations in en-US (#676)

Sentences end with periods; fragments (placeholders, button labels,
labels) do not. Buttons/menu items that open dialogs end with '...'.
en-US.json now passes lint:i18n with zero blocking violations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4.6: Regenerate usage map (final for en-US.json)

**Files:**
- Modify: `src/assets/i18n/en-US.usage.json`

- [ ] **Step 1: Regenerate**

Run: `cd /Users/efitz/Projects/tmi-ux && uv run scripts/build-i18n-usage-map.py`

- [ ] **Step 2: Verify lint still passes**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm run lint:i18n`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.usage.json
git commit -m "$(cat <<'EOF'
chore: regenerate en-US usage map after style corrections (#676)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Locale regeneration and verification

### Task 5.1: Build a list of changed keys

**Files:** none (analysis only)

- [ ] **Step 1: Find the commit before Phase 4 corrections**

Run: `git log --oneline -- src/assets/i18n/en-US.json | head -10`
Identify the most recent commit before the Phase 4 corrections — call its sha `BEFORE_SHA`. (It's the commit immediately before the `style: apply mechanical sentence-case corrections` commit.)

- [ ] **Step 2: Generate a per-key diff of values**

Run:
```bash
git show $BEFORE_SHA:src/assets/i18n/en-US.json > /tmp/en-US-before.json
python3 << 'EOF'
import json

before = json.load(open('/tmp/en-US-before.json'))
after = json.load(open('src/assets/i18n/en-US.json'))

def flatten(o, p=''):
    out = {}
    if isinstance(o, dict):
        for k, v in o.items():
            fk = f'{p}.{k}' if p else k
            if isinstance(v, dict):
                out.update(flatten(v, fk))
            else:
                out[fk] = v
    return out

b = flatten(before)
a = flatten(after)

added = [k for k in a if k not in b]  # mostly .comment siblings
changed = [k for k in a if k in b and a[k] != b[k]]
removed = [k for k in b if k not in a]

with open('/tmp/changed-keys.json', 'w') as f:
    json.dump({
        'changed': sorted(changed),
        'added': sorted(added),
        'removed': sorted(removed),
    }, f, indent=2)

print(f'Changed: {len(changed)}')
print(f'Added: {len(added)} (mostly .comment siblings)')
print(f'Removed: {len(removed)}')
EOF
```
Expected: prints counts. The "changed" set is what needs re-translation in non-en-US files.

- [ ] **Step 2: No commit (working file in /tmp)**

### Task 5.2: Regenerate translations for changed keys

**Files:**
- Modify: `src/assets/i18n/<locale>.json` for each of the 16 non-English locales.

- [ ] **Step 1: Identify the locales**

Run: `ls src/assets/i18n/*.json | grep -v en-US | grep -v allowlist | grep -v usage`
Expected: 16 files: `ar-SA, bn-BD, de-DE, es-ES, fr-FR, he-IL, hi-IN, id-ID, ja-JP, ko-KR, pt-BR, ru-RU, th-TH, ur-PK, zh-CN`.

- [ ] **Step 2: For each changed key, in each locale, regenerate the translation**

For each locale (do them sequentially or in parallel — they're independent):

Use the `translate_to_language` skill to translate each changed key's new en-US value into the target language. Pass the key name, new en-US value, target language code, and the surface info from the usage map for context.

The mechanical loop (per locale):

```
For each key in /tmp/changed-keys.json["changed"]:
    new_en = en-US.json[key]
    surfaces = en-US.usage.json[key]["surfaces"]
    comment = en-US.json.<sibling>.comment if exists else None
    target_value = translate_to_language(
        text=new_en,
        target_lang=<locale>,
        context=f"surfaces={surfaces}; comment={comment or 'n/a'}"
    )
    validate_translation(en=new_en, target=target_value, target_lang=<locale>)
    Set <locale>.json[key] = target_value
```

This is best run as a Python script that calls the skills via the appropriate harness. Implementation note: the skills are interactive; for batch runs, a per-key invocation against an LLM API is the practical execution path. The implementation agent will use whatever skill or harness is available (`translate_to_language`, `validate_translation`).

- [ ] **Step 3: Verify each locale file is well-formed**

For each locale:

Run: `python3 -c "import json; json.load(open('src/assets/i18n/<locale>.json'))"`
Expected: no output, exit 0.

- [ ] **Step 4: Run validate_translation across regenerated keys**

For each locale, invoke the `validate_translation` skill against each regenerated key. If validations fail (placeholder loss, length explosion, encoding issues), fix and re-run.

- [ ] **Step 5: Run check-i18n.py to verify key parity**

Run: `pnpm run check-i18n:dry-run`
Expected: prints comparison report. No keys missing in any locale; no `.comment` keys leaked into non-en-US files (the lint will catch the latter too).

- [ ] **Step 6: Run lint:i18n**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm run lint:i18n`
Expected: exits 0.

- [ ] **Step 7: Update i18n-allowlist.json if any regenerated translations match en-US**

If `pnpm run check-i18n` flags any keys as "potentially untranslated" (regenerated value happened to match the en-US value), and that's correct (e.g., proper noun, technical term that's the same in the target language), add the key to `i18n-allowlist.json` for that locale.

- [ ] **Step 8: Commit per-locale**

To keep diffs reviewable, commit each locale separately:

```bash
for locale in ar-SA bn-BD de-DE es-ES fr-FR he-IL hi-IN id-ID ja-JP ko-KR pt-BR ru-RU th-TH ur-PK zh-CN; do
    git add src/assets/i18n/$locale.json
    git commit -m "$(cat <<EOF
chore: regenerate $locale translations for keys whose en-US value changed (#676)

Triggered by the en-US capitalization audit. Only keys whose en-US
value changed were re-translated; unchanged keys retain their existing
translations.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
done
```

If `i18n-allowlist.json` was updated, commit it separately:
```bash
git add src/assets/i18n/i18n-allowlist.json
git commit -m "chore: update i18n allowlist for newly-matching translations (#676)"
```

### Task 5.3: Run validate_localization_coverage

**Files:** none

- [ ] **Step 1: Generate coverage report**

Invoke the `validate_localization_coverage` skill. Read the output. Compare against expected coverage (no new gaps introduced beyond what existed before this work).

- [ ] **Step 2: If new gaps were introduced, investigate and fix**

For any locale that lost coverage during regeneration, re-translate the missing keys and re-run. Commit any fixes per locale.

### Task 5.4: Final verification

**Files:** none

- [ ] **Step 1: Run full lint suite**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm run lint:all`
Expected: clean. All three sub-lints (eslint, stylelint, lint:i18n) exit 0.

- [ ] **Step 2: Run build**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm run build`
Expected: clean.

- [ ] **Step 3: Run tests**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm test`
Expected: clean. No tests should reference the changed strings; if any fail because they assert on en-US text, those tests need updating to match the new strings — fix as part of this phase.

- [ ] **Step 4: Manual smoke test**

Run: `cd /Users/efitz/Projects/tmi-ux && pnpm run dev`

In the browser, walk through:
- Threat-model list page (titles, buttons, filters).
- Threat-model detail / edit (dialog titles, field labels, buttons, error messages on form validation).
- DFD editor (toolbar tooltips, context menu items).
- Admin pages (users, groups, settings — table headers, action buttons).
- Intake survey (placeholder text, button labels).
- About page (proper nouns intact).

For any obviously-wrong string (a garbled translation, a button label that lost meaning), fix in en-US.json and the relevant locale file. Commit fixes individually.

Stop the dev server when done.

### Task 5.5: File the tone-audit follow-up issue

**Files:** none

- [ ] **Step 1: File the issue**

Run:
```bash
gh issue create \
    --title "chore: tone audit of all en-US localized strings (post-rubric)" \
    --milestone "1.4.0" \
    --assignee "ericfitz" \
    --body "$(cat <<'EOF'
Follow-up to #676. The en-US style guide established at `src/assets/i18n/STYLE-GUIDE.md` includes tone rules that go beyond what the auto-check enforces: tone is hard to lint mechanically, so the lint covers only the forbidden-phrase blacklist.

This issue is a tone audit pass through every en-US string the auto-check passes, judging tone against the rubric:

- Errors, snackbars, validation messages: state what happened plainly, tell the user the next step when there is one, use past-tense action constructions, no apologetic / cutesy phrasing beyond the blacklist.
- Validation messages: state the requirement (`Email address is required`), not the failure mode.
- Descriptive text in dialogs and headers: clear, direct, no marketing voice.

Acceptance criteria:

- Read every error, snackbar, validation, and description-surface key in en-US.json.
- For each, judge against the rubric.
- For tone-correct strings: no change.
- For tone-wrong strings: edit in place, regenerate the affected key in each non-English locale.
- File any human-judgment items as a further issue.
- `pnpm run lint:all` clean afterward.

Source rubric: `src/assets/i18n/STYLE-GUIDE.md`. Resulting from #676.
EOF
)" \
    --label "" \
    --project "tmi"
```

(Note: project assignment via `--project` flag may need replacement with `gh project item-add` or similar depending on `gh` version; check `gh project --help` if `--project` is rejected. Status `This milestone` and priority `Must Have` may need to be set via `gh project item-edit` after creation, since `gh issue create` doesn't accept project-board fields directly.)

After issue creation, set status and priority on the project board:

```bash
ISSUE_NUM=<the new issue number>
gh project item-add <project-id> --owner ericfitz --url https://github.com/ericfitz/tmi-ux/issues/$ISSUE_NUM
# Set Status=This milestone and Priority=Must Have via the project UI or `gh project item-edit`.
```

If `gh` automation for project fields proves brittle, set them manually in the GitHub UI — the issue must end up with: project=tmi, milestone=1.4.0, assignee=ericfitz, status=This milestone, priority=Must Have.

- [ ] **Step 2: Note the new issue number for the closure comment on #676**

### Task 5.6: File the human-review-deferred issue (if needed)

**Files:** none

- [ ] **Step 1: Determine if there are deferred items**

If during Phase 4 you accumulated keys whose decision was deferred (notes, edge cases, etc.), file an issue listing them.

- [ ] **Step 2: File the issue (only if there are items)**

```bash
gh issue create \
    --title "chore: human-review pass for en-US strings flagged during #676 audit" \
    --milestone "1.4.0" \
    --assignee "ericfitz" \
    --body "$(cat <<'EOF'
Follow-up to #676. The capitalization audit's auto-check flagged the following keys as needing human judgment that wasn't resolved during the audit. Each requires reading the key's surface, the current value, and the rubric, then either editing the en-US value (and regenerating affected locales) or adding a `<key>.lint-skip` sibling with a justification.

Keys:

- <list of deferred keys with current value and reason>

Acceptance criteria:

- Each key resolved with either an edit or a documented lint-skip.
- Affected locale files regenerated for any en-US edits.
- `pnpm run lint:all` clean afterward.
EOF
)" \
    --label "" \
    --project "tmi"
```

If no deferred items remain, skip this task entirely.

### Task 5.7: Delete the audit working document

**Files:**
- Delete: `docs/i18n-audit-review.md`

- [ ] **Step 1: Delete the file**

Run: `rm docs/i18n-audit-review.md`

- [ ] **Step 2: Verify it's gone**

Run: `ls docs/i18n-audit-review.md 2>&1 || echo deleted`
Expected: prints `deleted`.

- [ ] **Step 3: Commit (only if the file was previously tracked in git)**

The audit-review file should never have been committed (it was transient throughout). Verify:

Run: `git ls-files docs/i18n-audit-review.md`
Expected: no output (file was never tracked).

If for any reason it was tracked, commit the deletion:

```bash
git add -u docs/i18n-audit-review.md
git commit -m "chore: remove transient i18n audit review file (#676)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

### Task 5.8: Close #676

**Files:** none

- [ ] **Step 1: Get the final commit SHA**

Run: `git log --oneline -1`
Note the SHA (call it `FINAL_SHA`).

- [ ] **Step 2: Add a closure comment to #676**

```bash
gh issue comment 676 --body "Resolved in <FINAL_SHA> on branch dev/1.4.0.

Style guide established at \`src/assets/i18n/STYLE-GUIDE.md\`. Lint check wired into \`pnpm run lint:all\` via \`lint:i18n\`. en-US.json corrections applied; non-English locale translations regenerated for changed keys. Sidecar usage map at \`src/assets/i18n/en-US.usage.json\`.

Tone audit follow-up: #<TONE_AUDIT_ISSUE_NUM>.
$([ -n \"\$DEFERRED_ISSUE_NUM\" ] && echo \"Human-review deferred items: #\$DEFERRED_ISSUE_NUM.\" || echo \"\")"
```

- [ ] **Step 3: Close the issue**

```bash
gh issue close 676
```

- [ ] **Step 4: Verify closure**

Run: `gh issue view 676 --json state -q .state`
Expected: `CLOSED`.

---

## Self-review notes

This plan was self-reviewed against the spec. The check found:

**Spec coverage:** Each section/requirement mapped to at least one task:

- Style guide doc → Task 1.1.
- Maintained-lists config → Task 1.2.
- Usage map pipeline (stages 1-9) → Tasks 2.1-2.7. (Stages 4 = CSS class lookup and 6 = model verification deferred to "out of scope for the minimum-viable map" — the spec says these are optional accuracy improvements, not blocking; reduced to spot-check at Task 2.8.)
- Lint check (CI mode + audit mode) → Tasks 3.1-3.4.
- `lint:all` integration → Task 3.5.
- Mechanical sweep → Task 4.1-4.2.
- Per-key human-review → Tasks 4.3, 4.4, 4.5.
- Locale regeneration → Tasks 5.1-5.2.
- Verification → Task 5.4.
- Tone-audit follow-up issue → Task 5.5.
- Human-review-deferred issue → Task 5.6.
- Closure → Tasks 5.7-5.8.

**Stages 4 and 6 deferred:** Per the spec's open-implementation-time decisions, stages 4 (CSS class lookup) and 6 (model verification) were called out as optional accuracy improvements. The minimum-viable pipeline (stages 1, 2, 3, 7, 8, 9) is sufficient for the audit. If during Task 2.8 spot-check fewer than 18/20 keys are correctly identified, return to add stages 4 and/or 6 as additional tasks before proceeding to Phase 3.

**Method-name consistency:** Cross-checked `enumerate_keys`, `scan_for_key`, `scan_for_partial_key`, `infer_surfaces`, `is_ellipsis_candidate`, `build_usage_map`, `run_check`, `correct_sentence_case`, `correct_trailing_bang` — all referenced consistently across tasks.

**Schema consistency:** The usage map schema in Task 2.4 (`uses`, `surfaces`, `ellipsis_candidate`, `ambiguous_word`, `needs_translator_comment`, `confidence`, `found_by`) matches the consumers in Task 3.4 and the partial-search additions in Task 2.5.

**Forbidden-phrase substring matching:** Task 3.2's test cases verify case-insensitive substring matching; the spec's `Please try again` rule is correctly enforced.

**Open implementation choices:** Some tasks (4.3, 4.4, 4.5) require human judgment per key. The plan does not pre-decide every replacement — the audit report is the work-list, and the per-key edit cycle is the action.
