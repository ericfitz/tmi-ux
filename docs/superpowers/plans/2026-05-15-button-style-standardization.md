# Button Style Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every button in TMI-UX to a three-variant system (filled / text / action), removing dead CSS overrides and documenting the standard in CLAUDE.md.

**Architecture:** Foundation task removes a dead `border-radius` override and adds documentation. Audit tasks walk the codebase area by area (shared dialogs → tm dialogs → admin pages → page action bars → DFD pages → auth pages → home/static pages) applying a fixed migration mapping. Verification task runs the full build, tests, and Playwright suite; visual-regression baseline updates are expected.

**Tech Stack:** Angular 17+ standalone components, Angular Material 3, SCSS, Vitest, Playwright.

**Spec:** [docs/superpowers/specs/2026-05-15-button-style-standardization-design.md](../specs/2026-05-15-button-style-standardization-design.md)

**Issue:** [tmi-ux#677](https://github.com/ericfitz/tmi-ux/issues/677)

---

## Migration Mapping (Reference for All Audit Tasks)

Apply this mapping to every `<button>` in the files listed for each task:

| Current pattern | Becomes |
|---|---|
| `mat-raised-button color="primary"` (affirmative primary) | `mat-flat-button color="primary"` |
| `mat-raised-button color="warn"` (destructive primary) | `mat-flat-button color="warn"` |
| `mat-raised-button` with no `color` attr on a dismissive/cancel button | `mat-button` (drop `color` attr if present) |
| `mat-raised-button color="primary"` on a dismissive/cancel button | `mat-button` (drop `color` attr) |
| `mat-stroked-button` (any color) — default | `mat-button` (drop `color` attr) |
| `mat-stroked-button` (any color) — when it is the ONLY primary affirmative in its action group | `mat-flat-button color="primary"` |
| `mat-flat-button color="primary"` | unchanged ✓ |
| `mat-flat-button color="warn"` | unchanged ✓ |
| `mat-button color="warn"` on a destructive primary action | `mat-flat-button color="warn"` |
| `mat-button` (no color) on Cancel/dismissive | unchanged ✓ |
| `mat-icon-button` without `matTooltip` and without `[attr.aria-label]` | add `matTooltip` (and `[attr.aria-label]` if missing) |
| `mat-icon-button` with visible text label child | move label to `matTooltip`, OR convert to `mat-button` with icon child — judgment per instance (default: convert to `mat-button` if the label is i18n-translated and meaningful; convert to icon-only with tooltip if it's redundant with the icon) |

**Dialog action ordering rule:** In every `<mat-dialog-actions align="end">` block, ensure DOM order is `[Cancel-text-button] [Primary-filled-button]`. Place `cdkFocusInitial` on the primary affirmative button, UNLESS the primary is destructive (`mat-flat-button color="warn"`), in which case `cdkFocusInitial` goes on Cancel.

**Theme color rule:** Do not introduce hand-rolled hex colors on any button. If a button has component-scoped SCSS overriding colors, verify they use `var(--theme-*)` or `var(--color-*)` variables that resolve in all four palettes (light-normal, dark-normal, light-colorblind, dark-colorblind). If a needed color is missing from the theme, stop and add it to [src/styles/material-theme.scss](../../src/styles/material-theme.scss) (with all four palette variants) before continuing.

**Exception (do not touch):** [src/app/pages/tm/tm-edit.component.html](../../src/app/pages/tm/tm-edit.component.html) — the button with `class="timmy-header-button"` is exempt; leave it as-is.

---

## File Structure

This plan does not create new source modules. It modifies existing template (`.html`) files, one SCSS file ([component-overrides.scss](../../src/styles/component-overrides.scss)), and the project's CLAUDE.md.

**Files modified per task:** Listed explicitly in each task.

**No new files** other than this plan and the existing spec document (already committed).

---

## Task 1: Foundation — Remove Dead Override, Document Standard

**Files:**
- Modify: `src/styles/component-overrides.scss` (remove lines 27-44, keep 46-58)
- Modify: `.claude/CLAUDE.md` (add new section under "UI Terminology")

- [ ] **Step 1: Read the current override block**

Run: `sed -n '27,58p' src/styles/component-overrides.scss`
Expected output: shows the `// Increase border radius for all buttons` block at lines 28-44 followed by the `// Icon button centering` block at lines 46-58.

- [ ] **Step 2: Remove the border-radius override block from component-overrides.scss**

Open `src/styles/component-overrides.scss`. Find this block and delete it (lines 27-44):

```scss
// Increase border radius for all buttons (design preference)
.mat-mdc-button,
.mat-mdc-raised-button,
.mat-mdc-stroked-button,
.mat-mdc-flat-button,
.mat-mdc-unelevated-button,
.mat-mdc-outlined-button,
.mat-mdc-icon-button,
.mat-mdc-fab,
.mat-mdc-mini-fab {
  border-radius: 8px;

  .mdc-button,
  .mdc-fab {
    border-radius: 8px;
  }
}
```

Keep the `// Icon button centering` block immediately following it. Result: the file should still contain the `// BUTTON STYLING` section header followed directly by the `// Icon button centering` block.

- [ ] **Step 3: Add "Button styles" section to CLAUDE.md**

Open `.claude/CLAUDE.md`. Find the existing `## UI Terminology` section. Replace the entire section with the following expanded version:

```markdown
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
```

- [ ] **Step 4: Verify build still passes after foundation changes**

Run: `pnpm run build 2>&1 | tail -20`
Expected: build succeeds. Look for "Application bundle generation complete" or equivalent.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`
Expected: lint passes (pre-existing i18n warnings about trailing `…` are OK; no new errors introduced).

- [ ] **Step 6: Commit**

```bash
git add src/styles/component-overrides.scss .claude/CLAUDE.md
git commit -m "$(cat <<'EOF'
refactor: remove dead button border-radius override, document standard (#677)

The .mat-mdc-raised-button { border-radius: 8px } override was being lost
in the CSS cascade to Material 3's MDC styles for text buttons (raised,
flat, stroked all rendered as Material's default pill regardless of the
override). Removing the dead code; documenting the three-variant button
standard in CLAUDE.md.

Foundation for #677 audit work.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Audit Shared Dialogs

**Files:**
- Modify: `src/app/shared/components/confirm-action-dialog/confirm-action-dialog.component.html`
- Modify: `src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html`
- Modify: `src/app/shared/components/note-editor-dialog/note-editor-dialog.component.html`
- Modify: `src/app/shared/components/rollback-confirmation-dialog/rollback-confirmation-dialog.component.html`

- [ ] **Step 1: Apply migration mapping to each file**

For each file listed above:

1. Open the file.
2. For every `<button>` element, identify its current variant + color and look up the row in the Migration Mapping table at the top of this plan.
3. Change the directive (e.g., `mat-raised-button` → `mat-flat-button`) and adjust the `color` attribute per the mapping.
4. In any `<mat-dialog-actions align="end">` block, ensure DOM order is `[Cancel] [Primary]` and move `cdkFocusInitial` per the dialog-action ordering rule (destructive primaries → Cancel gets focus; affirmative primaries → Primary gets focus).

**Specific known issue in `delete-confirmation-dialog.component.html`:**

Cancel is currently `mat-raised-button color="primary"` (filled, prominent), Delete is currently `mat-button color="warn"` (text-only). Per the mapping:
- Cancel → `mat-button` (no color)
- Delete → `mat-flat-button color="warn"`
- `cdkFocusInitial` should be on Cancel (destructive primary rule).

The current template has Cancel rendered inside an `@if (requiresTypedConfirmation) { ... } @else { ... }` block. Both Cancel branches need the same treatment. Delete stays in its current DOM position (after Cancel) so order is already `[Cancel] [Delete]`.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 3: Run unit tests for shared components**

Run: `pnpm test -- src/app/shared/components/ 2>&1 | tail -20`
Expected: all tests pass. If a test asserts on button class names (`mat-raised-button` etc.), update the assertion to the new directive — these are not behavior tests, just selector tests.

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/shared/components/
git commit -m "refactor: audit shared dialog buttons to three-variant standard (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Audit Core/Auth Dialogs

**Files:**
- Modify: `src/app/core/components/delete-user-data-dialog/delete-user-data-dialog.component.html`
- Modify: `src/app/core/components/session-expiry-dialog/session-expiry-dialog.component.html`
- Modify: `src/app/core/components/validation-error-dialog/validation-error-dialog.component.html`
- Modify: `src/app/auth/components/login/login.component.html`
- Modify: `src/app/auth/components/unauthorized/unauthorized.component.html`

- [ ] **Step 1: Apply migration mapping**

Apply the mapping to each file as in Task 2.

Notable: `delete-user-data-dialog` is destructive — Cancel gets `cdkFocusInitial`. `session-expiry-dialog` is affirmative ("Extend session" or similar) — Primary gets `cdkFocusInitial`. `login.component.html`'s Cancel button at the bottom of the OAuth provider list becomes `mat-button` (no color).

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 3: Run unit tests for core + auth**

Run: `pnpm test -- src/app/core/ src/app/auth/ 2>&1 | tail -20`
Expected: passes.

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/app/core/components/ src/app/auth/components/
git commit -m "refactor: audit core and auth dialog buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Audit Threat-Model Dialogs

**Files:**
- Modify: `src/app/pages/tm/components/asset-editor-dialog/asset-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/create-diagram-dialog/create-diagram-dialog.component.html`
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html`
- Modify: `src/app/pages/tm/components/cwe-picker-dialog/cwe-picker-dialog.component.html`
- Modify: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/export-dialog/export-dialog.component.html`
- Modify: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html`
- Modify: `src/app/pages/tm/components/invoke-addon-dialog/invoke-addon-dialog.component.html`
- Modify: `src/app/pages/tm/components/metadata-dialog/metadata-dialog.component.html`
- Modify: `src/app/pages/tm/components/rename-diagram-dialog/rename-diagram-dialog.component.html`
- Modify: `src/app/pages/tm/components/repository-editor-dialog/repository-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/threats-dialog/threats-dialog.component.html`

- [ ] **Step 1: Apply migration mapping**

Apply to each file. These dialogs are mostly affirmative (Save, Create, Apply); Cancel uses `mat-button`, Primary uses `mat-flat-button color="primary"`, primary gets `cdkFocusInitial`.

`metadata-dialog` has a per-row delete `mat-icon-button` (already action-button compliant per existing pattern — verify `matTooltip` present, that's all).

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`

- [ ] **Step 3: Run unit tests**

Run: `pnpm test -- src/app/pages/tm/components/ 2>&1 | tail -20`
Expected: passes.

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/
git commit -m "refactor: audit threat-model dialog buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Audit Triage Dialogs and Pages

**Files:**
- Modify: `src/app/pages/triage/components/reviewer-assignment-list/reviewer-assignment-list.component.html`
- Modify: `src/app/pages/triage/components/revision-notes-dialog/revision-notes-dialog.component.html`
- Modify: `src/app/pages/triage/components/triage-detail/triage-detail.component.html`
- Modify: `src/app/pages/triage/components/triage-list/triage-list.component.html`
- Modify: `src/app/pages/triage/components/triage-note-editor-dialog/triage-note-editor-dialog.component.html`

- [ ] **Step 1: Apply migration mapping**

For these files (mixed dialogs + list views), apply the mapping. List-view "Create"/"Action" buttons at the top of pages become `mat-flat-button color="primary"`. Cancel buttons in dialogs become `mat-button`. In-row action buttons stay `mat-icon-button` — verify `matTooltip` is present.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`

- [ ] **Step 3: Run unit tests**

Run: `pnpm test -- src/app/pages/triage/ 2>&1 | tail -20`

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/triage/
git commit -m "refactor: audit triage dialog and page buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Audit Admin Pages and Dialogs

**Files:**
- Modify: `src/app/pages/admin/addons/admin-addons.component.html`
- Modify: `src/app/pages/admin/groups/admin-groups.component.html`
- Modify: `src/app/pages/admin/groups/group-members-dialog/group-members-dialog.component.html`
- Modify: `src/app/pages/admin/projects/admin-projects.component.html`
- Modify: `src/app/pages/admin/quotas/add-quota-dialog/add-quota-dialog.component.html`
- Modify: `src/app/pages/admin/quotas/admin-quotas.component.html`
- Modify: `src/app/pages/admin/settings/admin-settings.component.html`
- Modify: `src/app/pages/admin/surveys/admin-surveys.component.html`
- Modify: `src/app/pages/admin/surveys/components/template-builder/template-builder.component.html`
- Modify: `src/app/pages/admin/teams/admin-teams.component.html`
- Modify: `src/app/pages/admin/users/admin-users.component.html`
- Modify: `src/app/pages/admin/webhooks/admin-webhooks.component.html`
- Modify: `src/app/pages/admin/webhooks/hmac-secret-dialog/hmac-secret-dialog.component.html`

- [ ] **Step 1: Apply migration mapping**

Most admin pages have a top-right "Create [thing]" button — becomes `mat-flat-button color="primary"`. Per-row edit/delete buttons stay `mat-icon-button` with `matTooltip`. Admin destructive actions (delete user, revoke webhook) use `color="warn"` on the destructive variant.

Note: `template-builder.component.html` has three `color="warn"` buttons — these are likely destructive primaries; verify per-instance.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`

- [ ] **Step 3: Run unit tests**

Run: `pnpm test -- src/app/pages/admin/ 2>&1 | tail -20`

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/admin/
git commit -m "refactor: audit admin page buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Audit Chat and DFD Pages

**Files:**
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.html`
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.html`
- Modify: `src/app/pages/dfd/presentation/components/data-asset-dialog/data-asset-dialog.component.html`

- [ ] **Step 1: Apply migration mapping**

Chat panel and messages: mostly icon buttons; check `matTooltip` coverage. `chat-session-panel` has a `mat-raised-button` — convert per mapping.

`data-asset-dialog` is a save-or-cancel dialog: standard `[Cancel][Save]` treatment.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`

- [ ] **Step 3: Run unit tests**

Run: `pnpm test -- src/app/pages/chat/ src/app/pages/dfd/ 2>&1 | tail -30`

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/chat/ src/app/pages/dfd/
git commit -m "refactor: audit chat and DFD buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Audit Page-Level Action Bars (Top-Level Pages)

**Files:**
- Modify: `src/app/pages/about/about.component.html`
- Modify: `src/app/pages/dashboard/dashboard.component.html`
- Modify: `src/app/pages/home/home.component.html`
- Modify: `src/app/pages/privacy/privacy.component.html`
- Modify: `src/app/pages/projects/projects.component.html`
- Modify: `src/app/pages/surveys/components/my-responses/my-responses.component.html`
- Modify: `src/app/pages/surveys/components/response-detail/response-detail.component.html`
- Modify: `src/app/pages/surveys/components/survey-fill/survey-fill.component.html`
- Modify: `src/app/pages/surveys/components/survey-list/survey-list.component.html`
- Modify: `src/app/pages/teams/teams.component.html`
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`
- Modify: `src/app/pages/tm/tm-edit.component.html`
- Modify: `src/app/pages/tos/tos.component.html`

- [ ] **Step 1: Apply migration mapping**

Top-level page action bars: prominent CTAs become `mat-flat-button color="primary"`. Static-content pages (about, privacy, tos) usually have a single dismissive button → `mat-button`. The home page's "Get Started" button becomes `mat-flat-button color="primary"`.

**Important:** In `tm-edit.component.html`, do NOT modify the button with `class="timmy-header-button"`. It is the documented exception.

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all 2>&1 | tail -10`

- [ ] **Step 3: Run unit tests**

Run: `pnpm test -- src/app/pages/ 2>&1 | tail -30`
Note: this runs more than the changed files; tests should still pass for unmodified areas.

- [ ] **Step 4: Run build**

Run: `pnpm run build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/about/ src/app/pages/dashboard/ src/app/pages/home/ src/app/pages/privacy/ src/app/pages/projects/ src/app/pages/surveys/ src/app/pages/teams/ src/app/pages/tm/components/threat-page/ src/app/pages/tm/tm-edit.component.html src/app/pages/tos/
git commit -m "refactor: audit page-level action bar buttons (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Sweep for Missed Buttons and matTooltip Gaps

- [ ] **Step 1: Confirm no banned directives remain**

Run: `rg "mat-raised-button|mat-stroked-button|mat-fab|mat-mini-fab" src/app --type html`
Expected: zero hits. If any remain, they were missed — open the file, apply the mapping, and add to a follow-up commit. If you find a button that genuinely needs `mat-raised-button` shadow (you shouldn't), stop and discuss.

- [ ] **Step 2: Confirm all icon buttons have matTooltip OR an explicit aria-label**

Run: `rg -B1 -A3 'mat-icon-button' src/app --type html | rg -B3 -A1 '<button' | rg -L 'matTooltip|attr.aria-label|aria-label'`

This is fuzzy — review the output, but it's normal for the regex to produce some false positives. The goal is to spot any `mat-icon-button` without an accessible label. Fix any real gaps.

- [ ] **Step 3: Confirm no hand-rolled hex colors on buttons**

Run: `rg -B2 'background-color:\s*#|color:\s*#' src/app --type scss | rg -B2 'button'`
Expected: zero hits. Any hit indicates a button with a hard-coded color that needs to move to a theme variable.

- [ ] **Step 4: Run lint + build + full test suite**

```bash
pnpm run lint:all 2>&1 | tail -10
pnpm run build 2>&1 | tail -10
pnpm test 2>&1 | tail -20
```
Expected: all pass.

- [ ] **Step 5: Commit any sweep fixes**

If steps 1-3 produced fixes:

```bash
git add -A
git commit -m "refactor: sweep remaining button cleanup (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

If no fixes needed: skip this step.

---

## Task 10: Visual Regression Pass

- [ ] **Step 1: Run Playwright E2E suite**

Run: `pnpm test:e2e 2>&1 | tail -40`
Expected: most tests pass; visual-regression failures expected for screenshot tests that captured the old button styles.

- [ ] **Step 2: For each visual-regression failure, invoke triage skill**

For each failing screenshot test, invoke the `visual-regression-triage` skill. It will present baseline / actual / diff. Decide per-instance:
- Intentional change (button shape/shadow/color difference) → update the baseline.
- Unexpected regression (layout break, missing element) → fix the underlying issue in the component template/SCSS.

- [ ] **Step 3: Re-run E2E to confirm clean pass**

Run: `pnpm test:e2e 2>&1 | tail -20`
Expected: all pass after baseline updates.

- [ ] **Step 4: Commit baseline updates**

```bash
git add e2e/ tests-e2e/ playwright/
# (use whichever paths Playwright uses in this repo; check `git status`)
git commit -m "test: update visual-regression baselines for button audit (#677)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Manual Smoke Test and Close Issue

- [ ] **Step 1: Start dev server**

Run: `pnpm run dev` (or confirm one is already running on `:4200`).

- [ ] **Step 2: Manual smoke pass in browser**

Visit each of the following in light theme and dark theme. Confirm button visual hierarchy reads correctly (filled = primary action, text = cancel, action buttons round and tooltipped):

- `/` (home — logged out, then logged in)
- `/login` (auth providers + Cancel)
- `/dashboard`
- `/tm` (threat model list)
- `/tm/<some-id>/edit` (open delete-confirmation dialog from the kebab menu)
- `/tm/<some-id>/edit` (open metadata dialog from menu)
- `/dfd/<some-diagram-id>` (DFD editor with icon-button toolbar)
- `/admin/users` (admin page action bar)

If any button looks wrong in any theme, fix it and recommit before proceeding.

- [ ] **Step 3: Open PR**

```bash
gh pr create --title "refactor: standardize button styles to three-variant system (#677)" --body "$(cat <<'EOF'
## Summary

Audits every button in TMI-UX against the three-variant standard (filled / text / action) defined in `.claude/CLAUDE.md`. Removes dead `border-radius` override that was being lost in the CSS cascade. Documents the standard for future code review.

Closes #677

## Changes
- Removed dead `border-radius: 8px` override in `component-overrides.scss`
- Added "Button styles" section to CLAUDE.md (three variants, color rules, dialog ordering, Timmy exception)
- Migrated ~64 `mat-raised-button` and ~32 `mat-stroked-button` usages to `mat-flat-button` (primary affirmative) or `mat-button` (cancel/dismissive)
- Fixed dialog action ordering: `[Cancel] [Primary]` with `cdkFocusInitial` on Primary (or on Cancel when Primary is destructive)
- Updated visual-regression baselines where button styling changed

## Test plan
- [x] `pnpm run lint:all`
- [x] `pnpm run build`
- [x] `pnpm test`
- [x] `pnpm test:e2e`
- [x] Manual smoke in light + dark themes (home, login, dashboard, tm-edit, delete-confirmation, metadata dialog, DFD, admin)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: After PR merges, close issue**

Run: `gh issue comment 677 --repo ericfitz/tmi-ux --body "Closed by PR #<n> (merge commit <sha>)."` (substitute actual PR number and commit SHA from the merged PR), then `gh issue close 677 --repo ericfitz/tmi-ux --reason completed`.

---

## Self-Review

**Spec coverage:**
- Standard (three variants + destructive sub-variant) → Task 1 documents it; Tasks 2-9 enforce it ✓
- Migration mapping → in plan header; applied in every audit task ✓
- Dialog action ordering rule → in plan header; applied in every dialog-touching task ✓
- Theme color rule → in plan header; verified in Task 9 step 3 ✓
- Timmy exception → documented in Task 1's CLAUDE.md text; explicitly excluded in Task 8 step 1 ✓
- Verification (build, tests, E2E, visual regression) → Tasks 9 and 10 ✓
- CLAUDE.md update → Task 1 ✓
- Dead override removal → Task 1 ✓

**Placeholder scan:** No "TBD", "TODO", "handle edge cases". Per-instance judgment is explicit (e.g., destructive vs affirmative dialog focus) with the rule given. ✓

**Type consistency:** N/A (this plan modifies templates and one SCSS file, no new types).

**Notes for executor:**
- Tasks 2-8 are mostly mechanical. The judgment calls are: (a) is this button a primary affirmative or a dismissive? and (b) is it destructive? Use file context (`mat-dialog-title`, action label) to decide.
- Tasks are committable independently; each leaves the codebase in a working state.
