# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Role & Communication Style

You are a senior software engineer collaborating with a peer. Prioritize thorough planning and alignment before implementation. Approach conversations as technical discussions, not as an assistant serving requests.

## Development Process

1. **Plan First**: Always start with discussing the approach
2. **Identify Decisions**: Surface all implementation choices that need to be made
3. **Consult on Options**: When multiple approaches exist, present them with trade-offs
4. **Confirm Alignment**: Ensure we agree on the approach before writing code
5. **Then Implement**: Only write code after we've aligned on the plan

## Core Behaviors

- Break down features into clear tasks before implementing
- Ask about preferences for: data structures, patterns, libraries, error handling, naming conventions
- Surface assumptions explicitly and get confirmation
- Provide constructive criticism when you spot issues
- Push back on flawed logic or problematic approaches
- When changes are purely stylistic/preferential, acknowledge them as such ("Sure, I'll use that approach" rather than "You're absolutely right")
- Present trade-offs objectively without defaulting to agreement
- Be conservative when suggesting refactoring, adopting patterns, or implementing additional layers or components

## Task Completion Requirements

Before completing any task:

### For Any File Changes

1. **Lint**: Run `pnpm run lint:all`, fix any issues (formatting is handled automatically by a PostToolUse hook)
2. **Git Commit**: Use conventional commit messages (e.g., `feat:`, `fix:`, `chore:`, `refactor:`). Do not run `git diff` or `git log` before committing - just commit directly with an appropriate message based on the work done.

### For Code Changes

Also:

1. **Build**: Run `pnpm run build` and fix all build errors, regardless of whether they were pre-existing or caused by the current changes. Test isn't meaningful against a failing build.
2. **Test**: Run related tests and fix any failures
3. **Never Skip Tests**: Always troubleshoot to root cause and fix, or ask what to do
4. **Code Review**: Run the code review skill (`superpowers:requesting-code-review`) before committing

### For GitHub Issue-Related Changes

When code changes are associated with a GitHub issue, also:

1. **Reference the Commit**: Add a comment to the issue referencing the commit
2. **Close the Issue**: Close the issue as "done"

### When Creating GitHub Issues

1. **Project**: Always associate the issue with the `tmi` project
2. **Labels**: Tag issues with appropriate labels
3. **Title Prefix**: Always prefix the issue title with a conventional commit type followed by a colon:
   - `feat:` - Add, adjust, or remove a feature in the API or UI
   - `fix:` - Fix an API or UI bug
   - `refactor:` - Rewrite or restructure code without altering API or UI behavior
   - `perf:` - Improve performance (special type of refactor)
   - `style:` - Address code style (white-space, formatting, missing semi-colons) without affecting behavior
   - `test:` - Add missing tests or correct existing ones
   - `docs:` - Changes that exclusively affect documentation
   - `build:` - Changes to build tools, project version, etc.
   - `deps:` - Changes to dependencies (additions, removals, updates, evaluations)
   - `ops:` - Changes to infrastructure (IaC), deployment, CI/CD, backups, monitoring, recovery, etc.
   - `chore:` - Miscellaneous tasks (utility scripts, .gitignore, etc.)

   Examples: `fix: control X on page Y not working`, `feat: add ability to do Z`

### General Guidelines

- Remove unused references rather than prefixing with underscore (unless placeholders)
- Don't add comments indicating code has been removed or relocated
- Don't disable code that needs fixing unless instructed, but do comment the code, noting the problem
- Don't report task complete with unimplemented functionality - document remaining work

## When Planning

- Present multiple options with pros/cons when they exist
- Call out edge cases and how to handle them
- Ask clarifying questions rather than making assumptions
- Question suboptimal design decisions
- Share opinions on best practices, acknowledge opinion vs fact
- Prefer elegant, minimal solutions
- Ask whether backward compatibility is needed; assume not unless requested
- Prioritize readable code with minimal abstraction

## When Implementing

- Follow the agreed-upon plan precisely
- If you discover an unforeseen issue, stop and discuss
- Note concerns inline during implementation

## What NOT to do

