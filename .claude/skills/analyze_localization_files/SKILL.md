---
name: analyze_localization_files
description: Analyze differences between English master i18n file and target language files. Identifies missing keys, extra keys, and keys with English placeholder values. Use when reviewing localization/translation completeness or preparing translation tasks.
allowed-tools: Read, Glob
---

# Analyze Localization Files

Analyze the differences between an English master i18n JSON file and target language files to identify translation gaps and issues.

## Inputs

- **english_file_path**: Path to the English master file (default: `src/assets/i18n/en-US.json`)
- **target_file_paths**: List of paths to target language files. If not specified, automatically discover all JSON files in the same directory as the English file.

## Process

### Step 1: Load English Master File

Load and parse the English master JSON file. Flatten the nested structure into dot-notation keys for comparison.

Example: `{ "about": { "title": "About" } }` becomes `about.title: "About"`

### Step 2: Discover Target Files (if not specified)

If target_file_paths is not provided, use Glob to find all `*.json` files in `src/assets/i18n/` excluding `en-US.json`.

### Step 3: Process Each Target Language File

For each target language file:

1. **Extract language code** from filename:
   - `es-ES.json` -> `es` (primary language code)
   - `zh-CN.json` -> `zh-CN` (keep full code for Chinese variants)
   - `pt-BR.json` -> `pt-BR` (keep full code for Portuguese variants)

2. **Load and flatten** the target JSON file

3. **Compare keys**:
   - **missing_keys**: Keys present in English but not in target (need translation)
   - **extra_keys**: Keys present in target but not in English (potentially obsolete)
   - **english_placeholder_keys**: Keys where target value appears to be in English (untranslated)

### Step 4: Detect English Placeholder Values

A value is considered an English placeholder if:
- The target value exactly matches the English value AND
- The value contains Latin alphabet characters (not just numbers, URLs, or template variables)
- Exclude keys that are inherently language-agnostic:
  - URLs (values starting with `http://` or `https://`)
  - Template references (values like `{{common.name}}`)
  - Technical identifiers (all uppercase, or contains only numbers/symbols)

### Step 5: Map Language Codes to Names

Use this mapping for language_name:

| Code | Name |
|------|------|
| ar | Arabic |
| bn | Bengali |
| de | German |
| es | Spanish |
| fr | French |
| he | Hebrew |
| hi | Hindi |
| id | Indonesian |
| ja | Japanese |
| ko | Korean |
| pt-BR | Portuguese (Brazil) |
| ru | Russian |
| th | Thai |
| ur | Urdu |
| zh-CN | Chinese (Simplified) |

## Output Format

Return a dictionary mapping language code to task manifest:

```json
{
  "es": {
    "file_path": "src/assets/i18n/es-ES.json",
    "language_code": "es",
    "language_name": "Spanish",
    "missing_keys": [
      {"key": "about.trademarks", "english_value": "All product names..."},
      {"key": "admin.addons.addDialog.icon", "english_value": "Icon"}
    ],
    "extra_keys": ["obsolete.key1", "obsolete.key2"],
    "english_placeholder_keys": [
      {"key": "about.description1", "value": "TMI (Threat Modeling Improved)..."}
    ],
    "summary": {
      "total_english_keys": 450,
      "total_target_keys": 445,
      "missing_count": 12,
      "extra_count": 7,
      "english_placeholder_count": 38,
      "completion_percentage": 91.1
    }
  },
  "de": {
    ...
  }
}
```

## Summary Statistics

After processing all languages, provide a summary table:

| Language | Missing | Extra | Placeholders | Completion % |
|----------|---------|-------|--------------|--------------|
| Spanish  | 12      | 7     | 38           | 91.1%        |
| German   | 5       | 0     | 250          | 44.4%        |
| ...      | ...     | ...   | ...          | ...          |

Completion percentage = `((total_english_keys - missing_count - english_placeholder_count) / total_english_keys) * 100`

## Usage Examples

### Analyze all language files

```
/analyze_localization_files
```

### Analyze specific language files

```
/analyze_localization_files src/assets/i18n/es-ES.json src/assets/i18n/de-DE.json
```

### Analyze with custom English master

```
/analyze_localization_files --english=custom/en.json src/assets/i18n/*.json
```
