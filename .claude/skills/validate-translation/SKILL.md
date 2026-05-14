---
name: validate-translation
description: Use when reviewing a translated string or validating an i18n file update, to verify placeholder preservation, length, encoding, and common translation errors.
---

# Validate Translation

Validate that a translated string preserves required structural elements from the original and meets quality requirements.

## Inputs

- **original_text**: The source text (commonly English).
- **translated_text**: The translation under review.
- **target_language_code**: BCP 47 code (e.g. `es`, `fr`, `de`, `zh-CN`).

## Output

```json
{
  "valid": true,
  "issues": [],
  "warnings": []
}
```

- **valid**: `false` if any blocking issue exists, else `true`.
- **issues**: Blocking problems that must be fixed.
- **warnings**: Non-blocking concerns to review.

## Validation Checks

### 1. Placeholder Preservation (blocking)

Patterns to detect in both texts:

| Pattern | Regex |
|---------|-------|
| Double braces | `\{\{[\w.]+\}\}` |
| Single braces | `\{[\w]+\}` |
| Dollar braces | `\$\{[\w]+\}` |
| Printf | `%[sdif]` |
| Percent braces | `%\{[\w]+\}` |
| Double brackets | `\[\[[\w]+\]\]` |
| Numbered tags | `<\d+>` |

Rules:
- All placeholders from original must appear in translation.
- No new placeholders may be introduced.
- Syntax must be preserved exactly (`{{name}}` ≠ `{name}` ≠ `{{ name }}`).
- Placeholder names are case-sensitive (`{{Name}}` ≠ `{{name}}`).

### 2. Empty/Whitespace (blocking)

Translation is not empty or whitespace-only.

### 3. Untranslated Markers (blocking)

Detect: `TRANSLATE_ME`, `TODO`, `[TODO]`, `FIXME`, `XXX`, `UNTRANSLATED`, `NEEDS_TRANSLATION`, `TBD`.

### 4. Still in English (warning)

If `original === translated`, original has 3+ words, and target is not English → warn.

Exceptions (no warning):
- Single-word strings (could be proper nouns or technical terms).
- URLs, emails, identifiers.
- Mostly placeholders.

### 5. Length Ratio (warning)

Compare `len(translated) / len(original)` against language family expectations:

| Language | Min | Max |
|----------|-----|-----|
| German | 0.8 | 1.5 |
| French | 0.9 | 1.4 |
| Spanish | 0.9 | 1.4 |
| Italian | 0.9 | 1.4 |
| Portuguese | 0.9 | 1.4 |
| Russian | 0.8 | 1.5 |
| Chinese | 0.3 | 0.8 |
| Japanese | 0.4 | 1.0 |
| Korean | 0.5 | 1.0 |
| Arabic | 0.8 | 1.4 |
| Hebrew | 0.7 | 1.2 |
| Hindi | 0.9 | 1.5 |
| Thai | 0.8 | 1.3 |
| Default | 0.5 | 3.0 |

Skip if original is <10 characters, mostly placeholders, or a single word.

### 6. Character Encoding (blocking)

Detect: replacement character `�` (U+FFFD), mojibake patterns (e.g. `Ã©` for `é`), null `\x00`, non-`\n`/`\t` control characters.

### 7. HTML Entity Preservation (warning)

`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#…;` in original should appear in translation (or be intentionally rendered).

### 8. Newline/Trailing Whitespace (warning)

Newlines and trailing whitespace/punctuation should be preserved.

## Severity

| Blocking (`valid = false`) | Warning (`valid = true`) |
|-----------------------------|--------------------------|
| Missing/extra/modified placeholder | Identical to source |
| Empty translation | Unusual length ratio |
| Untranslated marker present | Missing HTML entity |
| Invalid encoding | Formatting/newline difference |

## Examples

### Valid
```
original:   "Hello {{name}}, you have {{count}} messages."
translated: "Hola {{name}}, tienes {{count}} mensajes."
target:     es
→ {valid: true, issues: [], warnings: []}
```

### Missing placeholder
```
original:   "Welcome {{name}}!"
translated: "¡Bienvenido!"
target:     es
→ {valid: false, issues: ["Missing placeholder: {{name}}"], warnings: []}
```

### Untranslated
```
original:   "Save changes"
translated: "Save changes"
target:     de
→ {valid: true, issues: [], warnings: ["Translation appears identical to source"]}
```

### Multiple issues
```
original:   "Delete {{count}} items permanently"
translated: "[TODO] Supprimer {count} éléments"
target:     fr
→ {valid: false,
   issues: ["Contains untranslated marker: [TODO]",
            "Placeholder syntax modified: {{count}} → {count}"],
   warnings: []}
```

## Implementation Notes

1. Be permissive: when uncertain, warn rather than block.
2. Placeholder *order* may legitimately change for grammar — only check presence.
3. Whitespace inside placeholders matters: `{{ name }}` ≠ `{{name}}`.
4. Idiomatic adaptation may legitimately produce length outside expected ratios.
