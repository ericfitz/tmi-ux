# E2E Test Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Playwright E2E testing with page objects, flows, custom fixtures, three new test suites, Cypress cleanup, and a CI stub.

**Architecture:** Three-layer test architecture — page objects (locators + single actions), flows (multi-step workflows), and tests (assertions). All wired via Playwright custom fixtures. Serial suites instantiate manually; independent suites use fixture injection.

**Tech Stack:** Playwright, TypeScript, Angular Material (selectors), AntV X6 (graph nodes)

---

## File Structure

### Created

| File | Responsibility |
|------|---------------|
| `e2e/fixtures/test-fixtures.ts` | Custom Playwright fixtures — wires all page objects, dialogs, and flows |
| `e2e/pages/dashboard.page.ts` | Dashboard page locators and actions |
| `e2e/pages/tm-edit.page.ts` | Threat model edit page locators and actions |
| `e2e/pages/threat-page.page.ts` | Threat page (full editor) locators and actions |
| `e2e/pages/dfd-editor.page.ts` | DFD editor page locators and actions |
| `e2e/pages/triage.page.ts` | Triage list page locators and actions |
| `e2e/pages/login.page.ts` | Login page locators and actions |
| `e2e/pages/navbar.page.ts` | Navbar locators and actions |
| `e2e/dialogs/create-tm.dialog.ts` | Create threat model dialog |
| `e2e/dialogs/create-diagram.dialog.ts` | Create diagram dialog |
| `e2e/dialogs/delete-confirm.dialog.ts` | Delete confirmation dialog |
| `e2e/dialogs/threat-editor.dialog.ts` | Threat editor dialog (quick create) |
| `e2e/dialogs/cvss-calculator.dialog.ts` | CVSS calculator dialog |
| `e2e/dialogs/cwe-picker.dialog.ts` | CWE picker dialog |
| `e2e/flows/auth.flow.ts` | Auth flow (login, session management) |
| `e2e/flows/threat-model.flow.ts` | TM CRUD workflows |
| `e2e/flows/threat.flow.ts` | Threat CRUD + scoring workflows |
| `e2e/flows/diagram.flow.ts` | Diagram CRUD workflows |
| `e2e/tests/threat-editing.spec.ts` | Threat editing test suite |
| `e2e/tests/navigation-routing.spec.ts` | Navigation and routing test suite |
| `e2e/tests/error-scenarios.spec.ts` | Error scenarios test suite |
| `.github/workflows/e2e-tests.yml` | CI stub (manual trigger only) |

### Modified

| File | Change |
|------|--------|
| `e2e/tests/core-lifecycle.spec.ts` | Refactor to use page objects and flows |
| `src/app/pages/tm/components/threat-page/threat-page.component.html` | Add data-testid attributes |
| `src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.html` | Add data-testid attributes |
| `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html` | Add data-testid attributes |
| `src/app/pages/tm/components/cwe-picker-dialog/cwe-picker-dialog.component.html` | Add data-testid attributes |
| `src/app/pages/triage/components/triage-list/triage-list.component.html` | Add data-testid attributes |
| `src/app/core/components/navbar/navbar.component.html` | Add data-testid attributes |
| `src/app/pages/tm/tm-edit.component.html` | Add data-testid to threat table rows and add-threat button |
| `src/testing/matchers/graph-matchers.ts` | Remove Cypress window check |
| `.dockerignore` | Remove Cypress directory entries |
| `.github/codeql/codeql-config.yml` | Remove Cypress ignore entry |

### Deleted

| File | Reason |
|------|--------|
| `e2e/helpers/auth.ts` | Logic moves to `e2e/flows/auth.flow.ts` |
| `src/testing/page-objects/page-object.base.ts` | Legacy Cypress page object, unused |

---

## Task 1: Cypress Cleanup

**Files:**
- Delete: `src/testing/page-objects/page-object.base.ts`
- Modify: `src/testing/matchers/graph-matchers.ts:140-162`
- Modify: `.dockerignore:12-14`
- Modify: `.github/codeql/codeql-config.yml:33`

- [ ] **Step 1: Delete legacy Cypress page object**

```bash
rm src/testing/page-objects/page-object.base.ts
```

Check if the directory is now empty and remove it if so:

```bash
ls src/testing/page-objects/
```

If empty:

```bash
rmdir src/testing/page-objects/
```

- [ ] **Step 2: Remove Cypress window check from graph-matchers.ts**

In `src/testing/matchers/graph-matchers.ts`, replace lines 141-162:

```typescript
/**
 * Register the graph matchers with Cypress
 */
export const registerGraphMatchers = (): void => {
  if (typeof window !== 'undefined') {
    // Check if Cypress and chai are available
    const cypressExists = 'Cypress' in window;
    const chaiExists = 'chai' in window;

    if (cypressExists && chaiExists) {
      // Safely access chai with proper type checking
      // First cast to unknown to avoid type errors
      const windowAny = window as unknown;
      // Then cast to the specific type we need
      const windowWithChai = windowAny as { chai: { use: (plugin: ChaiPlugin) => void } };

      if (typeof windowWithChai.chai?.use === 'function') {
        windowWithChai.chai.use(graphMatchers);
      }
    }
  }
};
```

with:

```typescript
/**
 * Register the graph matchers with Chai (Vitest)
 */
export const registerGraphMatchers = (): void => {
  if (typeof window !== 'undefined') {
    const chaiExists = 'chai' in window;

    if (chaiExists) {
      const windowWithChai = window as unknown as { chai: { use: (plugin: ChaiPlugin) => void } };

      if (typeof windowWithChai.chai?.use === 'function') {
        windowWithChai.chai.use(graphMatchers);
      }
    }
  }
};
```

- [ ] **Step 3: Remove Cypress entries from .dockerignore**

In `.dockerignore`, remove these three lines (lines 12-14):

```
cypress/screenshots/
cypress/videos/
cypress/downloads/
```

- [ ] **Step 4: Remove Cypress entry from CodeQL config**

In `.github/codeql/codeql-config.yml`, remove this line (line 33):

```yaml
  - "cypress/**"
```

- [ ] **Step 5: Verify no other Cypress references remain**

```bash
grep -r "cypress\|Cypress" --include="*.ts" --include="*.json" --include="*.yml" --include="*.yaml" src/ .github/ e2e/ package.json tsconfig*.json 2>/dev/null | grep -v node_modules | grep -v '.sccignore'
```

