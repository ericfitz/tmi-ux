# i18n style guide and capitalization audit — design

**Issue:** [#676 — chore: review all en-US localized strings for proper capitalization](https://github.com/ericfitz/tmi-ux/issues/676)
**Branch:** `dev/1.4.0`
**Date:** 2026-05-09

## Summary

The TMI-UX en-US localization file (`src/assets/i18n/en-US.json`, ~1,925 string keys) has inconsistent capitalization, punctuation, and tone across surfaces (titles, buttons, labels, placeholders, errors, snackbars, tooltips, menu items). This work establishes an authoritative style guide, builds a mechanical analysis pipeline that maps every i18n key to its UI usage surface, implements an automated lint check that enforces the rubric, corrects en-US.json to conform, and regenerates affected translations in non-English locale files.

The end state: a documented style guide, a committed sidecar usage map, a `lint:i18n` check wired into `pnpm run lint:all` so future drift is caught at PR time, a fully-conforming en-US.json, and locale files updated for any en-US string whose value changed.

Tone is in scope as a rubric concern (with a hard-coded forbidden-phrase blacklist enforced by the lint), but a comprehensive tone audit beyond that blacklist is filed as a separate follow-up issue.

## Style guide rubric

The full rubric lives at `src/assets/i18n/STYLE-GUIDE.md` after implementation. This section is the authoritative content that file will hold (expanded with examples during the writing).

### Capitalization

- All en-US strings use **sentence case**: first letter capitalized, all other letters lowercase except proper nouns, acronyms, and post-symbol segments (e.g., `Yes/No`).
- Proper nouns preserve canonical capitalization: TMI, Timmy, OAuth, JWT, Google Drive, Google Workspace, Microsoft, GitHub. Maintained list lives in the lint configuration.
- Acronyms preserve canonical case: CVSS, CWE, STRIDE, LINDDUN, PASTA, ID, URL, API, DFD, SSE. Maintained list lives in the lint configuration.
- TMI domain object types are common nouns and are lowercase mid-sentence: threat model, diagram, document, asset, repository, note, threat, source, addon, survey, group, quota, webhook, template. Capitalized only at the start of a string.
- Single-word strings: first letter capitalized.
- Symbol-joined enum values (`Yes/No`, `A/B`): each segment first-letter capitalized.
- Strings starting with `{{placeholder}}`: the first literal word after the placeholder follows sentence case (lowercase unless proper noun).
- Pure delegation strings (entire value is `{{another.key}}`): no rule applies; lint skips them.
- URLs and code-like values: no rule applies; lint detects and skips them.

### Punctuation

- Period rule applies uniformly across all surfaces:
  - Complete sentence (subject + verb) → end with period.
  - Multiple sentences → period after each.
  - Fragment / label / phrase → no period.
- No exclamation marks as terminal punctuation on any user-facing string. Lint check is a literal "string ends with `!`" check, not a global ban on `!` characters anywhere in the string.
- Ellipsis (`...`) on buttons and menu items that lead to a further dialog/picker before the action completes.

### Tone (errors, snackbars, validation, descriptive text)

- State what happened plainly; tell the user the next step when there is one.
- Use past-tense action constructions (`Couldn't connect`, `Failed to save`).
- Validation messages state the requirement (`Email address is required`), not the failure mode (`Email address is missing`).
- **Forbidden phrases** (case-insensitive, lint-enforced): `Please try again`, `Sorry,`, `We're sorry`, `Oops`, `Whoops`, `Unfortunately,`, `Apologies`, `My apologies`.
- No trailing `!` as the last character (covered by punctuation rule, restated for emphasis).
- Uniform tone across user-facing and admin surfaces — all users are engineers.

### Translator notes (`.comment` siblings) and usage records

- Translator notes (`<key>.comment` siblings in en-US.json) are required for any string that is ≤3 words AND contains a noun-verb-ambiguous word: `Filter`, `Search`, `Sort`, `Edit`, `Order`, `Save`, `Display`, `Help`, `Comment`, `Cancel`, `Open`, `Close`, `Lock`, `View`, `Print`, `Share`, `Copy`, `Move`, `Run`, `Stop`, `Pause`, `Send`, `Reply`, `Sign`, `Show`, `Hide`, `Add`, `Remove`, `Delete`. Maintained list in lint configuration.
- The `.comment` value contains translator-relevant guidance only (part of speech, character limits, ambiguity context). Mechanical usage info (file paths, surface type, line numbers) lives in the sidecar `en-US.usage.json`, not inline.
- `.comment` siblings are en-US-only. Non-English locale files do not duplicate them. The lint rejects `.comment` keys in non-en-US files.
- Existing `.comment` siblings in en-US.json (e.g., `about.bugReportUrl.comment` documenting "this is a URL and should not be translated") are preserved and may be expanded.

## Architecture

The work has four output artifacts and one transient working artifact.

### Outputs

1. **`src/assets/i18n/STYLE-GUIDE.md`** — the rubric, expanded with examples and the maintained lists.
2. **`src/assets/i18n/en-US.usage.json`** — committed sidecar mapping every en-US key to its UI usage records. Format:

   ```jsonc
   {
     "<key>": {
       "surfaces": ["page-title" | "dialog-title" | "button" | "menu-item" | "tooltip" | "placeholder" | "label" | "error" | "validation" | "snackbar" | "description" | "general"],
       "uses": [
         {
           "file": "src/app/.../foo.component.html",
           "line": 42,
           "element": "button" | "h1" | "mat-error" | "...",
           "classes": ["..."]
         }
       ],
       "ellipsis_candidate": false,
       "ambiguous_word": false,
       "needs_translator_comment": false,
       "confidence": "high" | "medium" | "low",
       "found_by": "fully-qualified" | "leaf" | "model-verified"
     }
   }
   ```

3. **Lint check** — `scripts/check-i18n-style.py` (or merged into `scripts/check-i18n.py`, decided during implementation based on what the existing script does). Operates in CI mode (exits non-zero on blocking violations) and audit mode (emits a markdown report). Wired into `pnpm run lint:all` via a new `lint:i18n` script in `package.json`.
4. **Usage-map builder** — `scripts/build-i18n-usage-map.py` (or merged with the lint check). Implements the mechanical analysis pipeline described in the next section. Lint check requires the committed `en-US.usage.json` to match the regenerated output; if stale, lint regenerates and fails until committed.

### Transient

5. **`docs/i18n-audit-review.md`** — working document during the audit pass, listing every violation with current value, suggested replacement, surface context, and a notes column. Contents migrate to the human-review GitHub issue at the end; file is deleted before the issue closure commit.

### Modifications

- **`src/assets/i18n/en-US.json`** — strings corrected in place per the rubric; new `.comment` siblings added where required; existing `.comment` siblings preserved or expanded.
- **`src/assets/i18n/<locale>.json`** for the 16 non-English locales — for each key whose en-US value changed, regenerate the translation using the `translate_to_language` skill (with surface context and translator notes from the sidecar). Keys whose en-US value did not change keep their existing translations untouched.
- **`src/assets/i18n/i18n-allowlist.json`** — minor updates if regenerated translations happen to match en-US for any locale.
- **`package.json`** — new `lint:i18n` script; `lint:all` invokes it.

## Mechanical analysis pipeline

The pipeline that builds `en-US.usage.json`. Designed to do as much as possible mechanically before invoking the model, to minimize token cost.

### Stage 1 — enumerate keys

Walk `en-US.json`, build the flat list of fully-qualified key names (`about.title`, `admin.users.filterLabel`, …). Output: ordered list of all keys.

### Stage 2 — fully-qualified search

Ripgrep each fully-qualified key name across `src/**/*.{ts,html,scss}` (file extensions confirmed during implementation; may extend to `.json` if survey templates or similar reference i18n keys). For each hit, record:

- File path and line number.
- Surrounding ~5 lines of context.
- The element / Material selector visible (`<button>`, `<h1>`, `[matTooltip]`, `placeholder=`, `mat-error`, `mat-dialog-title`, `MatMenuItem`, `MatSnackBar.open`, etc.).
- Any CSS class names on the same or parent element (HTML).
- The translation invocation form (`translate` pipe, `translateService.instant()`, `.get()`, attribute binding).

Output: `usage-map-stage2.json` mapping key → list of hits.

### Stage 3 — partial-key search

For keys not found in stage 2 (or with suspiciously few hits — e.g., a key that should be widely used but found once), search for:

- Trailing path segment (`'filterLabel'`).
- Parent-segment + leaf (`'users.filterLabel'`).
- Common dynamic-key patterns (`'admin.users.' + state + '.label'`).

Record candidates with confidence levels:

- **High** — full match (stage 2 result).
- **Medium** — parent + leaf match.
- **Low** — leaf only or dynamic-key candidate.

Output appended to usage map.

### Stage 4 — CSS class lookup

For each unique CSS class collected in stages 2-3, ripgrep across `*.scss` for the class definition and record what it's used for. Helps confirm surface type when the HTML element itself is generic (e.g., `<span class="snackbar-message">`).

### Stage 5 — script-existing-art reuse

Inspect `scripts/check-i18n.py` and `scripts/check-unused-i18n-keys.cjs`. If either already enumerates keys or scans usage, reuse output rather than re-implementing. May reduce stages 1-2 to "wire to existing script". Determined during implementation.

### Stage 6 — model verification (targeted)

Only for the following subsets — never the whole key list:

- Keys with zero hits (figure out where they're used or determine they're dead).
- Keys with only low-confidence hits (confirm or reject the candidate).
- Keys whose surface type is ambiguous from mechanical signals.

Feed the model just the usage records that need attention, not the whole file. Output: confidence promoted or demoted, surface type confirmed.

### Stage 7 — surface inference

From the usage records, mechanically derive the surface type per key:

- **page-title** / **dialog-title** — used in `<h1>`-`<h6>`, `mat-dialog-title`, `[matDialogTitle]`, `*Title` selectors.
- **button** — `<button>` text, `mat-mdc-button` / `mat-icon-button` content.
- **menu-item** — `<mat-menu>`, `MatMenuItem`, context menus.
- **tooltip** — `[matTooltip]` binding.
- **placeholder** — `placeholder=` / `[placeholder]` / `mat-form-field` hint.
- **label** — `<mat-label>`, form field labels.
- **error** — `mat-error`, error message bindings.
- **validation** — passed to validator output / shown in form-field error.
- **snackbar** — passed to `MatSnackBar.open`, notification service calls.
- **description** — descriptive text in dialogs, headers, help blocks.
- **general** — fallback when no specific surface signal is present.

Multi-surface keys (used in more than one place) get all surfaces recorded.

### Stage 8 — ellipsis candidate detection

For button and menu-item surfaces, walk to the click handler in the component (the method name is in the template); statically check whether the handler opens a dialog or picker:

- `MatDialog.open(...)` calls.
- `dialog.open(...)` on injected dialog services.
- Picker invocation (`GoogleDrivePickerService`, `MicrosoftFilePickerService`, file `<input>` synthesis).
- Navigation to a route that hosts a dialog.

Mechanical pattern-match flags candidates; model verifies the ambiguous ones (handlers that branch, helper methods, etc.).

### Stage 9 — emit `en-US.usage.json`

Final structured artifact, format shown in the Outputs section above.

## Lint check design

### What it checks

For every key/value in `en-US.json`, using `en-US.usage.json` as the authoritative source of surface type:

1. **Skip categories** — pure delegation, URLs, code-like strings (matched by heuristics: contains `://`, leads with `e.g.,`, contains `=` between `{...}` placeholders). Skipped strings still pass through forbidden-phrase check.
2. **Sentence case validation.** Tokenize the string; first literal word must start uppercase or match a proper noun / acronym (canonical case required); subsequent words must be lowercase, unless proper noun, acronym, or first word of a new sentence. Word boundaries on hyphens / slashes / em-dashes.
3. **Punctuation per the period rule.** Detect "complete sentence" via heuristic: contains a verb (token ending in `-ed`, `-ing`, `-s`, or in a small list of irregulars/auxiliaries) AND has at least three tokens. Approximate; uncertain cases go on the human-review list.
4. **Forbidden phrase check** — case-insensitive substring match against the no-list.
5. **No trailing `!`** — universal.
6. **`.comment` sibling requirement** — for keys whose value is ≤3 words and contains an ambiguous word, require a sibling `<key>.comment` to exist.
7. **Ellipsis candidates** — for button / menu-item surfaces flagged as `ellipsis_candidate: true` in the sidecar, the string must end with `...` (or be present in an explicit allowlist of opt-outs). This rule is *flagged*, not auto-failed in CI mode.
8. **Sidecar staleness** — re-run the usage-map builder; compare to committed `en-US.usage.json`. If stale, lint regenerates and fails with an instruction to commit the regenerated sidecar.
9. **Non-en-US `.comment` keys** — fail if any `.comment` keys appear in non-en-US locale files.

### Maintained lists

Stored as JSON config alongside the lint script (`scripts/i18n-style-config.json` or similar):

- `proper_nouns` — TMI, Timmy, OAuth, JWT, Google Drive, Google Workspace, Microsoft, GitHub.
- `acronyms` — CVSS, CWE, STRIDE, LINDDUN, PASTA, ID, URL, API, DFD, SSE.
- `domain_nouns` — threat model, diagram, document, asset, repository, note, threat, source, addon, survey, group, quota, webhook, template.
- `ambiguous_words` — Filter, Search, Sort, Edit, Order, Save, Display, Help, Comment, Cancel, Open, Close, Lock, View, Print, Share, Copy, Move, Run, Stop, Pause, Send, Reply, Sign, Show, Hide, Add, Remove, Delete.
- `forbidden_phrases` — Please try again, Sorry,, We're sorry, Oops, Whoops, Unfortunately,, Apologies, My apologies.

Lists are easily extended without code changes.

### Output modes

- **CI mode** (`pnpm run lint:i18n`, invoked by `lint:all`): exits non-zero on blocking violations. Blocking = capitalization, period rule, forbidden phrases, missing `.comment` siblings, sidecar staleness, non-en-US `.comment` leaks. Non-blocking = ellipsis suggestions (printed as warnings, do not fail build). Output: `key: <reason>` lines.
- **Audit mode** (`--audit`): all checks run, emits structured JSON and human-readable markdown to `docs/i18n-audit-review.md`. No exit-code failures.

### Escape hatch

`<key>.lint-skip` sibling key with a brief reason in its value. Used sparingly for keys that legitimately violate a rule (e.g., a quoted phrase from a third party that must not be edited). Auto-check ignores keys with a `lint-skip` sibling but logs them once at the start of each run for visibility.

### What it does NOT check

- Tone of error messages beyond the forbidden-phrase blacklist. A message like `'A horrible thing happened to your data'` passes the lint but is tone-wrong. Tone is the subject of the follow-up issue (see Out of scope).
- Whether a button needs an ellipsis when the sidecar didn't flag it as a candidate. The mechanical detection in stage 8 is best-effort; humans add to the candidate list during the audit if needed.
- Domain-noun proper-noun edge cases (when "threat model" should be capitalized as a feature/page name vs. an instance). Falls to human review.

## Audit and editing workflow

Five phases. Each is verifiable independently and produces commits.

### Phase 1 — infrastructure

- Write `src/assets/i18n/STYLE-GUIDE.md` with the full rubric.
- Write the maintained-lists JSON config.
- Verify against the rubric content here; commit.

### Phase 2 — usage-map pipeline

- Implement stages 1-9 of the mechanical analysis pipeline.
- Run end-to-end; produce `en-US.usage.json`.
- Hand-spot-check ~20 keys across surfaces (titles, buttons, tooltips, errors, snackbars) to validate accuracy.
- Commit pipeline scripts + `en-US.usage.json`.

### Phase 3 — lint check

- Implement the check in audit mode first.
- Run against the unmodified en-US.json; produce `docs/i18n-audit-review.md` with the full violation list. Sanity-check that the list matches expectations (lots of Title Case → sentence-case violations, scattered period issues, some forbidden-phrase hits).
- Implement CI mode.
- Wire into `package.json` (`lint:i18n` script + `lint:all` invocation).
- Commit lint scripts.

### Phase 4 — corrections

- **Mechanical sweep** on en-US.json: apply unambiguous fixes programmatically — Title-Case → sentence-case where deterministic (no proper nouns / acronyms), add/remove trailing periods where verb detection is high-confidence, add `.comment` siblings for short ambiguous strings (translator notes only — usage info stays in sidecar).
- **Re-run lint**; remaining violations are the human-review pile.
- **Per-key human-review pass** through `docs/i18n-audit-review.md`:
  - Forbidden-phrase replacements (`'Failed to invoke addon. Please try again.'` → context-appropriate replacement).
  - Period-rule edge cases the verb heuristic was uncertain on.
  - Ellipsis additions on confirmed dialog-opening buttons.
  - Domain-noun feature-vs-instance calls.
  - Tone issues caught by the audit-mode markdown that the lint can't catch.
- **Re-run lint**; en-US.json passes lint at the end of this phase.
- Commit en-US.json corrections.

### Phase 5 — locale regeneration and verification

- For each non-English locale file (`ar-SA`, `bn-BD`, `de-DE`, `es-ES`, `fr-FR`, `he-IL`, `hi-IN`, `id-ID`, `ja-JP`, `ko-KR`, `pt-BR`, `ru-RU`, `th-TH`, `ur-PK`, `zh-CN`):
  - Diff old vs. new en-US value per key.
  - For each changed key, re-translate using `translate_to_language` with surface context and translator notes from the sidecar.
  - Validate with `validate_translation`.
  - For unchanged keys, leave existing translations untouched.
  - Do not translate `.comment` keys (en-US-only).
- Update `i18n-allowlist.json` if any regenerated value happens to equal the en-US value.
- Run `validate_localization_coverage` to produce a coverage report; investigate any new gaps introduced.
- Run `pnpm run lint:all` (now including `lint:i18n`); verify clean.
- Run `pnpm run build`; verify clean.
- Run `pnpm test`; verify no regressions.
- Manual smoke test: load the app, click through the major surfaces (threat-model list/detail, DFD editor, admin pages, intake survey), confirm no obviously-mangled strings.
- File the tone-audit follow-up issue (see GitHub issues section below).
- File the human-review-deferred issue if any items were deferred.
- Delete `docs/i18n-audit-review.md`.
- Commit locale changes.
- Close #676 with a comment referencing the final commit on `dev/1.4.0`.

## Risk register

- **Lint check false positives.** Verb detection and proper-noun lists will flag legitimate strings. Mitigation: curate the proper-noun and acronym lists exhaustively up front; prefer false negatives over false positives in verb detection (uncertain cases go to human review); `.lint-skip` escape hatch for legitimate exceptions, used sparingly.
- **Usage map drift.** Source-code changes that touch i18n key references require regenerating the sidecar. Mitigation: lint runs the regen step itself when sidecar is out of sync and fails with a clear instruction to commit the regenerated file.
- **Translation quality regressions.** Regenerated translations might be worse than the originals (especially for short ambiguous strings where the old translation was hand-tuned). Mitigation: new `.comment` siblings provide context the original translator didn't have. `validate_translation` catches mechanical regressions (placeholder loss, length issues). Manual spot-check after regeneration.
- **Scope creep mid-audit.** Tempting to fix unrelated issues found during the pass (broken keys, dead translations, missing keys). Discipline: file separate issues, do not address inline.
- **Mechanical pipeline misses dynamic key references.** Some keys are constructed dynamically and may be missed by stages 2-3. Mitigation: stage 6 model verification targets these; over time, dynamic-key patterns can be added to the partial-search heuristic.
- **Pipeline runtime in CI.** Full usage-map regeneration over the whole `src/` tree may be slow. Mitigation: lint script caches based on file hashes; CI only regenerates when source files have changed since the last cached run.

## GitHub issues filed at completion

### Tone audit follow-up (always filed)

- **Project:** tmi
- **Milestone:** 1.4.0
- **Assignee:** ericfitz
- **Status:** This milestone
- **Priority:** Must Have
- **Title:** `chore: tone audit of all en-US localized strings (post-rubric)`
- **Body:** References #676 as rubric source. Scope: a pass through every en-US string the auto-check passed, judging tone against the rubric (errors, snackbars, validation, descriptive text especially). Produces a further issue for any human-judgment items found.

### Human-review-deferred items (filed only if any deferred items exist)

- **Project:** tmi
- **Milestone:** 1.4.0
- **Assignee:** ericfitz
- **Status:** This milestone
- **Title:** `chore: human-review pass for en-US strings flagged during #676 audit`
- **Body:** Lists each deferred key with its current value, the lint reason that flagged it, and the rubric section relevant to the call.

## Out of scope

- Text color rubric (mentioned in the original issue as "might be good"; deferred — separate concern, separate toolchain).
- Comprehensive tone audit beyond the forbidden-phrase blacklist (see follow-up issue above).
- Translation quality audit of non-en-US locales beyond keys this work touched.
- Cleanup of dead i18n keys (existing `check-unused-i18n-keys.cjs` handles this separately).
- Schema changes for translation tooling.
- Ellipsis convention for keyboard-shortcut hints, hover-state captions, or other surfaces beyond buttons and menu items.

## Open implementation-time decisions

These are deliberate punts to implementation and will not be re-litigated:

- Exact name of the new script(s) and whether they extend `check-i18n.py` or are standalone — depends on what `check-i18n.py` already does.
- Whether the usage map is `.json` or `.jsonl` (newline-delimited, friendlier for diffs) — minor format choice.
- Verb-detection algorithm specifics — start with a small irregular list + suffix heuristics; tune based on false-positive rate observed against real strings.
- Exact wording of forbidden-phrase substitutions — handled per-string in the human-review pass, not pre-decided.
- Whether `en-US.usage.json` is committed compressed or pretty-printed (size vs. readability trade-off).

## Definition of done for #676

- `src/assets/i18n/STYLE-GUIDE.md` committed.
- `src/assets/i18n/en-US.usage.json` committed and current.
- Lint script committed and wired into `pnpm run lint:all`.
- `pnpm run lint:all` exits clean.
- `pnpm run build` exits clean.
- `pnpm test` exits clean.
- en-US.json passes lint (zero violations or only documented `.lint-skip` exceptions).
- Each non-English locale's regenerated keys validated via `validate_translation`.
- `validate_localization_coverage` shows no new gaps introduced by this work.
- Tone-audit follow-up issue filed.
- Human-review-deferred issue filed if any deferred items exist.
- `docs/i18n-audit-review.md` deleted.
- #676 closed with a commit reference and links to follow-up issues.
