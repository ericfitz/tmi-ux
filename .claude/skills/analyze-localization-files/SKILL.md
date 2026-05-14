---
name: analyze-localization-files
description: Use when building a translation task manifest for an i18n project — produces per-language lists of missing keys with their source values by running the bundled check-i18n.py script.
---

# Analyze Localization Files

Analyze the differences between the master i18n file and target-language files, returning a per-language task manifest of missing keys with their source values.

This skill bundles its own analyzer (`scripts/check-i18n.py`) so it is tool-agnostic — it does not rely on `pnpm`, `npm`, or any other project-specific wrapper.

## Bundled tool

`scripts/check-i18n.py` is a self-contained Python 3.8+ script with PEP 723 inline metadata. Invoke it with `uv run` (recommended — no setup) or `python3` directly. It:

- Sorts the master and target JSON files in place (originals moved to `$TMPDIR/old-<basename>`).
- Reports keys present in master but missing in each target, and vice versa.
- Reports keys whose values are identical to the master ("potentially untranslated").
- Walks up from `pwd` to find `.claude/i18n.config.json` when invoked with no positional file argument.

## Configuration

The script reads `.claude/i18n.config.json` (walked up from `pwd`):

```jsonc
{
  "locales_dir":    "src/assets/i18n",   // directory holding locale files
  "master_locale":  "en-US",              // basename (no extension) of the source-of-truth file
  "file_extension": "json"                 // optional, default "json"
}
```

If no config exists, either pass `--config <path>` or provide an explicit master file argument.

## Inputs

None beyond the config file. Optionally accepts an explicit path to the i18n config.

## Output

A map from locale code → task manifest:

```json
{
  "ar-SA": {
    "file_path": "src/assets/i18n/ar-SA.json",
    "language_code": "ar-SA",
    "missing_keys": [
      ["about.trademarks", "All product names, logos, ..."]
    ],
    "extra_keys": [],
    "total_missing": 1
  }
}
```

Field reference:

| Field | Type | Description |
|-------|------|-------------|
| `file_path` | string | Path to the locale file. |
| `language_code` | string | BCP 47 code (e.g. `es-ES`, `zh-CN`). |
| `missing_keys` | `[string, string][]` | `[dot.path, source_value]` tuples. |
| `extra_keys` | `string[]` | Keys present in target but not in master (possibly obsolete). |
| `total_missing` | number | Length of `missing_keys`. |

Locale codes follow BCP 47 / ISO 15897; human-readable language names are not part of the output — callers that need them should derive them from `Intl.DisplayNames` or an equivalent standards-backed source. Do not maintain a hand-rolled code-to-name map.

## Process

### 1. Run the bundled analyzer

From the user's project root:

```bash
uv run "$SKILL_DIR/scripts/check-i18n.py" -y
```

`$SKILL_DIR` is the absolute path to this skill's directory (the harness announces it when the skill is invoked). The script auto-discovers `.claude/i18n.config.json` and processes every locale file in `locales_dir`.

Capture stdout for parsing.

### 2. Parse the output

The script emits these section markers:

- Section header: `=== Comparing <master-path> with <target-path> ===`
- Per-section blocks:
  - `Keys present in <master> but missing in <target>:` followed by indented `  <dot.key.path>` lines, or `No keys missing in <target>.`
  - `Keys present in <target> but missing in <master>:` followed by indented `  <dot.key.path>` lines, or `No keys missing in <master>.`
  - `Potentially untranslated (same value as <master>):` — ignored by this skill (the `localization-backfill` command consumes it).

Parsing:

1. Split into sections at each `=== Comparing ... ===` line. Derive the locale code from the target path's basename (e.g. `ar-SA.json` → `ar-SA`).
2. Within each section, collect `missing_keys` from the first block.
3. Collect `extra_keys` from the second block when present.

### 4. Resolve source values

Load `<locales_dir>/<master_locale>.<file_extension>` and look up each missing key by dot path. For `admin.webhooks.addDialog.secret`:

1. Split on `.` → `["admin", "webhooks", "addDialog", "secret"]`.
2. Traverse the JSON object.
3. Return the leaf value.

Preserve template variables (`{{count}}`, `%s`, etc.) exactly.

### 5. Build manifests

Produce one entry per locale, including locales with no missing keys (`missing_keys: []`, `total_missing: 0`).

## Notes

1. The bundled script sorts locale files in place and moves originals to `$TMPDIR/old-<basename>`. Pass `--dry-run` to suppress this if needed.
2. If a key path doesn't exist in the master, record the entry with an empty string and surface a warning. This usually indicates the tool's output disagrees with the file.
3. Deeply nested keys (5+ levels) must be supported by the traversal.
4. The output is intentionally code-only — no `language_name` field — so the skill remains tool- and locale-agnostic. Use `Intl.DisplayNames` if a display name is needed.
5. The script honors `i18n-allowlist.json` and `.comment` annotations as documented in its module docstring.

## Example

With `i18n.config.json` set to `src/assets/i18n` / master `en-US`, the output for a project missing one Arabic key is:

```json
{
  "ar-SA": {
    "file_path": "src/assets/i18n/ar-SA.json",
    "language_code": "ar-SA",
    "missing_keys": [
      ["about.trademarks", "All product names, logos, and brands are property of their respective owners..."]
    ],
    "extra_keys": [],
    "total_missing": 1
  },
  "de-DE": {
    "file_path": "src/assets/i18n/de-DE.json",
    "language_code": "de-DE",
    "missing_keys": [],
    "extra_keys": [],
    "total_missing": 0
  }
}
```
