# Localization Backfill Command

Automatically translate missing and untranslated keys in all localization files using the English master as the source.

## Overview

This command performs a complete localization backfill:
1. Analyzes all language files to identify missing translations AND potentially untranslated strings (values identical to English)
2. Spawns parallel sub-agents to translate each language independently
3. Validates all translations and updates the files
4. Reports final coverage statistics

## Process

### Step 1: Analyze Localization Files

Use the `analyze_localization_files` skill:

1. Run `pnpm run check-i18n` to compare all language files against `en-US.json`
2. Parse the output to build task manifests for each language
3. For each language, extract:
   - Language code (e.g., `ar-SA`, `es-ES`)
   - Language name (e.g., `Arabic (Saudi Arabia)`, `Spanish (Spain)`)
   - List of missing keys with their English values
   - List of potentially untranslated keys (same value as English) with their values
   - Any extra keys (for reporting)

Language code to name mapping:
| Code | Language Name |
|------|---------------|
| ar-SA | Arabic (Saudi Arabia) |
| bn-BD | Bengali (Bangladesh) |
| de-DE | German (Germany) |
| es-ES | Spanish (Spain) |
| fr-FR | French (France) |
| he-IL | Hebrew (Israel) |
| hi-IN | Hindi (India) |
| id-ID | Indonesian (Indonesia) |
| ja-JP | Japanese (Japan) |
| ko-KR | Korean (South Korea) |
| pt-BR | Portuguese (Brazil) |
| ru-RU | Russian (Russia) |
| th-TH | Thai (Thailand) |
| ur-PK | Urdu (Pakistan) |
| zh-CN | Chinese (Simplified, China) |

### Step 2: Display Analysis Summary

Present the analysis results to the user:

```
📊 Localization Analysis Complete

Master file: src/assets/i18n/en-US.json
Total languages: 15

┌─────────┬──────────────────────────────┬─────────────┬──────────────┐
│ Code    │ Language                     │ Missing     │ Untranslated │
├─────────┼──────────────────────────────┼─────────────┼──────────────┤
│ ar-SA   │ Arabic (Saudi Arabia)        │ 0           │ 143          │
│ bn-BD   │ Bengali (Bangladesh)         │ 0           │ 337          │
│ de-DE   │ German (Germany)             │ 0           │ 27           │
│ ...     │ ...                          │ ...         │ ...          │
└─────────┴──────────────────────────────┴─────────────┴──────────────┘

Total strings to translate: 2,847 (missing: 0, untranslated: 2,847)
Languages needing work: 15
Languages complete: 0
```

If no translations are needed, report that and exit:
```
✅ All localization files are complete! No missing or untranslated strings found.
```

### Step 3: Spawn Translation Sub-Agents

For each language with missing or untranslated strings, spawn a sub-agent using the Task tool:

1. Use `subagent_type="general-purpose"`
2. Run ALL agents in parallel (single message with multiple Task calls)
3. Each agent receives its language's task manifest (combining both missing and untranslated keys)

**Sub-agent prompt template:**

```
You are translating keys for {{LANGUAGE_NAME}} ({{LANGUAGE_CODE}}).

Target file: {{FILE_PATH}}

## Instructions

For each key below, perform these steps:

1. **Check if localizable**: Apply the detect_non_localizable skill rules:
   - Skip URLs, email addresses, file paths, version numbers
   - Skip UUIDs, config keys (SCREAMING_SNAKE_CASE), pure numbers
   - Skip template-only values like "{{common.name}}"
   - Skip date format strings that should remain standard (e.g., "A4", "usLetter")
   - Skip proper nouns, brand names, and technical terms that don't translate
   - When in doubt, translate it

2. **Translate**: For localizable strings, translate to {{LANGUAGE_NAME}}:
   - Preserve all placeholders exactly ({{var}}, {var}, %s, etc.)
   - Match the formality/tone of the original
   - Keep similar length when reasonable
   - Use appropriate {{LANGUAGE_NAME}} conventions

3. **Validate**: Check each translation:
   - All placeholders from original are present
   - No extra placeholders added
   - Not empty or just whitespace
   - Reasonable length ratio

## Keys to Translate

This includes both missing keys (not present in target file) and untranslated keys (present but identical to English):

{{KEYS_JSON}}

## Output Format

Return a JSON object with the translations:

```json
{
  "translations": {
    "key.path.here": "translated value",
    "another.key": "another translation"
  },
  "skipped": [
    {"key": "some.key", "reason": "URL - non-localizable"}
  ],
  "errors": [
    {"key": "problem.key", "error": "description of issue"}
  ]
}
```

Now process all {{COUNT}} keys.
```

