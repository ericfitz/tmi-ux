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
    "filter.comment": "Used as a verb on a button that initiates filtering.",
  },
}
```

The `.comment` siblings live only in `en-US.json`. They are translator-facing guidance for translating into the other 16 locales. **[lint]** The lint rejects `.comment` keys in non-en-US locale files.

### Mechanical usage info lives in the sidecar

Where each key is _used_ in the codebase (file path, line number, surface type, classes) lives in `src/assets/i18n/en-US.usage.json`, not inline. Translators don't need that detail; the lint and audit do.

## Lint escape hatch

Add a sibling `<key>.lint-skip` with a brief reason if a string legitimately violates a rule (e.g., a quoted phrase from a third party that must be preserved verbatim). The lint skips that key but logs the skip at the start of each run for visibility. Use sparingly.

```jsonc
{
  "about": {
    "thirdPartyQuote": "Don't be evil",
    "thirdPartyQuote.lint-skip": "Verbatim quote from Google's former motto; preserved as-is.",
  },
}
```

## Versioning this guide

This document is the source of truth. When the rules change, update this file and the maintained-lists JSON together in the same commit.