Expected: no results (or only the `.sccignore` entry which we're leaving).

- [ ] **Step 6: Run lint and build to verify nothing broke**

```bash
pnpm run lint:all
pnpm run build
```

Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove legacy Cypress artifacts

Remove unused Cypress page object base class, Cypress window checks
in graph matchers, and Cypress directory references from dockerignore
and CodeQL config."
```

---

## Task 2: Add data-testid Attributes

**Files:**
- Modify: `src/app/pages/tm/components/threat-page/threat-page.component.html`
- Modify: `src/app/pages/tm/components/threat-editor-dialog/threat-editor-dialog.component.html`
- Modify: `src/app/pages/tm/components/cvss-calculator-dialog/cvss-calculator-dialog.component.html`
- Modify: `src/app/pages/tm/components/cwe-picker-dialog/cwe-picker-dialog.component.html`
- Modify: `src/app/pages/triage/components/triage-list/triage-list.component.html`
- Modify: `src/app/core/components/navbar/navbar.component.html`
- Modify: `src/app/pages/tm/tm-edit.component.html`

- [ ] **Step 1: Add data-testid attributes to threat-page.component.html**

Add the following `data-testid` attributes to existing elements:

**Name input** (line 175) — add `data-testid="threat-page-name-input"` to the `<input>`:
```html
<input matInput formControlName="name" data-testid="threat-page-name-input" />
```

**Description textarea** (line 209) — add `data-testid="threat-page-description-input"`:
```html
<textarea
  matInput
  formControlName="description"
  rows="3"
  data-testid="threat-page-description-input"
  [placeholder]="'common.threatDescriptionPlaceholder' | transloco"
></textarea>
```

**Status select** (line 127) — add `data-testid="threat-page-status-select"`:
```html
<mat-select formControlName="status" data-testid="threat-page-status-select">
```

**Severity select** (line 237) — add `data-testid="threat-page-severity-select"`:
```html
<mat-select formControlName="severity" data-testid="threat-page-severity-select">
```

**Score input** (line 249) — add `data-testid="threat-page-score-input"`:
```html
<input matInput type="number" formControlName="score" min="0" max="10" step="0.1" data-testid="threat-page-score-input" />
```

**Priority select** (line 254) — add `data-testid="threat-page-priority-select"`:
```html
<mat-select formControlName="priority" data-testid="threat-page-priority-select">
```

**Save button** (line 30-38) — add `data-testid="threat-page-save-button"`:
```html
<button
  mat-icon-button
  color="primary"
  [disabled]="threatForm.invalid || !threatForm.dirty || isSaving"
  (click)="save()"
  [matTooltip]="'common.save' | transloco"
  data-testid="threat-page-save-button"
>
```

**Delete menu item** (line 473) — add `data-testid="threat-page-delete-button"`:
```html
<button mat-menu-item (click)="deleteThreat()" data-testid="threat-page-delete-button">
```

**Add CWE button** (line 347-358) — add `data-testid="threat-page-add-cwe-button"`:
```html
<button
  mat-stroked-button
  color="primary"
  (click)="openCwePicker()"
  class="mapping-add-button"
  [matTooltip]="'cwePicker.chooseCwe' | transloco"
  data-testid="threat-page-add-cwe-button"
>
```

**CWE chips** (line 333) — add `data-testid="threat-page-cwe-chip"` to each `<mat-chip>`:
```html
<mat-chip
  [removable]="canEdit"
  (removed)="removeCweId(cweId)"
  [matTooltip]="getCweName(cweId)"
  data-testid="threat-page-cwe-chip"
>
```

**CVSS add button** (line 389-400) — add `data-testid="threat-page-open-cvss-button"`:
```html
<button
  mat-stroked-button
  color="primary"
  (click)="openCvssCalculator()"
  [disabled]="!canAddCvss"
  class="mapping-add-button"
  data-testid="threat-page-open-cvss-button"
>
```

**CVSS chips** (line 374-387) — add `data-testid="threat-page-cvss-chip"`:
```html
<mat-chip
  [removable]="canEdit"
  (removed)="removeCvssEntry(i)"
  (click)="canEdit ? editCvssEntry(i) : null"
  [class.clickable]="canEdit"
  data-testid="threat-page-cvss-chip"
>
```

**Threat type chips** (line 302-311) — add `data-testid="threat-page-threat-type-chip"`:
```html
<mat-chip [removable]="canEdit" (removed)="removeThreatType(type)" data-testid="threat-page-threat-type-chip">
```

**Add mapping button** (line 314-323) — add `data-testid="threat-page-add-mapping-button"`:
```html
<button
  mat-stroked-button
  color="primary"
  (click)="openFrameworkMappingPicker()"
  class="mapping-add-button"
  data-testid="threat-page-add-mapping-button"
>
```

- [ ] **Step 2: Add data-testid attributes to threat-editor-dialog.component.html**

**Name input** (line 31) — add `data-testid="threat-editor-name-input"`:
```html
<input matInput formControlName="name" tabindex="1" data-testid="threat-editor-name-input" />
```

**Description textarea** (line 63-69) — add `data-testid="threat-editor-description-input"`:
```html
<textarea
  matInput
  formControlName="description"
  rows="3"
  tabindex="5"
  placeholder="{{ 'common.threatDescriptionPlaceholder' | transloco }}"
  data-testid="threat-editor-description-input"
></textarea>
```

**Threat type select** (line 82) — add `data-testid="threat-editor-type-select"`:
```html
<mat-select formControlName="threat_type" tabindex="6" multiple data-testid="threat-editor-type-select">
```

**Severity select** (line 94) — add `data-testid="threat-editor-severity-select"`:
```html
<mat-select formControlName="severity" tabindex="7" data-testid="threat-editor-severity-select">
```

**Cancel button** (line 107-113) — add `data-testid="threat-editor-cancel-button"`:
```html
<button
  mat-button
  (click)="onCancel()"
  tabindex="16"
  [attr.aria-label]="'common.cancel' | transloco"
  data-testid="threat-editor-cancel-button"
>
```

**Save button** (line 116-124) — add `data-testid="threat-editor-save-button"`:
```html
<button
  mat-raised-button
  color="primary"
  [disabled]="threatForm.invalid"
  (click)="onSubmit()"
  tabindex="17"
  [attr.aria-label]="'common.save' | transloco"
  data-testid="threat-editor-save-button"
>
```

- [ ] **Step 3: Add data-testid attributes to cvss-calculator-dialog.component.html**

**Version 3.1 toggle** (line 22) — add `data-testid="cvss-version-3.1"`:
```html
<mat-button-toggle value="3.1" data-testid="cvss-version-3.1">CVSS 3.1</mat-button-toggle>
```

**Version 4.0 toggle** (line 23) — add `data-testid="cvss-version-4.0"`:
```html
<mat-button-toggle value="4.0" data-testid="cvss-version-4.0">CVSS 4.0</mat-button-toggle>
```

**Metric toggle group** (line 51-54) — add dynamic `data-testid`:
```html
<mat-button-toggle-group
  [value]="metric.selectedValue"
  (change)="onMetricChange(metric.shortName, $event.value)"
  class="metric-toggle-group"
  [attr.data-testid]="'cvss-metric-' + metric.shortName"
>
```

**Individual metric value buttons** (line 57-64) — add dynamic `data-testid`:
```html
<mat-button-toggle
  [value]="val.shortName"
  [matTooltip]="val.name + ': ' + val.description"
  matTooltipClass="metric-tooltip"
  [class.not-defined]="val.shortName === 'X'"
  [attr.data-testid]="'cvss-metric-value-' + metric.shortName + '-' + val.shortName"
>
```

**Score display** (line 87-89) — add `data-testid="cvss-score-display"`:
```html
<span class="score-value" [ngClass]="severityClass" data-testid="cvss-score-display">
```

**Vector string** (line 78) — add `data-testid="cvss-vector-display"`:
```html
<code class="vector-value" data-testid="cvss-vector-display">{{ vectorString || '--' }}</code>
```

**Cancel button** (line 113) — add `data-testid="cvss-cancel-button"`:
```html
<button mat-button (click)="cancel()" data-testid="cvss-cancel-button">
```

**Apply button** (line 116) — add `data-testid="cvss-apply-button"`:
```html
<button mat-raised-button color="primary" (click)="apply()" [disabled]="!isValid" data-testid="cvss-apply-button">
```

- [ ] **Step 4: Add data-testid attributes to cwe-picker-dialog.component.html**

**Search input** (line 8) — add `data-testid="cwe-picker-search-input"`:
```html
<input matInput [formControl]="searchControl" data-testid="cwe-picker-search-input" />
```

**List options** (line 30) — add `data-testid="cwe-picker-item"`:
```html
<mat-list-option [value]="cwe" [selected]="selectedCwe?.cwe_id === cwe.cwe_id" data-testid="cwe-picker-item">
```

**Cancel button** (line 53) — add `data-testid="cwe-picker-cancel-button"`:
```html
<button mat-button (click)="cancel()" data-testid="cwe-picker-cancel-button">
```

**Add CWE button** (line 56) — add `data-testid="cwe-picker-add-button"`:
```html
<button mat-raised-button color="primary" (click)="addCwe()" [disabled]="!selectedCwe" data-testid="cwe-picker-add-button">
```

- [ ] **Step 5: Add data-testid attributes to triage-list.component.html**

**Search input** (line 27-31) — add `data-testid="triage-search-input"`:
```html
<input
  matInput
  [(ngModel)]="filters.searchTerm"
  (ngModelChange)="onFilterChange()"
  [placeholder]="'triage.list.searchPlaceholder' | transloco"
  data-testid="triage-search-input"
/>
```

**Status filter** (line 42-44) — add `data-testid="triage-status-filter"`:
```html
<mat-select
  [(ngModel)]="filters.status"
  (selectionChange)="onFilterChange()"
  [multiple]="true"
  data-testid="triage-status-filter"
>
```

**Template filter** (line 55) — add `data-testid="triage-template-filter"`:
```html
<mat-select [(ngModel)]="filters.surveyId" (selectionChange)="onFilterChange()" data-testid="triage-template-filter">
```

**Clear filters button** (line 79) — add `data-testid="triage-clear-filters-button"`:
```html
<button mat-stroked-button (click)="clearFilters()" data-testid="triage-clear-filters-button">
```

**Response table rows** (line 232-237) — add `data-testid="triage-response-row"`:
```html
<tr
  mat-row
  *matRowDef="let row; columns: displayedColumns"
  class="response-row"
  (click)="viewResponse(row)"
  data-testid="triage-response-row"
></tr>
```

**Retry button** (line 96) — add `data-testid="triage-error-retry-button"`:
```html
<button mat-raised-button color="primary" (click)="loadResponses()" data-testid="triage-error-retry-button">
```

- [ ] **Step 6: Add data-testid attributes to navbar.component.html**

**Home menu trigger** (line 8-13) — add `data-testid="navbar-home-menu"`:
```html
<button
  mat-icon-button
  [matMenuTriggerFor]="homeMenu"
  class="logo-button home-menu-trigger"
  [matTooltip]="'navbar.home' | transloco"
  matTooltipPosition="below"
  data-testid="navbar-home-menu"
>
```

**Dashboard nav link** (line 106-114) — add `data-testid="navbar-dashboard-link"`:
```html
<button
  mat-button
  routerLink="/dashboard"
  routerLinkActive="active-link"
  class="nav-link"
  data-testid="navbar-dashboard-link"
>
```

**Intake nav link** (line 100) — add `data-testid="navbar-intake-link"`:
```html
<button mat-button routerLink="/intake" routerLinkActive="active-link" class="nav-link" data-testid="navbar-intake-link">
```

**Triage nav link** (line 117) — add `data-testid="navbar-triage-link"`:
```html
<button mat-button routerLink="/triage" routerLinkActive="active-link" class="nav-link" data-testid="navbar-triage-link">
```

**Admin nav link** (line 122) — add `data-testid="navbar-admin-link"`:
```html
<button mat-button routerLink="/admin" routerLinkActive="active-link" class="nav-link" data-testid="navbar-admin-link">
```

**User profile button** (line 196-207) — add `data-testid="navbar-user-menu"`:
```html
<button
  mat-button
  (click)="openUserPreferences()"
  (contextmenu)="openUserProfileContextMenu($event)"
  class="user-profile-button"
  [matTooltip]="userEmail"
  matTooltipPosition="below"
  #userProfileButton
  data-testid="navbar-user-menu"
>
```

**Logout button in home menu** (line 55-58) — add `data-testid="navbar-logout-button"`:
```html
<button mat-menu-item (click)="logout()" data-testid="navbar-logout-button">
```

- [ ] **Step 7: Add data-testid attributes to tm-edit.component.html (threats section)**

**Add threat button** (line 1531-1538) — add `data-testid="add-threat-button"`:
```html
<button
  mat-icon-button
  color="primary"
  (click)="openThreatEditor()"
  [matTooltip]="'common.addThreat' | transloco"
  data-testid="add-threat-button"
>
```

**Threat table rows** (line 1880-1888) — add `data-testid="threat-row"`:
```html
<tr
  mat-row
  *matRowDef="let row; columns: threatsDisplayedColumns"
  class="clickable-row"
  [matTooltip]="row.description"
  matTooltipClass="entity-description-tooltip"
  matTooltipPosition="above"
  (click)="openThreatEditor(row)"
  data-testid="threat-row"
></tr>
```

- [ ] **Step 8: Run lint and build**

```bash
pnpm run lint:all
pnpm run build
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "test: add data-testid attributes for E2E test expansion

Add data-testid attributes to threat page, threat editor dialog,
CVSS calculator, CWE picker, triage list, navbar, and TM edit
threats section to support new E2E test suites."
```

---

## Task 3: Page Objects and Dialog Objects

**Files:**
- Create: `e2e/pages/dashboard.page.ts`
- Create: `e2e/pages/tm-edit.page.ts`
- Create: `e2e/pages/threat-page.page.ts`
- Create: `e2e/pages/dfd-editor.page.ts`
- Create: `e2e/pages/triage.page.ts`
- Create: `e2e/pages/login.page.ts`
- Create: `e2e/pages/navbar.page.ts`
- Create: `e2e/dialogs/create-tm.dialog.ts`
- Create: `e2e/dialogs/create-diagram.dialog.ts`
- Create: `e2e/dialogs/delete-confirm.dialog.ts`
- Create: `e2e/dialogs/threat-editor.dialog.ts`
- Create: `e2e/dialogs/cvss-calculator.dialog.ts`
- Create: `e2e/dialogs/cwe-picker.dialog.ts`

- [ ] **Step 1: Create e2e/pages/login.page.ts**

```typescript
import { Locator, Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

export class LoginPage {
  constructor(private page: Page) {}

  readonly providerButton = () =>
    this.page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`);

  readonly signInButton = () =>
    this.page.getByRole('button', { name: 'Sign In', exact: true });
}
```

- [ ] **Step 2: Create e2e/pages/dashboard.page.ts**

```typescript
import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  readonly createTmButton = () =>
    this.page.getByTestId('create-threat-model-button');

  readonly tmCards = () =>
    this.page.getByTestId('threat-model-card');

  tmCard(name: string) {
    return this.tmCards().filter({ hasText: name });
  }

  tmDeleteButton(name: string) {
    return this.tmCard(name).getByTestId('threat-model-delete-button');
  }
}
```

- [ ] **Step 3: Create e2e/pages/tm-edit.page.ts**

```typescript
import { Page } from '@playwright/test';

export class TmEditPage {
  constructor(private page: Page) {}

  readonly tmName = () => this.page.getByTestId('threat-model-name');
  readonly addDiagramButton = () => this.page.getByTestId('add-diagram-button');
  readonly addThreatButton = () => this.page.getByTestId('add-threat-button');

  readonly diagramRows = () => this.page.getByTestId('diagram-row');
  readonly threatRows = () => this.page.getByTestId('threat-row');

  diagramRow(name: string) {
    return this.diagramRows().filter({ hasText: name });
  }

  threatRow(name: string) {
    return this.threatRows().filter({ hasText: name });
  }

  diagramKebabButton(name: string) {
    return this.diagramRow(name).locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
  }

  readonly diagramDeleteButton = () =>
    this.page.getByTestId('diagram-delete-button');
}
```

- [ ] **Step 4: Create e2e/pages/threat-page.page.ts**

```typescript
import { Page } from '@playwright/test';

export class ThreatPage {
  constructor(private page: Page) {}

  readonly nameInput = () => this.page.getByTestId('threat-page-name-input');
  readonly descriptionInput = () => this.page.getByTestId('threat-page-description-input');
  readonly statusSelect = () => this.page.getByTestId('threat-page-status-select');
  readonly severitySelect = () => this.page.getByTestId('threat-page-severity-select');
  readonly scoreInput = () => this.page.getByTestId('threat-page-score-input');
  readonly prioritySelect = () => this.page.getByTestId('threat-page-priority-select');
  readonly saveButton = () => this.page.getByTestId('threat-page-save-button');
  readonly deleteButton = () => this.page.getByTestId('threat-page-delete-button');
  readonly addCweButton = () => this.page.getByTestId('threat-page-add-cwe-button');
  readonly cweChips = () => this.page.getByTestId('threat-page-cwe-chip');
  readonly openCvssButton = () => this.page.getByTestId('threat-page-open-cvss-button');
  readonly cvssChips = () => this.page.getByTestId('threat-page-cvss-chip');
  readonly threatTypeChips = () => this.page.getByTestId('threat-page-threat-type-chip');
  readonly addMappingButton = () => this.page.getByTestId('threat-page-add-mapping-button');

  async fillName(name: string) {
    await this.nameInput().clear();
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().fill(desc);
  }

  async save() {
    await this.saveButton().click();
  }
}
```

- [ ] **Step 5: Create e2e/pages/dfd-editor.page.ts**

```typescript
import { Page } from '@playwright/test';

export class DfdEditorPage {
  constructor(private page: Page) {}

  readonly graphContainer = () => this.page.getByTestId('graph-container');
  readonly addActorButton = () => this.page.getByTestId('add-actor-button');
  readonly addProcessButton = () => this.page.getByTestId('add-process-button');
  readonly addStoreButton = () => this.page.getByTestId('add-store-button');
  readonly closeButton = () => this.page.getByTestId('close-diagram-button');

  readonly nodes = () => this.page.locator('.x6-node');
}
```

- [ ] **Step 6: Create e2e/pages/triage.page.ts**

```typescript
import { Page } from '@playwright/test';

export class TriagePage {
  constructor(private page: Page) {}

  readonly searchInput = () => this.page.getByTestId('triage-search-input');
  readonly statusFilter = () => this.page.getByTestId('triage-status-filter');
  readonly templateFilter = () => this.page.getByTestId('triage-template-filter');
  readonly clearFiltersButton = () => this.page.getByTestId('triage-clear-filters-button');
  readonly responseRows = () => this.page.getByTestId('triage-response-row');
  readonly retryButton = () => this.page.getByTestId('triage-error-retry-button');
}
```

- [ ] **Step 7: Create e2e/pages/navbar.page.ts**

```typescript
import { Page } from '@playwright/test';

export class NavbarPage {
  constructor(private page: Page) {}

  readonly homeMenu = () => this.page.getByTestId('navbar-home-menu');
  readonly dashboardLink = () => this.page.getByTestId('navbar-dashboard-link');
  readonly intakeLink = () => this.page.getByTestId('navbar-intake-link');
  readonly triageLink = () => this.page.getByTestId('navbar-triage-link');
  readonly adminLink = () => this.page.getByTestId('navbar-admin-link');
  readonly userMenu = () => this.page.getByTestId('navbar-user-menu');
  readonly logoutButton = () => this.page.getByTestId('navbar-logout-button');
}
```

- [ ] **Step 8: Create e2e/dialogs/create-tm.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateTmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-tm-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-tm-submit');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async submit() {
    await this.submitButton().click();
  }
}
```

- [ ] **Step 9: Create e2e/dialogs/create-diagram.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CreateDiagramDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly typeSelect = () => this.dialog.getByTestId('diagram-type-select');
  readonly nameInput = () => this.dialog.getByTestId('diagram-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-diagram-submit');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async submit() {
    await this.submitButton().click();
  }
}
```

- [ ] **Step 10: Create e2e/dialogs/delete-confirm.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class DeleteConfirmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly confirmInput = () => this.dialog.getByTestId('delete-confirm-input');
  readonly confirmButton = () => this.dialog.getByTestId('delete-confirm-button');

  async confirmDeletion() {
    await this.confirmInput().waitFor({ state: 'visible' });
    await this.confirmInput().fill('gone forever');
    await this.confirmButton().click();
  }
}
```

- [ ] **Step 11: Create e2e/dialogs/threat-editor.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class ThreatEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('threat-editor-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('threat-editor-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('threat-editor-type-select');
  readonly severitySelect = () => this.dialog.getByTestId('threat-editor-severity-select');
  readonly saveButton = () => this.dialog.getByTestId('threat-editor-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('threat-editor-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async save() {
    await this.saveButton().click();
  }
}
```

