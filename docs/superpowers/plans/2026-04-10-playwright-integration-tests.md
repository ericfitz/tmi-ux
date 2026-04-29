# Playwright Integration Tests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trustworthy Playwright integration test suite that verifies the core threat model lifecycle against a live local backend.

**Architecture:** Single serial test suite sharing a `BrowserContext` with httpOnly cookie-based auth. Tests create their own data and clean up by exercising delete flows. All selectors use `data-testid` attributes added to component templates.

**Tech Stack:** Playwright, Angular Material, AntV X6 (graph library)

**Spec:** `docs/superpowers/specs/2026-04-09-playwright-integration-tests-design.md`

---

### Task 1: Delete existing e2e directory

**Files:**
- Delete: `e2e/` (entire directory)

- [ ] **Step 1: Remove the existing e2e directory**

```bash
rm -rf e2e/
```

- [ ] **Step 2: Verify removal**

```bash
ls e2e/ 2>/dev/null && echo "FAIL: e2e still exists" || echo "OK: e2e removed"
```

Expected: `OK: e2e removed`

- [ ] **Step 3: Commit**

```bash
git add -A e2e/
git commit -m "chore: remove untrusted legacy e2e tests"
```

---

### Task 2: Rewrite playwright.config.ts

**Files:**
- Modify: `playwright.config.ts`

- [ ] **Step 1: Replace playwright.config.ts with Chromium-only config**

```typescript
import { defineConfig, devices } from '@playwright/test';

const testConfig = {
  appUrl: process.env.E2E_APP_URL || 'http://localhost:4200',
  apiUrl: process.env.E2E_API_URL || 'http://localhost:8080',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/setup/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',

  use: {
    baseURL: testConfig.appUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev:local',
    url: testConfig.appUrl,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm exec tsc --noEmit -p tsconfig.json 2>&1 | grep -i "playwright" || echo "OK: no playwright TS errors"
```

Note: `playwright.config.ts` is compiled by Playwright directly, not by the project's `tsconfig.json`. This step verifies it doesn't interfere. The real validation comes when we run the tests in a later task.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts
git commit -m "chore: simplify Playwright config to Chromium-only"
```

---

### Task 3: Create e2e config and global setup

**Files:**
- Create: `e2e/config/test.config.ts`
- Create: `e2e/setup/global-setup.ts`

- [ ] **Step 1: Create e2e/config/test.config.ts**

```typescript
export interface E2ETestConfig {
  /** Frontend application base URL */
  appUrl: string;
  /** Backend API base URL */
  apiUrl: string;
  /** OAuth provider ID for test login */
  testOAuthProvider: string;
  /** Timeout for waiting for services to be available (ms) */
  serviceAvailabilityTimeout: number;
}

export const testConfig: E2ETestConfig = {
  appUrl: process.env.E2E_APP_URL || 'http://localhost:4200',
  apiUrl: process.env.E2E_API_URL || 'http://localhost:8080',
  testOAuthProvider: process.env.E2E_OAUTH_PROVIDER || 'tmi',
  serviceAvailabilityTimeout: 30000,
};
```

- [ ] **Step 2: Create e2e/setup/global-setup.ts**

```typescript
import { testConfig } from '../config/test.config';

async function checkService(url: string, label: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    testConfig.serviceAvailabilityTimeout,
  );

  try {
    await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'manual' });
    clearTimeout(timeoutId);
    console.log(`  ✓ ${label} available at ${url}`);
  } catch (error) {
    clearTimeout(timeoutId);
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} not available at ${url}: ${message}`);
  }
}

async function globalSetup(): Promise<void> {
  console.log('\n=== E2E Test Setup ===\n');

  const errors: string[] = [];

  try {
    await checkService(testConfig.appUrl, 'Frontend');
  } catch (e) {
    errors.push((e as Error).message);
  }

  try {
    await checkService(testConfig.apiUrl, 'Backend API');
  } catch (e) {
    errors.push((e as Error).message);
  }

  if (errors.length > 0) {
    console.error('\n✗ Service check failed:\n');
    errors.forEach(e => console.error(`  ${e}`));
    console.error('\nStart both services before running e2e tests.\n');
    throw new Error('Required services are not available');
  }

  console.log('\n✓ All services available\n');
}

export default globalSetup;
```

- [ ] **Step 3: Commit**

