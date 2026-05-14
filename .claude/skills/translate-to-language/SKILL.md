---
name: translate-to-language
description: Use when translating UI strings, i18n values, or short localized content into a specific target language while preserving placeholders, formatting, capitalization, and tone.
---

# Translate to Language

Translate text into a specified target language while preserving placeholders, formatting, and tone.

## Inputs

- **source_text**: The source text to translate (commonly English).
- **target_language_code**: BCP 47 / ISO 15897 code (e.g. `es`, `fr`, `de`, `zh-CN`, `pt-BR`).
- **target_language_name**: Full language name as a hint for tone (e.g. `Spanish (Spain)`).
- **context_key** (optional): The i18n key (e.g. `error.save_failed`, `button.delete`) to inform tone and brevity.

## Output

Return only the translated string.

## Process

### 1. Identify placeholders

Extract every placeholder and record its position so you can verify it survives translation.

| Pattern | Example | Notes |
|---------|---------|-------|
| `{{var}}` | `{{count}}`, `{{user.email}}` | Angular/Mustache/i18n interpolation |
| `{var}` | `{username}`, `{0}` | Generic |
| `${var}` | `${total}` | Template literals |
| `%s`, `%d`, `%f` | `%s items` | printf-style |
| `%{var}` | `%{count}` | Ruby/Rails-style |
| `[[var]]` | `[[user]]` | Custom brackets |
| `<n>` | `<0>`, `<1>` | Numbered tags |

### 2. Analyze formatting

- Capitalization: Title Case / Sentence case / UPPER / lower
- Punctuation: trailing `.`, `!`, `?`, `:`, ellipsis (`...` vs `…`), label colon `Name:`
- HTML entities: `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`
- Special characters: `\n`, `\t`, escaped quotes
- Length: button labels and short labels must stay concise

### 3. Infer tone from context key

| Key pattern | Tone |
|-------------|------|
| `error.*` / `*.error` | Formal, clear |
| `warning.*` | Cautionary |
| `button.*` / `*.button` | Concise, imperative |
| `tooltip.*` / `*.tooltip` | Helpful, brief |
| `title.*` / `*.title` | Formal, prominent |
| `placeholder.*` | Instructive, brief |
| `label.*` | Concise, descriptive |
| `confirm.*` | Question form |
| `success.*` | Positive, affirming |
| `help.*` / `*.hint` | Helpful, guiding |

### 4. Translate

Rules:
1. Preserve placeholders exactly — do not translate, modify, or alter their syntax.
2. Match the formality the locale expects for UI text (e.g. Spanish formal "usted", French "vous", German "Sie", Russian "вы", Japanese です/ます).
3. Keep similar length when reasonable, especially for buttons and labels.
4. Preserve capitalization style, trailing punctuation, HTML entities, and escapes.
5. Prefer natural target-language phrasing over literal translation.
6. Handle gender/plurals appropriately for the target language.

### 5. Verify

Before returning, confirm:
- All placeholders from source appear in translation unchanged.
- Placeholder order is grammatically logical for the target language.
- Capitalization style matches source.
- Trailing punctuation is preserved.
- HTML entities are preserved.
- No stray whitespace or formatting changes.

## Language-Specific Notes

- **Spanish**: inverted `¿...?`, `¡...!`; accents required (`sí`, `está`).
- **French**: spaces before `:`, `;`, `!`, `?`; proper accents.
- **German**: capitalize all nouns; compound words common.
- **Chinese (zh-CN, zh-TW)**: no spaces between characters; use Chinese punctuation (`，。？！`); keep Arabic numerals.
- **Japanese**: mix kanji/hiragana/katakana; Japanese punctuation (`、。`).
- **Arabic / Hebrew**: RTL — placeholder positions may differ grammatically (UI handles direction).
- **Russian**: use «...» quotation marks; respect case endings.

## Examples

### Basic
```
source_text: "Delete"
target: es / Spanish
→ "Eliminar"
```

### With placeholder
```
source_text: "Hello {{name}}, welcome back!"
target: fr / French
context_key: "greeting.welcome"
→ "Bonjour {{name}}, bienvenue !"
```

### Multiple placeholders
```
source_text: "{{count}} items selected"
target: de / German
→ "{{count}} Elemente ausgewählt"
```

### Preserved punctuation/quoting
```
source_text: "Are you sure you want to delete \"{{name}}\"?"
target: es / Spanish
context_key: "confirm.delete"
→ "¿Está seguro de que desea eliminar \"{{name}}\"?"
```

### Label with colon
```
source_text: "Email Address:"
target: fr / French
context_key: "label.email"
→ "Adresse e-mail :"
```

## Common Pitfalls

1. Translating placeholders: `{{name}}` must stay `{{name}}`, not `{{nombre}}`.
2. Changing placeholder syntax: `{{var}}` must not become `{var}` or `[[var]]`.
3. Losing punctuation: if source ends with `.`, translation should too.
4. Inconsistent formality within a string.
5. Over-translating loanwords/technical terms commonly used in English in the locale.
6. Breaking HTML entities.