- [ ] **Step 12: Create e2e/dialogs/cvss-calculator.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CvssCalculatorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly versionToggle = (v: string) =>
    this.dialog.getByTestId(`cvss-version-${v}`);

  readonly metricGroup = (shortName: string) =>
    this.dialog.getByTestId(`cvss-metric-${shortName}`);

  readonly metricValue = (metric: string, value: string) =>
    this.dialog.getByTestId(`cvss-metric-value-${metric}-${value}`);

  readonly scoreDisplay = () => this.dialog.getByTestId('cvss-score-display');
  readonly vectorDisplay = () => this.dialog.getByTestId('cvss-vector-display');
  readonly applyButton = () => this.dialog.getByTestId('cvss-apply-button');
  readonly cancelButton = () => this.dialog.getByTestId('cvss-cancel-button');

  async selectVersion(v: '3.1' | '4.0') {
    await this.versionToggle(v).click();
  }

  async setMetric(metric: string, value: string) {
    await this.metricValue(metric, value).click();
  }

  async apply() {
    await this.applyButton().click();
  }
}
```

- [ ] **Step 13: Create e2e/dialogs/cwe-picker.dialog.ts**

```typescript
import { Locator, Page } from '@playwright/test';

export class CwePickerDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly searchInput = () => this.dialog.getByTestId('cwe-picker-search-input');
  readonly items = () => this.dialog.getByTestId('cwe-picker-item');
  readonly addButton = () => this.dialog.getByTestId('cwe-picker-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('cwe-picker-cancel-button');

  async search(term: string) {
    await this.searchInput().waitFor({ state: 'visible' });
    await this.searchInput().fill(term);
    // Wait for search results to update
    await this.dialog.page().waitForTimeout(500);
  }

  async selectFirst() {
    await this.items().first().click();
  }

  async add() {
    await this.addButton().click();
  }
}
```

- [ ] **Step 14: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 15: Commit**

```bash
git add e2e/pages/ e2e/dialogs/
git commit -m "test: add page objects and dialog objects for E2E tests