### Step 4: Collect Sub-Agent Results

1. Wait for all sub-agents to complete
2. Collect results from each:
   - Successful translations
   - Skipped keys (with reasons)
   - Errors (if any)
3. Track overall progress

### Step 5: Update Localization Files

For each language with successful translations:

1. Use the `update_json_localization_file` skill approach:
   - Read the current language file
   - Apply all translations (additions/updates)
   - Write back with proper formatting (2-space indent, final newline)
   - Create backup before writing

2. Track changes:
   - Keys added
   - Keys updated
   - Any write errors

### Step 6: Final Validation

Use the `validate_localization_coverage` skill:

1. Run `pnpm run check-i18n` again
2. Parse output to generate coverage report
3. Calculate final statistics

### Step 7: Display Final Report

```
✅ Localization Backfill Complete

## Summary

Total languages processed: 15
Total strings translated: 2,500
Total strings skipped: 347 (non-localizable)
Errors: 0

## Per-Language Results

┌─────────┬──────────────────────────────┬────────────┬─────────┬──────────┐
│ Code    │ Language                     │ Translated │ Skipped │ Errors   │
├─────────┼──────────────────────────────┼────────────┼─────────┼──────────┤
│ ar-SA   │ Arabic (Saudi Arabia)        │ 120        │ 23      │ 0        │
│ bn-BD   │ Bengali (Bangladesh)         │ 310        │ 27      │ 0        │
│ de-DE   │ German (Germany)             │ 20         │ 7       │ 0        │
│ ...     │ ...                          │ ...        │ ...     │ ...      │
└─────────┴──────────────────────────────┴────────────┴─────────┴──────────┘

## Final Validation

Run `pnpm run check-i18n` again to verify:
- All missing keys are now present
- Remaining "potentially untranslated" entries are intentionally non-localizable

📄 Files modified:
  - src/assets/i18n/ar-SA.json (120 keys updated)
  - src/assets/i18n/bn-BD.json (310 keys updated)
  - src/assets/i18n/de-DE.json (20 keys updated)
  ...
```

## Error Handling

- **check-i18n fails**: Report error and exit
- **Sub-agent fails**: Log error, continue with other languages, report at end
- **File write fails**: Log error, continue with other files, report at end
- **Invalid JSON in response**: Log error, skip that language
- **Validation fails**: Log warnings, still apply translations if placeholders are valid

## Usage

```bash
/localization-backfill           # Run full backfill
```

## Implementation Notes

- All sub-agents run in parallel for speed
- Each sub-agent handles one language completely
- Backups are created before modifying files
- The check-i18n script automatically sorts files
- Progress is shown after all agents complete (no streaming updates)
- Non-localizable strings are detected and skipped automatically
- "Potentially untranslated" strings (identical to English) are included for translation
- Some strings intentionally remain identical to English (proper nouns, technical terms, standard formats like "A4") - these are reported as skipped

## Skills Used

This command orchestrates the following skills:
1. `analyze_localization_files` - Initial analysis using check-i18n
2. `detect_non_localizable` - Filter out non-translatable strings (inline in sub-agent)
3. `translate_to_language` - Perform translations (inline in sub-agent)
4. `validate_translation` - Verify translation quality (inline in sub-agent)
5. `update_json_localization_file` - Write changes to files
6. `validate_localization_coverage` - Final coverage report

---

Now execute this process.