```bash
git add e2e/config/test.config.ts e2e/setup/global-setup.ts
git commit -m "test: add e2e config and global setup"
```

---

### Task 4: Create auth helper

**Files:**
- Create: `e2e/helpers/auth.ts`

- [ ] **Step 1: Create e2e/helpers/auth.ts**

```typescript
import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

/**
 * Login using the TMI OAuth provider.
 *
 * Navigates to /login, clicks the configured OAuth provider button,
 * and waits for the redirect chain to complete. The httpOnly session
 * cookie is automatically stored in the Page's BrowserContext.
 */
export async function loginWithTmiProvider(page: Page): Promise<void> {
  await page.goto('/login');

  // Wait for provider button to be visible and enabled
  const providerButton = page.locator(
    `button[data-provider="${testConfig.testOAuthProvider}"]`,
  );
  await providerButton.waitFor({ state: 'visible', timeout: 10000 });

  // Click and wait for the full OAuth redirect chain to complete:
  // login -> backend OAuth -> IdP (auto-grant for tmi) -> callback -> final destination
  await Promise.all([
    page.waitForURL(
      url =>
        !url.pathname.includes('/login') &&
        !url.pathname.includes('/oauth2/callback'),
      { timeout: 15000 },
    ),
    providerButton.click(),
  ]);
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/auth.ts
git commit -m "test: add OAuth login helper for e2e tests"
```

---

### Task 5: Add data-testid attributes to dashboard component

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.component.html`

The dashboard has two views (cards and table). We need `data-testid` on:
1. The create button (line 32, `(click)="createThreatModel()"`)
2. Each card in card view (line 250, `<mat-card ... class="threat-model-card">`)
3. Each card's delete button (line 390, `<button ... class="delete-button">`)

- [ ] **Step 1: Add data-testid to the create threat model button**

Find this button in `src/app/pages/dashboard/dashboard.component.html` (around line 29-36):

```html
      <button
        mat-icon-button
        color="primary"
        (click)="createThreatModel()"
        [matTooltip]="'common.create' | transloco"
      >
```

Add `data-testid="create-threat-model-button"`:

```html
      <button
        mat-icon-button
        color="primary"
        data-testid="create-threat-model-button"
        (click)="createThreatModel()"
        [matTooltip]="'common.create' | transloco"
      >
```

- [ ] **Step 2: Add data-testid to each threat model card**

Find the card element (around line 250-254):

```html
        <mat-card
          *ngFor="let threatModel of filteredThreatModels"
          class="threat-model-card"
          [class.has-active-session]="hasActiveSessions(threatModel.id)"
          (click)="openThreatModel(threatModel.id)"
        >
```

Add `data-testid="threat-model-card"`:

```html
        <mat-card
          *ngFor="let threatModel of filteredThreatModels"
          class="threat-model-card"
          data-testid="threat-model-card"
          [class.has-active-session]="hasActiveSessions(threatModel.id)"
          (click)="openThreatModel(threatModel.id)"
        >
```

- [ ] **Step 3: Add data-testid to each card's delete button**

Find the delete button (around line 390-398):

```html
            <button
              mat-icon-button
              color="warn"
              class="delete-button"
              (click)="deleteThreatModel(threatModel.id, $event)"
              [matTooltip]="'common.delete' | transloco"
            >
```

Add `data-testid="threat-model-delete-button"`:

```html
            <button
              mat-icon-button
              color="warn"
              class="delete-button"
              data-testid="threat-model-delete-button"
              (click)="deleteThreatModel(threatModel.id, $event)"
              [matTooltip]="'common.delete' | transloco"
            >
```

- [ ] **Step 4: Verify build still passes**

```bash
pnpm run build
```

Expected: Build succeeds. `data-testid` is a standard HTML attribute — no Angular changes needed.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/dashboard/dashboard.component.html
git commit -m "test: add data-testid attributes to dashboard for e2e tests"
```

---

### Task 6: Add data-testid attributes to create threat model dialog

**Files:**
- Modify: `src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts` (inline template)

The create TM dialog is an inline template. We need `data-testid` on:
1. The name input (around line 39-45)
2. The create/submit button (around line 89)

- [ ] **Step 1: Add data-testid to the name input**

Find in the inline template (around line 39-45):