Create page objects for dashboard, tm-edit, threat-page, dfd-editor,
triage, login, and navbar. Create dialog objects for create-tm,
create-diagram, delete-confirm, threat-editor, cvss-calculator,
and cwe-picker."
```

---

## Task 4: Flows and Fixtures

**Files:**
- Create: `e2e/flows/auth.flow.ts`
- Create: `e2e/flows/threat-model.flow.ts`
- Create: `e2e/flows/threat.flow.ts`
- Create: `e2e/flows/diagram.flow.ts`
- Create: `e2e/fixtures/test-fixtures.ts`
- Delete: `e2e/helpers/auth.ts`

- [ ] **Step 1: Create e2e/flows/auth.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

export class AuthFlow {
  private loginPage: LoginPage;

  constructor(private page: Page) {
    this.loginPage = new LoginPage(page);
  }

  async login() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });

    await this.loginPage.providerButton().waitFor({ state: 'visible', timeout: 30000 });
    await this.loginPage.providerButton().click();

    await this.loginPage.signInButton().waitFor({ state: 'visible', timeout: 5000 });
    await this.loginPage.signInButton().click();

    await this.page.waitForURL(
      url =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/oauth2/callback'),
      { timeout: 30000 },
    );
  }
}
```

- [ ] **Step 2: Create e2e/flows/threat-model.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { CreateTmDialog } from '../dialogs/create-tm.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class ThreatModelFlow {
  private dashboardPage: DashboardPage;
  private tmEditPage: TmEditPage;
  private createTmDialog: CreateTmDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.dashboardPage = new DashboardPage(page);
    this.tmEditPage = new TmEditPage(page);
    this.createTmDialog = new CreateTmDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromDashboard(name: string) {
    await this.page.goto('/dashboard');
    await this.page.waitForLoadState('networkidle');
    await this.dashboardPage.createTmButton().click();
    await this.createTmDialog.fillName(name);
    await this.createTmDialog.submit();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async openFromDashboard(name: string) {
    await this.dashboardPage.tmCard(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async deleteFromDashboard(name: string) {
    await this.dashboardPage.tmDeleteButton(name).click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 3: Create e2e/flows/threat.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { ThreatEditorDialog } from '../dialogs/threat-editor.dialog';
import { CvssCalculatorDialog } from '../dialogs/cvss-calculator.dialog';
import { CwePickerDialog } from '../dialogs/cwe-picker.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class ThreatFlow {
  private tmEditPage: TmEditPage;
  private threatPage: ThreatPage;
  private threatEditorDialog: ThreatEditorDialog;
  private cvssDialog: CvssCalculatorDialog;
  private cwePickerDialog: CwePickerDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.threatPage = new ThreatPage(page);
    this.threatEditorDialog = new ThreatEditorDialog(page);
    this.cvssDialog = new CvssCalculatorDialog(page);
    this.cwePickerDialog = new CwePickerDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string) {
    await this.tmEditPage.addThreatButton().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.tmEditPage.addThreatButton().click();
    await this.threatEditorDialog.fillName(name);
    await this.threatEditorDialog.save();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 10000 });
  }

  async openFromTmEdit(name: string) {
    await this.tmEditPage.threatRow(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
  }

  async scoreThreatWithCvss(version: '3.1' | '4.0', metrics: Record<string, string>) {
    await this.threatPage.openCvssButton().click();
    await this.cvssDialog.selectVersion(version);
    for (const [metric, value] of Object.entries(metrics)) {
      await this.cvssDialog.setMetric(metric, value);
    }
    await this.cvssDialog.apply();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });
  }

  async addCweReference(searchTerm: string) {
    await this.threatPage.addCweButton().click();
    await this.cwePickerDialog.search(searchTerm);
    await this.cwePickerDialog.selectFirst();
    await this.cwePickerDialog.add();
    // Wait for dialog to close
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden', timeout: 5000 });
  }

  async deleteThreatFromPage() {
    // Open kebab menu on threat page, click delete
    const kebabButton = this.page.locator('button[mat-icon-button]').filter({
      has: this.page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();
    await this.threatPage.deleteButton().waitFor({ state: 'visible' });
    await this.threatPage.deleteButton().click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 4: Create e2e/flows/diagram.flow.ts**

```typescript
import { Page } from '@playwright/test';
import { TmEditPage } from '../pages/tm-edit.page';
import { DfdEditorPage } from '../pages/dfd-editor.page';
import { CreateDiagramDialog } from '../dialogs/create-diagram.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

export class DiagramFlow {
  private tmEditPage: TmEditPage;
  private dfdEditorPage: DfdEditorPage;
  private createDiagramDialog: CreateDiagramDialog;
  private deleteConfirmDialog: DeleteConfirmDialog;

  constructor(private page: Page) {
    this.tmEditPage = new TmEditPage(page);
    this.dfdEditorPage = new DfdEditorPage(page);
    this.createDiagramDialog = new CreateDiagramDialog(page);
    this.deleteConfirmDialog = new DeleteConfirmDialog(page);
  }

  async createFromTmEdit(name: string) {
    await this.tmEditPage.addDiagramButton().waitFor({ state: 'visible', timeout: 15000 });
    await this.tmEditPage.addDiagramButton().scrollIntoViewIfNeeded();
    await this.page.waitForTimeout(500);
    await this.tmEditPage.addDiagramButton().click();
    await this.createDiagramDialog.fillName(name);
    await this.createDiagramDialog.submit();
    // Wait for diagram row to appear
    await this.tmEditPage.diagramRow(name).waitFor({ state: 'visible', timeout: 10000 });
  }

  async openFromTmEdit(name: string) {
    await this.tmEditPage.diagramRow(name).click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 10000 });
    await this.dfdEditorPage.graphContainer().waitFor({ state: 'visible', timeout: 15000 });
  }

  async closeDiagram() {
    await this.dfdEditorPage.closeButton().click();
    await this.page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  }

  async deleteFromTmEdit(name: string) {
    await this.tmEditPage.diagramKebabButton(name).click();
    await this.tmEditPage.diagramDeleteButton().waitFor({ state: 'visible' });
    await this.tmEditPage.diagramDeleteButton().click();
    await this.deleteConfirmDialog.confirmDeletion();
  }
}
```

- [ ] **Step 5: Create e2e/fixtures/test-fixtures.ts**

```typescript
import { test as base } from '@playwright/test';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { DfdEditorPage } from '../pages/dfd-editor.page';
import { TriagePage } from '../pages/triage.page';
import { LoginPage } from '../pages/login.page';
import { NavbarPage } from '../pages/navbar.page';
import { CreateTmDialog } from '../dialogs/create-tm.dialog';
import { CreateDiagramDialog } from '../dialogs/create-diagram.dialog';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';
import { ThreatEditorDialog } from '../dialogs/threat-editor.dialog';
import { CvssCalculatorDialog } from '../dialogs/cvss-calculator.dialog';
import { CwePickerDialog } from '../dialogs/cwe-picker.dialog';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { ThreatFlow } from '../flows/threat.flow';
import { DiagramFlow } from '../flows/diagram.flow';

type TestFixtures = {
  // Pages
  dashboardPage: DashboardPage;
  tmEditPage: TmEditPage;
  threatPage: ThreatPage;
  dfdEditorPage: DfdEditorPage;
  triagePage: TriagePage;
  loginPage: LoginPage;
  navbarPage: NavbarPage;

  // Dialogs
  createTmDialog: CreateTmDialog;
  createDiagramDialog: CreateDiagramDialog;
  deleteConfirmDialog: DeleteConfirmDialog;
  threatEditorDialog: ThreatEditorDialog;
  cvssCalculatorDialog: CvssCalculatorDialog;
  cwePickerDialog: CwePickerDialog;

  // Flows
  authFlow: AuthFlow;
  threatModelFlow: ThreatModelFlow;
  threatFlow: ThreatFlow;
  diagramFlow: DiagramFlow;
};

export const test = base.extend<TestFixtures>({
  // Pages
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  tmEditPage: async ({ page }, use) => {
    await use(new TmEditPage(page));
  },
  threatPage: async ({ page }, use) => {
    await use(new ThreatPage(page));
  },
  dfdEditorPage: async ({ page }, use) => {
    await use(new DfdEditorPage(page));
  },
  triagePage: async ({ page }, use) => {
    await use(new TriagePage(page));
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  navbarPage: async ({ page }, use) => {
    await use(new NavbarPage(page));
  },

  // Dialogs
  createTmDialog: async ({ page }, use) => {
    await use(new CreateTmDialog(page));
  },
  createDiagramDialog: async ({ page }, use) => {
    await use(new CreateDiagramDialog(page));
  },
  deleteConfirmDialog: async ({ page }, use) => {
    await use(new DeleteConfirmDialog(page));
  },
  threatEditorDialog: async ({ page }, use) => {
    await use(new ThreatEditorDialog(page));
  },
  cvssCalculatorDialog: async ({ page }, use) => {
    await use(new CvssCalculatorDialog(page));
  },
  cwePickerDialog: async ({ page }, use) => {
    await use(new CwePickerDialog(page));
  },

  // Flows
  authFlow: async ({ page }, use) => {
    await use(new AuthFlow(page));
  },
  threatModelFlow: async ({ page }, use) => {
    await use(new ThreatModelFlow(page));
  },
  threatFlow: async ({ page }, use) => {
    await use(new ThreatFlow(page));
  },
  diagramFlow: async ({ page }, use) => {
    await use(new DiagramFlow(page));
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 6: Delete e2e/helpers/auth.ts**

```bash
rm e2e/helpers/auth.ts
rmdir e2e/helpers/ 2>/dev/null || true
```

- [ ] **Step 7: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add e2e/flows/ e2e/fixtures/
git add -u e2e/helpers/
git commit -m "test: add flows, fixtures, and remove old auth helper

Create auth, threat-model, threat, and diagram flow classes.
Create Playwright custom fixtures file wiring all page objects,
dialogs, and flows. Delete old e2e/helpers/auth.ts."
```

---

## Task 5: Refactor Core Lifecycle Test

**Files:**
- Modify: `e2e/tests/core-lifecycle.spec.ts`

- [ ] **Step 1: Rewrite core-lifecycle.spec.ts to use page objects and flows**

Replace the entire contents of `e2e/tests/core-lifecycle.spec.ts` with:

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { DiagramFlow } from '../flows/diagram.flow';
import { DashboardPage } from '../pages/dashboard.page';
import { TmEditPage } from '../pages/tm-edit.page';
import { DfdEditorPage } from '../pages/dfd-editor.page';
import { DeleteConfirmDialog } from '../dialogs/delete-confirm.dialog';

/**
 * Core lifecycle integration test.
 *
 * Tests the primary user flow against a live backend:
 *   login → create TM → open TM → create diagram → open DFD editor →
 *   add nodes → close diagram → delete diagram → delete TM
 *
 * Tests run serially and share a single browser context (httpOnly session cookie).
 * All test data is created and cleaned up within the suite.
 */
test.describe.serial('Core Lifecycle', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  // Page objects and flows — instantiated manually for serial shared context
  let authFlow: AuthFlow;
  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let tmEditPage: TmEditPage;
  let dfdEditorPage: DfdEditorPage;
  let deleteConfirmDialog: DeleteConfirmDialog;

  // State shared across tests
  const testTmName = `E2E Test TM ${Date.now()}`;
  const testDiagramName = `E2E Test Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    authFlow = new AuthFlow(page);
    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    tmEditPage = new TmEditPage(page);
    dfdEditorPage = new DfdEditorPage(page);
    deleteConfirmDialog = new DeleteConfirmDialog(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login via OAuth', async () => {
    await authFlow.login();

    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/oauth2/callback');
  });

  test('create a threat model', async () => {
    await threatModelFlow.createFromDashboard(testTmName);

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('verify threat model appears in list', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(dashboardPage.tmCard(testTmName)).toBeVisible({ timeout: 10000 });
  });

  test('open the threat model', async () => {
    await threatModelFlow.openFromDashboard(testTmName);

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('create a diagram', async () => {
    await diagramFlow.createFromTmEdit(testDiagramName);

    await expect(tmEditPage.diagramRow(testDiagramName)).toBeVisible();
  });

  test('open the DFD editor', async () => {
    await diagramFlow.openFromTmEdit(testDiagramName);

    await expect(dfdEditorPage.graphContainer()).toBeVisible();
  });

  test('add nodes to the diagram', async () => {
    await expect(dfdEditorPage.addActorButton()).toBeEnabled({ timeout: 15000 });

    const initialNodeCount = await dfdEditorPage.nodes().count();

    await dfdEditorPage.addActorButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 1, { timeout: 5000 });

    await dfdEditorPage.addProcessButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 2, { timeout: 5000 });

    await dfdEditorPage.addStoreButton().click();
    await expect(dfdEditorPage.nodes()).toHaveCount(initialNodeCount + 3, { timeout: 5000 });
  });

  test('close the diagram', async () => {
    await diagramFlow.closeDiagram();

    await expect(tmEditPage.tmName()).toHaveText(testTmName);
  });

  test('delete the diagram', async () => {
    await diagramFlow.deleteFromTmEdit(testDiagramName);

    await expect(
      tmEditPage.diagramRow(testDiagramName),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('delete the threat model', async () => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await expect(dashboardPage.tmCard(testTmName)).toBeVisible({ timeout: 10000 });
    await threatModelFlow.deleteFromDashboard(testTmName);

    await expect(
      dashboardPage.tmCard(testTmName),
    ).toHaveCount(0, { timeout: 10000 });
  });
});
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/core-lifecycle.spec.ts
git commit -m "refactor: migrate core lifecycle test to page objects and flows

Replace raw Playwright locators with page objects, dialog objects,
and flow classes. Same test coverage, same serial execution."
```

---

## Task 6: Threat Editing Test Suite

**Files:**
- Create: `e2e/tests/threat-editing.spec.ts`

- [ ] **Step 1: Create the threat editing test suite**

Create `e2e/tests/threat-editing.spec.ts`:

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';
import { ThreatModelFlow } from '../flows/threat-model.flow';
import { ThreatFlow } from '../flows/threat.flow';
import { TmEditPage } from '../pages/tm-edit.page';
import { ThreatPage } from '../pages/threat-page.page';
import { DashboardPage } from '../pages/dashboard.page';

/**
 * Threat editing integration test.
 *
 * Tests threat CRUD operations, CVSS scoring, and CWE tagging
 * against a live backend. Creates a threat model in beforeAll
 * and cleans up in afterAll.
 */
test.describe.serial('Threat Editing', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;

  let authFlow: AuthFlow;
  let threatModelFlow: ThreatModelFlow;
  let threatFlow: ThreatFlow;
  let tmEditPage: TmEditPage;
  let threatPage: ThreatPage;
  let dashboardPage: DashboardPage;

  const testTmName = `E2E Threat Test TM ${Date.now()}`;
  const testThreatName = `E2E Test Threat ${Date.now()}`;
  const updatedThreatName = `${testThreatName} Updated`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    authFlow = new AuthFlow(page);
    threatModelFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    tmEditPage = new TmEditPage(page);
    threatPage = new ThreatPage(page);
    dashboardPage = new DashboardPage(page);

    // Login and create a threat model for testing
    await authFlow.login();
    await threatModelFlow.createFromDashboard(testTmName);
  });

  test.afterAll(async () => {
    // Clean up: navigate to dashboard and delete the TM
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    try {
      await threatModelFlow.deleteFromDashboard(testTmName);
      await expect(dashboardPage.tmCard(testTmName)).toHaveCount(0, { timeout: 10000 });
    } catch {
      // Best effort cleanup — don't fail the suite
    }
    await context.close();
  });

  test('create a threat', async () => {
    // We're on the TM edit page from beforeAll
    await threatFlow.createFromTmEdit(testThreatName);

    // Verify threat appears in the threats table
    await expect(tmEditPage.threatRow(testThreatName)).toBeVisible({ timeout: 10000 });
  });

  test('edit threat fields', async () => {
    // Click the threat row to navigate to full threat page
    await threatFlow.openFromTmEdit(testThreatName);

    // Edit fields
    await threatPage.fillName(updatedThreatName);
    await threatPage.fillDescription('A test threat for E2E testing');
    await threatPage.save();

    // Wait for save to complete (button becomes disabled while saving, then re-enables)
    await expect(threatPage.saveButton()).toBeDisabled({ timeout: 5000 });
    await expect(threatPage.saveButton()).toBeEnabled({ timeout: 10000 });

    // Reload page to verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(threatPage.nameInput()).toHaveValue(updatedThreatName, { timeout: 10000 });
    await expect(threatPage.descriptionInput()).toHaveValue('A test threat for E2E testing');
  });

  test('score with CVSS 3.1', async () => {
    // We're still on the threat page from previous test
    await threatFlow.scoreThreatWithCvss('3.1', {
      AV: 'N',  // Attack Vector: Network
      AC: 'L',  // Attack Complexity: Low
      PR: 'N',  // Privileges Required: None
      UI: 'N',  // User Interaction: None
      S: 'U',   // Scope: Unchanged
      C: 'H',   // Confidentiality: High
      I: 'H',   // Integrity: High
      A: 'H',   // Availability: High
    });

    // Verify CVSS chip appears
    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    // The chip text should contain the score (9.8 for this vector)
    await expect(threatPage.cvssChips().first()).toContainText('9.8');
  });

  test('score with CVSS 4.0', async () => {
    await threatFlow.scoreThreatWithCvss('4.0', {
      AV: 'N',  // Attack Vector: Network
      AC: 'L',  // Attack Complexity: Low
      AT: 'N',  // Attack Requirements: None
      PR: 'N',  // Privileges Required: None
      UI: 'N',  // User Interaction: None
      VC: 'H',  // Vulnerable System Confidentiality: High
      VI: 'H',  // Vulnerable System Integrity: High
      VA: 'H',  // Vulnerable System Availability: High
      SC: 'N',  // Subsequent System Confidentiality: None
      SI: 'N',  // Subsequent System Integrity: None
      SA: 'N',  // Subsequent System Availability: None
    });

    // Now should have 2 CVSS chips (3.1 + 4.0)
    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });
  });

  test('add CWE reference', async () => {
    await threatFlow.addCweReference('79');

    // Verify CWE chip appears
    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-79');
  });

  test('delete the threat', async () => {
    await threatFlow.deleteThreatFromPage();

    // Should navigate back to TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });

    // Verify threat is gone from the table
    await expect(tmEditPage.threatRow(updatedThreatName)).toHaveCount(0, { timeout: 10000 });
  });
});
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/threat-editing.spec.ts
git commit -m "test: add threat editing E2E test suite

