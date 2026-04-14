# Fix #590: Angular Form Input Timing Race Conditions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate E2E flaky failures caused by Angular's change detection racing with Playwright's keystroke-based input methods.

**Architecture:** Create a shared `angularFill()` utility that sets input values atomically via `evaluate()`, then migrate all E2E helpers from `pressSequentially()` to either `angularFill()` (for `[value]`/`[(ngModel)]` inputs) or `fill()` (for reactive form inputs). Simultaneously migrate three component templates from the vulnerable `[value]` + handler pattern to `[(ngModel)]`.

**Tech Stack:** Playwright, Angular 19, Angular Material

**Spec:** `docs/superpowers/specs/2026-04-13-e2e-angular-fill-utility-design.md`

---

### Task 1: Create the `angularFill` shared utility

**Files:**
- Create: `e2e/helpers/angular-fill.ts`

- [ ] **Step 1: Create `e2e/helpers/angular-fill.ts`**

```typescript
import { Locator } from '@playwright/test';

/**
 * Sets an input value atomically, bypassing Angular's change detection
 * race condition with Playwright's keystroke-based input methods.
 *
 * Uses evaluate() to set the value via the native HTMLInputElement.prototype.value
 * setter and dispatch an input event in a single synchronous browser operation.
 * Angular's change detection cannot interleave.
 *
 * Use for [value], [(ngModel)], or any input where pressSequentially() drops
 * characters. For formControlName inputs, use Playwright's fill() instead.
 *
 * @param locator - Playwright locator for the input element
 * @param value - The value to set
 * @param options - Optional settings
 * @param options.clear - Whether to clear existing value first (default: true)
 */
export async function angularFill(
  locator: Locator,
  value: string,
  options?: { clear?: boolean },
): Promise<void> {
  const clear = options?.clear ?? true;

  await locator.waitFor({ state: 'visible' });

  if (clear) {
    // Select all existing text so the new value replaces it
    await locator.click({ clickCount: 3 });
  }

  // Set value and dispatch input event atomically within a single
  // synchronous browser operation. Angular's change detection cannot
  // run between setting the value and dispatching the event.
  await locator.evaluate((el, val) => {
    const input = el as HTMLInputElement;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    nativeSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);

  // Verify the value persisted after Angular's change detection cycle.
  // If [value] binding overwrote it, retry once.
  const actual = await locator.inputValue();
  if (actual !== value) {
    await locator.evaluate((el, val) => {
      const input = el as HTMLInputElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )!.set!;
      nativeSetter.call(input, val);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/angular-fill.ts
git commit -m "feat(e2e): add angularFill shared utility for atomic input value setting (#590)"
```

---

### Task 2: Migrate permissions dialog component to `[(ngModel)]`

**Files:**
- Modify: `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts:195-202` (template — subject input)
- Modify: `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts:640-678` (getSubjectValue, updatePermissionSubject)

- [ ] **Step 1: Update the subject input template binding**

In `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts`, find the subject input in the inline template (around line 195):

```html
                      <input
                        matInput
                        data-testid="permissions-subject-input"
                        [value]="getSubjectValue(auth)"
                        (input)="updatePermissionSubject(i, $event)"
                        [placeholder]="getSubjectPlaceholder(auth)"
                        [attr.tabindex]="i * 5 + 3"
                      />
```

Replace with:

```html
                      <input
                        matInput
                        data-testid="permissions-subject-input"
                        [(ngModel)]="auth._subject"
                        [placeholder]="getSubjectPlaceholder(auth)"
                        [attr.tabindex]="i * 5 + 3"
                      />
```

- [ ] **Step 2: Initialize `_subject` when building the data source**

Find the method that populates `permissionsDataSource.data` with permission entries. Each `Authorization` object needs `_subject` initialized from `email || provider_id` so that `[(ngModel)]` has a value to bind.

Search for where permissions are loaded into the data source (look for `permissionsDataSource.data =`). At each location, ensure the authorization objects have `_subject` set:

```typescript
// When initializing the data source (in ngOnInit or constructor):
this.permissionsDataSource.data = this.data.permissions.map(auth => ({
  ...auth,
  _subject: auth.email || auth.provider_id,
}));
```

If there's an `addPermission()` method that adds a new row, ensure it also sets `_subject: ''`:

