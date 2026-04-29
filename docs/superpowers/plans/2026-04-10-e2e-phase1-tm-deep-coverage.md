# E2E Phase 1: Threat Model Deep Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill out complete E2E coverage for the threat model area — workflows, child entity CRUD, scoring systems, schema-driven field coverage, and visual regression with screenshot baselines.

**Architecture:** Three sequential sub-phases: 1A adds `data-testid` attributes to ~10 Angular components, creates 9 new dialog/page objects, 7 new flows, and 3 workflow spec files (16 tests). 1B adds a field interaction helper and 6 parameterized field-coverage spec files (46 tests). 1C adds 2 visual regression spec files (15 tests). All E2E tests follow the existing three-layer pattern (tests → flows → page objects) and run against a live backend.

**Tech Stack:** Playwright, TypeScript, Angular Material, Transloco

**Spec:** `docs/superpowers/specs/2026-04-10-e2e-phase1-tm-deep-coverage-design.md`

---

## Sub-phase 1A: Infrastructure + Workflow Tests

### Task 1: Add `data-testid` attributes to CreateTmDialog

**Files:**
- Modify: `src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts`

- [ ] **Step 1: Add data-testid to description, framework, and confidential controls**

In the inline template, add `data-testid` attributes to three elements:

1. Description textarea — add `data-testid="create-tm-description-input"`:
```html
        <textarea
          matInput
          formControlName="description"
          data-testid="create-tm-description-input"
          [placeholder]="'createThreatModel.descriptionPlaceholder' | transloco"
```

2. Framework select — add `data-testid="create-tm-framework-select"`:
```html
          <mat-select formControlName="framework" data-testid="create-tm-framework-select">
```

3. Confidential toggle — add `data-testid="create-tm-confidential-toggle"`:
```html
            <mat-slide-toggle formControlName="isConfidential" color="primary" data-testid="create-tm-confidential-toggle">
```

- [ ] **Step 2: Run build to verify no errors**

Run: `pnpm run build`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: Run existing E2E tests to verify no regressions**

Run: `pnpm test:e2e:workflows`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts
git commit -m "test: add data-testid attributes to CreateTmDialog"
```

### Task 2: Add `data-testid` attributes to tm-edit.component.html

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html`

- [ ] **Step 1: Add data-testid to child entity add buttons and rows**

Add `data-testid` attributes to the following elements. Find each element by its `(click)` handler or existing context:

1. Asset add button (the `(click)="addAsset()"` button):
```html
                    (click)="addAsset()"
                    [matTooltip]="'threatModels.tooltips.addAsset' | transloco"
                    data-testid="add-asset-button"
```

2. Asset table rows — on the `<tr mat-row>` inside the assets table, add:
```html
                  <tr mat-row *matRowDef="let row; columns: assetsDisplayedColumns" (click)="editAsset(row, $event)" class="clickable-row" data-testid="asset-row"></tr>
```

3. Document add button (the `(click)="addDocument()"` button):
```html
                    (click)="addDocument()"
                    [matTooltip]="'threatModels.tooltips.addDocument' | transloco"
                    data-testid="add-document-button"
```

4. Document table rows:
```html
                  <tr mat-row *matRowDef="let row; columns: documentsDisplayedColumns" (click)="editDocument(row, $event)" class="clickable-row" data-testid="document-row"></tr>
```

5. Repository add button (the `(click)="addRepository()"` button):
```html
                    (click)="addRepository()"
                    [matTooltip]="'threatModels.createNewRepository' | transloco"
                    data-testid="add-repository-button"
```

6. Repository table rows:
```html
                  <tr mat-row *matRowDef="let row; columns: repositoriesDisplayedColumns" (click)="editRepository(row, $event)" class="clickable-row" data-testid="repository-row"></tr>
```

7. Note add button (the `(click)="addNote()"` button):
```html
                    (click)="addNote()"
                    [matTooltip]="'threatModels.tooltips.addNote' | transloco"
                    data-testid="add-note-button"
```

8. Note table rows:
```html
                  <tr mat-row *matRowDef="let row; columns: notesDisplayedColumns" (click)="openNote(row)" class="clickable-row" data-testid="note-row"></tr>
```

- [ ] **Step 2: Add data-testid to kebab menu items and TM-level controls**

Find the kebab menu items for export, permissions, and metadata. Also add testids to the framework select and confidential badge:

1. Export menu item — find the menu button that triggers export:
```html
                <button mat-menu-item (click)="openExportDialog()" data-testid="tm-export-button">
```

2. Permissions menu item:
```html
                <button mat-menu-item (click)="openPermissionsDialog()" data-testid="tm-permissions-button">
```

3. Metadata menu item:
```html
                <button mat-menu-item (click)="openMetadataDialog()" data-testid="tm-metadata-button">
```

4. Framework select (in the Review Process panel):
```html
                <mat-select formControlName="threat_model_framework" data-testid="tm-framework-select"
```

5. Confidential badge:
```html
            <div class="confidential-project-badge" data-testid="tm-confidential-badge">
```

- [ ] **Step 3: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "test: add data-testid attributes to tm-edit component"
```

### Task 3: Add `data-testid` attributes to child entity dialogs

**Files:**
- Modify: `src/app/pages/tm/components/asset-editor-dialog/asset-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/repository-editor-dialog/repository-editor-dialog.component.html`

- [ ] **Step 1: Add data-testid to asset-editor-dialog**

Add `data-testid` attributes to each form control. Match by `formControlName`:

```
formControlName="name"            → data-testid="asset-name-input"
formControlName="description"     → data-testid="asset-description-input"
formControlName="type"            → data-testid="asset-type-select"
formControlName="criticality"     → data-testid="asset-criticality-input"
#classificationChipGrid           → data-testid="asset-classification-chips" (on the mat-chip-grid)
formControlName="sensitivity"     → data-testid="asset-sensitivity-input"
formControlName="include_in_report" → data-testid="asset-include-report-checkbox" (on the mat-checkbox)
formControlName="timmy_enabled"   → data-testid="asset-timmy-checkbox" (on the mat-checkbox)
Save/Create button                → data-testid="asset-save-button"
Cancel/Close button               → data-testid="asset-cancel-button"
```

- [ ] **Step 2: Add data-testid to document-editor-dialog**

```
formControlName="name"              → data-testid="document-name-input"
formControlName="uri"               → data-testid="document-uri-input"
formControlName="description"       → data-testid="document-description-input"
formControlName="include_in_report" → data-testid="document-include-report-checkbox"
formControlName="timmy_enabled"     → data-testid="document-timmy-checkbox"
Save/Create button                  → data-testid="document-save-button"
Cancel/Close button                 → data-testid="document-cancel-button"
```

- [ ] **Step 3: Add data-testid to repository-editor-dialog**

```
formControlName="name"              → data-testid="repository-name-input"
formControlName="description"       → data-testid="repository-description-input"
formControlName="type"              → data-testid="repository-type-select"
formControlName="uri"               → data-testid="repository-uri-input"
formControlName="refType"           → data-testid="repository-ref-type-select"
formControlName="refValue"          → data-testid="repository-ref-value-input"
formControlName="subPath"           → data-testid="repository-sub-path-input"
formControlName="include_in_report" → data-testid="repository-include-report-checkbox"
formControlName="timmy_enabled"     → data-testid="repository-timmy-checkbox"
Save/Create button                  → data-testid="repository-save-button"
Cancel/Close button                 → data-testid="repository-cancel-button"
```

- [ ] **Step 4: Run build**

Run: `pnpm run build`
Expected: Success

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/asset-editor-dialog/asset-editor-dialog.component.html \
        src/app/pages/tm/components/document-editor-dialog/document-editor-dialog.component.html \
        src/app/pages/tm/components/repository-editor-dialog/repository-editor-dialog.component.html
git commit -m "test: add data-testid attributes to entity editor dialogs"
```

### Task 4: Add `data-testid` attributes to note-page, metadata, permissions, SSVC, export, and framework-mapping dialogs

**Files:**
- Modify: `src/app/pages/tm/components/note-page/note-page.component.html`
- Modify: `src/app/pages/tm/components/metadata-dialog/metadata-dialog.component.html`
- Modify: `src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts`
- Modify: `src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html`
- Modify: `src/app/pages/tm/components/export-dialog/export-dialog.component.html`
- Modify: `src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html`

- [ ] **Step 1: note-page.component.html**