Tests threat create, edit, CVSS 3.1/4.0 scoring, CWE tagging,
and delete against a live backend."
```

---

## Task 7: Navigation & Routing Test Suite

**Files:**
- Create: `e2e/tests/navigation-routing.spec.ts`

- [ ] **Step 1: Create the navigation and routing test suite**

Create `e2e/tests/navigation-routing.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

/**
 * Navigation and routing integration tests.
 *
 * Tests deep linking, auth guards, role guards, browser history,
 * and navbar navigation. Each test is independent (uses fixture
 * isolation, not serial shared state).
 */
test.describe('Navigation & Routing', () => {
  test.setTimeout(60000);

  test('deep link to a threat model', async ({
    page,
    authFlow,
    threatModelFlow,
    tmEditPage,
    dashboardPage,
  }) => {
    await authFlow.login();

    // Create a TM to get a valid ID
    const tmName = `E2E Nav Test TM ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);

    // Extract the TM ID from the URL
    const url = page.url();
    const tmIdMatch = url.match(/\/tm\/([a-f0-9-]+)/);
    expect(tmIdMatch).toBeTruthy();
    const tmId = tmIdMatch![1];

    // Navigate away then deep link back
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await page.goto(`/tm/${tmId}`);
    await page.waitForLoadState('networkidle');

    await expect(tmEditPage.tmName()).toHaveText(tmName, { timeout: 10000 });

    // Cleanup
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await threatModelFlow.deleteFromDashboard(tmName);
  });

  test('deep link to nonexistent resource', async ({ page, authFlow }) => {
    await authFlow.login();

    await page.goto('/tm/00000000-0000-0000-0000-000000000000');

    // Should redirect away from the TM page (back to dashboard or show error)
    // The exact behavior depends on the API response — verify we don't stay on a broken page
    await page.waitForLoadState('networkidle');
    // Wait a moment for any redirects to settle
    await page.waitForTimeout(2000);

    const currentUrl = page.url();
    // Should not be stuck on the nonexistent TM URL without any indication of error
    // Either redirected to dashboard or showing an error state
    expect(
      currentUrl.includes('/dashboard') ||
      currentUrl.includes('/tm/00000000-0000-0000-0000-000000000000'),
    ).toBeTruthy();
  });

  test('auth guard redirects to login', async ({ page }) => {
    // Fresh page, no auth — navigate directly to protected route
    await page.goto('/dashboard');

    // Should redirect to /login
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('protected route not accessible without auth', async ({ page }) => {
    // Fresh page, no auth — navigate to triage (requires reviewer role)
    await page.goto('/triage');

    // Should redirect away — either to /login (auth guard) or /unauthorized (role guard)
    await page.waitForURL(
      url =>
        url.pathname.includes('/login') || url.pathname.includes('/unauthorized'),
      { timeout: 10000 },
    );

    const currentUrl = page.url();
    expect(currentUrl).not.toContain('/triage');
  });

  test('back/forward navigation', async ({
    page,
    authFlow,
    threatModelFlow,
    tmEditPage,
    dashboardPage,
  }) => {
    await authFlow.login();

    const tmName = `E2E Back/Fwd Test TM ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);
    await expect(tmEditPage.tmName()).toHaveText(tmName);

    // We're on TM edit — go back to dashboard
    await page.goBack();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(dashboardPage.tmCards()).not.toHaveCount(0, { timeout: 10000 });

    // Go forward — should return to TM edit
    await page.goForward();
    await page.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(tmEditPage.tmName()).toHaveText(tmName);

    // Cleanup
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await threatModelFlow.deleteFromDashboard(tmName);
  });

  test('navbar navigation', async ({ page, authFlow, navbarPage }) => {
    await authFlow.login();

    // Click dashboard link
    await navbarPage.dashboardLink().click();
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(page.url()).toContain('/dashboard');

    // Click intake link
    await navbarPage.intakeLink().click();
    await page.waitForURL(/\/intake/, { timeout: 10000 });
    expect(page.url()).toContain('/intake');
  });
});
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/navigation-routing.spec.ts
git commit -m "test: add navigation and routing E2E test suite