```html
          <input
            matInput
            formControlName="name"
            [placeholder]="'createThreatModel.namePlaceholder' | transloco"
            maxlength="256"
            cdkFocusInitial
          />
```

Add `data-testid="create-tm-name-input"`:

```html
          <input
            matInput
            formControlName="name"
            data-testid="create-tm-name-input"
            [placeholder]="'createThreatModel.namePlaceholder' | transloco"
            maxlength="256"
            cdkFocusInitial
          />
```

- [ ] **Step 2: Add data-testid to the create button**

Find the create button (around line 89):

```html
      <button mat-raised-button color="primary" (click)="onCreate()" [disabled]="form.invalid">
```

Add `data-testid="create-tm-submit"`:

```html
      <button mat-raised-button color="primary" data-testid="create-tm-submit" (click)="onCreate()" [disabled]="form.invalid">
```

- [ ] **Step 3: Verify build**

```bash
pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts
git commit -m "test: add data-testid attributes to create TM dialog for e2e tests"
```

---

### Task 7: Add data-testid attributes to TM edit component

**Files:**
- Modify: `src/app/pages/tm/tm-edit.component.html`

We need `data-testid` on:
1. The TM name display (line 9, `<span class="title-name">`)
2. The add diagram button (line 295-301, `(click)="addDiagram()"`)
3. Each diagram table row (line 1482-1490, `<tr mat-row ...>`)
4. Each diagram's delete menu item (line 1460, `(click)="deleteDiagram(diagram, $event)"`)

- [ ] **Step 1: Add data-testid to the TM name span**

Find in `src/app/pages/tm/tm-edit.component.html` (line 9):

```html
        <span class="title-name">{{ threatModel?.name }}</span>
```

Add `data-testid="threat-model-name"`:

```html
        <span class="title-name" data-testid="threat-model-name">{{ threatModel?.name }}</span>
```

- [ ] **Step 2: Add data-testid to the add diagram button**

Find the add diagram button (around line 1295-1302):

```html
                  <button
                    mat-icon-button
                    color="primary"
                    (click)="addDiagram()"
                    [matTooltip]="'threatModels.tooltips.addDiagram' | transloco"
                  >
```

Add `data-testid="add-diagram-button"`:

```html
                  <button
                    mat-icon-button
                    color="primary"
                    data-testid="add-diagram-button"
                    (click)="addDiagram()"
                    [matTooltip]="'threatModels.tooltips.addDiagram' | transloco"
                  >
```

- [ ] **Step 3: Add data-testid to each diagram table row**

Find the diagram row (around line 1482-1490):

```html
                  <tr
                    mat-row
                    *matRowDef="let row; columns: diagramsDisplayedColumns"
                    class="clickable-row"
                    [matTooltip]="row.description"
                    matTooltipClass="entity-description-tooltip"
                    matTooltipPosition="above"
                    [routerLink]="['/tm', threatModel.id, 'dfd', row.id]"
                  ></tr>
```

Add `data-testid="diagram-row"`:

```html
                  <tr
                    mat-row
                    *matRowDef="let row; columns: diagramsDisplayedColumns"
                    class="clickable-row"
                    data-testid="diagram-row"
                    [matTooltip]="row.description"
                    matTooltipClass="entity-description-tooltip"
                    matTooltipPosition="above"
                    [routerLink]="['/tm', threatModel.id, 'dfd', row.id]"
                  ></tr>
```

- [ ] **Step 4: Add data-testid to the diagram delete menu item**

Find the delete diagram menu item (around line 1460):

```html
                            <button mat-menu-item (click)="deleteDiagram(diagram, $event)">
```

Add `data-testid="diagram-delete-button"`:

```html
                            <button mat-menu-item data-testid="diagram-delete-button" (click)="deleteDiagram(diagram, $event)">
```

- [ ] **Step 5: Verify build**

```bash
pnpm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/tm/tm-edit.component.html
git commit -m "test: add data-testid attributes to TM edit page for e2e tests"
```

---

### Task 8: Add data-testid attributes to create diagram dialog

**Files:**
- Modify: `src/app/pages/tm/components/create-diagram-dialog/create-diagram-dialog.component.html`

We need `data-testid` on:
1. The type select (line 7, `<mat-select formControlName="type">`)
2. The name input (line 17, `<input matInput formControlName="name">`)
3. The submit/OK button (line 42-51)

