# HANDOFF — backlog bugfix batch, 2026-08-17

Session context for resuming work. Read this first, then start with **Next session** at the bottom.

## Where things stand

Branch **`feature/backlog-bugfix-batch`**, 7 commits, **not pushed, no PR**. Base `main` @ v1.10.6.

```
7bfb321c  test: type-check unit-test sources and ratchet the error count   (#858, partial)
df1d542f  fix: make the triage search box actually filter results          (#821, closed)
e6a47c5d  test: claim a palette slot before typing in the color-picker...  (#831, closed)
8f553b9a  feat: render page-header close (X) buttons white-on-red          (#812, closed)
523dcf40  chore: drop stale removeViewBox override from svgo config        (#832, closed)
39349ef6  fix: show translated labels for DFD SVG/PNG export options       (#835, closed)
21609b45  style: normalize i18n key ordering across all locale files       (no issue)
```

Gates as of the last commit — all green, all run locally:

`lint:all` · `build` · `test` (**6070 tests / 309 files**) · `typecheck:e2e` · `typecheck:vitest:ratchet` (at baseline 342) · `validate-json:test` (8/8) · `validate-all`

Five issues closed with commit references. **#858 remains open** (partial). **#860 filed** (new).

## Decisions already made — do not relitigate

- **#812 dark themes.** Uses fixed tones from each theme's error ramp (40 bg / 100 fg / 30 hover) instead of `mat.button-color(..., error)`. M3's error _role_ inverts in dark themes (`#ffb4a9` with dark text), so the role-driven path gives white-on-red only in light palettes. **User explicitly approved breaking the M3 dark convention.** Resolved tones: `#bb1614`-on-white (normal), `#9d4400`-on-white (colorblind, intentional Okabe-Ito vermillion).
- **#821 client-side search.** `GET /triage/survey_responses` has no search parameter (only status, survey_id, is_confidential, created/modified ranges, sort, pagination — verified against the local OpenAPI spec). So search filters the loaded page in the browser. The page-scoping is surfaced in the UI (match-count hint, a distinct no-match state that keeps the paginator mounted, and a search-only clear) rather than hidden.
- **#831 is a test fix, not a UI change.** `onHexInput()` writes to the selected _diagram palette slot_; with no slot selected there is no defined target for a typed color. Tests now claim a slot first.
- **#835 key consolidation.** All three export labels now live under `common.*`. The split path is what let two keys silently vanish.

## Three defects found that were not in any issue

All three fixed and empirically verified this session:

1. **`createCommonMocks()` / `createTypedMocks()` threw `ReferenceError`** — `src/testing/mocks/index.ts` only re-exported its symbols, so the factories referenced names not in local scope. Verified by running both factories against pre- and post-fix versions. Nothing calls them today. Fixed in `7bfb321c`.
2. **`scripts/validate-json.cjs` swallowed whole files** — its regex comment-stripper read the trailing `/*` in `"./src/app/*"` as a block-comment opener. `tsconfig.json` was _already failing_ `pnpm run validate-all` on `main` because of this. Replaced with a string-aware scanner; added a `--test` self-check (8 cases), following the `compute-next-version.mjs --test` convention. Fixed in `7bfb321c`.
3. **Triage column sorting had never worked** — the table sits behind an `@if`, so `@ViewChild(MatSort)` was `undefined` when `ngAfterViewInit` ran and the one-time `dataSource.sort = this.sort` captured nothing. Now bound through a setter. Fixed in `df1d542f`. **Caveat: the wiring is unit-tested, but nobody has clicked a column header in a browser to confirm the resulting sort order.**

## A code review caught 7 real defects in this session's own work

All fixed before committing. The one worth remembering: the first cut of #821 changed the empty-state guard to `visibleResponseCount === 0`, which removed the table **and the paginator** when a search matched nothing on the loaded page — stranding the reviewer with no way forward but clearing all filters. Now no-match is its own state and keeps the paginator.

## Open work

### #860 — CI quality-gate job (NEW, "This milestone")

https://github.com/ericfitz/tmi-ux/issues/860

**Nothing runs this repo's quality checks automatically.** Not a workflow, not a git hook.

| Workflow                            | Runs                           | Gates quality?                    |
| ----------------------------------- | ------------------------------ | --------------------------------- |
| `codeql.yml`                        | `pnpm run build` + CodeQL scan | No — builds, never lints or tests |
| `e2e-tests.yml`                     | `pnpm test:e2e`                | Playwright only                   |
| `deps-bump.yml`, `version-bump.yml` | automation                     | No                                |

`.husky/` has only `commit-msg` and `prepare-commit-msg`.

This is _why_ #858 happened — 534 spec type errors accumulated with every PR green.

Questions to settle in planning (all written up in the issue):