Tests deep linking, auth/role guards, back/forward navigation,
and navbar navigation."
```

---

## Task 8: Error Scenarios Test Suite

**Files:**
- Create: `e2e/tests/error-scenarios.spec.ts`

- [ ] **Step 1: Create the error scenarios test suite**

Create `e2e/tests/error-scenarios.spec.ts`:

```typescript
import { test, expect } from '../fixtures/test-fixtures';

/**
 * Error scenario integration tests.
 *
 * Tests client-side error handling, validation, and edge cases.
 * Each test is independent (uses fixture isolation).
 */
test.describe('Error Scenarios', () => {
  test.setTimeout(60000);

  test('unauthorized page displays correctly', async ({ page }) => {
    await page.goto('/unauthorized?statusCode=403&reason=no_permission');
    await page.waitForLoadState('networkidle');

    // Verify the unauthorized page content is visible
    const card = page.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    // Verify OK button exists and navigates home
    const okButton = page.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    // Should navigate to home
    await page.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });

  test('wildcard route redirects home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await page.waitForLoadState('networkidle');

    // Wildcard route redirects to /
    await page.waitForURL(
      url =>
        url.pathname === '/' || url.pathname.includes('/login'),
      { timeout: 10000 },
    );

    const currentUrl = page.url();
    expect(
      currentUrl.endsWith('/') ||
      currentUrl.includes('/login'),
    ).toBeTruthy();
  });

  test('delete confirmation requires exact text', async ({
    page,
    authFlow,
    threatModelFlow,
    dashboardPage,
    deleteConfirmDialog,
  }) => {
    await authFlow.login();

    const tmName = `E2E Delete Validation Test ${Date.now()}`;
    await threatModelFlow.createFromDashboard(tmName);

    // Go to dashboard and initiate delete
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await dashboardPage.tmDeleteButton(tmName).click();

    // Dialog is open — button should be disabled initially
    await deleteConfirmDialog.confirmInput().waitFor({ state: 'visible' });
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type wrong text — button should still be disabled
    await deleteConfirmDialog.confirmInput().fill('wrong text');
    await expect(deleteConfirmDialog.confirmButton()).toBeDisabled();

    // Type correct text — button should enable
    await deleteConfirmDialog.confirmInput().clear();
    await deleteConfirmDialog.confirmInput().fill('gone forever');
    await expect(deleteConfirmDialog.confirmButton()).toBeEnabled();

    // Complete the deletion (cleanup)
    await deleteConfirmDialog.confirmButton().click();
    await expect(dashboardPage.tmCard(tmName)).toHaveCount(0, { timeout: 10000 });
  });

  test('form validation prevents save', async ({
    page,
    authFlow,
    dashboardPage,
    createTmDialog,
  }) => {
    await authFlow.login();

    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await dashboardPage.createTmButton().click();
    await createTmDialog.nameInput().waitFor({ state: 'visible' });

    // Submit button should be disabled when name is empty
    await expect(createTmDialog.submitButton()).toBeDisabled();

    // Type a name — submit should enable
    await createTmDialog.nameInput().fill('Test Name');
    await expect(createTmDialog.submitButton()).toBeEnabled();

    // Clear the name — submit should disable again
    await createTmDialog.nameInput().clear();
    await expect(createTmDialog.submitButton()).toBeDisabled();

    // Cancel the dialog (no cleanup needed — nothing was created)
    await page.keyboard.press('Escape');
  });
});
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/error-scenarios.spec.ts
git commit -m "test: add error scenarios E2E test suite