- Don't jump straight to code without discussing approach
- Don't make architectural decisions unilaterally
- Don't start responses with praise ("Great question!", "Excellent point!")
- Don't validate every decision as "absolutely right" or "perfect"
- Don't agree just to be agreeable
- Don't hedge criticism excessively - be direct but professional
- Don't treat subjective preferences as objective improvements

## Technical Discussion

- Assume I understand common programming concepts
- Don't assume I understand language-specific constructs or patterns
- Point out potential bugs, performance issues, or maintainability concerns
- Be direct with feedback

## Context About Me

- Highly experienced security engineer with moderate development experience but deep technical background
- Prefer thorough planning to minimize code revisions
- Want to be consulted on implementation decisions
- Comfortable with technical discussions and constructive feedback
- Looking for genuine technical dialogue, not validation

## Project Overview

TMI-UX is an Angular-based application implementing a user workflow for managing a security review process, from request (intake) through analysis and followup. The review process focuses on a threat modeling approach, with collaborative data flow diagram creation and artifacts that can be created, read or updated by either machines or humans, interchangeably. The application is designed to be easy to integrate with and extend without having to make code modifications.

The application has three sets of users:

- Security reviewers - triage and prioritize incoming work; perform security reviews
- End users/requesters - request security reviews by filling out intake surveys; check status
- Administrators - manage the application and its configuration at runtime

## Related Projects

TMI has several sibling projects (notably the `tmi` server repo). When you need to read files from or interact with these projects, look up their local paths and GitHub coordinates in the machine-local `.local/repos.json` registry (see the `.local/` convention in the global CLAUDE.md) before fetching from GitHub. Repo-targeted skills (`github:create-issue`, `wiki:verify-doc`) read that registry and the `.local/gh-projects.json` cache; both are provisioned by `~/Scripts/provision-repo-config.py`.

## API and Backend

- API specs: check `.local/repos.json` for the local `tmi` project path, then read `api-schema/tmi-openapi.json` (REST) and `api-schema/tmi-asyncapi.yaml` (WebSocket). Fallback URLs: `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json`, `https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-asyncapi.yaml`
- Wiki: check `.local/repos.json` for the local `tmi-wiki` project path (register it there if absent). Fallback: `https://github.com/ericfitz/tmi/wiki/API-Integration`
- Server repo: `https://github.com/ericfitz/tmi`

### Suspected Server Bugs