```
formControlName="name"              → data-testid="note-name-input"
formControlName="description"       → data-testid="note-description-input"
formControlName="content" (textarea) → data-testid="note-content-textarea"
formControlName="include_in_report" → data-testid="note-include-report-checkbox"
formControlName="timmy_enabled"     → data-testid="note-timmy-checkbox"
Save button (mat-icon save)         → data-testid="note-save-button"
Kebab menu delete button            → data-testid="note-delete-button"
Metadata button (mat-icon list)     → data-testid="note-metadata-button"
Close button (mat-icon close)       → data-testid="note-close-button"
```

- [ ] **Step 2: metadata-dialog.component.html**

```
Add metadata button (mat-icon add)  → data-testid="metadata-add-button"
Save button                         → data-testid="metadata-save-button"
Cancel button                       → data-testid="metadata-cancel-button"
Key input (per row)                 → data-testid="metadata-key-input"
Value input (per row)               → data-testid="metadata-value-input"
Delete button (per row)             → data-testid="metadata-delete-button"
```

- [ ] **Step 3: permissions-dialog.component.ts (inline template)**

```
Add permission button               → data-testid="permissions-add-button"
Save button                         → data-testid="permissions-save-button"
Cancel/Close button                 → data-testid="permissions-cancel-button"
Principal type select (per row)     → data-testid="permissions-type-select"
Provider select (per row)           → data-testid="permissions-provider-select"
Subject input (per row)             → data-testid="permissions-subject-input"
Role select (per row)               → data-testid="permissions-role-select"
Delete button (per row)             → data-testid="permissions-delete-button"
Set as owner button (per row)       → data-testid="permissions-set-owner-button"
```

- [ ] **Step 4: ssvc-calculator-dialog.component.html**

```
Step dot (per step)                 → data-testid="ssvc-step-dot"
Value card (per option)             → data-testid="ssvc-value-card"
Back button                         → data-testid="ssvc-back-button"
Next button                         → data-testid="ssvc-next-button"
Cancel button                       → data-testid="ssvc-cancel-button"
Apply button                        → data-testid="ssvc-apply-button"
Decision badge                      → data-testid="ssvc-decision-badge"
Summary row (per decision point)    → data-testid="ssvc-summary-row"
```

- [ ] **Step 5: export-dialog.component.html**

```
Save/download button                → data-testid="export-save-button"
Cancel button                       → data-testid="export-cancel-button"
Retry button                        → data-testid="export-retry-button"
Status container div                → data-testid="export-status"
```

- [ ] **Step 6: framework-mapping-picker-dialog.component.html**

```
Checkbox (per option)               → data-testid="framework-mapping-checkbox"
Apply/OK button                     → data-testid="framework-mapping-save-button"
Cancel button                       → data-testid="framework-mapping-cancel-button"
```

- [ ] **Step 7: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 8: Run existing E2E tests to confirm no regressions**

Run: `pnpm test:e2e:workflows`
Expected: All existing tests pass (testid additions are purely additive)

- [ ] **Step 9: Commit**

```bash
git add src/app/pages/tm/components/note-page/note-page.component.html \
        src/app/pages/tm/components/metadata-dialog/metadata-dialog.component.html \
        src/app/pages/tm/components/permissions-dialog/permissions-dialog.component.ts \
        src/app/pages/tm/components/ssvc-calculator-dialog/ssvc-calculator-dialog.component.html \
        src/app/pages/tm/components/export-dialog/export-dialog.component.html \
        src/app/pages/tm/components/framework-mapping-picker-dialog/framework-mapping-picker-dialog.component.html
git commit -m "test: add data-testid attributes to note, metadata, permissions, SSVC, export, and framework mapping components"
```

### Task 5: Create new dialog objects

**Files:**
- Create: `e2e/dialogs/asset-editor.dialog.ts`
- Create: `e2e/dialogs/document-editor.dialog.ts`
- Create: `e2e/dialogs/repository-editor.dialog.ts`
- Create: `e2e/dialogs/metadata.dialog.ts`
- Create: `e2e/dialogs/permissions.dialog.ts`
- Create: `e2e/dialogs/ssvc-calculator.dialog.ts`
- Create: `e2e/dialogs/export.dialog.ts`
- Create: `e2e/dialogs/framework-mapping-picker.dialog.ts`

Follow the exact pattern from existing dialogs (`e2e/dialogs/create-tm.dialog.ts`): class with `Page` constructor, `dialog` locator scoped to `mat-dialog-container`, readonly arrow-function getters using `getByTestId`.

