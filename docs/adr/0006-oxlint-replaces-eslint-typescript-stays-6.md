# ADR 0006: Lint with Oxlint; keep TypeScript on 6.0 until Angular supports 7

- **Status:** Accepted
- **Date:** 2026-11-26
- **Decision by:** Eric Fitzgerald (human decision)
- **Related:** #1063 (migration), #845 (TypeScript 6 → 7), tmi-clients' move of `@tmi-dev/client`
  to TypeScript 7 + Oxlint

## Context

tmi-clients moved its TypeScript client to TypeScript 7 and Oxlint. tmi-ux was asked whether to
follow. Two upstream pins blocked TypeScript 7 for tmi-ux (#845):

- `@angular/compiler-cli` / `@angular/build` 22.3.0 declare `typescript >=6.0 <6.1`. Angular's
  compiler is built on the TypeScript JavaScript API, which TypeScript 7.0 does not ship; Angular
  has announced no release date for TypeScript 7 support.
- `typescript-eslint` 8.74.0 declares `typescript <6.1.0` and refuses to start under 7.0.

Switching the linter to Oxlint removes only the second blocker.

## Decision

- Replace ESLint + typescript-eslint with Oxlint now, on TypeScript 6.0 (#1063).
- Keep TypeScript on 6.0 for the build and both `tsc --noEmit` projects. #845 stays blocked on
  Angular alone.
- Rejected: a hybrid that runs TypeScript 7 for the `tsc --noEmit` type checks while the Angular
  build stays on TypeScript 6.

## Consequences

- Type-aware lint rules run through `oxlint-tsgolint`, which uses the TypeScript 7 checker. Lint-time
  type information can differ from the TypeScript 6 compiler's in edge cases; the build and `tsc`
  projects remain the source of truth for type errors. (Proposed during the autonomous run;
  approved by Eric on 2026-11-26, human decision.)
- `tsconfig.json` sets `"rootDir": "./"` so tsgolint accepts the project. (Approved by Eric on
  2026-11-26, human decision.)
- When Angular ships TypeScript 7 support, #845 needs no linter work.
- Implementation details and the parity record: `docs/superpowers/specs/2026-11-26-oxlint-migration-design.md`.
