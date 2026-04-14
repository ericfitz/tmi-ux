# Design: Fix #590 — Angular Form Input Timing Race Conditions

**Issue:** #590
**Date:** 2026-04-13
**Status:** Approved

## Problem

Playwright's `pressSequentially()` types characters one at a time. Between keystrokes, Angular's change detection can run and `[value]` bindings overwrite the DOM input value from the (stale) model. Characters get dropped or the entire value resets. This causes ~5% failure rate across the E2E suite, with a different test failing each run.

## Solution — Two Layers

### Layer 1: Shared E2E utility (`angularFill`)

A helper in `e2e/helpers/angular-fill.ts` that uses `evaluate()` to set the input value via the native `HTMLInputElement.prototype.value` setter and dispatch an `input` event — all in a single synchronous browser operation. Angular's change detection cannot interleave. After the evaluate, it verifies the value persisted by reading `inputValue()` and retries once if it didn't stick.

All E2E dialog/page objects that currently use `pressSequentially()` on text inputs migrate to either:

- `angularFill(locator, value)` — for `[value]`/`[(ngModel)]` inputs
- `locator.fill(value)` — for reactive form (`formControlName`) inputs (already works)

### Layer 2: Component-side binding migrations

Migrate the remaining vulnerable `[value]` + handler components to `[(ngModel)]`:

- Permissions dialog subject input
- Teams filter input
- Admin teams filter input

This eliminates the root cause — `[(ngModel)]` keeps the model and DOM in sync on every keystroke, so even if change detection runs, it writes back the correct value.

## Architecture

```
e2e/helpers/angular-fill.ts     ← New shared utility
  └─ angularFill(locator, value, options?)
     - evaluate() with native setter + dispatchEvent('input')
     - optional: verify value persisted, retry once
     - optional: clear existing value first (for edit scenarios)

e2e/dialogs/*.dialog.ts          ← Migrate from pressSequentially()
e2e/pages/*.page.ts              ← Migrate from pressSequentially()
e2e/helpers/field-interactions.ts ← Migrate from pressSequentially()

src/app/.../permissions-dialog/  ← [value] → [(ngModel)]
src/app/.../teams.component.html ← [value] → [(ngModel)]
src/app/.../admin-teams.component.html ← [value] → [(ngModel)]
```

## `angularFill` API

```typescript
/**
 * Sets an input value atomically, bypassing Angular's change detection
 * race condition with Playwright's keystroke-based input methods.
 *
 * Use for [value], [(ngModel)], or any input where pressSequentially()
 * drops characters. For formControlName inputs, use Playwright's fill().
 */
async function angularFill(
  locator: Locator,
  value: string,
  options?: { clear?: boolean }  // default true
): Promise<void>
```

Implementation:

1. `locator.waitFor({ state: 'visible' })`
2. If `clear` (default), select all first via `locator.click({ clickCount: 3 })`
3. `locator.evaluate()` — native setter + `dispatchEvent('input', { bubbles: true })`
4. Verify: `locator.inputValue()` === `value`, retry once if not

## Component Migrations

### Permissions dialog

The subject input uses `[value]="getSubjectValue(auth)"` with a `_subject` cache. Migration:

- Add `FormsModule` to imports
- Replace `[value]="getSubjectValue(auth)"` + `(input)="updatePermissionSubject(i, $event)"` with `[(ngModel)]="auth._subject"` (or equivalent model property)
- Remove the `getSubjectValue()` getter and update `updatePermissionSubject()` to work with ngModel

### Teams/Admin teams filter

Simple filter input. Migration:

- Add `FormsModule` to imports (if not present)
- Replace `[value]="filterText"` + `(input)="onFilterChange($event)"` with `[(ngModel)]="filterText"` + `(ngModelChange)="onFilterChange($event)"`

## E2E Migration Scope

Files to update (replace `pressSequentially()` with appropriate method):

| File | Inputs | Binding Type | Action |
|------|--------|-------------|--------|
| `permissions.dialog.ts` | subject | `[(ngModel)]` after fix | `angularFill()` |
| `delete-confirm.dialog.ts` | confirm text | `[(ngModel)]` | Already uses `evaluate()` — refactor to use shared `angularFill()` |
| `asset-editor.dialog.ts` | name, description, criticality, sensitivity | `formControlName` | `fill()` |
| `document-editor.dialog.ts` | name, URI, description | `formControlName` | `fill()` |
| `threat-editor.dialog.ts` | name, description | `formControlName` | `fill()` |
| `repository-editor.dialog.ts` | name, desc, URI, ref-value, subpath | `formControlName` | `fill()` |
| `create-tm.dialog.ts` | name, description | `formControlName` | `fill()` |
| `create-diagram.dialog.ts` | name | `formControlName` | `fill()` |
| `cwe-picker.dialog.ts` | search | `formControlName` | `fill()` |
| `note-page.page.ts` | name, description, content | `formControlName` | `fill()` |
| `note.flow.ts` | name, content (create dialog) | `formControlName` | `fill()` |
| `field-interactions.ts` | generic text/textarea | mixed | `fill()` for reactive, `angularFill()` for others |
| `metadata.dialog.ts` | key, value | `[value]` + `(input)` | Already uses `fill()` — keep as-is |

## Testing Strategy

- Run `pnpm test:e2e:workflows` with `--repeat-each 5` on the child-entity-crud suite to verify flakiness is eliminated
- Run full workflow suite to check for regressions
- Run unit tests for migrated components (permissions dialog, teams)
- Build verification

## What This Does NOT Fix

- Mat-menu animation detach issues (already fixed in b040dc0c with `dispatchEvent('click')`)
- CWE picker timeout (separate issue — likely server latency)
- Any server-side bugs