- One job or several (shared install vs. parallel + clearer failure reporting)?
- Does a PR-time `build` belong here given CodeQL already builds on `main`?
- **`lint:all` currently auto-fixes** (`eslint --fix`, `stylelint --fix`). A fixing linter can pass in CI while leaving committed source unformatted — check-only variants are needed. `format:check` already exists; `lint` / `lint:scss` need `--no-fix` equivalents.
- Adding it to the `main` ruleset as a required check. See the ruleset/CodeQL gotcha: PRs touching `.github/workflows/` need an empty synchronize push to trigger CodeQL, and pushing workflow files needs the gh `workflow` OAuth scope.

### #858 — spec type errors (OPEN, partial)

534 → **342**. Done: `typecheck:vitest` script, the broken mocks index (−24), TS4111 mechanical sweep (−159), `@testing/*` path alias (−14), ratchet + baseline.

**Deferred decision, still needs the user's call: ratchet at 342, or drive to zero?** No mechanical class remains — the rest are mocks whose shape drifted from the interfaces they stand in for, needing file-by-file reading. Prior recommendation: keep the ratchet, fix opportunistically, lower the baseline as you go.

Remaining shape (from `typecheck-vitest-baseline.json`):

| Count | Code                            |     | Count | Worst files                                                             |
| ----: | ------------------------------- | --- | ----: | ----------------------------------------------------------------------- |
|    74 | TS2345 argument not assignable  |     |    34 | `dfd/utils/cell-property-filter.util.spec.ts`                           |
|    59 | TS2339 property does not exist  |     |    27 | `tm/resolvers/threat-model.resolver.spec.ts`                            |
|    46 | TS2352 unsafe assertion         |     |    20 | `tm/services/import/reference-rewriter.service.spec.ts`                 |
|    36 | TS2322 type not assignable      |     |    18 | `tm/services/report/threat-model-report.service.spec.ts`                |
|    31 | TS2353 unknown literal property |     |    12 | `tm/validation/threat-model-validator.service.spec.ts`                  |
|    45 | (18 other codes)                |     |    12 | `shared/components/provider-display/provider-display.component.spec.ts` |

## How the ratchet works

`pnpm run typecheck:vitest:ratchet` compares the live error count against `typecheck-vitest-baseline.json` and **fails in both directions**:

- count goes **up** → fails, lists the worst files
- count goes **down** → fails, tells you to run `node scripts/typecheck-vitest-ratchet.mjs --update`

The second half is what makes it a ratchet rather than a cap: improvements get locked in permanently instead of being silently reclaimable later. The baseline carries a per-code and per-file breakdown, so progress is a reviewable diff.

**If you fix spec types, lower the baseline in the same commit or the ratchet fails.**

## Gotchas hit this session

- **`pnpm run lint:i18n` enforces sentence-final punctuation.** A 5-word heading tripped the "complete sentence must end with '.'" rule; shortened it rather than using the `.lint-skip` escape hatch (143 keys use that hatch). Locale-appropriate terminals matter: `。` ja/zh, `।` hi, `۔` ur, none for th/bn.
- **`pnpm run check-i18n` re-sorts every locale file.** Running it produces churn from _pre-existing_ unsorted blocks unrelated to your change. That is why `21609b45` exists as a separate `style:` commit — isolate the sorter output before making content changes.
- **Editing files via scripts bypasses the formatting PostToolUse hook.** Run `prettier --write` on script-edited files or `format:check` fails.
- **`src/assets/i18n/en-US.usage.json` fails `prettier --check` on `main`.** Pre-existing, generated, deliberately left alone. A strict `format:check` gate (#860) trips on it day one — decide reformat vs. exclude.
- **`pnpm run unused-i18n` takes >2 minutes.** Not part of `lint:all`. Budget for it or skip.
- **graphify does not index HTML templates.** Useless for template/CSS sweeps; grep directly for those.

## Next session

1. **Plan #860** (the reason this handoff exists). Settle the open questions above before writing YAML. Note the `--fix`-in-CI problem is the substantive one.
2. **Clean up after this run:**
   - Decide the #858 ratchet-vs-zero question; if driving down, start with `cell-property-filter.util.spec.ts` (34) and `threat-model.resolver.spec.ts` (27).
   - Decide what to do with this branch — 7 commits are unpushed with no PR. Version bump derives from the PR's Conventional Commits; `feat:` in `8f553b9a` means a **minor** bump.
   - Delete this file when the work it describes is done.
3. **Not done, worth knowing:** #812 was verified by compiling the four themes and checking resolved tones — the buttons were never viewed in a browser. Same for the triage no-match state and the column-sort fix. The #831 e2e tests were not executed (they need a dev server plus a backend on :8080); they were fixed by reading the gating logic.