- [ ] **Step 1: Add data-testid to the diagram type select**

Find in `src/app/pages/tm/components/create-diagram-dialog/create-diagram-dialog.component.html` (line 7):

```html
        <mat-select formControlName="type" tabindex="1">
```

Add `data-testid="diagram-type-select"`:

```html
        <mat-select formControlName="type" data-testid="diagram-type-select" tabindex="1">
```

- [ ] **Step 2: Add data-testid to the diagram name input**

Find the name input (line 17):

```html
        <input matInput formControlName="name" tabindex="2" />
```

Add `data-testid="diagram-name-input"`:

```html
        <input matInput formControlName="name" data-testid="diagram-name-input" tabindex="2" />
```

- [ ] **Step 3: Add data-testid to the submit button**

Find the OK button (around line 42-52):

```html
  <button
    mat-raised-button
    color="primary"
    type="submit"
    [disabled]="diagramForm.invalid"
    (click)="onSubmit()"
    tabindex="4"
    [attr.aria-label]="'common.ok' | transloco"
  >
```

Add `data-testid="create-diagram-submit"`:

```html
  <button
    mat-raised-button
    color="primary"
    type="submit"
    data-testid="create-diagram-submit"
    [disabled]="diagramForm.invalid"
    (click)="onSubmit()"
    tabindex="4"
    [attr.aria-label]="'common.ok' | transloco"
  >
```

- [ ] **Step 4: Verify build**

```bash
pnpm run build
```

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/tm/components/create-diagram-dialog/create-diagram-dialog.component.html
git commit -m "test: add data-testid attributes to create diagram dialog for e2e tests"
```

---

### Task 9: Add data-testid attributes to DFD editor

**Files:**
- Modify: `src/app/pages/dfd/presentation/components/dfd.component.html`

We need `data-testid` on:
1. The graph container div (line 398, `<div #graphContainer class="x6-graph">`)
2. Actor button (line 71-84, `(click)="addGraphNode('actor')"`)
3. Process button (line 85-98, `(click)="addGraphNode('process')"`)
4. Store button (line 99-112, `(click)="addGraphNode('store')"`)
5. Close button (line 386, `(click)="closeDiagram()"`)

- [ ] **Step 1: Add data-testid to the graph container**

Find in `src/app/pages/dfd/presentation/components/dfd.component.html` (line 398):

```html
    <div #graphContainer class="x6-graph"></div>
```

Add `data-testid="graph-container"`:

```html
    <div #graphContainer class="x6-graph" data-testid="graph-container"></div>
```

- [ ] **Step 2: Add data-testid to the actor button**

Find the actor button (around line 71-84):

```html
      <button
        mat-icon-button
        color="primary"
        (click)="addGraphNode('actor')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addActor' | transloco"
      >
```

Add `data-testid="add-actor-button"`:

```html
      <button
        mat-icon-button
        color="primary"
        data-testid="add-actor-button"
        (click)="addGraphNode('actor')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addActor' | transloco"
      >
```

- [ ] **Step 3: Add data-testid to the process button**

Find the process button (around line 85-98):

```html
      <button
        mat-icon-button
        color="accent"
        (click)="addGraphNode('process')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addProcess' | transloco"
      >
```

Add `data-testid="add-process-button"`:

```html
      <button
        mat-icon-button
        color="accent"
        data-testid="add-process-button"
        (click)="addGraphNode('process')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addProcess' | transloco"
      >
```

- [ ] **Step 4: Add data-testid to the store button**

Find the store button (around line 99-112):

```html
      <button
        mat-icon-button
        color="warn"
        (click)="addGraphNode('store')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addStore' | transloco"
      >
```

Add `data-testid="add-store-button"`:

```html
      <button
        mat-icon-button
        color="warn"
        data-testid="add-store-button"
        (click)="addGraphNode('store')"
        [disabled]="isReadOnlyMode || !isSystemInitialized"
        [matTooltip]="'editor.toolbar.tooltips.addStore' | transloco"
      >
```

- [ ] **Step 5: Add data-testid to the close button**

Find the close button (line 386):

```html
      <button mat-icon-button (click)="closeDiagram()" [matTooltip]="'common.close' | transloco">
```

Add `data-testid="close-diagram-button"`:

