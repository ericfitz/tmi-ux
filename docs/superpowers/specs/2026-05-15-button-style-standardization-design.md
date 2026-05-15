# Button Style Standardization Design

**Issue:** [tmi-ux#677](https://github.com/ericfitz/tmi-ux/issues/677) — chore: review all button styles for consistency
**Branch:** `dev/1.4.0`
**Date:** 2026-05-15

## Background

The TMI-UX codebase currently uses five Material button directives interchangeably:

- `mat-raised-button` — 64 usages
- `mat-stroked-button` — 32 usages
- `mat-flat-button` — 9 usages
- `mat-button` — handful, mostly Cancel actions
- `mat-icon-button` — 227 usages (the established "action button" pattern)

Color attributes (`color="primary"`, `color="warn"`) are applied inconsistently — some Cancel buttons render as filled-primary while their destructive sibling renders as plain text, inverting the expected visual hierarchy (see [delete-confirmation-dialog.component.html](../../src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html#L82-L116)).

A global `border-radius: 8px` override at [component-overrides.scss:28-44](../../src/styles/component-overrides.scss#L28-L44) intends to make all buttons rounded rectangles, but is losing the CSS cascade fight against Material 3's MDC styles for raised/flat/stroked buttons — those render as Material's default true pill regardless. The override is dead code on text buttons; it only takes effect on icon buttons and FABs.

CLAUDE.md already defines an "Action button" UI term but does not define a "Dialog button" or other text-button conventions.

## Goal

Establish a single coherent button-style standard, audit every button in the application against it, and document the standard in CLAUDE.md so future contributors and Claude sessions can enforce it during code review.

## The Standard

### Three variants

The codebase uses exactly three button variants: **filled**, **text**, and **action**. The filled variant has a destructive sub-variant.

| Variant | Material directive | Visual | When to use |
|---|---|---|---|
| **Filled** (affirmative) | `mat-flat-button color="primary"` | Solid primary background, pill-shaped (Material 3 default) | The primary affirmative action in any dialog or page action bar (Save, Confirm, Create, Apply). At most one per dialog. |
| **Filled** (destructive sub-variant) | `mat-flat-button color="warn"` | Solid warn (red) background, pill-shaped | The primary action when destructive or irreversible (Delete, Remove, Revoke, Rollback). Replaces the affirmative filled button — never both in the same action group. |
| **Text** | `mat-button` (no color attr) | No background, no border, label only | Dismissive actions (Cancel, Close, Dismiss) and tertiary actions. Sits to the left of the filled button in `mat-dialog-actions`. |
| **Action** | `mat-icon-button` with `<mat-icon>` (or `<img>` for branded icons) + `matTooltip` for the label | Round icon-only button | Single-action invocations against an object (edit, delete, add, more-menu trigger). Already established pattern. |

**Banned directives:** `mat-raised-button`, `mat-stroked-button`, `mat-fab`, `mat-mini-fab`. The first two are migrated by this audit. The last two have no current usages and are banned prospectively.

### Composition (independent of variant)

Filled and text buttons may contain any combination of `<mat-icon>` plus label text. The audit does not strip icons from text buttons or labels from filled buttons. Action buttons are icon-only by definition, with the label moved to `matTooltip`.

### Color attribute rules

- `color="primary"` — only on `mat-flat-button` for affirmative primary actions, and on `mat-icon-button` when the icon should be tinted primary.
- `color="warn"` — only on the destructive variant (filled or icon).
- `color="accent"` / `color="tertiary"` — not used.
- No `color` attribute on `mat-button` (text buttons stay neutral).

### Theme compliance

All button colors must come from theme variables that resolve correctly in all four theme combinations: light-normal, dark-normal, light-colorblind, dark-colorblind. `color="primary"` and `color="warn"` route through Material's themed palettes, so they are safe by construction (the M3 theme definitions at [component-overrides.scss:67-100](../../src/styles/component-overrides.scss#L67-L100) cover all four palettes).

Hand-rolled button SCSS must use `var(--theme-*)` or `var(--color-*)` variables, never hard-coded hex. The audit flags any button with hand-rolled color rules; if a needed semantic color is missing from the theme, it is added to [material-theme.scss](../../src/styles/material-theme.scss) (with all four palette variants) before being used.

### Shape

Material 3 default (true pill) for filled and text buttons. Material 3 default (round) for icon buttons. The dead `border-radius: 8px` override at [component-overrides.scss:28-44](../../src/styles/component-overrides.scss#L28-L44) is removed as part of the foundation step.

The icon-button centering rules at [component-overrides.scss:46-58](../../src/styles/component-overrides.scss#L46-L58) are load-bearing and kept.

### Dialog action ordering

Every `mat-dialog-actions align="end"` block renders as `[Cancel (mat-button)] [Primary (mat-flat-button)]` in DOM order.

- `cdkFocusInitial` goes on the primary affirmative button so Enter commits the user's intent.
- **Exception:** if the primary is destructive (`mat-flat-button color="warn"`), `cdkFocusInitial` moves to Cancel so an accidental Enter does not destroy data.

## Migration Mapping

| Current pattern | Becomes | Notes |
|---|---|---|
| `mat-raised-button color="primary"` (affirmative) | `mat-flat-button color="primary"` | Most common case. M3 flat ≈ M2 raised visually; no shadow. |
| `mat-raised-button color="warn"` | `mat-flat-button color="warn"` | Destructive primary. |
| `mat-raised-button` with no color, or `color="primary"` on a Cancel | `mat-button` | Demotes Cancel from filled to text — fixes the visual-hierarchy inversion in [delete-confirmation-dialog](../../src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html#L82-L104). |
| `mat-stroked-button` (any color) | Default: `mat-button` (text variant). Promote to `mat-flat-button color="primary"` only when the button is the primary affirmative action in its action group (no other filled button present). | 32 sites; default assumes secondary action, since the original outlined style usually signaled "secondary, not primary." |
| `mat-flat-button color="warn"` | `mat-flat-button color="warn"` | No change. |
| `mat-button color="warn"` on a destructive primary | `mat-flat-button color="warn"` | Promotes to filled-destructive for proper hierarchy. |
| `mat-icon-button` with visible text label alongside the icon | Per-instance: either move the label to `matTooltip` (true action button) or convert to `mat-button` with an icon child. | If the label is visible today, the button is not actually icon-only. |
| `mat-icon-button` without `matTooltip` | `mat-icon-button` with `matTooltip` added | Accessibility requirement; CLAUDE.md already documents this for action buttons. |
| `mat-fab` / `mat-mini-fab` | — | None in codebase; ban prospectively. |

## Exceptions (Global)

- **Timmy launcher button** at [src/app/pages/tm/tm-edit.component.html:22](../../src/app/pages/tm/tm-edit.component.html#L22) (`class="timmy-header-button"`). Oversized icon-only button with an `<img>` child (not `<mat-icon>`) that opens the Timmy AI chat. Already uses `mat-icon-button` with `matTooltip`, so it conforms to the action-button directive; the larger size and image content are intentional. Excluded from the audit. Documented in CLAUDE.md as an intentional exception.

## Out of Scope

- Page-level action bar layouts (positioning, spacing, alignment) — only variant and color attributes change.
- Custom non-Material buttons. A quick scan found none; if any surface during the audit, they are listed in the PR description and addressed separately.
- DFD editor toolbar buttons — already `mat-icon-button` per existing pattern; only `matTooltip` presence is audited.
- Performance, accessibility, and i18n changes unrelated to button styling.

## Execution Plan

### Step 1: Foundation (single commit)

- Remove the dead `border-radius: 8px` override block at [component-overrides.scss:28-44](../../src/styles/component-overrides.scss#L28-L44).
- Keep the icon-button centering rules at [component-overrides.scss:46-58](../../src/styles/component-overrides.scss#L46-L58).
- Add a "Button styles" section to [.claude/CLAUDE.md](../../.claude/CLAUDE.md) under "UI Terminology" containing:
  - The three-variant table (filled / text / action).
  - The destructive variant rule.
  - Color attribute rules.
  - Theme compliance rule.
  - Dialog action ordering rule.
  - The Timmy launcher exception.
- Take baseline screenshots (`pnpm test:e2e` if it produces them, or manual capture of representative pages) for the visual-regression triage step.

### Step 2: Audit pass (multiple commits, one per logical area)

Walk the codebase area by area, applying the migration mapping. Suggested order — highest-leverage to lowest:

1. **Shared dialogs** — `src/app/shared/components/*` (delete-confirmation, rollback-confirmation, note-editor, etc.). Establishes the canonical dialog pattern.
2. **Threat-model dialogs** — `src/app/pages/tm/components/*-dialog/*` (threat-editor, document-editor, ssvc-calculator, export, cvss, etc.).
3. **Page-level action bars** — `tm-edit`, `threat-page`, `dashboard`, `triage`, `surveys`, `admin`.
4. **DFD pages** — `src/app/pages/dfd/*`. Mostly icon buttons; primarily a `matTooltip` audit.
5. **Auth pages** — `src/app/auth/components/*` (login, callback).
6. **Home and top-level pages** — `src/app/pages/home/*`, intake, etc.

For each area:

- Read the templates.
- Apply the migration mapping.
- Run `pnpm run lint:all`.
- Run relevant unit tests for the area.
- Run the area's E2E tests if any.

### Step 3: Verification

- `pnpm run build` to catch any template errors.
- Full Vitest suite (`pnpm test`).
- Full Playwright E2E suite (`pnpm test:e2e`). Visual regressions are expected:
  - `mat-raised-button` → `mat-flat-button` removes the M2-style shadow.
  - `mat-stroked-button` → `mat-flat-button` or `mat-button` removes the outline.
  - Cancel buttons that were `color="primary"` lose their fill.
- Invoke the `visual-regression-triage` skill on failures. Update baselines where the change is intentional (most cases); flag unexpected diffs as bugs.
- Manual smoke pass in the browser: home, login, dashboard, tm-edit, a threat-editor dialog, a delete-confirmation dialog, the DFD editor. Confirm visual hierarchy reads correctly in light and dark themes.

### Step 4: Cleanup

- Revert the temporary shape-preview row and SCSS that were added to `home.component.{html,scss}` during brainstorming.
- Open a PR, attach screenshots showing before/after of representative dialogs.
- After merge: comment on issue #677 referencing the merge commit, close issue.

## Risks and Mitigations

- **Visual-regression baseline churn.** Expected. Handled by the `visual-regression-triage` skill; baselines updated where the diff is intentional.
- **Stroked-button layout dependencies.** A few buttons may rely on the 1px outline for visual spacing or alignment. Fixed per-instance when caught during the audit or verification.
- **Removed `color="primary"` on Cancel buttons may surprise users.** Acceptable; this is the visual-hierarchy bug we are fixing.
- **Large PR blast radius.** ~125 button sites touched. Mitigation: walk by area and commit per area, so the diff is reviewable in chunks even if it ships as a single PR. Each area commit independently passes lint, build, and tests.

## Enforcement After Merge

CLAUDE.md gains a "Button styles" section that future code review (human and Claude) reads at the start of every session. No automated linting added in this PR — kept light per the project's preference for documentation + review over tooling.