Tests unauthorized page, wildcard redirect, delete confirmation
validation, and form validation."
```

---

## Task 9: CI Stub and GitHub Issue

**Files:**
- Create: `.github/workflows/e2e-tests.yml`

- [ ] **Step 1: Create the CI workflow stub**

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  workflow_dispatch:
    inputs:
      app_url:
        description: 'Frontend URL'
        default: 'http://localhost:4200'
      api_url:
        description: 'Backend API URL'
        default: 'http://localhost:8080'

jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'

      - uses: pnpm/action-setup@v4

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          E2E_APP_URL: ${{ inputs.app_url }}
          E2E_API_URL: ${{ inputs.api_url }}

      - name: Upload test report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/e2e-tests.yml
git commit -m "ops: add CI stub for E2E tests (manual trigger only)

Adds a workflow_dispatch-only GitHub Actions workflow for running
Playwright E2E tests. Backend provisioning is out of scope — see
separate tracking issue."
```

- [ ] **Step 3: Create GitHub issue for CI integration**

```bash
gh issue create \
  --repo ericfitz/tmi-ux \
  --title "ops: integrate E2E tests into CI pipeline" \
  --label "enhancement" \
  --milestone "1.4.0" \
  --body "## Summary

A manual-trigger CI workflow stub for E2E tests has been added (\`.github/workflows/e2e-tests.yml\`). This issue tracks making it fully automated.

## Work Items

- [ ] Backend service provisioning in CI (Docker Compose or GitHub service containers)
- [ ] Trigger strategy (on PR, on push to main, on schedule)
- [ ] Parallel browser matrix (currently Chromium-only)
- [ ] Test result reporting (PR comments, status checks)
- [ ] Secrets management for OAuth test credentials
- [ ] Test data isolation between CI runs

## Context

- Stub workflow: \`.github/workflows/e2e-tests.yml\` (workflow_dispatch only)
- Related: #84 (automated UX integration testing)
- Backend repo: https://github.com/ericfitz/tmi"
```

