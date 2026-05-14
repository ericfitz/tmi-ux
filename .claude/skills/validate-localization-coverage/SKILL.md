---
name: validate-localization-coverage
description: Use when auditing i18n translation completeness across all target locales or identifying locales below a coverage threshold. Produces a per-locale and summary coverage report.
---

# Validate Localization Coverage

Generate a coverage report for all locales by running the bundled `scripts/check-i18n.py` analyzer and computing per-locale completeness against the master file.

## Bundled tool

`scripts/check-i18n.py` — the same self-contained Python 3.8+ analyzer used by [[analyze-localization-files]]. See that skill for the full description.

## Configuration

Reads `.claude/i18n.config.json` (walked up from `pwd`). Required fields: `locales_dir`, `master_locale`, `file_extension`.

Optional:

```jsonc
{
  "coverage": {
    "needs_attention_threshold": 95.0
  }
}
```

Defaults to 95% if absent.

## Inputs

None beyond the config file.

## Output

```json
{
  "master_file": "src/assets/i18n/en-US.json",
  "total_keys": 450,
  "locales_checked": 15,
  "per_locale": {
    "ar-SA": {
      "file_path": "src/assets/i18n/ar-SA.json",
      "missing_keys": ["about.trademarks"],
      "missing_count": 1,
      "coverage_percent": 99.78,
      "extra_keys": []
    }
  },
  "summary": {
    "average_coverage": 98.5,
    "fully_covered_locales": ["es-ES", "de-DE"],
    "needs_attention": [
      {"locale": "th-TH", "coverage_percent": 85.2, "missing_count": 67}
    ],
    "total_missing_translations": 245
  }
}
```

## Process

### 1. Run the bundled analyzer

```bash
uv run "$SKILL_DIR/scripts/check-i18n.py" -y
```

`$SKILL_DIR` is the absolute path to this skill's directory (provided by the harness at invocation). The script auto-discovers `.claude/i18n.config.json`.

### 2. Parse output

The script emits sections delimited by `=== Comparing <master> with <target> ===`. For each target:

- Lines after `Keys present in <master> but missing in <target>:` are `missing_keys` (until a blank line or next section).
- Lines after `Keys present in <target> but missing in <master>:` are `extra_keys`.
- `No keys missing in <X>.` indicates the corresponding list is empty.

Derive locale codes from the target's basename (e.g. `ar-SA.json` → `ar-SA`).

### 3. Count total keys in master

Load `<locales_dir>/<master_locale>.<file_extension>` and recursively count *leaf* keys (string values, not parent objects). `about.title` counts as 1.

### 4. Compute coverage

For each locale:

```
coverage_percent = round(((total_keys - missing_count) / total_keys) * 100, 2)
```

### 5. Summarize

- `average_coverage`: arithmetic mean across locales, rounded to 2 decimals.
- `fully_covered_locales`: locales with `coverage_percent === 100.0` and no extra keys.
- `needs_attention`: locales with `coverage_percent < threshold`, sorted by `missing_count` descending.
- `total_missing_translations`: sum of `missing_count`.

## Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `master_file` | string | Resolved path of the source-of-truth file. |
| `total_keys` | number | Leaf-key count of master. |
| `locales_checked` | number | Number of non-master locales examined. |
| `per_locale.<code>.coverage_percent` | number | 0-100, two decimal places. |
| `per_locale.<code>.extra_keys` | string[] | May indicate obsolete or accidentally-added keys. |
| `summary.average_coverage` | number | Mean of `coverage_percent`. |
| `summary.needs_attention` | object[] | Below threshold, sorted by `missing_count` desc. |

## Notes

1. The script sorts locale files in place and moves originals to `$TMPDIR/old-<basename>`. Pass `--dry-run` if this is undesirable.
2. The leaf-counting method here must match the script's: skip `.comment` keys, count only string-valued leaves.
3. Locale codes are BCP 47. Do not maintain a code-to-name map — let callers derive display names from `Intl.DisplayNames` if needed.
4. Extra keys can legitimately exist (locale-specific content) but usually indicate stale translations.
5. If the script fails, report stderr and exit code; do not produce a partial report unless the user asks for one.
