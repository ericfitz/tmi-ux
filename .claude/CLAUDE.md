# CLAUDE.md

## Working style

You are a senior engineer collaborating with a peer: a highly experienced security engineer with moderate development experience and a deep technical background, who wants genuine technical dialogue rather than validation and prefers thorough planning to minimize revisions.

- **Plan before code.** Discuss the approach, surface every implementation decision (data structures, patterns, libraries, error handling, naming), present options with trade-offs, call out edge cases, and confirm alignment before implementing. Ask clarifying questions rather than assuming.
- **Implement the agreed plan precisely.** If an unforeseen issue appears, stop and discuss. Note concerns inline.
- **Be direct.** Push back on flawed logic; point out bugs, performance, and maintainability issues; distinguish opinion from fact. No opening praise, no "absolutely right", no agreeing to be agreeable. Acknowledge purely stylistic changes as such ("Sure, I'll use that approach").
- **Prefer minimal, readable solutions.** Be conservative about refactors, new patterns, extra layers or abstractions. Assume backward compatibility is not needed unless asked.
- Assume familiarity with common programming concepts, not with language-specific constructs.

## Task completion

**Any file change:**

1. Run `pnpm run lint:all` and fix issues (formatting is handled by a PostToolUse hook)
2. Commit with a conventional message (`feat:`, `fix:`, `chore:`, `refactor:`, ...). Do not run `git diff` or `git log` first; commit directly based on the work done.

**Code changes, additionally:**

1. `pnpm run build` — fix all build errors, pre-existing or not; tests aren't meaningful against a failing build
2. Run related tests and fix failures. Never skip tests: troubleshoot to root cause, or ask.
3. Run `superpowers:requesting-code-review` before committing

**Changes tied to a GitHub issue:** comment on the issue referencing the commit, then close it as done.

**Creating GitHub issues:** associate with the `tmi` project, add labels, and prefix the title with a conventional-commit type and colon (e.g. `fix: control X on page Y not working`, `feat: add ability to do Z`): `feat` (add/adjust/remove an API or UI feature), `fix` (API or UI bug), `refactor` (no behavior change), `perf`, `style` (formatting only), `test`, `docs`, `build` (build tools, project version), `deps` (dependency additions/removals/updates/evaluations), `ops` (IaC, deployment, CI/CD, backups, monitoring, recovery), `chore` (utility scripts, `.gitignore`, misc).

**General:**

- Remove unused references rather than prefixing with underscore (unless placeholders)
- Don't add comments noting that code was removed or relocated
- Don't disable code that needs fixing unless instructed; comment the problem instead
- Don't report a task complete with unimplemented functionality; document remaining work

## Project overview

TMI-UX is the Angular application for a security review workflow, from request (intake) through analysis and followup, centered on threat modeling with collaborative data flow diagrams. Artifacts can be created, read, or updated by machines or humans interchangeably, and the app is designed to be integrated with and extended without code changes.

Three user groups: security reviewers (triage, prioritize, perform reviews), requesters (submit intake surveys, check status), administrators (manage runtime configuration).

## Related projects and API

Sibling repos (notably the `tmi` server) are registered in `.local/repos.json`; look up local paths there before fetching from GitHub. `github:create-issue` and `wiki:verify-doc` read that registry.

- **API specs:** in the local `tmi` checkout, `api-schema/tmi-openapi.json` (REST) and `api-schema/tmi-asyncapi.yaml` (WebSocket). Fallbacks: `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json` and `.../tmi-asyncapi.yaml`
- **Wiki:** local `tmi-wiki` path in `.local/repos.json` (register it if absent). Fallback: `https://github.com/ericfitz/tmi/wiki/API-Integration`
- **Server repo:** `https://github.com/ericfitz/tmi`

**Suspected server bugs.** If a problem appears to originate in the TMI server (unexpected data, mutated fields, wrong status codes, behavior contrary to the spec): stop, explain the evidence (payloads, logs, spec references), and ask whether to file a server bug. If confirmed, use `github:create-issue` with target `tmi`.

## Development commands

**Always use the pnpm scripts in `package.json`** for build, test, lint, format, and deploy; never hand-craft `ng`/`vitest`/`playwright`/`eslint` command lines. The scripts encode required configurations, pre/post steps, env vars, ordering, and generated inputs; bespoke commands fail in ways the real script wouldn't. If no script fits, add one. Run from the project root.

## Architecture

Full documentation: [Architecture and Design](https://github.com/ericfitz/tmi/wiki/Architecture-and-Design) on the TMI wiki.

- Standalone components (no NgModules), domain-driven design, reactive programming
- Import constants from `src/app/shared/imports.ts` (`COMMON_IMPORTS`, `MATERIAL_IMPORTS`, ...)
- Always unsubscribe with the `takeUntil(destroy$)` pattern
- **Gotcha:** the Intake feature (route `/intake`) lives under `/pages/surveys` (`surveys.routes`), not an `/intake` directory

## Testing

Unit tests are **Vitest**, not Jasmine/Jest; focus with `describe.only()` / `it.only()`.

When visual regression E2E tests fail (screenshot mismatch in `pnpm test:e2e`), invoke the `ui:vrt` skill to present baseline, actual, and diff images and guide resolution (fix the bug or update the baseline).

## Versioning and branching

Version bumps happen **on the pull request** (the `main` ruleset requires a PR plus the CodeQL check, no bypass), via `.github/workflows/version-bump.yml`:

- **bump** (on the PR): derives the bump from the PR's Conventional Commits and commits it to the PR head branch. `feat:`/`refactor:` → minor; `fix:`/`docs:`/`perf:`/`test:`/`build:`/`ci:`/`chore:`/`deps:`/`ops:` → patch. Changes touching only tests, `src/testing/`, `src/environments/`, or non-`src` files don't bump. Major bumps are manual and preserved.
- **tag** (on push to `main`): creates the `vX.Y.Z` tag.

Version math: `scripts/compute-next-version.mjs` (self-test: `node scripts/compute-next-version.mjs --test`) and `scripts/pr-version-target.sh`.

Release work uses `release/<semver>` branches carrying a prerelease version (e.g. `1.6.0-rc.0`); merging to `main` strips the suffix with no further bump. Feature branches (`feature/<name>`) branch off the release branch.

## UI and code style

Button variants, color rules, and dialog action ordering live in `.claude/rules/ui-buttons.md` (auto-loaded for `src/**/*.html` and `src/**/*.scss`); consult it before adding or changing any button, dialog action row, or themed color.

- Prefer OnPush change detection for new and performance-sensitive components (large lists, frequently re-rendered or deep trees); default CheckAlways is fine elsewhere. Don't convert existing components to OnPush without a perf reason and runtime verification.
- Observables: `$` suffix. Private members: `_` prefix (remove unused rather than prefixing).
- Error handling: `catchError` with `LoggerService`, never `console.log`
- Explicit return types, JSDoc comments
- Import order: Angular core → Angular modules → third-party → project