```typescript
const newAuth: AuthorizationWithSubject = {
  // ... existing fields
  _subject: '',
};
```

- [ ] **Step 3: Clean up `getSubjectValue()` and `updatePermissionSubject()`**

`getSubjectValue()` (line ~645) is no longer needed in the template since `[(ngModel)]` binds directly to `auth._subject`. However, it's still used in the read-only `@if` block (line ~206: `{{ getSubjectValue(auth) }}`). Simplify it to just return `auth._subject`:

```typescript
  getSubjectValue(auth: Authorization): string {
    return (auth as AuthorizationWithSubject)._subject ?? auth.email ?? auth.provider_id ?? '';
  }
```

Remove `updatePermissionSubject()` entirely — `[(ngModel)]` handles the binding automatically.

- [ ] **Step 4: Build and run unit tests**

```bash
pnpm run build
pnpm test -- --run
```

Expected: Build succeeds, all 4502+ unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts
git commit -m "fix: migrate permissions dialog subject input from [value] to [(ngModel)] (#590)"
```

---

### Task 3: Migrate teams filter inputs to `[(ngModel)]`

**Files:**
- Modify: `src/app/pages/teams/teams.component.html:20`
- Modify: `src/app/pages/admin/teams/admin-teams.component.html:20`
- Modify: `src/app/pages/teams/teams.component.ts:121` (onFilterChange signature)
- Modify: `src/app/pages/admin/teams/admin-teams.component.ts:122` (onFilterChange signature)

- [ ] **Step 1: Update teams filter input**

In `src/app/pages/teams/teams.component.html`, line 20, replace:

```html
        <input matInput [value]="filterText" (input)="onFilterChange($any($event.target).value)" />
```

with:

```html
        <input matInput [(ngModel)]="filterText" (ngModelChange)="onFilterChange($event)" />
```

- [ ] **Step 2: Update admin teams filter input**

In `src/app/pages/admin/teams/admin-teams.component.html`, line 20, replace:

```html
        <input matInput [value]="filterText" (input)="onFilterChange($any($event.target).value)" />
```

with:

```html
        <input matInput [(ngModel)]="filterText" (ngModelChange)="onFilterChange($event)" />
```

- [ ] **Step 3: Update `onFilterChange` signatures**

Both `teams.component.ts` and `admin-teams.component.ts` have `onFilterChange(value: string)` — these already accept a string, so `(ngModelChange)="onFilterChange($event)"` passes the string value directly. No signature change needed, but verify they compile.

- [ ] **Step 4: Build and run unit tests**

```bash
pnpm run build
pnpm test -- --run
```

Expected: Build succeeds, all unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/teams/teams.component.html src/app/pages/admin/teams/admin-teams.component.html
git commit -m "fix: migrate teams filter inputs from [value] to [(ngModel)] (#590)"
```

---

### Task 4: Migrate E2E dialog helpers from `pressSequentially()` to `fill()`

These dialogs all use reactive form (`formControlName`) inputs, so Playwright's `fill()` is the correct replacement.

**Files:**
- Modify: `e2e/dialogs/asset-editor.dialog.ts`
- Modify: `e2e/dialogs/document-editor.dialog.ts`
- Modify: `e2e/dialogs/threat-editor.dialog.ts`
- Modify: `e2e/dialogs/repository-editor.dialog.ts`
- Modify: `e2e/dialogs/create-tm.dialog.ts`
- Modify: `e2e/dialogs/create-diagram.dialog.ts`
- Modify: `e2e/dialogs/cwe-picker.dialog.ts`

- [ ] **Step 1: Migrate `asset-editor.dialog.ts`**

Replace all `pressSequentially()` calls with `fill()`:

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async fillCriticality(value: string) {
    await this.criticalityInput().fill(value);
  }

  async fillSensitivity(value: string) {
    await this.sensitivityInput().fill(value);
  }
```

- [ ] **Step 2: Migrate `document-editor.dialog.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }
```

- [ ] **Step 3: Migrate `threat-editor.dialog.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }
```

- [ ] **Step 4: Migrate `repository-editor.dialog.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillRefValue(value: string) {
    await this.refValueInput().fill(value);
  }

  async fillSubPath(path: string) {
    await this.subPathInput().fill(path);
  }
