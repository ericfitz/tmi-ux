# ADR 0007: CLDR plurals with Intl.PluralRules, not ICU MessageFormat

- **Status:** Accepted
- **Date:** 2026-11-28
- **Decision by:** Eric (human decision, confirmed 2026-11-28 after review; drafted by Claude under
  delegation of #1070).
- **Related:** [#1070](https://github.com/ericfitz/tmi-ux/issues/1070), [#1067](https://github.com/ericfitz/tmi-ux/issues/1067)

## Context

Plurals used a two-key convention: a singular key, a `*Plural` key, and a `count === 1` choice in the
template (`adminSurveys.templateCount`, `collaboration.participantCount`,
`surveys.responses.responseCount`, and `triage.detail.note`/`notes`). Two forms can't express the
CLDR rules of several of our 16 locales: ru-RU needs one/few/many, ar-SA needs
zero/one/two/few/many, he-IL has a dual, and fr-FR treats 0 as singular.

#1070 asked whether to adopt ICU MessageFormat through `@jsverse/transloco-messageformat`.

### What we found about the plugin

- Version 8.4.0 (last published 2026-09-26). Its peers are `@angular/core >=16`,
  `@jsverse/transloco >=8` and `@jsverse/utils 1.0.0-beta.5`, which is compatible with Angular 22
  and transloco 8.4.0. It depends on `@messageformat/core ^3.4.0`.
- It replaces the Transloco transpiler globally. `MessageFormatTranspiler.transpile()` runs the
  default `{{param}}` substitution first and then compiles **every** translation string with
  MessageFormat. A scratchpad reproduction with `@messageformat/core` 3.4.1 compiled the string the
  way the transpiler would:

  | Input after `{{param}}` substitution                    | Output                       |
  | ------------------------------------------------------- | ---------------------------- |
  | `Delete a{b}?` (user-supplied name `a{b}`)              | `Delete aundefined?`         |
  | `Delete weird{name?` (user-supplied name `weird{name`)  | throws `invalid syntax`      |
  | `{Count} icons available.` (existing literal string)    | `undefined icons available.` |
  | `E.g., {questionname} = 'value'` (existing survey hint) | `E.g., undefined = 'value'`  |

  So user data interpolated into any message (threat, asset or diagram names) would be parsed as ICU
  syntax. That corrupts display and can throw. Existing single-brace strings in all 16 locales would
  also break.

## Decision

Don't adopt `@jsverse/transloco-messageformat`. Use the browser's `Intl.PluralRules` with
per-locale plural groups:

- A plural message is an object keyed by CLDR category. Each locale lists exactly the categories its
  language uses:
  `"participantCount": { "one": "{{count}} участник", "few": "…", "many": "…", "other": "…" }`.
- `selectPluralKey()` (`src/app/i18n/plural-key.ts`) picks the category with a cached
  `Intl.PluralRules` and falls back to `other` when the translation lacks it. The impure
  `pluralKey` pipe (`src/app/i18n/plural-key.pipe.ts`) applies it in templates and re-selects on
  language change:
  `{{ 'collaboration.participantCount' | pluralKey: n | transloco: { count: n } }}`.
- The default Transloco transpiler stays, so `{{param}}` substitution never parses user data.
- The tooling treats a plural group as one key:
  - `scripts/i18n_style/plural.py`, used by `check-i18n.py` for locale drift;
  - the usage-map builder, which scans for the group key;
  - `check-unused-i18n-keys.cjs`.

  `src/app/i18n/plural-key.spec.ts` checks that every locale's groups match the categories
  `Intl.PluralRules` reports for it.

## Consequences

- No new dependency and no bundle cost. CLDR data comes from the browser.
- The plural mechanism is ours to maintain, but it is small: one function, one pipe and one helper
  per tool. ICU's `select` and nested messages aren't available; nothing uses them today.
- A plural message's categories differ between locales by design. The coverage test, not key
  parity, keeps them complete.
- **Needs native review:** the new ru-RU few/many forms, the ar-SA
  zero/one/two/few/many forms, and the he-IL one/two forms were written without a native speaker.
  The fr-FR, es-ES and pt-BR `many` forms (used for 1,000,000 and up) repeat the `other` form,
  which is a known inexactness: Spanish and Portuguese want "de" there ("1 millón de
  participantes").
- The locale coverage test reads categories from the test runtime's ICU data (Node 24.22, CLDR 48:
  he-IL = one/two/other). Node is pinned in `.nvmrc`; a Node upgrade that changes CLDR can fail the
  test, and that's the signal to update the locale files.