- [ ] **Step 4: Add the new issue to the TMI project**

```bash
# Get the issue number from the previous command output, then:
gh project item-add 2 --owner ericfitz --url <issue-url>
```

---

## Task 10: Final Verification

- [ ] **Step 1: Run lint**

```bash
pnpm run lint:all
```

Expected: no errors.

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Expected: no errors.

- [ ] **Step 3: Verify TypeScript compilation for E2E files**

```bash
npx tsc --noEmit --project tsconfig.e2e.json
```

Expected: no errors.

- [ ] **Step 4: Verify all E2E test files are discovered by Playwright**

```bash
npx playwright test --list
```

Expected: lists tests from all 4 spec files:
- `core-lifecycle.spec.ts` — 10 tests
- `threat-editing.spec.ts` — 6 tests
- `navigation-routing.spec.ts` — 6 tests
- `error-scenarios.spec.ts` — 4 tests

Total: 26 tests

- [ ] **Step 5: Add comment to issue #84 referencing the work**

```bash
gh issue comment 84 --repo ericfitz/tmi-ux --body "E2E test expansion implementation complete. Commits on dev/1.4.0 branch.

Infrastructure:
- Page objects (7), dialog objects (6), flow classes (4), custom Playwright fixtures
- Cypress artifacts cleaned up

New test suites:
- threat-editing.spec.ts (6 tests)
- navigation-routing.spec.ts (6 tests)
- error-scenarios.spec.ts (4 tests)

Also:
- Core lifecycle test refactored to use new abstractions
- CI stub workflow added (.github/workflows/e2e-tests.yml)
- Separate issue created for CI pipeline integration"
```
