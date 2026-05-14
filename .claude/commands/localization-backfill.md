---
name: localization-backfill
description: Translate every missing or untranslated key across all i18n locale files using the master locale as the source. Tool-agnostic; reads project i18n configuration.
---

# Localization Backfill

Translate every missing or untranslated key across all i18n locale files using the master locale as the source.

This command orchestrates a set of skills; the skills do not assume any particular i18n tooling. Project-specific paths and commands come from `.claude/i18n.config.json`.

## Bundled scripts

- `localization-backfill.scripts/find_duplicate_localizations.py` — bundled dedupe analyzer used in Step 1 of this command.
- The translation analysis itself runs through [[analyze-localization-files]], which bundles its own `scripts/check-i18n.py`.

## Configuration

Same config used by the i18n skill family — see [[analyze-localization-files]] for the full schema. Required fields:

- `locales_dir`
- `master_locale`
- `file_extension`

Optional:

```jsonc
{
  "format_command":    "<shell command that normalizes formatting, e.g. 'pnpm run format'>",
  "dedupe_plan_file":  "<path where the dedupe script writes its plan, default 'localization_dedup_plan.txt'>"
}
```

If `format_command` is absent, the format step is skipped.

## Process

### Step 1: Deduplicate

Run the bundled dedupe script (`$COMMAND_DIR` is the directory holding this `.md` file):

```bash
uv run "$COMMAND_DIR/localization-backfill.scripts/find_duplicate_localizations.py" \
  --skippolicy --reference
```

The script reads `.claude/i18n.config.json` to find the master locale, then writes its plan to `localization_dedup_plan.txt` in the current directory (override with `-o`).

Then:

1. Read the plan file.
2. If it contains REFER recommendations:
   1. Back up locale files: `mkdir -p /tmp/i18n-dedup-backups && cp <locales_dir>/*.<ext> /tmp/i18n-dedup-backups/`.
   2. Apply each REFER change to the master locale — replace the literal value with a `{{reference}}` template.
   3. Apply the same reference change to every non-master locale (jq filter).
   4. Run `format_command` from config if present.
   5. Re-run the dedupe script to verify zero duplicates remain.
3. If no duplicates, continue to step 2.

### Step 2: Analyze locales

Use the [[analyze-localization-files]] skill to build per-locale task manifests:

For each locale, extract:
- Locale code (BCP 47)
- Missing keys (with master values)
- Potentially untranslated keys (value identical to master) — these are included for re-translation
- Extra keys (reported only)

### Step 3: Display analysis summary

Present to the user (locale display names should come from `Intl.DisplayNames`, not a hand-rolled map):

```
Localization analysis complete

Master file: <locales_dir>/<master_locale>.<ext>
Total locales: <N>

  Code    Missing  Untranslated
  ar-SA   0        143
  bn-BD   0        337
  de-DE   0        27
  …

Total strings to translate: <X>
Locales needing work:       <Y>
Locales complete:           <Z>
```

If nothing to translate, report and exit.

### Step 4: Spawn translation sub-agents in parallel

For each locale with work, dispatch a `general-purpose` sub-agent (one Task call per locale, all in a single message so they run in parallel).

Sub-agent prompt template:

```
You are translating keys for {LOCALE_CODE}.

Target file: {FILE_PATH}

## Instructions

For each key below:

1. Check if localizable using [[detect-non-localizable]] rules:
   - Skip URLs, emails, file paths, version numbers
   - Skip UUIDs, SCREAMING_SNAKE_CASE config keys, pure numbers
   - Skip template-only values like "{{common.name}}"
   - Skip format-token strings (e.g. "A4", "usLetter") that should remain standard
   - Skip proper nouns and brand names that don't translate
   - When in doubt, translate.

2. Translate using [[translate-to-language]]:
   - Preserve all placeholders exactly ({{var}}, {var}, %s, etc.)
   - Match the formality the locale expects for UI text
   - Keep similar length when reasonable
   - Use natural target-language phrasing

3. Validate using [[validate-translation]]:
   - All source placeholders present, none added
   - Not empty/whitespace
   - Reasonable length ratio

## Keys to translate

This list combines missing keys (absent in target) and untranslated keys
(present but identical to source):

{KEYS_JSON}

## Output

```json
{
  "translations": {"key.path": "translated value", ...},
  "skipped":      [{"key": "x", "reason": "URL - non-localizable"}],
  "errors":       [{"key": "y", "error": "description"}]
}
```

IMPORTANT: Do NOT create git commits. The parent agent handles commits.
```

### Step 5: Collect results

Wait for all sub-agents, then collect translations, skipped keys, and errors per locale.

### Step 6: Write translations

Use [[update-json-localization-file]] for each locale:
- Read current file
- Apply translations (additions/updates)
- Atomic write with 2-space indent and final newline
- Backup before writing

### Step 7: Final validation

Run [[validate-localization-coverage]] to produce a final coverage report.

### Step 8: Display final report

```
Localization backfill complete

Total locales processed:    <N>
Total strings translated:   <X>
Total strings skipped:      <Y>  (non-localizable)
Errors:                     <Z>

Per-locale:
  Code    Translated  Skipped  Errors
  ar-SA   120         23       0
  …

Files modified:
  <locales_dir>/ar-SA.<ext> (120 keys)
  …
```

## Error Handling

| Error | Behavior |
|-------|----------|
| `check_command` fails | Report and exit. |
| Sub-agent fails | Log, continue other locales, report at end. |
| File write fails | Log, continue, report at end. |
| Invalid JSON in sub-agent response | Skip that locale, log. |
| Validation fails for a translation | Apply it if placeholders are valid; otherwise drop and log. |

## Usage

```
/localization-backfill
```

## Implementation Notes

- All sub-agents run in parallel (one message, many Task calls).
- Each sub-agent handles one locale end-to-end.
- Backups are created before file modifications.
- Non-localizable strings are detected and skipped.
- "Potentially untranslated" strings (value identical to source) are re-translated; legitimate cases (proper nouns, format tokens) are reported as skipped.

## Skills Used

- [[analyze-localization-files]] — analysis using the configured `check_command`.
- [[detect-non-localizable]] — filter (inline in sub-agent).
- [[translate-to-language]] — translate (inline in sub-agent).
- [[validate-translation]] — verify (inline in sub-agent).
- [[update-json-localization-file]] — write changes.
- [[validate-localization-coverage]] — final coverage report.