```

- [ ] **Step 5: Migrate `create-tm.dialog.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }
```

- [ ] **Step 6: Migrate `create-diagram.dialog.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }
```

- [ ] **Step 7: Migrate `cwe-picker.dialog.ts`**

```typescript
  async search(term: string) {
    await this.searchInput().waitFor({ state: 'visible' });
    await this.searchInput().fill(term);
    // Wait for search results to update
    await this.dialog.page().waitForTimeout(500);
  }
```

- [ ] **Step 8: Commit**

```bash
git add e2e/dialogs/asset-editor.dialog.ts e2e/dialogs/document-editor.dialog.ts e2e/dialogs/threat-editor.dialog.ts e2e/dialogs/repository-editor.dialog.ts e2e/dialogs/create-tm.dialog.ts e2e/dialogs/create-diagram.dialog.ts e2e/dialogs/cwe-picker.dialog.ts
git commit -m "fix(e2e): migrate reactive form dialog helpers from pressSequentially() to fill() (#590)"
```

---

### Task 5: Migrate E2E page objects and flows from `pressSequentially()` to `fill()`

**Files:**
- Modify: `e2e/pages/note-page.page.ts`
- Modify: `e2e/flows/note.flow.ts`

- [ ] **Step 1: Migrate `note-page.page.ts`**

```typescript
  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async fillContent(content: string) {
    // Switch to edit mode if the content textarea is not visible (preview mode)
    if (!(await this.contentTextarea().isVisible())) {
      await this.page
        .locator('button')
        .filter({ has: this.page.locator('mat-icon:has-text("edit_note")') })
        .click();
      await this.contentTextarea().waitFor({ state: 'visible', timeout: 5000 });
    }
    await this.contentTextarea().fill(content);
  }
```

- [ ] **Step 2: Migrate `note.flow.ts` — `createFromTmEdit`**

In `e2e/flows/note.flow.ts`, update `createFromTmEdit` to use `fill()` for the reactive form inputs:

```typescript
  async createFromTmEdit(name: string, content = 'E2E test note content') {
    const addButton = this.page.getByTestId('add-note-button');
    await addButton.scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await addButton.click();
    // Note creation opens a dialog (not a route navigation)
    const dialog = this.page.locator('mat-dialog-container');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });
    const nameInput = dialog.locator('input[formcontrolname="name"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(name);
    // Content is required
    const contentInput = dialog.locator('textarea[formcontrolname="content"]');
    await contentInput.fill(content);
    // Click "Save and Close" to create and dismiss the dialog
    const saveButton = dialog.locator('button').filter({ hasText: 'Save and Close' });
    await saveButton.click();
    await dialog.waitFor({ state: 'hidden', timeout: 10000 });
  }
```

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/note-page.page.ts e2e/flows/note.flow.ts
git commit -m "fix(e2e): migrate note page/flow from pressSequentially() to fill() (#590)"
```

---

### Task 6: Migrate `field-interactions.ts` and remaining helpers to `fill()`

**Files:**
- Modify: `e2e/helpers/field-interactions.ts`

- [ ] **Step 1: Migrate `editField` in `field-interactions.ts`**

In `e2e/helpers/field-interactions.ts`, update the `text`/`textarea` case in `editField()`:

```typescript
    case 'text':
    case 'textarea':
      await locator.fill(newValue as string);
      break;
```