```html
      <button mat-icon-button data-testid="close-diagram-button" (click)="closeDiagram()" [matTooltip]="'common.close' | transloco">
```

- [ ] **Step 6: Verify build**

```bash
pnpm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/app/pages/dfd/presentation/components/dfd.component.html
git commit -m "test: add data-testid attributes to DFD editor for e2e tests"
```

---

### Task 10: Add data-testid attributes to delete confirmation dialog

**Files:**
- Modify: `src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html`

We need `data-testid` on:
1. The typed confirmation input (line 55-63)
2. The delete/confirm button (line 103-113)

- [ ] **Step 1: Add data-testid to the confirmation input**

Find in `src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html` (around line 55-63):

```html
          <input
            matInput
            type="text"
            [(ngModel)]="confirmationInput"
            [placeholder]="'common.deleteWarningConfirmationValue' | transloco"
            autocomplete="off"
            tabindex="1"
            cdkFocusInitial
          />
```

Add `data-testid="delete-confirm-input"`:

```html
          <input
            matInput
            type="text"
            data-testid="delete-confirm-input"
            [(ngModel)]="confirmationInput"
            [placeholder]="'common.deleteWarningConfirmationValue' | transloco"
            autocomplete="off"
            tabindex="1"
            cdkFocusInitial
          />
```

- [ ] **Step 2: Add data-testid to the delete button**

Find the delete button (around line 103-113):

```html
  <button
    mat-button
    color="warn"
    (click)="onConfirmDelete()"
    [disabled]="!canDelete"
    [tabindex]="requiresTypedConfirmation ? 3 : 2"
    [attr.aria-label]="'common.delete' | transloco"
  >
```

Add `data-testid="delete-confirm-button"`:

```html
  <button
    mat-button
    color="warn"
    data-testid="delete-confirm-button"
    (click)="onConfirmDelete()"
    [disabled]="!canDelete"
    [tabindex]="requiresTypedConfirmation ? 3 : 2"
    [attr.aria-label]="'common.delete' | transloco"
  >
```

- [ ] **Step 3: Verify build**

```bash
pnpm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html
git commit -m "test: add data-testid attributes to delete confirmation dialog for e2e tests"
```

---

### Task 11: Write the core lifecycle test

**Files:**
- Create: `e2e/tests/core-lifecycle.spec.ts`

This is the main test file — a serial test suite with 9 steps that share a single `BrowserContext` and `Page`.

