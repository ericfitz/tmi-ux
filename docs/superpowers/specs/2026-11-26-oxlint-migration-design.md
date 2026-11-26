# Replace ESLint with Oxlint (TypeScript stays 6.0) — design

Issue: #1063. Related: #845 (TypeScript 6 → 7).

## Intent

**Human decision (Eric, 2026-11-26):** follow tmi-clients' move off ESLint/typescript-eslint
to Oxlint, but keep TypeScript on 6.0. tmi-ux cannot take TS 7 yet because
`@angular/compiler-cli` / `@angular/build` 22.3.0 pin `typescript >=6.0 <6.1` (Angular's compiler
needs the TS JavaScript API that TS 7.0 lacks). This change removes the `typescript-eslint`
blocker on #845 (typescript-eslint 8.74.0 peers `<6.1.0`); #845 remains blocked on Angular.
Eric rejected the hybrid option (TS 7 for the `tsc --noEmit` projects alongside TS 6 for the
build).

## Goals / non-goals / anti-goals

- Goal: same lint coverage as today with Oxlint; ESLint and its plugins removed.
- Non-goal: adopting new Oxlint rule categories (only parity; `correctness` defaults are off and
  every rule is listed explicitly).
- Non-goal: changing TypeScript, stylelint, or the i18n checks.
- Anti-goal: a linter that passes because it silently stopped checking. A committed self-test
  must prove each override and the type-aware rules fire.

## Approaches

- **A. Native Oxlint rules + one local JS plugin + tsgolint type-aware (chosen).** Of the 96
  rules active on ordinary source files, 94 map 1:1 (three under their core `eslint` names:
  `no-unused-vars`, `no-unused-expressions`, `no-array-constructor`);
  `unused-imports/no-unused-imports` is covered by Oxlint's `no-unused-vars` with
  `fix.imports: "safe-fix"`; `no-octal` is dropped (octal literals are a parse error in TS
  modules). The spec-only `no-restricted-syntax` (the #870 "no casting to any in tests"
  selector) becomes local rule `tmi/no-any-cast` in `scripts/oxlint/tmi-plugin.mjs`.
- B. Oxlint for syntax rules, keep ESLint only for type-aware rules. Rejected: keeps
  typescript-eslint, so the #845 blocker stays.
- C. Oxlint without type-aware rules. Rejected: drops ~25 rules (`no-floating-promises`,
  `no-unsafe-*`, `await-thenable`, `unbound-method`, ...).

## Design

- `.oxlintrc.json` at repo root: `plugins: ["typescript"]`, `categories.correctness: "off"`,
  explicit rules, `options.typeAware: true`, `options.reportUnusedDisableDirectives: "warn"`
  (ESLint's default), the same ignore patterns and per-glob overrides as `eslint.config.js`.
- Scripts keep their names: `lint` / `lint:check` / `lint:e2e` / `lint:e2e:check` run
  `oxlint` on `src` / `e2e` (with `--fix` for the non-check forms). Warnings do not fail the
  check, as today.
- New `lint:rules:test` runs the harness's own tests (`scripts/oxlint/selftest.test.mjs`, against
  a stub binary) and then `scripts/oxlint/selftest.mjs`: it copies a fixture tree with seeded
  violations plus the real `tsconfig.json` into a fresh OS temp directory with a `node_modules`
  symlink to the repo's (so tsgolint and imported types resolve; inside the repo it would be
  skipped by `.gitignore`), lints it with the real config, and compares (file, line, severity,
  rule) and the enabled-rule count with `expected.json`. Fixtures cover every override glob,
  positive and negative. Added to `verify` and to `.github/workflows/quality.yml`.
  Known limits: it does not exercise `--fix` (so the `no-unused-vars` `fix` option is untested),
  severity changes of rules no fixture triggers are not caught, and a one-for-one rule swap keeps
  the rule count unchanged.
- `oxlint` and `oxlint-tsgolint` are exact-pinned and bumped together (no hold); the self-test is
  the bump gate. Rationale in `package.json` `comments`.
- Removed: `eslint.config.js`, eslint / typescript-eslint / angular-eslint / eslint-config-prettier
  / eslint-plugin-* devDependencies, the `angular.json` lint target and eslint schematics
  collection; `.vscode` switches to the Oxlint extension. Inline `eslint-disable` comments become
  `oxlint-disable`.

## Calls made without Eric (autonomous run)

- **Type-aware linting uses tsgolint, which is built on the TypeScript 7 native checker**, while
  the build and `tsc` projects use TS 6. Lint-time type information can therefore differ from the
  compiler's in edge cases. Accepted because the alternative (approach C) drops all type-aware
  rules; the build and both `tsc --noEmit` runs stay on TS 6 and remain the source of truth for
  type errors (`options.typeCheck` is left off).
- `*.html` was in the ESLint glob but no config ever applied to it (baseline: zero `.html` files
  linted). Dropping it from the scripts loses nothing.
- The domain-layer `paths` entries `@angular/material/*` and `rxjs/*` were literal names in ESLint
  (never matched). They become `patterns`, which is what they were meant to do.
- `no-restricted-imports` `group` patterns end in `/**`, not `/*`: Oxlint's `/*` matches exactly one
  path segment, whereas ESLint's gitignore-style `/*` matched any depth (`../../pages/tm/...` was
  reported). With `/*` the core-to-pages rule would have been inert. Fixtures cover deep imports.
- Rule options are explicit: every option ESLint resolved for the recommended rules (for example
  `no-cond-assign: except-parens`, `no-shadow-restricted-names.reportGlobalThis`,
  `no-irregular-whitespace.skipStrings`) is written into `.oxlintrc.json`. Oxlint validates options
  and rejects unknown fields, so a mismatch fails loudly. The only option Oxlint lacks is
  `preserve-caught-error.errorClassNames`, which ESLint resolved to an empty list (no effect).
- Oxlint also applies `no-restricted-imports` to dynamic `import()`; ESLint did not. No current
  source hits it.
- Oxlint honors `.gitignore`, so the git-ignored `src/environments/environment.local.ts` is no longer
  linted (ESLint linted it). It is a machine-local file.
- `tsconfig.json` gains `"rootDir": "./"`. TypeScript (6 and 7) rejects `outDir` without `rootDir`
  when the computed common source directory is not the tsconfig directory; under tsgolint that
  surfaces as a `tsconfig-error` diagnostic and no type-aware rules run. The real tree computes `./` today; the explicit
  value removes that dependency. No effect on TS 6 or the Angular build (which sets its own output).
- Two `no-unsafe-optional-chaining` hits ESLint missed (`(get('x')?.value as string).trim()` in
  `triage-note-editor-dialog.component.ts`) are fixed in code, not suppressed.
- Oxlint picks the tsconfig per file by discovery; e2e files get the root `tsconfig.json` rather
  than `tsconfig.e2e.json`. Verified that Playwright types resolve (`await-thenable` fires on a
  `Locator`). `typecheck:e2e` still uses `tsconfig.e2e.json`.