This replaces the current `clear()` + `pressSequentially()` pattern (lines 35-36).

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/field-interactions.ts
git commit -m "fix(e2e): migrate field-interactions from pressSequentially() to fill() (#590)"
```

---

### Task 7: Migrate `permissions.dialog.ts` to use `angularFill()`

**Files:**
- Modify: `e2e/dialogs/permissions.dialog.ts`

- [ ] **Step 1: Update `addPermission` to use `angularFill()`**

Replace the `pressSequentially()` + `dispatchEvent('input')` pattern with `angularFill()`:

```typescript
import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class PermissionsDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly addButton = () => this.dialog.getByTestId('permissions-add-button');
  readonly saveButton = () => this.dialog.getByTestId('permissions-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('permissions-cancel-button');
  readonly typeSelects = () => this.dialog.getByTestId('permissions-type-select');
  readonly providerSelects = () => this.dialog.getByTestId('permissions-provider-select');
  readonly subjectInputs = () => this.dialog.getByTestId('permissions-subject-input');
  readonly roleSelects = () => this.dialog.getByTestId('permissions-role-select');
  readonly deleteButtons = () => this.dialog.getByTestId('permissions-delete-button');
  readonly setOwnerButtons = () => this.dialog.getByTestId('permissions-set-owner-button');
  readonly rows = () => this.dialog.locator('tr.mat-mdc-row');

  typeSelect(index: number): Locator {
    return this.typeSelects().nth(index);
  }

  providerSelect(index: number): Locator {
    return this.providerSelects().nth(index);
  }

  subjectInput(index: number): Locator {
    return this.subjectInputs().nth(index);
  }

  roleSelect(index: number): Locator {
    return this.roleSelects().nth(index);
  }

  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  async addPermission(type: string, provider: string, subject: string, role: string) {
    await this.addButton().click();
    // Wait for the new row to appear in the table
    await this.page.waitForTimeout(500);
    const lastIndex = (await this.typeSelects().count()) - 1;

    // Select provider before type — provider selection may auto-constrain principal_type
    await this.providerSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: new RegExp(`^.*${provider}$`) }).click();

    await this.typeSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();

    await angularFill(this.subjectInput(lastIndex), subject);

    await this.roleSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: role }).click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/dialogs/permissions.dialog.ts
git commit -m "fix(e2e): migrate permissions dialog to angularFill() (#590)"
```

---

### Task 8: Refactor `delete-confirm.dialog.ts` to use `angularFill()`

**Files:**
- Modify: `e2e/dialogs/delete-confirm.dialog.ts`

- [ ] **Step 1: Replace inline `evaluate()` with `angularFill()`**

```typescript
import { expect, Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class DeleteConfirmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly confirmInput = () => this.dialog.getByTestId('delete-confirm-input');
  readonly confirmButton = () => this.dialog.getByTestId('delete-confirm-button');

  async confirmDeletion() {
    await this.confirmButton().waitFor({ state: 'visible' });
    // Typed confirmation is only required for some object types (not documents/repositories).
    // The input renders inside an @if block that may take an extra change detection cycle,
    // so we wait for it rather than using an instant isVisible() check.
    try {
      await this.confirmInput().waitFor({ state: 'visible', timeout: 2000 });
      await angularFill(this.confirmInput(), 'gone forever');
    } catch {
      // Input not present — typed confirmation not required for this object type
    }
    await expect(this.confirmButton()).toBeEnabled({ timeout: 5000 });
    await this.confirmButton().click();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/dialogs/delete-confirm.dialog.ts
git commit -m "refactor(e2e): use shared angularFill() in delete-confirm dialog (#590)"
```

---

### Task 9: Lint, build, and verify

**Files:** None (verification only)

- [ ] **Step 1: Lint**

```bash
pnpm run lint:all
```

Expected: No errors.

- [ ] **Step 2: Build**

```bash
pnpm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run unit tests**

```bash
pnpm test -- --run
```

Expected: All 4502+ unit tests pass.

- [ ] **Step 4: Run E2E workflow tests**

```bash
pnpm test:e2e:workflows
```

Expected: 50-51/51 pass. Any remaining failures should be unrelated to input timing (e.g., CWE picker timeout).

- [ ] **Step 5: Run child entity CRUD with repeat to verify flakiness is eliminated**

```bash
npx playwright test --project=workflows -g "Child Entity CRUD" --repeat-each 5
```

Expected: 30/30 pass (6 tests × 5 repeats). Zero flaky failures from input timing.

- [ ] **Step 6: Run full E2E suite**

```bash
pnpm test:e2e
```

Expected: All projects pass with no input-related flaky failures.

---

### Task 10: Verify no remaining `pressSequentially()` calls

**Files:** None (verification only)

- [ ] **Step 1: Search for any remaining `pressSequentially()` usage**

```bash
grep -r "pressSequentially" e2e/
```

Expected: Zero results. All `pressSequentially()` calls should be migrated.

If any remain, evaluate whether they need `fill()` or `angularFill()` and update accordingly.

- [ ] **Step 2: Final commit (if any cleanup was needed)**

```bash
git add -A
git commit -m "chore(e2e): remove remaining pressSequentially() usage (#590)"
```