- [ ] **Step 1: Create e2e/tests/core-lifecycle.spec.ts**

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { loginWithTmiProvider } from '../helpers/auth';

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
  let context: BrowserContext;
  let page: Page;

  // State shared across tests
  const testTmName = `E2E Test TM ${Date.now()}`;
  const testDiagramName = `E2E Test Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login via OAuth', async () => {
    await loginWithTmiProvider(page);

    // Verify we landed on a protected page (not login, not callback)
    const url = page.url();
    expect(url).not.toContain('/login');
    expect(url).not.toContain('/oauth2/callback');
  });

  test('create a threat model', async () => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click create button
    await page.locator('[data-testid="create-threat-model-button"]').click();

    // Fill the create dialog
    const nameInput = page.locator('[data-testid="create-tm-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(testTmName);

    // Submit
    await page.locator('[data-testid="create-tm-submit"]').click();

    // Wait for navigation to the new threat model's edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+$/, { timeout: 10000 });

    // Verify we're on the TM edit page with the correct name
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('verify threat model appears in list', async () => {
    // Navigate back to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find our card by name
    const cards = page.locator('[data-testid="threat-model-card"]');
    const ourCard = cards.filter({ hasText: testTmName });
    await expect(ourCard).toBeVisible({ timeout: 10000 });
  });

  test('open the threat model', async () => {
    // Click on our card (we're already on the dashboard from previous test)
    const cards = page.locator('[data-testid="threat-model-card"]');
    const ourCard = cards.filter({ hasText: testTmName });
    await ourCard.click();

    // Wait for TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+$/, { timeout: 10000 });

    // Verify name
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('create a diagram', async () => {
    // Click add diagram button
    const addButton = page.locator('[data-testid="add-diagram-button"]');
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();

    // Fill the create diagram dialog
    const nameInput = page.locator('[data-testid="diagram-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(testDiagramName);

    // Submit
    await page.locator('[data-testid="create-diagram-submit"]').click();

    // Wait for the dialog to close and diagram to appear in table
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await expect(diagramRow).toBeVisible({ timeout: 10000 });
  });

  test('open the DFD editor', async () => {
    // Click on the diagram row to navigate to the DFD editor
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await diagramRow.click();

    // Wait for DFD page to load
    await page.waitForURL(/\/tm\/[a-f0-9-]+\/dfd\/[a-f0-9-]+/, { timeout: 10000 });

    // Verify graph container is visible
    const graphContainer = page.locator('[data-testid="graph-container"]');
    await expect(graphContainer).toBeVisible({ timeout: 15000 });
  });

  test('add nodes to the diagram', async () => {
    const graphContainer = page.locator('[data-testid="graph-container"]');

    // Wait for the graph to initialize (toolbar buttons become enabled)
    const actorButton = page.locator('[data-testid="add-actor-button"]');
    await expect(actorButton).toBeEnabled({ timeout: 15000 });

    // Count initial nodes
    const initialNodeCount = await page.locator('.x6-node').count();

    // Add an actor node
    await actorButton.click();
    await graphContainer.click({ position: { x: 200, y: 200 } });
    // Wait for node to appear
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 1, {
      timeout: 5000,
    });

    // Add a process node
    await page.locator('[data-testid="add-process-button"]').click();
    await graphContainer.click({ position: { x: 400, y: 200 } });
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 2, {
      timeout: 5000,
    });

    // Add a store node
    await page.locator('[data-testid="add-store-button"]').click();
    await graphContainer.click({ position: { x: 300, y: 400 } });
    await expect(page.locator('.x6-node')).toHaveCount(initialNodeCount + 3, {
      timeout: 5000,
    });
  });

  test('close the diagram', async () => {
    // Click close button
    await page.locator('[data-testid="close-diagram-button"]').click();

    // Should navigate back to TM edit page
    await page.waitForURL(/\/tm\/[a-f0-9-]+$/, { timeout: 10000 });

    // Verify we're on the TM detail page
    const tmName = page.locator('[data-testid="threat-model-name"]');
    await expect(tmName).toHaveText(testTmName);
  });

  test('delete the diagram', async () => {
    // Find our diagram row
    const diagramRow = page.locator('[data-testid="diagram-row"]').filter({
      hasText: testDiagramName,
    });
    await expect(diagramRow).toBeVisible();

    // The delete button is inside a kebab menu on the diagram row.
    // Click the kebab menu (more_vert) button on the row to open it.
    const kebabButton = diagramRow.locator('button[mat-icon-button]').filter({
      has: page.locator('mat-icon:has-text("more_vert")'),
    });
    await kebabButton.click();

    // Click delete in the menu
    const deleteMenuItem = page.locator('[data-testid="diagram-delete-button"]');
    await deleteMenuItem.waitFor({ state: 'visible' });
    await deleteMenuItem.click();

    // Handle delete confirmation dialog — type "gone forever"
    const confirmInput = page.locator('[data-testid="delete-confirm-input"]');
    await confirmInput.waitFor({ state: 'visible' });
    await confirmInput.fill('gone forever');

    // Click the delete confirm button
    const confirmButton = page.locator('[data-testid="delete-confirm-button"]');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for dialog to close and diagram to disappear
    await expect(
      page.locator('[data-testid="diagram-row"]').filter({
        hasText: testDiagramName,
      }),
    ).toHaveCount(0, { timeout: 10000 });
  });

  test('delete the threat model', async () => {
    // Navigate to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find our card
    const ourCard = page.locator('[data-testid="threat-model-card"]').filter({
      hasText: testTmName,
    });
    await expect(ourCard).toBeVisible({ timeout: 10000 });

    // Click the delete button on our card
    const deleteButton = ourCard.locator(
      '[data-testid="threat-model-delete-button"]',
    );
    await deleteButton.click();

    // Handle delete confirmation dialog — type "gone forever"
    const confirmInput = page.locator('[data-testid="delete-confirm-input"]');
    await confirmInput.waitFor({ state: 'visible' });
    await confirmInput.fill('gone forever');

    // Click the delete confirm button
    const confirmButton = page.locator('[data-testid="delete-confirm-button"]');
    await expect(confirmButton).toBeEnabled();
    await confirmButton.click();

    // Wait for dialog to close and card to disappear
    await expect(
      page.locator('[data-testid="threat-model-card"]').filter({
        hasText: testTmName,
      }),
    ).toHaveCount(0, { timeout: 10000 });
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/core-lifecycle.spec.ts
git commit -m "test: add core lifecycle integration test"
```