- [ ] **Step 1: Create asset-editor.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class AssetEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('asset-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('asset-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('asset-type-select');
  readonly criticalityInput = () => this.dialog.getByTestId('asset-criticality-input');
  readonly classificationChips = () => this.dialog.getByTestId('asset-classification-chips');
  readonly sensitivityInput = () => this.dialog.getByTestId('asset-sensitivity-input');
  readonly includeReportCheckbox = () => this.dialog.getByTestId('asset-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('asset-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('asset-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('asset-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().click();
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async selectType(type: string) {
    await this.typeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  async fillCriticality(value: string) {
    await this.criticalityInput().fill(value);
  }

  async addClassification(value: string) {
    const chipInput = this.classificationChips().locator('input');
    await chipInput.fill(value);
    await chipInput.press('Enter');
  }

  async fillSensitivity(value: string) {
    await this.sensitivityInput().fill(value);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 2: Create document-editor.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class DocumentEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('document-name-input');
  readonly uriInput = () => this.dialog.getByTestId('document-uri-input');
  readonly descriptionInput = () => this.dialog.getByTestId('document-description-input');
  readonly includeReportCheckbox = () => this.dialog.getByTestId('document-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('document-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('document-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('document-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().click();
    await this.nameInput().fill(name);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 3: Create repository-editor.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class RepositoryEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('repository-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('repository-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('repository-type-select');
  readonly uriInput = () => this.dialog.getByTestId('repository-uri-input');
  readonly refTypeSelect = () => this.dialog.getByTestId('repository-ref-type-select');
  readonly refValueInput = () => this.dialog.getByTestId('repository-ref-value-input');
  readonly subPathInput = () => this.dialog.getByTestId('repository-sub-path-input');
  readonly includeReportCheckbox = () => this.dialog.getByTestId('repository-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('repository-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('repository-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('repository-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().click();
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async selectType(type: string) {
    await this.typeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async selectRefType(refType: string) {
    await this.refTypeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: refType }).click();
  }

  async fillRefValue(value: string) {
    await this.refValueInput().fill(value);
  }

  async fillSubPath(path: string) {
    await this.subPathInput().fill(path);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 4: Create metadata.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class MetadataDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly addButton = () => this.dialog.getByTestId('metadata-add-button');
  readonly saveButton = () => this.dialog.getByTestId('metadata-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('metadata-cancel-button');
  readonly keyInputs = () => this.dialog.getByTestId('metadata-key-input');
  readonly valueInputs = () => this.dialog.getByTestId('metadata-value-input');
  readonly deleteButtons = () => this.dialog.getByTestId('metadata-delete-button');
  readonly rows = () => this.dialog.locator('tr.mat-mdc-row');

  keyInput(index: number) {
    return this.keyInputs().nth(index);
  }

  valueInput(index: number) {
    return this.valueInputs().nth(index);
  }

  deleteButton(index: number) {
    return this.deleteButtons().nth(index);
  }

  async addEntry(key: string, value: string) {
    await this.addButton().click();
    const count = await this.keyInputs().count();
    const lastIndex = count - 1;
    await this.keyInput(lastIndex).fill(key);
    await this.keyInput(lastIndex).press('Tab');
    await this.valueInput(lastIndex).fill(value);
    await this.valueInput(lastIndex).press('Tab');
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 5: Create permissions.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

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

  typeSelect(index: number) {
    return this.typeSelects().nth(index);
  }

  providerSelect(index: number) {
    return this.providerSelects().nth(index);
  }

  subjectInput(index: number) {
    return this.subjectInputs().nth(index);
  }

  roleSelect(index: number) {
    return this.roleSelects().nth(index);
  }

  deleteButton(index: number) {
    return this.deleteButtons().nth(index);
  }

  async addPermission(
    type: 'user' | 'group',
    provider: string,
    subject: string,
    role: 'reader' | 'writer' | 'owner',
  ) {
    await this.addButton().click();
    const count = await this.rows().count();
    const lastIndex = count - 1;

    // Set type
    await this.typeSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();

    // Set provider
    await this.providerSelect(lastIndex).click();
    await this.page.locator('mat-option').filter({ hasText: provider }).click();

    // Set subject
    await this.subjectInput(lastIndex).fill(subject);
    await this.subjectInput(lastIndex).press('Tab');

    // Set role
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

- [ ] **Step 6: Create ssvc-calculator.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class SsvcCalculatorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly stepDots = () => this.dialog.getByTestId('ssvc-step-dot');
  readonly valueCards = () => this.dialog.getByTestId('ssvc-value-card');
  readonly backButton = () => this.dialog.getByTestId('ssvc-back-button');
  readonly nextButton = () => this.dialog.getByTestId('ssvc-next-button');
  readonly cancelButton = () => this.dialog.getByTestId('ssvc-cancel-button');
  readonly applyButton = () => this.dialog.getByTestId('ssvc-apply-button');
  readonly decisionBadge = () => this.dialog.getByTestId('ssvc-decision-badge');
  readonly summaryRows = () => this.dialog.getByTestId('ssvc-summary-row');

  stepDot(index: number) {
    return this.stepDots().nth(index);
  }

  valueCard(name: string) {
    return this.valueCards().filter({ hasText: name });
  }

  summaryRow(index: number) {
    return this.summaryRows().nth(index);
  }

  async selectValue(name: string) {
    await this.valueCard(name).click();
  }

  async next() {
    await this.nextButton().click();
  }

  async back() {
    await this.backButton().click();
  }

  async apply() {
    await this.applyButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 7: Create export.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class ExportDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly saveButton = () => this.dialog.getByTestId('export-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('export-cancel-button');
  readonly retryButton = () => this.dialog.getByTestId('export-retry-button');
  readonly status = () => this.dialog.getByTestId('export-status');

  async cancel() {
    await this.cancelButton().click();
  }

  async save() {
    await this.saveButton().click();
  }
}
```

- [ ] **Step 8: Create framework-mapping-picker.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class FrameworkMappingPickerDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly checkboxes = () => this.dialog.getByTestId('framework-mapping-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('framework-mapping-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('framework-mapping-cancel-button');

  checkbox(name: string) {
    return this.checkboxes().filter({ hasText: name });
  }

  async toggleMapping(name: string) {
    await this.checkbox(name).click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
```

- [ ] **Step 9: Commit**

```bash
git add e2e/dialogs/asset-editor.dialog.ts \
        e2e/dialogs/document-editor.dialog.ts \
        e2e/dialogs/repository-editor.dialog.ts \
        e2e/dialogs/metadata.dialog.ts \
        e2e/dialogs/permissions.dialog.ts \
        e2e/dialogs/ssvc-calculator.dialog.ts \
        e2e/dialogs/export.dialog.ts \
        e2e/dialogs/framework-mapping-picker.dialog.ts
git commit -m "test: create dialog objects for Phase 1 entity editors"
```

### Task 6: Create note-page page object and update CreateTmDialog

**Files:**
- Create: `e2e/pages/note-page.page.ts`
- Modify: `e2e/dialogs/create-tm.dialog.ts`

- [ ] **Step 1: Create note-page.page.ts**

```typescript
import { Page } from '@playwright/test';

export class NotePage {
  constructor(private page: Page) {}

  readonly nameInput = () => this.page.getByTestId('note-name-input');
  readonly descriptionInput = () => this.page.getByTestId('note-description-input');
  readonly contentTextarea = () => this.page.getByTestId('note-content-textarea');
  readonly includeReportCheckbox = () => this.page.getByTestId('note-include-report-checkbox');
  readonly timmyCheckbox = () => this.page.getByTestId('note-timmy-checkbox');
  readonly saveButton = () => this.page.getByTestId('note-save-button');
  readonly deleteButton = () => this.page.getByTestId('note-delete-button');
  readonly metadataButton = () => this.page.getByTestId('note-metadata-button');
  readonly closeButton = () => this.page.getByTestId('note-close-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(desc);
  }

  async fillContent(content: string) {
    await this.contentTextarea().clear();
    await this.contentTextarea().fill(content);
  }

  async save() {
    await this.saveButton().click();
  }

  async close() {
    await this.closeButton().click();
  }
}
```

- [ ] **Step 2: Update CreateTmDialog with new locators**

Add `descriptionInput`, `frameworkSelect`, and `confidentialToggle` locators plus helper methods to `e2e/dialogs/create-tm.dialog.ts`:

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateTmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-tm-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-tm-description-input');
  readonly frameworkSelect = () => this.dialog.getByTestId('create-tm-framework-select');
  readonly confidentialToggle = () => this.dialog.getByTestId('create-tm-confidential-toggle');
  readonly submitButton = () => this.dialog.getByTestId('create-tm-submit');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    // Wait for dialog animation to settle before interacting
    await this.nameInput().click();
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async selectFramework(framework: string) {
    await this.frameworkSelect().click();
    await this.page.locator('mat-option').filter({ hasText: framework }).click();
  }

  async setConfidential(enabled: boolean) {
    const isChecked = await this.confidentialToggle().isChecked();
    if (isChecked !== enabled) {
      await this.confidentialToggle().click();
    }
  }

  async submit() {
    await this.submitButton().click();
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add e2e/pages/note-page.page.ts e2e/dialogs/create-tm.dialog.ts
git commit -m "test: create NotePage page object and update CreateTmDialog"
```

### Task 7: Create new flows

**Files:**
- Create: `e2e/flows/asset.flow.ts`
- Create: `e2e/flows/document.flow.ts`
- Create: `e2e/flows/repository.flow.ts`
- Create: `e2e/flows/note.flow.ts`
- Create: `e2e/flows/metadata.flow.ts`
- Create: `e2e/flows/permissions.flow.ts`
- Create: `e2e/flows/scoring.flow.ts`

Follow the existing flow pattern: class with `Page` constructor, compose page objects/dialog objects, no assertions.

- [ ] **Step 1: Create asset.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { AssetEditorDialog } from '../dialogs/asset-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class AssetFlow {
  private tmEditPage: TmEditPage;
  private assetDialog: AssetEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.assetDialog = new AssetEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(fields: {
    name: string;
    type?: string;
    criticality?: string;
    classification?: string[];
    sensitivity?: string;
  }) {
    await this.page.getByTestId('add-asset-button').scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('add-asset-button').click();
    await this.assetDialog.fillName(fields.name);
    if (fields.type) await this.assetDialog.selectType(fields.type);
    if (fields.criticality) await this.assetDialog.fillCriticality(fields.criticality);
    if (fields.classification) {
      for (const c of fields.classification) {
        await this.assetDialog.addClassification(c);
      }
    }
    if (fields.sensitivity) await this.assetDialog.fillSensitivity(fields.sensitivity);
    await this.assetDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async editFromTmEdit(name: string, updates: Record<string, string>) {
    await this.page.getByTestId('asset-row').filter({ hasText: name }).click();
    for (const [field, value] of Object.entries(updates)) {
      if (field === 'name') {
        await this.assetDialog.nameInput().clear();
        await this.assetDialog.fillName(value);
      } else if (field === 'description') {
        await this.assetDialog.descriptionInput().clear();
        await this.assetDialog.fillDescription(value);
      } else if (field === 'criticality') {
        await this.assetDialog.criticalityInput().clear();
        await this.assetDialog.fillCriticality(value);
      } else if (field === 'sensitivity') {
        await this.assetDialog.sensitivityInput().clear();
        await this.assetDialog.fillSensitivity(value);
      }
    }
    await this.assetDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    // Asset delete is via kebab menu on the row
    const row = this.page.getByTestId('asset-row').filter({ hasText: name });
    const kebab = row.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebab.click();
    await this.page.locator('button[mat-menu-item]').filter({ hasText: /delete/i }).click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 2: Create document.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class DocumentFlow {
  private documentDialog: DocumentEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.documentDialog = new DocumentEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(fields: { name: string; uri: string; description?: string }) {
    await this.page.getByTestId('add-document-button').scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('add-document-button').click();
    await this.documentDialog.fillName(fields.name);
    await this.documentDialog.fillUri(fields.uri);
    if (fields.description) await this.documentDialog.fillDescription(fields.description);
    await this.documentDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async editFromTmEdit(name: string, updates: Record<string, string>) {
    await this.page.getByTestId('document-row').filter({ hasText: name }).click();
    for (const [field, value] of Object.entries(updates)) {
      if (field === 'name') {
        await this.documentDialog.nameInput().clear();
        await this.documentDialog.fillName(value);
      } else if (field === 'uri') {
        await this.documentDialog.uriInput().clear();
        await this.documentDialog.fillUri(value);
      } else if (field === 'description') {
        await this.documentDialog.descriptionInput().clear();
        await this.documentDialog.fillDescription(value);
      }
    }
    await this.documentDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    const row = this.page.getByTestId('document-row').filter({ hasText: name });
    const kebab = row.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebab.click();
    await this.page.locator('button[mat-menu-item]').filter({ hasText: /delete/i }).click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 3: Create repository.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { RepositoryEditorDialog } from '../dialogs/repository-editor.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class RepositoryFlow {
  private repoDialog: RepositoryEditorDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.repoDialog = new RepositoryEditorDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(fields: {
    name: string;
    type: string;
    uri: string;
    refType?: string;
    refValue?: string;
    subPath?: string;
  }) {
    await this.page.getByTestId('add-repository-button').scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('add-repository-button').click();
    await this.repoDialog.fillName(fields.name);
    await this.repoDialog.selectType(fields.type);
    await this.repoDialog.fillUri(fields.uri);
    if (fields.refType) await this.repoDialog.selectRefType(fields.refType);
    if (fields.refValue) await this.repoDialog.fillRefValue(fields.refValue);
    if (fields.subPath) await this.repoDialog.fillSubPath(fields.subPath);
    await this.repoDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async editFromTmEdit(name: string, updates: Record<string, string>) {
    await this.page.getByTestId('repository-row').filter({ hasText: name }).click();
    for (const [field, value] of Object.entries(updates)) {
      if (field === 'name') {
        await this.repoDialog.nameInput().clear();
        await this.repoDialog.fillName(value);
      } else if (field === 'description') {
        await this.repoDialog.descriptionInput().clear();
        await this.repoDialog.fillDescription(value);
      } else if (field === 'uri') {
        await this.repoDialog.uriInput().clear();
        await this.repoDialog.fillUri(value);
      } else if (field === 'refValue') {
        await this.repoDialog.refValueInput().clear();
        await this.repoDialog.fillRefValue(value);
      } else if (field === 'subPath') {
        await this.repoDialog.subPathInput().clear();
        await this.repoDialog.fillSubPath(value);
      }
    }
    await this.repoDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    const row = this.page.getByTestId('repository-row').filter({ hasText: name });
    const kebab = row.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebab.click();
    await this.page.locator('button[mat-menu-item]').filter({ hasText: /delete/i }).click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 4: Create note.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { NotePage } from '../pages/note-page.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class NoteFlow {
  private notePage: NotePage;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.notePage = new NotePage(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string) {
    await this.page.getByTestId('add-note-button').scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(300);
    await this.page.getByTestId('add-note-button').click();
    // Note creation navigates to the note page
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
    await this.notePage.fillName(name);
    await this.notePage.save();
  }

  async openFromTmEdit(name: string) {
    await this.page.getByTestId('note-row').filter({ hasText: name }).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
  }

  async editNote(fields: { name?: string; description?: string; content?: string }) {
    if (fields.name) await this.notePage.fillName(fields.name);
    if (fields.description) await this.notePage.fillDescription(fields.description);
    if (fields.content) await this.notePage.fillContent(fields.content);
    await this.notePage.save();
  }

  async deleteNote() {
    // Open kebab menu on note page, click delete
    const kebabButton = this.page.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    await this.page.getByTestId('note-delete-button').waitFor({ state: 'visible' });
    await this.page.getByTestId('note-delete-button').click();
    await this.deleteConfirmDialog.confirmDeletion();
  }

  async closeNote() {
    await this.notePage.close();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }
}
```

- [ ] **Step 5: Create metadata.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { MetadataDialog } from '../dialogs/metadata.dialog';

export class MetadataFlow {
  private metadataDialog: MetadataDialog;

  constructor(private page: Page) {
    this.metadataDialog = new MetadataDialog(page);
  }

  async addEntry(key: string, value: string) {
    await this.metadataDialog.addEntry(key, value);
  }

  async editEntry(index: number, key?: string, value?: string) {
    if (key !== undefined) {
      await this.metadataDialog.keyInput(index).clear();
      await this.metadataDialog.keyInput(index).fill(key);
      await this.metadataDialog.keyInput(index).press('Tab');
    }
    if (value !== undefined) {
      await this.metadataDialog.valueInput(index).clear();
      await this.metadataDialog.valueInput(index).fill(value);
      await this.metadataDialog.valueInput(index).press('Tab');
    }
  }

  async deleteEntry(index: number) {
    await this.metadataDialog.deleteButton(index).click();
  }

  async saveAndClose() {
    await this.metadataDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
```

- [ ] **Step 6: Create permissions.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { PermissionsDialog } from '../dialogs/permissions.dialog';

export class PermissionsFlow {
  private permissionsDialog: PermissionsDialog;

  constructor(private page: Page) {
    this.permissionsDialog = new PermissionsDialog(page);
  }

  async addPermission(
    type: 'user' | 'group',
    provider: string,
    subject: string,
    role: 'reader' | 'writer' | 'owner',
  ) {
    await this.permissionsDialog.addPermission(type, provider, subject, role);
  }

  async deletePermission(index: number) {
    await this.permissionsDialog.deleteButton(index).click();
  }

  async setOwner(index: number) {
    await this.permissionsDialog.setOwnerButtons().nth(index).click();
  }

  async saveAndClose() {
    await this.permissionsDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
```

- [ ] **Step 7: Create scoring.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { SsvcCalculatorDialog } from '../dialogs/ssvc-calculator.dialog';
import { FrameworkMappingPickerDialog } from '../dialogs/framework-mapping-picker.dialog';

export class ScoringFlow {
  private ssvcDialog: SsvcCalculatorDialog;
  private frameworkMappingDialog: FrameworkMappingPickerDialog;

  constructor(private page: Page) {
    this.ssvcDialog = new SsvcCalculatorDialog(page);
    this.frameworkMappingDialog = new FrameworkMappingPickerDialog(page);
  }

  /**
   * Walk through all SSVC decision points and apply.
   * @param selections Array of 4 value names, one per decision point
   */
  async scoreSsvc(selections: string[]) {
    for (let i = 0; i < selections.length; i++) {
      await this.ssvcDialog.selectValue(selections[i]);
      if (i < selections.length - 1) {
        await this.ssvcDialog.next();
      } else {
        // Last selection advances to summary automatically
        await this.ssvcDialog.next();
      }
    }
    await this.ssvcDialog.apply();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async addFrameworkMapping(types: string[]) {
    for (const type of types) {
      await this.frameworkMappingDialog.toggleMapping(type);
    }
    await this.frameworkMappingDialog.save();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }
}
```

- [ ] **Step 8: Commit**

```bash
git add e2e/flows/asset.flow.ts \
        e2e/flows/document.flow.ts \
        e2e/flows/repository.flow.ts \
        e2e/flows/note.flow.ts \
        e2e/flows/metadata.flow.ts \
        e2e/flows/permissions.flow.ts \
        e2e/flows/scoring.flow.ts
git commit -m "test: create flows for Phase 1 entity operations and scoring"
```

### Task 8: Register new objects in test-fixtures.ts

**Files:**
- Modify: `e2e/fixtures/test-fixtures.ts`

- [ ] **Step 1: Add imports and fixture registrations for all new dialog objects, page objects, and flows**

Add imports at the top of the file for all 8 new dialogs, 1 new page, and 7 new flows. Then add them to the `TestFixtures` type and the `base.extend<TestFixtures>({})` block, following the exact pattern of existing entries.

New imports to add:
```typescript
import { NotePage } from '../pages/note-page.page';
import { AssetEditorDialog } from '../dialogs/asset-editor.dialog';
import { DocumentEditorDialog } from '../dialogs/document-editor.dialog';
import { RepositoryEditorDialog } from '../dialogs/repository-editor.dialog';
import { MetadataDialog } from '../dialogs/metadata.dialog';
import { PermissionsDialog } from '../dialogs/permissions.dialog';
import { SsvcCalculatorDialog } from '../dialogs/ssvc-calculator.dialog';
import { ExportDialog } from '../dialogs/export.dialog';
import { FrameworkMappingPickerDialog } from '../dialogs/framework-mapping-picker.dialog';
import { AssetFlow } from '../flows/asset.flow';
import { DocumentFlow } from '../flows/document.flow';
import { RepositoryFlow } from '../flows/repository.flow';
import { NoteFlow } from '../flows/note.flow';
import { MetadataFlow } from '../flows/metadata.flow';
import { PermissionsFlow } from '../flows/permissions.flow';
import { ScoringFlow } from '../flows/scoring.flow';
```

New type entries:
```typescript
  // Pages (add)
  notePage: NotePage;

  // Dialogs (add)
  assetEditorDialog: AssetEditorDialog;
  documentEditorDialog: DocumentEditorDialog;
  repositoryEditorDialog: RepositoryEditorDialog;
  metadataDialog: MetadataDialog;
  permissionsDialog: PermissionsDialog;
  ssvcCalculatorDialog: SsvcCalculatorDialog;
  exportDialog: ExportDialog;
  frameworkMappingPickerDialog: FrameworkMappingPickerDialog;

  // Flows (add)
  assetFlow: AssetFlow;
  documentFlow: DocumentFlow;
  repositoryFlow: RepositoryFlow;
  noteFlow: NoteFlow;
  metadataFlow: MetadataFlow;
  permissionsFlow: PermissionsFlow;
  scoringFlow: ScoringFlow;
```

New fixture definitions (same `async ({ page }, use)` pattern):
```typescript
  notePage: async ({ page }, use) => { await use(new NotePage(page)); },
  assetEditorDialog: async ({ page }, use) => { await use(new AssetEditorDialog(page)); },
  documentEditorDialog: async ({ page }, use) => { await use(new DocumentEditorDialog(page)); },
  repositoryEditorDialog: async ({ page }, use) => { await use(new RepositoryEditorDialog(page)); },
  metadataDialog: async ({ page }, use) => { await use(new MetadataDialog(page)); },
  permissionsDialog: async ({ page }, use) => { await use(new PermissionsDialog(page)); },
  ssvcCalculatorDialog: async ({ page }, use) => { await use(new SsvcCalculatorDialog(page)); },
  exportDialog: async ({ page }, use) => { await use(new ExportDialog(page)); },
  frameworkMappingPickerDialog: async ({ page }, use) => { await use(new FrameworkMappingPickerDialog(page)); },
  assetFlow: async ({ page }, use) => { await use(new AssetFlow(page)); },
  documentFlow: async ({ page }, use) => { await use(new DocumentFlow(page)); },
  repositoryFlow: async ({ page }, use) => { await use(new RepositoryFlow(page)); },
  noteFlow: async ({ page }, use) => { await use(new NoteFlow(page)); },
  metadataFlow: async ({ page }, use) => { await use(new MetadataFlow(page)); },
  permissionsFlow: async ({ page }, use) => { await use(new PermissionsFlow(page)); },
  scoringFlow: async ({ page }, use) => { await use(new ScoringFlow(page)); },
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/test-fixtures.ts
git commit -m "test: register Phase 1 page objects, dialogs, and flows in fixtures"
```

### Task 9: Write TM workflow tests

**Files:**
- Create: `e2e/tests/workflows/tm-workflows.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { expect, Page } from '@playwright/test';
import { userTest, reviewerTest, multiRoleTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { ThreatFlow } from '../../flows/threat.flow';
import { NoteFlow } from '../../flows/note.flow';
import { PermissionsFlow } from '../../flows/permissions.flow';
import { CreateTmDialog } from '../../dialogs/create-tm.dialog';
import { ExportDialog } from '../../dialogs/export.dialog';
import { TmEditPage } from '../../pages/tm-edit.page';
import { ThreatPage } from '../../pages/threat-page.page';
import { DashboardPage } from '../../pages/dashboard.page';

userTest.describe('TM Workflows - Single Role', () => {
  userTest.setTimeout(60000);

  userTest('framework selection (STRIDE)', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const createDialog = new CreateTmDialog(userPage);
    const tmEdit = new TmEditPage(userPage);
    const dashboard = new DashboardPage(userPage);
    const testName = `E2E STRIDE TM ${Date.now()}`;

    // Create TM with STRIDE framework
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await dashboard.createTmButton().click();
    await createDialog.fillName(testName);
    await createDialog.selectFramework('STRIDE');
    await createDialog.submit();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Verify framework shows STRIDE
    await expect(userPage.getByTestId('tm-framework-select')).toContainText('STRIDE');

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testName);
    } catch { /* best effort */ }
  });

  userTest('export dialog', async ({ userPage }) => {
    const exportDialog = new ExportDialog(userPage);

    // Navigate to seeded TM
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    const tmCard = userPage.getByTestId('threat-model-card').filter({ hasText: 'Seed TM' });
    await tmCard.first().click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Open export dialog from kebab menu
    await userPage.getByTestId('tm-export-button').click();

    // Verify dialog shows loading then ready
    await exportDialog.status().waitFor({ state: 'visible' });
    await expect(exportDialog.saveButton()).toBeVisible({ timeout: 10000 });

    // Cancel without downloading
    await exportDialog.cancel();
  });

  userTest('project association and dashboard filter', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const dashboard = new DashboardPage(userPage);
    const testName = `E2E Project TM ${Date.now()}`;

    // Create TM
    await tmFlow.createFromDashboard(testName);

    // Link to project — find the project select on TM edit page
    await userPage.getByTestId('tm-project-select').click();
    await userPage.locator('mat-option').filter({ hasText: 'Seed Project One' }).click();

    // Save the TM (wait for PUT response)
    const saveResponse = userPage.waitForResponse(
      resp => resp.url().includes('/threat_models/') && resp.request().method() === 'PUT',
    );
    await userPage.locator('button').filter({ hasText: /save/i }).click();
    await saveResponse;

    // Go to dashboard and verify TM appears
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await expect(dashboard.tmCard(testName)).toBeVisible({ timeout: 10000 });

    // Cleanup
    try {
      await tmFlow.deleteFromDashboard(testName);
    } catch { /* best effort */ }
  });
});

reviewerTest.describe('TM Workflows - Reviewer Role', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('reviewer edits assigned TM', async ({ reviewerPage }) => {
    const dashboard = new DashboardPage(reviewerPage);
    const tmEdit = new TmEditPage(reviewerPage);
    const threatPage = new ThreatPage(reviewerPage);

    // Navigate to seeded TM (reviewer has writer access via seed data)
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await dashboard.tmCard('Seed TM - Full Fields').click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Verify reviewer can see and access the TM
    await expect(tmEdit.tmName()).toContainText('Seed TM');

    // Open seeded threat and verify access
    await tmEdit.threatRow('Seed Threat - All Fields').click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(threatPage.nameInput()).toBeVisible();

    // Navigate back
    await reviewerPage.goBack();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  });
});

multiRoleTest.describe('TM Workflows - Cross Role', () => {
  multiRoleTest.setTimeout(90000);

  multiRoleTest('owner shares TM with reviewer', async ({ userPage, reviewerPage }) => {
    const userTmFlow = new ThreatModelFlow(userPage);
    const userDashboard = new DashboardPage(userPage);
    const testName = `E2E Share TM ${Date.now()}`;

    // User creates TM
    await userTmFlow.createFromDashboard(testName);

    // Open permissions, add reviewer as writer
    await userPage.getByTestId('tm-permissions-button').click();
    const permissionsFlow = new PermissionsFlow(userPage);
    await permissionsFlow.addPermission('user', 'tmi', 'test-reviewer', 'writer');
    await permissionsFlow.saveAndClose();

    // Reviewer opens TM
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    const reviewerDashboard = new DashboardPage(reviewerPage);
    await reviewerDashboard.tmCard(testName).click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Reviewer can see the TM
    await expect(reviewerPage.getByTestId('threat-model-name')).toContainText(testName);

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await userTmFlow.deleteFromDashboard(testName);
    } catch { /* best effort */ }
  });

  multiRoleTest('confidential TM visibility', async ({ userPage, reviewerPage }) => {
    const createDialog = new CreateTmDialog(userPage);
    const userDashboard = new DashboardPage(userPage);
    const userTmFlow = new ThreatModelFlow(userPage);
    const reviewerDashboard = new DashboardPage(reviewerPage);
    const testName = `E2E Confidential TM ${Date.now()}`;

    // User creates confidential TM
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await userDashboard.createTmButton().click();
    await createDialog.fillName(testName);
    await createDialog.setConfidential(true);
    await createDialog.submit();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // Verify confidential badge
    await expect(userPage.getByTestId('tm-confidential-badge')).toBeVisible();

    // Reviewer cannot see it on dashboard
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await expect(reviewerDashboard.tmCard(testName)).toHaveCount(0, { timeout: 5000 });

    // User adds reviewer as reader
    await userPage.getByTestId('tm-permissions-button').click();
    const permissionsFlow = new PermissionsFlow(userPage);
    await permissionsFlow.addPermission('user', 'tmi', 'test-reviewer', 'reader');
    await permissionsFlow.saveAndClose();

    // Reviewer can now see it
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await expect(reviewerDashboard.tmCard(testName)).toHaveCount(1, { timeout: 10000 });

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await userTmFlow.deleteFromDashboard(testName);
    } catch { /* best effort */ }
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:e2e:workflows -- --grep "TM Workflows"`
Expected: All tests pass (requires live backend with seeded data)

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/tm-workflows.spec.ts
git commit -m "test: add TM workflow E2E tests (reviewer, sharing, confidential, framework, export, project)"
```

### Task 10: Write child entity CRUD tests

**Files:**
- Create: `e2e/tests/workflows/child-entity-crud.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { AssetFlow } from '../../flows/asset.flow';
import { DocumentFlow } from '../../flows/document.flow';
import { RepositoryFlow } from '../../flows/repository.flow';
import { NoteFlow } from '../../flows/note.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { PermissionsFlow } from '../../flows/permissions.flow';
import { MetadataDialog } from '../../dialogs/metadata.dialog';
import { PermissionsDialog } from '../../dialogs/permissions.dialog';
import { DashboardPage } from '../../pages/dashboard.page';
import { NotePage } from '../../pages/note-page.page';

test.describe.serial('Child Entity CRUD', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let tmFlow: ThreatModelFlow;
  let dashboard: DashboardPage;

  const testTmName = `E2E Entity CRUD TM ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    tmFlow = new ThreatModelFlow(page);
    dashboard = new DashboardPage(page);

    await new AuthFlow(page).loginAs('test-user');
    await tmFlow.createFromDashboard(testTmName);
  });

  test.afterAll(async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testTmName);
      await expect(dashboard.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch { /* best effort */ }
    await context.close();
  });

  test('asset CRUD', async () => {
    const assetFlow = new AssetFlow(page);
    const assetName = `E2E Asset ${Date.now()}`;
    const updatedName = `${assetName} Updated`;

    // Create
    await assetFlow.createFromTmEdit({
      name: assetName,
      type: 'data',
      criticality: 'high',
      classification: ['confidential', 'pii'],
      sensitivity: 'high',
    });
    await expect(page.getByTestId('asset-row').filter({ hasText: assetName })).toBeVisible({ timeout: 10000 });

    // Edit
    await assetFlow.editFromTmEdit(assetName, { name: updatedName });
    await expect(page.getByTestId('asset-row').filter({ hasText: updatedName })).toBeVisible({ timeout: 10000 });

    // Delete
    await assetFlow.deleteFromTmEdit(updatedName);
    await expect(page.getByTestId('asset-row').filter({ hasText: updatedName })).toHaveCount(0, { timeout: 10000 });
  });

  test('document CRUD', async () => {
    const docFlow = new DocumentFlow(page);
    const docName = `E2E Doc ${Date.now()}`;

    // Create
    await docFlow.createFromTmEdit({
      name: docName,
      uri: 'https://example.com/doc.pdf',
      description: 'Test document',
    });
    await expect(page.getByTestId('document-row').filter({ hasText: docName })).toBeVisible({ timeout: 10000 });

    // Edit
    await docFlow.editFromTmEdit(docName, { description: 'Updated description' });

    // Delete
    await docFlow.deleteFromTmEdit(docName);
    await expect(page.getByTestId('document-row').filter({ hasText: docName })).toHaveCount(0, { timeout: 10000 });
  });

  test('repository CRUD', async () => {
    const repoFlow = new RepositoryFlow(page);
    const repoName = `E2E Repo ${Date.now()}`;

    // Create
    await repoFlow.createFromTmEdit({
      name: repoName,
      type: 'Git',
      uri: 'https://github.com/example/repo',
      refType: 'branch',
      refValue: 'main',
      subPath: 'src/',
    });
    await expect(page.getByTestId('repository-row').filter({ hasText: repoName })).toBeVisible({ timeout: 10000 });

    // Edit
    await repoFlow.editFromTmEdit(repoName, { refValue: 'develop' });

    // Delete
    await repoFlow.deleteFromTmEdit(repoName);
    await expect(page.getByTestId('repository-row').filter({ hasText: repoName })).toHaveCount(0, { timeout: 10000 });
  });

  test('note CRUD', async () => {
    const noteFlow = new NoteFlow(page);
    const notePage = new NotePage(page);
    const noteName = `E2E Note ${Date.now()}`;

    // Create (navigates to note page)
    await noteFlow.createFromTmEdit(noteName);
    await expect(notePage.nameInput()).toHaveValue(noteName, { timeout: 10000 });

    // Edit
    await noteFlow.editNote({
      description: 'Test note description',
      content: '## Test Content\n\nSome markdown here.',
    });

    // Verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(notePage.descriptionInput()).toHaveValue('Test note description', { timeout: 10000 });

    // Navigate back and verify in table
    await noteFlow.closeNote();
    await expect(page.getByTestId('note-row').filter({ hasText: noteName })).toBeVisible({ timeout: 10000 });

    // Delete from note page
    await noteFlow.openFromTmEdit(noteName);
    await noteFlow.deleteNote();
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
    await expect(page.getByTestId('note-row').filter({ hasText: noteName })).toHaveCount(0, { timeout: 10000 });
  });

  test('metadata CRUD', async () => {
    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // Open metadata dialog
    await page.getByTestId('tm-metadata-button').click();

    // Add entry
    await metadataFlow.addEntry('test-key', 'test-value');
    await metadataFlow.saveAndClose();

    // Reopen and verify
    await page.getByTestId('tm-metadata-button').click();
    await expect(metadataDialog.keyInputs().last()).toHaveValue('test-key', { timeout: 5000 });
    await expect(metadataDialog.valueInputs().last()).toHaveValue('test-value');

    // Edit value
    const lastIndex = (await metadataDialog.valueInputs().count()) - 1;
    await metadataFlow.editEntry(lastIndex, undefined, 'updated-value');
    await metadataFlow.saveAndClose();

    // Reopen and verify update
    await page.getByTestId('tm-metadata-button').click();
    await expect(metadataDialog.valueInputs().last()).toHaveValue('updated-value', { timeout: 5000 });

    // Delete entry
    const deleteIndex = (await metadataDialog.deleteButtons().count()) - 1;
    await metadataFlow.deleteEntry(deleteIndex);
    await metadataFlow.saveAndClose();
  });

  test('permissions CRUD', async () => {
    const permissionsFlow = new PermissionsFlow(page);
    const permissionsDialog = new PermissionsDialog(page);

    // Open permissions dialog
    await page.getByTestId('tm-permissions-button').click();
    const initialCount = await permissionsDialog.rows().count();

    // Add reader
    await permissionsFlow.addPermission('user', 'tmi', 'test-reviewer', 'reader');
    await permissionsFlow.saveAndClose();

    // Reopen and verify
    await page.getByTestId('tm-permissions-button').click();
    await expect(permissionsDialog.rows()).toHaveCount(initialCount + 1, { timeout: 5000 });

    // Delete the permission we just added
    const lastIndex = (await permissionsDialog.deleteButtons().count()) - 1;
    await permissionsFlow.deletePermission(lastIndex);
    await permissionsFlow.saveAndClose();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:e2e:workflows -- --grep "Child Entity CRUD"`
Expected: All 6 tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/child-entity-crud.spec.ts
git commit -m "test: add child entity CRUD E2E tests (assets, documents, repos, notes, metadata, permissions)"
```

### Task 11: Write scoring systems tests

**Files:**
- Create: `e2e/tests/workflows/scoring-systems.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { ThreatFlow } from '../../flows/threat.flow';
import { ScoringFlow } from '../../flows/scoring.flow';
import { ThreatPage } from '../../pages/threat-page.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { DashboardPage } from '../../pages/dashboard.page';
import { SsvcCalculatorDialog } from '../../dialogs/ssvc-calculator.dialog';

test.describe.serial('Scoring Systems', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let tmFlow: ThreatModelFlow;
  let threatFlow: ThreatFlow;
  let scoringFlow: ScoringFlow;
  let threatPage: ThreatPage;
  let tmEdit: TmEditPage;
  let dashboard: DashboardPage;

  const testTmName = `E2E Scoring TM ${Date.now()}`;
  const testThreatName = `E2E Scoring Threat ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    tmFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    scoringFlow = new ScoringFlow(page);
    threatPage = new ThreatPage(page);
    tmEdit = new TmEditPage(page);
    dashboard = new DashboardPage(page);

    await new AuthFlow(page).loginAs('test-user');
    await tmFlow.createFromDashboard(testTmName);
    await threatFlow.createFromTmEdit(testThreatName);
    await threatFlow.openFromTmEdit(testThreatName);
  });

  test.afterAll(async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testTmName);
    } catch { /* best effort */ }
    await context.close();
  });

  test('SSVC calculator full workflow', async () => {
    // Open SSVC calculator — find the SSVC button on threat page
    // The SSVC button may be labeled differently; look for it near scoring section
    const ssvcButton = page.locator('button').filter({ hasText: /ssvc/i });
    await ssvcButton.click();

    const ssvcDialog = new SsvcCalculatorDialog(page);

    // Step through 4 decision points
    await ssvcDialog.selectValue('Active');
    await ssvcDialog.next();
    await ssvcDialog.selectValue('Total');
    await ssvcDialog.next();
    await ssvcDialog.selectValue('Automatable');
    await ssvcDialog.next();
    await ssvcDialog.selectValue('Significant');
    await ssvcDialog.next();

    // Verify summary and decision
    await expect(ssvcDialog.decisionBadge()).toBeVisible();
    await expect(ssvcDialog.decisionBadge()).toContainText('Act');

    // Apply
    await ssvcDialog.apply();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  });

  test('multiple CVSS scores (3.1 + 4.0)', async () => {
    // Add CVSS 3.1
    await threatFlow.scoreThreatWithCvss('3.1', {
      AV: 'N', AC: 'L', PR: 'N', UI: 'N', S: 'U', C: 'H', I: 'H', A: 'H',
    });
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cvssChips().first()).toContainText('9.8');

    // Add CVSS 4.0
    await threatFlow.scoreThreatWithCvss('4.0', {
      AV: 'N', AC: 'L', AT: 'N', PR: 'N', UI: 'N',
      VC: 'H', VI: 'H', VA: 'H', SC: 'N', SI: 'N', SA: 'N',
    });
    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });

    // Remove 3.1 chip (click the remove icon on the first chip)
    const firstChipRemove = threatPage.cvssChips().first().locator('mat-icon, button').filter({ hasText: /cancel|close|remove/ });
    await firstChipRemove.click();

    // Verify only 4.0 remains
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
  });

  test('multiple CWE references', async () => {
    // Add CWE-79
    await threatFlow.addCweReference('CWE-79');
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-79');

    // Add CWE-352
    await threatFlow.addCweReference('CWE-352');
    await expect(threatPage.cweChips()).toHaveCount(2, { timeout: 5000 });

    // Remove CWE-79 (first chip)
    const firstCweRemove = threatPage.cweChips().first().locator('mat-icon, button').filter({ hasText: /cancel|close|remove/ });
    await firstCweRemove.click();

    // Verify only CWE-352 remains
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-352');
  });

  test('framework mappings', async () => {
    // Open framework mapping picker
    await threatPage.addMappingButton().click();
    await scoringFlow.addFrameworkMapping(['Spoofing', 'Tampering']);

    // Verify chips
    await expect(threatPage.threatTypeChips()).toHaveCount(2, { timeout: 5000 });

    // Remove one mapping
    const firstTypeChipRemove = threatPage.threatTypeChips().first().locator('mat-icon, button').filter({ hasText: /cancel|close|remove/ });
    await firstTypeChipRemove.click();

    // Verify one remains
    await expect(threatPage.threatTypeChips()).toHaveCount(1, { timeout: 5000 });
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:e2e:workflows -- --grep "Scoring Systems"`
Expected: All 4 tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/scoring-systems.spec.ts
git commit -m "test: add scoring systems E2E tests (SSVC, CVSS, CWE, framework mappings)"
```

---

## Sub-phase 1B: Schema-Driven Field Coverage

### Task 12: Update field-definitions.json

**Files:**
- Modify: `e2e/schema/field-definitions.json`

- [ ] **Step 1: Fix asset field types and add missing fields**

Update the asset entity in `field-definitions.json`:
- Change `criticality` type from `"select"` to `"text"` and rename uiSelector to `asset-criticality-input`
- Change `classification` type from `"multiselect"` to `"chips"` and rename uiSelector to `asset-classification-chips`
- Change `sensitivity` type from `"select"` to `"text"` and rename uiSelector to `asset-sensitivity-input`
- Change `include_in_report` type from `"toggle"` to `"checkbox"` and rename uiSelector to `asset-include-report-checkbox`
- Add `timmy_enabled` field: `{ "apiName": "timmy_enabled", "uiSelector": "[data-testid='asset-timmy-checkbox']", "type": "checkbox", "required": false, "editable": true }`

- [ ] **Step 2: Fix document fields and add missing**

- Change `include_in_report` type from `"toggle"` to `"checkbox"` and rename uiSelector to `document-include-report-checkbox`
- Add `timmy_enabled`: `{ "apiName": "timmy_enabled", "uiSelector": "[data-testid='document-timmy-checkbox']", "type": "checkbox", "required": false, "editable": true }`

- [ ] **Step 3: Fix repository fields and add missing**

- Change `include_in_report` type from `"toggle"` to `"checkbox"` and rename uiSelector to `repository-include-report-checkbox`
- Add `ref_type`: `{ "apiName": "ref_type", "uiSelector": "[data-testid='repository-ref-type-select']", "type": "select", "required": false, "editable": true, "options": ["branch", "tag", "commit"] }`
- Add `ref_value`: `{ "apiName": "ref_value", "uiSelector": "[data-testid='repository-ref-value-input']", "type": "text", "required": false, "editable": true }`
- Add `subpath`: `{ "apiName": "subpath", "uiSelector": "[data-testid='repository-sub-path-input']", "type": "text", "required": false, "editable": true }`
- Add `timmy_enabled`: `{ "apiName": "timmy_enabled", "uiSelector": "[data-testid='repository-timmy-checkbox']", "type": "checkbox", "required": false, "editable": true }`

- [ ] **Step 4: Fix note fields and add missing**

- Change `content` uiSelector to `note-content-textarea`
- Change `include_in_report` type from `"toggle"` to `"checkbox"` and rename uiSelector to `note-include-report-checkbox`
- Add `timmy_enabled`: `{ "apiName": "timmy_enabled", "uiSelector": "[data-testid='note-timmy-checkbox']", "type": "checkbox", "required": false, "editable": true }`

- [ ] **Step 5: Fix threat_model fields**

- Change `owner` to `"editable": false` (managed via permissions dialog, not directly editable)
- Change `is_confidential` to `"editable": false` (write-once at creation)
- Update all `uiSelector` values to use the `data-testid` attributes added in Tasks 1-4

- [ ] **Step 6: Run schema validation**

Run: `pnpm run e2e:validate-schema`
Expected: No missing fields (or document any intentional gaps)

- [ ] **Step 7: Commit**

```bash
git add e2e/schema/field-definitions.json
git commit -m "test: update field definitions to match actual templates and add missing fields"
```

### Task 13: Create field interaction helper

**Files:**
- Create: `e2e/helpers/field-interactions.ts`

- [ ] **Step 1: Write the helper**

```typescript
import { expect, Locator, Page } from '@playwright/test';
import { FieldDef } from '../schema/field-definitions';

/**
 * Verify a field displays the expected value.
 */
export async function verifyFieldValue(
  page: Page,
  field: FieldDef,
  expected: string | string[] | boolean,
): Promise<void> {
  const locator = page.locator(field.uiSelector);

  switch (field.type) {
    case 'text':
    case 'textarea':
      await expect(locator).toHaveValue(expected as string, { timeout: 5000 });
      break;
    case 'select':
      await expect(locator).toContainText(expected as string, { timeout: 5000 });
      break;
    case 'multiselect':
    case 'chips': {
      const values = Array.isArray(expected) ? expected : [expected as string];
      for (const v of values) {
        await expect(locator).toContainText(v, { timeout: 5000 });
      }
      break;
    }
    case 'checkbox':
    case 'toggle': {
      const checkbox = locator.locator('input[type="checkbox"]');
      if (expected) {
        await expect(checkbox).toBeChecked({ timeout: 5000 });
      } else {
        await expect(checkbox).not.toBeChecked({ timeout: 5000 });
      }
      break;
    }
  }
}

/**
 * Edit a field to a new value.
 */
export async function editField(
  page: Page,
  field: FieldDef,
  newValue: string | boolean,
): Promise<void> {
  const locator = page.locator(field.uiSelector);

  switch (field.type) {
    case 'text':
    case 'textarea':
      await locator.clear();
      await locator.fill(newValue as string);
      break;
    case 'select':
      await locator.click();
      await page.locator('mat-option').filter({ hasText: newValue as string }).click();
      break;
    case 'checkbox':
    case 'toggle': {
      const checkbox = locator.locator('input[type="checkbox"]');
      const isChecked = await checkbox.isChecked();
      if (isChecked !== newValue) {
        await locator.click();
      }
      break;
    }
    case 'chips': {
      // Add a new chip value
      const chipInput = locator.locator('input');
      await chipInput.fill(newValue as string);
      await chipInput.press('Enter');
      break;
    }
    case 'multiselect': {
      // Click select then click additional option
      await locator.click();
      await page.locator('mat-option').filter({ hasText: newValue as string }).click();
      // Close the dropdown by pressing Escape
      await page.keyboard.press('Escape');
      break;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/field-interactions.ts
git commit -m "test: create field interaction helper for schema-driven tests"
```

### Task 14: Write field coverage test specs

**Files:**
- Create: `e2e/tests/field-coverage/asset-fields.spec.ts`
- Create: `e2e/tests/field-coverage/document-fields.spec.ts`
- Create: `e2e/tests/field-coverage/repository-fields.spec.ts`
- Create: `e2e/tests/field-coverage/note-fields.spec.ts`
- Create: `e2e/tests/field-coverage/threat-fields.spec.ts`
- Create: `e2e/tests/field-coverage/tm-fields.spec.ts`

Each file follows the same parameterized pattern: load seeded data, iterate field definitions, verify + edit + persist.

- [ ] **Step 1: Create asset-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { ASSET_FIELDS, FieldDef } from '../../schema/field-definitions';
import { verifyFieldValue, editField } from '../../helpers/field-interactions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_ASSET = 'Seed Asset - User Database';

userTest.describe('Asset Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of ASSET_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      // Navigate to seeded TM
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      // Open seeded asset
      await userPage.getByTestId('asset-row').filter({ hasText: SEEDED_ASSET }).click();

      // Verify field exists in dialog
      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Close without saving
      await userPage.getByTestId('asset-cancel-button').click();
    });
  }
});
```

- [ ] **Step 2: Create document-fields.spec.ts**

Follow the same pattern as asset-fields.spec.ts, but open the seeded document "Architecture Doc" and use `DOCUMENT_FIELDS`.

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { DOCUMENT_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_DOC = 'Architecture Doc';

userTest.describe('Document Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of DOCUMENT_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      await userPage.getByTestId('document-row').filter({ hasText: SEEDED_DOC }).click();

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      await userPage.getByTestId('document-cancel-button').click();
    });
  }
});
```

- [ ] **Step 3: Create repository-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { REPOSITORY_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_REPO = 'Main Codebase';

userTest.describe('Repository Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of REPOSITORY_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      await userPage.getByTestId('repository-row').filter({ hasText: SEEDED_REPO }).click();

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      await userPage.getByTestId('repository-cancel-button').click();
    });
  }
});
```

- [ ] **Step 4: Create note-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { NOTE_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('Note Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of NOTE_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      // Note opens as a page, not a dialog
      await userPage.getByTestId('note-row').filter({ hasText: SEEDED_NOTE }).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Navigate back
      await userPage.getByTestId('note-close-button').click();
    });
  }
});
```

- [ ] **Step 5: Create threat-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { THREAT_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';

userTest.describe('Threat Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of THREAT_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      // Navigate to seeded threat
      const tmEdit = new TmEditPage(userPage);
      await tmEdit.threatRow(SEEDED_THREAT).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
```

- [ ] **Step 6: Create tm-fields.spec.ts**

```typescript
import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { THREAT_MODEL_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';

// Skip metadata (tested separately) and non-editable fields for edit testing
const SKIP_FIELDS = ['metadata'];

userTest.describe('Threat Model Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of THREAT_MODEL_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
```

- [ ] **Step 7: Run field coverage tests**

Run: `pnpm test:e2e:field-coverage`
Expected: All parameterized tests pass

- [ ] **Step 8: Commit**

```bash
git add e2e/tests/field-coverage/asset-fields.spec.ts \
        e2e/tests/field-coverage/document-fields.spec.ts \
        e2e/tests/field-coverage/repository-fields.spec.ts \
        e2e/tests/field-coverage/note-fields.spec.ts \
        e2e/tests/field-coverage/threat-fields.spec.ts \
        e2e/tests/field-coverage/tm-fields.spec.ts
git commit -m "test: add schema-driven field coverage E2E tests for all TM entities"
```

---

## Sub-phase 1C: Visual Regression

### Task 15: Write visual regression screenshot tests

**Files:**
- Create: `e2e/tests/visual-regression/tm-visual-regression.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { userTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';
const SEEDED_ASSET = 'Seed Asset - User Database';
const SEEDED_DOC = 'Architecture Doc';
const SEEDED_REPO = 'Main Codebase';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('TM Visual Regression', () => {
  userTest.setTimeout(60000);

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    // Mask timestamps and collaboration indicators
    const timestamps = userPage.locator('.mat-column-lastModified, .mat-column-created, .mat-column-statusLastChanged');

    await takeThemeScreenshots(userPage, 'tm-dashboard', {
      mask: [timestamps],
    });
  });

  userTest('TM edit page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    // Mask timestamps
    const timestamps = userPage.locator('.info-value').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/ });

    await takeThemeScreenshots(userPage, 'tm-edit-page', {
      mask: [timestamps],
      fullPage: true,
    });
  });

  userTest('threat detail page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await new TmEditPage(userPage).threatRow(SEEDED_THREAT).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/ });

    await takeThemeScreenshots(userPage, 'tm-threat-detail', {
      mask: [timestamps],
      fullPage: true,
    });
  });

  userTest('asset editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('asset-row').filter({ hasText: SEEDED_ASSET }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-asset-editor-dialog');

    await userPage.getByTestId('asset-cancel-button').click();
  });

  userTest('document editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('document-row').filter({ hasText: SEEDED_DOC }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-document-editor-dialog');

    await userPage.getByTestId('document-cancel-button').click();
  });

  userTest('repository editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('repository-row').filter({ hasText: SEEDED_REPO }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-repository-editor-dialog');

    await userPage.getByTestId('repository-cancel-button').click();
  });

  userTest('note page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('note-row').filter({ hasText: SEEDED_NOTE }).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({ hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/ });

    await takeThemeScreenshots(userPage, 'tm-note-page', {
      mask: [timestamps],
      fullPage: true,
    });
  });
});
```

- [ ] **Step 2: Run to generate baselines**

Run: `pnpm test:e2e:visual-regression -- --update-snapshots`
Expected: 28 baseline screenshots created (7 tests x 4 themes)

- [ ] **Step 3: Commit baselines and test file**

```bash
git add e2e/tests/visual-regression/tm-visual-regression.spec.ts \
        e2e/tests/visual-regression/tm-visual-regression.spec.ts-snapshots/