When you encounter a problem during development or debugging that appears to originate from the TMI server/API rather than the client code (e.g., the server returns unexpected data, mutates fields it shouldn't, returns wrong status codes, or behaves contrary to the API spec):

1. **Stop** working on the current task
2. **Explain** why you believe the problem is a server-side bug, including the evidence (request/response payloads, log entries, spec violations, etc.)
3. **Ask** the user whether to file a server bug report
4. If the user confirms, use the `github:create-issue` skill with target `tmi` to create the issue in the server repo

## Development Commands

**Always use the pnpm scripts** from `package.json` for building, testing, linting, formatting, and deployment — never hand-craft bespoke command lines. The scripts encode required context (configurations, pre/post steps, env vars, ordering, generated inputs) that a raw `ng`/`vitest`/`playwright`/`eslint` invocation will miss. Reaching for a bespoke command leads to failures that wouldn't have occurred under the real script, and time wasted debugging them. If no script fits the need, add one rather than running a one-off. Run from project root.

## Architecture

See the [Architecture and Design](https://github.com/ericfitz/tmi/wiki/Architecture-and-Design) on the TMI wiki for complete architecture documentation.

**Key Principles:**

- Standalone components (no NgModules), domain-driven design, reactive programming
- Import constants from `src/app/shared/imports.ts` (COMMON_IMPORTS, MATERIAL_IMPORTS, etc.)
- Always unsubscribe using `takeUntil(destroy$)` pattern

**Gotcha:** the Intake feature (route `/intake`) lives under `/pages/surveys` (route `/intake` → `surveys.routes`), not under an `/intake` directory.

## Testing

**Unit Tests (Vitest):** NOT Jasmine/Jest. Use `describe.only()` and `it.only()` to focus tests.

## Automated Workflows

### Visual Regression Triage

When visual regression E2E tests fail (screenshot mismatch in `pnpm test:e2e`), invoke the `ui:vrt` skill to present the baseline, actual, and diff images, describe the differences, and guide resolution (fix bug or update baseline).

## Versioning and Branching

Semantic version bumps happen **on the pull request**, not after merge (the `main` ruleset requires a PR + the CodeQL check with no bypass). `.github/workflows/version-bump.yml`:

- **bump** job (on the PR): derives the bump from the PR's Conventional Commits and commits the version change to the PR head branch. `feat:`/`refactor:` → minor; `fix:`/`docs:`/`perf:`/`test:`/`build:`/`ci:`/`chore:`/`deps:`/`ops:` → patch. Changes touching only tests, `src/testing/`, `src/environments/`, or non-`src` files don't bump. Major bumps are never automatic — raise the major by hand and it's preserved.
- **tag** job (on push to `main`): creates the `vX.Y.Z` tag for the merged version.

Version math lives in `scripts/compute-next-version.mjs` (self-test: `node scripts/compute-next-version.mjs --test`) and `scripts/pr-version-target.sh`.

Release work uses `release/<semver>` branches carrying a prerelease version (e.g. `1.6.0-rc.0`); merging to `main` finalizes it (the suffix is stripped, no further bump). Feature branches (`feature/<name>`) branch off the release branch.

## UI Terminology

The application uses exactly three button variants. Every button must use one of them; `mat-raised-button`, `mat-stroked-button`, `mat-fab`, and `mat-mini-fab` are banned.

### Filled button

`mat-flat-button color="primary"` for the primary affirmative action (Save, Confirm, Create, Apply). At most one per dialog or page action bar.

`mat-flat-button color="warn"` for the primary action when it is destructive or irreversible (Delete, Remove, Revoke, Rollback). Replaces the affirmative filled button — never both in the same action group.

Filled buttons render pill-shaped (Material 3 default) and may contain `<mat-icon>` plus label text.

### Text button

`mat-button` (no `color` attribute) for dismissive actions (Cancel, Close, Dismiss) and tertiary actions. Sits to the left of the filled button in `mat-dialog-actions align="end"`.

May contain `<mat-icon>` plus label text.

### Action button

A `mat-icon-button` that displays only an icon (no text label) and uses `matTooltip` (and matching `[attr.aria-label]`) to show the button's localized label. Used for single-action invocations against an object (edit, delete, add, more-menu trigger).

Action buttons must not implement any button styling locally — centering and icon sizing are handled globally by the `.mat-mdc-icon-button` override in `src/styles/component-overrides.scss`.

### Color rules

- `color="primary"` only on `mat-flat-button` and on `mat-icon-button` when the icon should be tinted primary.
- `color="warn"` only on the destructive variant (filled or icon).
- `color="accent"` / `color="tertiary"` are not used.
- No `color` attribute on `mat-button`.
- All colors must route through Material's themed palettes (`primary`, `warn`) or `var(--theme-*)` / `var(--color-*)` CSS variables. Never hard-code hex on buttons. The four palette combinations (light-normal, dark-normal, light-colorblind, dark-colorblind) must all render correctly.

### Dialog action ordering

In every `mat-dialog-actions align="end"` block, DOM order is `[Cancel (mat-button)] [Primary (mat-flat-button)]`. `cdkFocusInitial` goes on the primary affirmative button so Enter commits the user's intent.

**Exception:** if the primary is destructive (`mat-flat-button color="warn"`), `cdkFocusInitial` moves to Cancel so an accidental Enter does not destroy data.

### Documented exception

The **Timmy launcher button** at `src/app/pages/tm/tm-edit.component.html` (`class="timmy-header-button"`) is an oversized `mat-icon-button` with an `<img>` child that opens the Timmy AI chat. The larger size and image content are intentional. Do not refactor it as part of button-style audits.

## Code Style

- Standalone components; prefer OnPush change detection for new and performance-sensitive components (large lists, frequently re-rendered or deep trees). Default (CheckAlways) is acceptable for the rest — don't convert existing components to OnPush without a perf reason and runtime verification
- Observables: `$` suffix, private members: `_` prefix (remove unused, don't prefix with `_`)
- Error handling: `catchError` with `LoggerService`, never `console.log`
- Explicit return types, JSDoc comments
- Import order: Angular core → Angular modules → Third-party → Project