---

### Task 12: Create README

**Files:**
- Create: `e2e/README.md`

- [ ] **Step 1: Create e2e/README.md**

```markdown
# E2E Integration Tests

Playwright-based integration tests for TMI-UX, running against a live local backend.

## Prerequisites

Both services must be running:

1. **TMI backend** on `http://localhost:8080` (or set `E2E_API_URL`)
2. **TMI-UX frontend** on `http://localhost:4200` (or set `E2E_APP_URL`)

The backend must have the `tmi` OAuth provider configured (auto-grants tokens without IdP interaction).

## Running Tests

```bash
# Run all tests
pnpm test:e2e

# Run with visible browser
pnpm test:e2e:headed

# Run in interactive UI mode
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_APP_URL` | `http://localhost:4200` | Frontend URL |
| `E2E_API_URL` | `http://localhost:8080` | Backend API URL |
| `E2E_OAUTH_PROVIDER` | `tmi` | OAuth provider for test login |

## Test Structure

```
e2e/
├── config/test.config.ts       # Environment-based configuration
├── setup/global-setup.ts       # Pre-test service availability check
├── helpers/auth.ts             # OAuth login helper
└── tests/core-lifecycle.spec.ts # Core lifecycle test suite
```

## What It Tests

The core lifecycle test runs a serial flow:

1. Login via OAuth
2. Create a threat model
3. Verify it appears in the list
4. Open the threat model
5. Create a diagram
6. Open the DFD editor
7. Add nodes (actor, process, store)
8. Close the diagram
9. Delete the diagram
10. Delete the threat model

Each step depends on the previous one. If auth fails, everything after it fails. All test data is created and cleaned up within the test run.

## Troubleshooting

**Tests fail at global setup:** Both services must be running. Check that the backend is accessible at the configured API URL.

**Auth test fails:** Verify the `tmi` OAuth provider is configured on the backend and auto-grants without interactive login.

**View test report:**

```bash
pnpm playwright show-report
```
```

- [ ] **Step 2: Commit**

```bash
git add e2e/README.md
git commit -m "docs: add e2e test README"
```

---

### Task 13: Run the tests and fix issues

This task is intentionally open-ended. The preceding tasks set up all the infrastructure; this task validates it against the live backend.

- [ ] **Step 1: Ensure both services are running**

Verify the frontend dev server and backend API are accessible:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:4200 && echo " Frontend OK"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 && echo " Backend OK"
```

Expected: Both return HTTP status codes (200, 302, etc. — any response means the service is up).

- [ ] **Step 2: Run the e2e tests**

```bash
pnpm test:e2e
```

- [ ] **Step 3: Diagnose and fix failures**

If any tests fail:
1. Check the HTML report: `pnpm playwright show-report`
2. Review screenshots and videos in `test-results/`
3. Run in headed mode to watch: `pnpm test:e2e:headed`
4. Run in debug mode to step through: `pnpm test:e2e:debug`

Common issues to watch for:
- **Auth redirect not completing:** The OAuth callback processing may need additional waits or URL pattern adjustments in `loginWithTmiProvider`
- **Node creation not working:** The `addGraphNode` toolbar buttons may trigger a different interaction pattern than click-on-canvas (e.g., drag-to-place). Watch the headed test to see what happens.
- **Dialog not appearing:** Material dialogs may need time to animate. Add `waitFor({ state: 'visible' })` if needed.
- **Diagram row click intercepted:** The kebab menu button or other elements may intercept the row click. Use more specific selectors.

Fix issues in the relevant files and re-run until all 9 tests pass.

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "test: fix e2e test issues found during initial run"
```

---

### Task 14: Lint and build verification

- [ ] **Step 1: Run linter**

```bash
pnpm run lint:all
```

Fix any issues.

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

Fix any build errors.

- [ ] **Step 3: Run unit tests**

```bash
pnpm test
```

Verify no unit tests were broken by the `data-testid` additions. They shouldn't be — `data-testid` is inert — but verify.

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: fix lint and build issues from e2e test setup"
```