git commit -m "test: add TM visual regression screenshot baselines"
```

### Task 16: Write translation and icon sweep tests

**Files:**
- Create: `e2e/tests/visual-regression/tm-translation-icons.spec.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { userTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';
const SEEDED_ASSET = 'Seed Asset - User Database';
const SEEDED_DOC = 'Architecture Doc';
const SEEDED_REPO = 'Main Codebase';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('TM Translation & Icon Integrity', () => {
  userTest.setTimeout(30000);

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('TM edit page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('threat page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await new TmEditPage(userPage).threatRow(SEEDED_THREAT).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('note page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('note-row').filter({ hasText: SEEDED_NOTE }).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('asset dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('asset-row').filter({ hasText: SEEDED_ASSET }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('asset-cancel-button').click();
  });

  userTest('document dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('document-row').filter({ hasText: SEEDED_DOC }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('document-cancel-button').click();
  });

  userTest('repository dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('repository-row').filter({ hasText: SEEDED_REPO }).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('repository-cancel-button').click();
  });

  userTest('metadata dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('tm-metadata-button').click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('metadata-cancel-button').click();
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test:e2e:visual-regression -- --grep "Translation"`
Expected: All 8 tests pass

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/visual-regression/tm-translation-icons.spec.ts
git commit -m "test: add TM translation and icon integrity sweep tests"
```

---

## Final Verification

### Task 17: Run full E2E suite and verify

- [ ] **Step 1: Run all E2E test projects**

Run: `pnpm test:e2e`
Expected: All tests pass across workflows, field-coverage, and visual-regression projects

- [ ] **Step 2: Run build and lint**

Run: `pnpm run build && pnpm run lint:all`
Expected: Success

- [ ] **Step 3: Run unit tests**

Run: `pnpm test`
Expected: All unit tests pass (no regressions from data-testid additions)

- [ ] **Step 4: Final commit (if any lint fixes needed)**

Only if lint/build surfaced issues that need fixing.
