# E2E Phase 0: Foundation Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cross-cutting E2E test infrastructure (directory restructuring, role-aware auth, helpers, schema definitions, seed data contract, visual regression triage skill) that all subsequent E2E phases depend on.

**Architecture:** Playwright multi-project setup with subdirectory-per-project organization. Role-aware auth fixtures using TMI OAuth `login_hint` parameter. Helper utilities for translation scanning, icon checking, screenshot baselines (4 theme modes), and accessibility snapshots. Schema-driven field definitions in JSON consumed by both TypeScript tests and a Python OpenAPI validator.

**Tech Stack:** Playwright, TypeScript, Python (uv run), Angular Material theming (CSS class toggling)

**Spec:** `docs/superpowers/specs/2026-04-10-e2e-phase0-foundation-infrastructure-design.md`

---

### Task 1: Directory Structure & Playwright Projects

**Files:**
- Create: `e2e/tests/workflows/.gitkeep` (temporary, removed once tests move in)
- Create: `e2e/tests/field-coverage/.gitkeep`
- Create: `e2e/tests/visual-regression/.gitkeep`
- Create: `e2e/tests/admin/.gitkeep`
- Create: `e2e/schema/` (directory)
- Create: `e2e/seed/` (directory)
- Create: `e2e/helpers/` (directory)
- Modify: `playwright.config.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create new directories with placeholders**

```bash
mkdir -p e2e/tests/workflows e2e/tests/field-coverage e2e/tests/visual-regression e2e/tests/admin e2e/schema e2e/seed e2e/helpers
touch e2e/tests/field-coverage/.gitkeep e2e/tests/visual-regression/.gitkeep e2e/tests/admin/.gitkeep
```

- [ ] **Step 2: Update playwright.config.ts**

Replace the entire file with:

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
      name: 'workflows',
      testDir: './e2e/tests/workflows',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'field-coverage',
      testDir: './e2e/tests/field-coverage',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'visual-regression',
      testDir: './e2e/tests/visual-regression',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin',
      testDir: './e2e/tests/admin',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

- [ ] **Step 3: Update package.json scripts**

Add new scripts and update existing ones. The `test:e2e:chromium` line is no longer valid (project name changed). Add project-specific run commands and the schema validator:

```json
{
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:workflows": "playwright test --project=workflows",
  "test:e2e:field-coverage": "playwright test --project=field-coverage",
  "test:e2e:visual-regression": "playwright test --project=visual-regression",
  "test:e2e:admin": "playwright test --project=admin",
  "e2e:validate-schema": "uv run e2e/schema/validate-fields.py"
}
```

Remove these obsolete scripts: `test:e2e:chromium`, `test:e2e:firefox`, `test:e2e:webkit`.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/field-coverage/.gitkeep e2e/tests/visual-regression/.gitkeep e2e/tests/admin/.gitkeep playwright.config.ts package.json
git commit -m "test: restructure E2E into multi-project Playwright setup

Create subdirectories for workflows, field-coverage, visual-regression,
and admin projects. Update playwright.config.ts with four independent
projects. Add per-project pnpm scripts.

Refs #574"
```

---

### Task 2: Auth Flow — loginAs() and LoginPage Update

**Files:**
- Modify: `e2e/flows/auth.flow.ts`
- Modify: `e2e/pages/login.page.ts`

- [ ] **Step 1: Add loginHintInput locator to LoginPage**

In `e2e/pages/login.page.ts`, add a locator for the login hint input field in the OAuth dialog. The field appears after clicking the provider button:

```typescript
import { Page } from '@playwright/test';
import { testConfig } from '../config/test.config';

export class LoginPage {
  constructor(private page: Page) {}

  readonly providerButton = () =>
    this.page.locator(`button[data-provider="${testConfig.testOAuthProvider}"]`);

  readonly loginHintInput = () =>
    this.page.getByLabel('Login hint');

  readonly signInButton = () =>
    this.page.getByRole('button', { name: 'Sign In', exact: true });
}
```

Note: The `loginHintInput` locator uses `getByLabel` — verify the actual label text matches the TMI OAuth dialog. If the dialog uses a different label or a placeholder, adjust the locator (e.g., `getByPlaceholder('Username')` or `getByTestId('login-hint-input')`). The implementer should inspect the dialog when the backend is running to confirm.

- [ ] **Step 2: Replace AuthFlow.login() with loginAs()**

Replace `e2e/flows/auth.flow.ts` entirely:

```typescript
import { Page } from '@playwright/test';
import { LoginPage } from '../pages/login.page';

export class AuthFlow {
  private loginPage: LoginPage;

  constructor(private page: Page) {
    this.loginPage = new LoginPage(page);
  }

  async loginAs(userId: string): Promise<void> {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });

    await this.loginPage.providerButton().waitFor({ state: 'visible', timeout: 30000 });
    await this.loginPage.providerButton().click();

    // Dialog appears — type the login hint to select the test user
    await this.loginPage.loginHintInput().waitFor({ state: 'visible', timeout: 5000 });
    await this.loginPage.loginHintInput().fill(userId);
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

- [ ] **Step 3: Commit**

```bash
git add e2e/flows/auth.flow.ts e2e/pages/login.page.ts
git commit -m "test: replace AuthFlow.login() with loginAs(userId)

Add login_hint support to OAuth flow for multi-user E2E testing.
LoginPage gets loginHintInput locator. AuthFlow.loginAs() types the
user identifier into the TMI provider dialog.

Refs #574"
```

---

### Task 3: Role-Aware Auth Fixtures

**Files:**
- Create: `e2e/fixtures/auth-fixtures.ts`

- [ ] **Step 1: Create auth-fixtures.ts**

```typescript
import { test as base, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';

/**
 * Creates an authenticated browser context for the given user.
 * Each fixture gets its own BrowserContext (isolated cookies/storage).
 */
async function createAuthenticatedPage(
  browser: import('@playwright/test').Browser,
  userId: string,
): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await new AuthFlow(page).loginAs(userId);
  return {
    page,
    cleanup: async () => ctx.close(),
  };
}

/**
 * Test fixture authenticated as a normal user (test-user).
 */
export const userTest = base.extend<{ userPage: Page }>({
  userPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-user');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture authenticated as a security reviewer (test-reviewer).
 */
export const reviewerTest = base.extend<{ reviewerPage: Page }>({
  reviewerPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-reviewer');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture authenticated as an admin (test-admin).
 */
export const adminTest = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-admin');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture with all three roles for cross-role workflow tests.
 * Each role gets its own BrowserContext (separate sessions).
 */
export const multiRoleTest = base.extend<{
  userPage: Page;
  reviewerPage: Page;
  adminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-user');
    await use(page);
    await cleanup();
  },
  reviewerPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-reviewer');
    await use(page);
    await cleanup();
  },
  adminPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-admin');
    await use(page);
    await cleanup();
  },
});

export { expect } from '@playwright/test';
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/auth-fixtures.ts
git commit -m "test: add role-aware auth fixtures for E2E tests

Four fixture exports: userTest, reviewerTest, adminTest, multiRoleTest.
Each creates an isolated BrowserContext authenticated via login_hint.

Refs #574"
```

---

### Task 4: Migrate core-lifecycle.spec.ts

**Files:**
- Move: `e2e/tests/core-lifecycle.spec.ts` → `e2e/tests/workflows/core-lifecycle.spec.ts`
- Delete: `e2e/tests/core-lifecycle.spec.ts`

- [ ] **Step 1: Create migrated test file**

Create `e2e/tests/workflows/core-lifecycle.spec.ts`. The serial pattern is preserved — `beforeAll` creates a single authenticated page via `loginAs`. All page objects are instantiated from that page. Imports use relative paths adjusted for the new location:

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DiagramFlow } from '../../flows/diagram.flow';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { DfdEditorPage } from '../../pages/dfd-editor.page';
import { DeleteConfirmDialog } from '../../dialogs/delete-confirm.dialog';

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

  let threatModelFlow: ThreatModelFlow;
  let diagramFlow: DiagramFlow;
  let dashboardPage: DashboardPage;
  let tmEditPage: TmEditPage;
  let dfdEditorPage: DfdEditorPage;

  const testTmName = `E2E Test TM ${Date.now()}`;
  const testDiagramName = `E2E Test Diagram ${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    // Authenticate as the default test user
    await new AuthFlow(page).loginAs('test-user');

    threatModelFlow = new ThreatModelFlow(page);
    diagramFlow = new DiagramFlow(page);
    dashboardPage = new DashboardPage(page);
    tmEditPage = new TmEditPage(page);
    dfdEditorPage = new DfdEditorPage(page);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login completed successfully', async () => {
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

- [ ] **Step 2: Delete the old file**

```bash
rm e2e/tests/core-lifecycle.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/core-lifecycle.spec.ts
git rm e2e/tests/core-lifecycle.spec.ts
git commit -m "test: migrate core-lifecycle to workflows project

Move to e2e/tests/workflows/, switch to loginAs('test-user'),
remove AuthFlow fixture in favor of direct instantiation in beforeAll.
No behavior changes.

Refs #574"
```

---

### Task 5: Migrate threat-editing.spec.ts

**Files:**
- Move: `e2e/tests/threat-editing.spec.ts` → `e2e/tests/workflows/threat-editing.spec.ts`
- Delete: `e2e/tests/threat-editing.spec.ts`

- [ ] **Step 1: Create migrated test file**

Create `e2e/tests/workflows/threat-editing.spec.ts`. Same migration pattern as core-lifecycle: `beforeAll` uses `loginAs`, adjust import paths:

```typescript
import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { ThreatFlow } from '../../flows/threat.flow';
import { TmEditPage } from '../../pages/tm-edit.page';
import { ThreatPage } from '../../pages/threat-page.page';
import { DashboardPage } from '../../pages/dashboard.page';

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

    await new AuthFlow(page).loginAs('test-user');

    threatModelFlow = new ThreatModelFlow(page);
    threatFlow = new ThreatFlow(page);
    tmEditPage = new TmEditPage(page);
    threatPage = new ThreatPage(page);
    dashboardPage = new DashboardPage(page);

    // Create a threat model for testing
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
    await threatFlow.createFromTmEdit(testThreatName);

    await expect(tmEditPage.threatRow(testThreatName)).toBeVisible({ timeout: 10000 });
  });

  test('edit threat fields', async () => {
    await threatFlow.openFromTmEdit(testThreatName);

    await threatPage.fillName(updatedThreatName);
    await threatPage.fillDescription('A test threat for E2E testing');

    const saveResponse = page.waitForResponse(
      resp => resp.url().includes('/threats/') && resp.request().method() === 'PUT',
    );
    await threatPage.save();
    await saveResponse;

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(threatPage.nameInput()).toHaveValue(updatedThreatName, { timeout: 10000 });
    await expect(threatPage.descriptionInput()).toHaveValue('A test threat for E2E testing');
  });

  test('score with CVSS 3.1', async () => {
    await threatFlow.scoreThreatWithCvss('3.1', {
      AV: 'N',
      AC: 'L',
      PR: 'N',
      UI: 'N',
      S: 'U',
      C: 'H',
      I: 'H',
      A: 'H',
    });

    await expect(threatPage.cvssChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cvssChips().first()).toContainText('9.8');
  });

  test('score with CVSS 4.0', async () => {
    await threatFlow.scoreThreatWithCvss('4.0', {
      AV: 'N',
      AC: 'L',
      AT: 'N',
      PR: 'N',
      UI: 'N',
      VC: 'H',
      VI: 'H',
      VA: 'H',
      SC: 'N',
      SI: 'N',
      SA: 'N',
    });

    await expect(threatPage.cvssChips()).toHaveCount(2, { timeout: 5000 });
  });

  test('add CWE reference', async () => {
    await threatFlow.addCweReference('CWE-79');

    await expect(threatPage.cweChips()).toHaveCount(1, { timeout: 5000 });
    await expect(threatPage.cweChips().first()).toContainText('CWE-79');
  });

  test('delete the threat', async () => {
    await threatFlow.deleteThreatFromPage();

    await page.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
    await expect(tmEditPage.threatRow(updatedThreatName)).toHaveCount(0, { timeout: 10000 });
  });
});
```

- [ ] **Step 2: Delete the old file**

```bash
rm e2e/tests/threat-editing.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/threat-editing.spec.ts
git rm e2e/tests/threat-editing.spec.ts
git commit -m "test: migrate threat-editing to workflows project

Move to e2e/tests/workflows/, switch to loginAs('test-user').
No behavior changes.

Refs #574"
```

---

### Task 6: Migrate navigation-routing.spec.ts with Role Variants

**Files:**
- Move: `e2e/tests/navigation-routing.spec.ts` → `e2e/tests/workflows/navigation-routing.spec.ts`
- Delete: `e2e/tests/navigation-routing.spec.ts`

- [ ] **Step 1: Create migrated test file with role variants**

Create `e2e/tests/workflows/navigation-routing.spec.ts`. This file uses `userTest` for existing tests and adds new `describe` blocks for reviewer and admin role variants:

```typescript
import { expect } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { NavbarPage } from '../../pages/navbar.page';
import { ThreatModelFlow } from '../../flows/threat-model.flow';

/**
 * Navigation and routing integration tests.
 *
 * Tests deep linking, auth guards, role guards, browser history,
 * and navbar navigation for all three user roles.
 */

// === Normal User Navigation ===

userTest.describe('Navigation & Routing (User)', () => {
  userTest.setTimeout(60000);

  userTest('deep link to a threat model', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const tmEdit = new TmEditPage(userPage);
    const tmFlow = new ThreatModelFlow(userPage);

    const tmName = `E2E Nav Test TM ${Date.now()}`;
    await tmFlow.createFromDashboard(tmName);

    const url = userPage.url();
    const tmIdMatch = url.match(/\/tm\/([a-f0-9-]+)/);
    expect(tmIdMatch).toBeTruthy();
    const tmId = tmIdMatch![1];

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await userPage.goto(`/tm/${tmId}`);
    await userPage.waitForLoadState('networkidle');

    await expect(tmEdit.tmName()).toHaveText(tmName, { timeout: 10000 });

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName);
  });

  userTest('deep link to nonexistent resource', async ({ userPage }) => {
    await userPage.goto('/tm/00000000-0000-0000-0000-000000000000');

    await userPage.waitForLoadState('networkidle');
    await userPage.waitForTimeout(2000);

    const currentUrl = userPage.url();
    expect(
      currentUrl.includes('/dashboard') ||
        currentUrl.includes('/tm/00000000-0000-0000-0000-000000000000'),
    ).toBeTruthy();
  });

  userTest('back/forward navigation', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const tmEdit = new TmEditPage(userPage);
    const tmFlow = new ThreatModelFlow(userPage);

    const tmName = `E2E Back/Fwd Test TM ${Date.now()}`;
    await tmFlow.createFromDashboard(tmName);
    await expect(tmEdit.tmName()).toHaveText(tmName);

    await userPage.goBack();
    await userPage.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(dashboard.tmCards()).not.toHaveCount(0, { timeout: 10000 });

    await userPage.goForward();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(tmEdit.tmName()).toHaveText(tmName);

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName);
  });

  userTest('navbar shows dashboard and intake links', async ({ userPage }) => {
    const navbar = new NavbarPage(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    // Normal user should NOT see triage or admin
    await expect(navbar.triageLink()).toHaveCount(0);
    await expect(navbar.adminLink()).toHaveCount(0);
  });

  userTest('navbar navigation works', async ({ userPage }) => {
    const navbar = new NavbarPage(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await navbar.dashboardLink().click();
    await userPage.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(userPage.url()).toContain('/dashboard');

    await navbar.intakeLink().click();
    await userPage.waitForURL(/\/intake/, { timeout: 10000 });
    expect(userPage.url()).toContain('/intake');
  });
});

// === Auth Guards (no auth) ===

import { test as unauthTest } from '@playwright/test';

unauthTest.describe('Auth Guards', () => {
  unauthTest.setTimeout(60000);

  unauthTest('unauthenticated user redirected to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  unauthTest('unauthenticated user redirected from triage', async ({ page }) => {
    await page.goto('/triage');
    await page.waitForURL(
      url => url.pathname.includes('/login') || url.pathname.includes('/unauthorized'),
      { timeout: 10000 },
    );
    expect(page.url()).not.toContain('/triage');
  });
});

// === Reviewer Navigation ===

reviewerTest.describe('Navigation & Routing (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('navbar shows triage link', async ({ reviewerPage }) => {
    const navbar = new NavbarPage(reviewerPage);

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    await expect(navbar.triageLink()).toBeVisible();
    // Reviewer should NOT see admin
    await expect(navbar.adminLink()).toHaveCount(0);
  });

  reviewerTest('reviewer can access triage page', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    expect(reviewerPage.url()).toContain('/triage');
  });

  reviewerTest('reviewer blocked from admin page', async ({ reviewerPage }) => {
    await reviewerPage.goto('/admin');
    await reviewerPage.waitForURL(
      url => url.pathname.includes('/unauthorized') || !url.pathname.includes('/admin'),
      { timeout: 10000 },
    );
    expect(reviewerPage.url()).not.toMatch(/\/admin(?!\/|$)/);
  });
});

// === Admin Navigation ===

adminTest.describe('Navigation & Routing (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('navbar shows all links including admin', async ({ adminPage }) => {
    const navbar = new NavbarPage(adminPage);

    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    await expect(navbar.triageLink()).toBeVisible();
    await expect(navbar.adminLink()).toBeVisible();
  });

  adminTest('admin can access admin page', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');
    expect(adminPage.url()).toContain('/admin');
  });

  adminTest('admin can access triage page', async ({ adminPage }) => {
    await adminPage.goto('/triage');
    await adminPage.waitForLoadState('networkidle');
    expect(adminPage.url()).toContain('/triage');
  });
});
```

- [ ] **Step 2: Delete the old file**

```bash
rm e2e/tests/navigation-routing.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/navigation-routing.spec.ts
git rm e2e/tests/navigation-routing.spec.ts
git commit -m "test: migrate navigation-routing with role variant tests

Move to e2e/tests/workflows/, switch to role-aware fixtures.
Add reviewer and admin navbar/guard tests verifying role-based
link visibility and route access.

Refs #574"
```

---

### Task 7: Migrate error-scenarios.spec.ts with Role Variants

**Files:**
- Move: `e2e/tests/error-scenarios.spec.ts` → `e2e/tests/workflows/error-scenarios.spec.ts`
- Delete: `e2e/tests/error-scenarios.spec.ts`

- [ ] **Step 1: Create migrated test file with role variants**

Create `e2e/tests/workflows/error-scenarios.spec.ts`:

```typescript
import { expect } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { DeleteConfirmDialog } from '../../dialogs/delete-confirm.dialog';
import { CreateTmDialog } from '../../dialogs/create-tm.dialog';

/**
 * Error scenario integration tests.
 *
 * Tests client-side error handling, validation, and edge cases
 * across all three user roles.
 */

// === Normal User Error Scenarios ===

userTest.describe('Error Scenarios (User)', () => {
  userTest.setTimeout(60000);

  userTest('unauthorized page displays correctly', async ({ userPage }) => {
    await userPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await userPage.waitForLoadState('networkidle');

    const card = userPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    const okButton = userPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    await userPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });

  userTest('wildcard route redirects home', async ({ userPage }) => {
    await userPage.goto('/this-route-does-not-exist');
    await userPage.waitForLoadState('networkidle');

    await userPage.waitForURL(
      url => url.pathname === '/' || url.pathname.includes('/dashboard'),
      { timeout: 10000 },
    );
  });

  userTest('delete confirmation requires exact text', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const tmFlow = new ThreatModelFlow(userPage);
    const deleteDialog = new DeleteConfirmDialog(userPage);

    const tmName = `E2E Delete Validation Test ${Date.now()}`;
    await tmFlow.createFromDashboard(tmName);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await dashboard.tmDeleteButton(tmName).click();

    await deleteDialog.confirmInput().waitFor({ state: 'visible' });
    await expect(deleteDialog.confirmButton()).toBeDisabled();

    await deleteDialog.confirmInput().fill('wrong text');
    await expect(deleteDialog.confirmButton()).toBeDisabled();

    await deleteDialog.confirmInput().clear();
    await deleteDialog.confirmInput().fill('gone forever');
    await expect(deleteDialog.confirmButton()).toBeEnabled();

    await deleteDialog.confirmButton().click();
    await expect(dashboard.tmCard(tmName)).toHaveCount(0, { timeout: 10000 });
  });

  userTest('form validation prevents save', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const createTmDialog = new CreateTmDialog(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await dashboard.createTmButton().click();
    await createTmDialog.nameInput().waitFor({ state: 'visible' });

    await expect(createTmDialog.submitButton()).toBeDisabled();

    await createTmDialog.nameInput().fill('Test Name');
    await expect(createTmDialog.submitButton()).toBeEnabled();

    await createTmDialog.nameInput().clear();
    await expect(createTmDialog.submitButton()).toBeDisabled();

    await userPage.keyboard.press('Escape');
  });
});

// === Reviewer Error Scenarios ===

reviewerTest.describe('Error Scenarios (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('unauthorized page displays correctly for reviewer', async ({ reviewerPage }) => {
    await reviewerPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await reviewerPage.waitForLoadState('networkidle');

    const card = reviewerPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    const okButton = reviewerPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    await reviewerPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });
});

// === Admin Error Scenarios ===

adminTest.describe('Error Scenarios (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('unauthorized page displays correctly for admin', async ({ adminPage }) => {
    await adminPage.goto('/unauthorized?statusCode=403&reason=no_permission');
    await adminPage.waitForLoadState('networkidle');

    const card = adminPage.locator('mat-card');
    await expect(card).toBeVisible({ timeout: 10000 });

    const okButton = adminPage.getByRole('button', { name: /ok/i });
    await expect(okButton).toBeVisible();
    await okButton.click();

    await adminPage.waitForURL(url => !url.pathname.includes('/unauthorized'), {
      timeout: 10000,
    });
  });
});
```

- [ ] **Step 2: Delete the old file**

```bash
rm e2e/tests/error-scenarios.spec.ts
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/workflows/error-scenarios.spec.ts
git rm e2e/tests/error-scenarios.spec.ts
git commit -m "test: migrate error-scenarios with role variant tests

Move to e2e/tests/workflows/, switch to role-aware fixtures.
Add reviewer and admin unauthorized page tests.

Refs #574"
```

---

### Task 8: Clean Up Old Test Directory

**Files:**
- Delete: `e2e/tests/` (old flat files should all be gone)
- Remove: `e2e/tests/workflows/.gitkeep` (now has real files)

- [ ] **Step 1: Verify old files are gone and remove .gitkeep**

```bash
# Verify no old spec files remain in e2e/tests/ root
ls e2e/tests/*.spec.ts 2>/dev/null && echo "ERROR: old files still exist" || echo "OK: no stale files"

# Remove .gitkeep from workflows (has real tests now)
rm -f e2e/tests/workflows/.gitkeep
```

- [ ] **Step 2: Run lint to verify no import issues**

```bash
pnpm run lint:all
```

Fix any issues found.

- [ ] **Step 3: Commit**

```bash
git add -A e2e/tests/
git commit -m "test: clean up old E2E test directory structure

Remove .gitkeep from workflows (now populated).
Verify no stale test files remain outside project subdirectories.

Refs #574"
```

---

### Task 9: Seed Data Specification

**Files:**
- Create: `e2e/seed/seed-spec.json`

- [ ] **Step 1: Create the seed spec JSON**

Create `e2e/seed/seed-spec.json`. This is the contract document for the server team. Content is adapted from the comprehensive test plan spec with `login_hint`-compatible user IDs:

```json
{
  "version": "1.0",
  "description": "E2E test seed data specification. The server team builds idempotent ingestion tooling around this format.",
  "users": [
    {
      "id": "test-user",
      "email": "test-user@tmi.local",
      "display_name": "Test User",
      "roles": { "is_admin": false, "is_security_reviewer": false },
      "oauth_provider": "tmi"
    },
    {
      "id": "test-reviewer",
      "email": "test-reviewer@tmi.local",
      "display_name": "Test Reviewer",
      "roles": { "is_admin": false, "is_security_reviewer": true },
      "oauth_provider": "tmi"
    },
    {
      "id": "test-admin",
      "email": "test-admin@tmi.local",
      "display_name": "Test Admin",
      "roles": { "is_admin": true, "is_security_reviewer": true },
      "oauth_provider": "tmi"
    }
  ],
  "teams": [
    {
      "name": "Seed Team Alpha",
      "status": "active",
      "members": [
        { "user_id": "test-user", "role": "member" },
        { "user_id": "test-reviewer", "role": "lead" }
      ],
      "metadata": [{ "key": "department", "value": "Engineering" }]
    }
  ],
  "projects": [
    {
      "name": "Seed Project One",
      "team": "Seed Team Alpha",
      "status": "active",
      "metadata": [{ "key": "fiscal_year", "value": "2026" }]
    }
  ],
  "threat_models": [
    {
      "name": "Seed TM - Full Fields",
      "description": "Threat model with all fields populated for field-coverage testing",
      "owner": "test-reviewer",
      "threat_model_framework": "STRIDE",
      "status": "active",
      "is_confidential": false,
      "project_id": "Seed Project One",
      "security_reviewer": "test-reviewer",
      "issue_uri": "https://example.com/issues/1",
      "alias": ["seed-tm-1", "full-fields-tm"],
      "metadata": [{ "key": "risk_level", "value": "high" }],
      "authorization": [
        { "user_id": "test-user", "role": "reader" },
        { "user_id": "test-reviewer", "role": "writer" }
      ],
      "threats": [
        {
          "name": "Seed Threat - All Fields",
          "description": "A fully populated threat for field testing",
          "threat_type": ["spoofing", "tampering"],
          "severity": "high",
          "score": 9.8,
          "priority": "critical",
          "status": "open",
          "mitigated": false,
          "mitigation": "Implement input validation and CSRF tokens",
          "cwe_id": ["CWE-79", "CWE-352"],
          "cvss": [
            { "version": "3.1", "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "score": 9.8 }
          ],
          "issue_uri": "https://example.com/issues/2",
          "include_in_report": true
        }
      ],
      "assets": [
        {
          "name": "Seed Asset - User Database",
          "description": "Primary user data store",
          "type": "data",
          "criticality": "high",
          "classification": ["confidential", "pii"],
          "sensitivity": "high",
          "include_in_report": true
        },
        {
          "name": "Seed Asset - Web Server",
          "type": "infrastructure",
          "criticality": "high"
        }
      ],
      "documents": [
        {
          "name": "Architecture Doc",
          "uri": "https://example.com/docs/architecture.pdf",
          "description": "System architecture documentation",
          "include_in_report": true
        }
      ],
      "repositories": [
        {
          "name": "Main Codebase",
          "type": "git",
          "uri": "https://github.com/example/repo",
          "description": "Primary application repository"
        }
      ],
      "notes": [
        {
          "name": "Review Notes",
          "content": "## Initial Review\n\nFindings from the first pass:\n- Input validation gaps\n- Missing CSRF protection",
          "description": "Security review findings",
          "include_in_report": true
        }
      ],
      "diagrams": [
        {
          "name": "Simple DFD",
          "type": "dfd",
          "nodes": [
            { "id": "actor-1", "type": "actor", "label": "End User", "x": 100, "y": 200 },
            { "id": "process-1", "type": "process", "label": "Web App", "x": 400, "y": 200 },
            { "id": "store-1", "type": "store", "label": "Database", "x": 700, "y": 200 }
          ],
          "edges": [
            { "source": "actor-1", "target": "process-1", "label": "HTTP Request" },
            { "source": "process-1", "target": "store-1", "label": "SQL Query" }
          ]
        },
        {
          "name": "Complex DFD",
          "type": "dfd",
          "description": "Complex diagram for rendering regression testing",
          "nodes": [
            { "id": "actor-ext", "type": "actor", "label": "External User", "x": 50, "y": 150 },
            { "id": "actor-int", "type": "actor", "label": "Internal Admin", "x": 50, "y": 450 },
            { "id": "process-gw", "type": "process", "label": "API Gateway", "x": 300, "y": 300 },
            { "id": "process-auth", "type": "process", "label": "Auth Service", "x": 550, "y": 150 },
            { "id": "process-core", "type": "process", "label": "Core Service", "x": 550, "y": 300 },
            { "id": "process-notify", "type": "process", "label": "Notification Service", "x": 550, "y": 450 },
            { "id": "store-db", "type": "store", "label": "Primary DB", "x": 800, "y": 200 },
            { "id": "store-cache", "type": "store", "label": "Redis Cache", "x": 800, "y": 400 },
            { "id": "store-queue", "type": "store", "label": "Message Queue", "x": 800, "y": 550 },
            { "id": "process-embedded", "type": "process", "label": "Validator", "x": 320, "y": 320, "parent": "process-gw" }
          ],
          "edges": [
            { "source": "actor-ext", "target": "process-gw", "label": "HTTPS Request" },
            { "source": "actor-int", "target": "process-gw", "label": "Admin API" },
            { "source": "process-gw", "target": "process-auth", "label": "Auth Check" },
            { "source": "process-gw", "target": "process-core", "label": "Business Logic" },
            { "source": "process-auth", "target": "store-db", "label": "User Lookup" },
            { "source": "process-core", "target": "store-db", "label": "CRUD Operations" },
            { "source": "process-core", "target": "store-cache", "label": "Cache Read/Write" },
            { "source": "process-core", "target": "process-notify", "label": "Event Trigger" },
            { "source": "process-notify", "target": "store-queue", "label": "Enqueue Message" },
            { "source": "process-embedded", "target": "process-auth", "label": "Validate Token" }
          ]
        }
      ]
    }
  ],
  "surveys": [
    {
      "name": "Kitchen Sink Survey",
      "description": "Survey with all supported question types for integration testing",
      "status": "active",
      "survey_json": { "_placeholder": "Full SurveyJS JSON to be authored during Phase 3 implementation" },
      "settings": { "link_threat_model": true }
    },
    {
      "name": "Simple Workflow Survey",
      "description": "Minimal survey for workflow testing (fill, submit, triage)",
      "status": "active",
      "survey_json": { "_placeholder": "Full SurveyJS JSON to be authored during Phase 3 implementation" },
      "settings": {}
    }
  ],
  "survey_responses": [
    {
      "survey": "Simple Workflow Survey",
      "user": "test-user",
      "status": "submitted",
      "responses": { "_placeholder": "Authored during Phase 3 implementation" }
    }
  ],
  "admin_entities": {
    "groups": [
      { "name": "Seed Group - Engineering", "members": ["test-user", "test-reviewer"] }
    ],
    "quotas": [
      { "user": "test-user", "rate_limit": 100, "period": "hour" }
    ],
    "webhooks": [
      {
        "name": "Seed Webhook",
        "url": "https://example.com/webhook",
        "events": ["threat_model.created", "threat_model.updated"],
        "hmac_secret": "test-secret-value"
      }
    ],
    "addons": [],
    "settings": [
      { "key": "default_theme", "value": "light" },
      { "key": "max_upload_size_mb", "value": "50" }
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/seed/seed-spec.json
git commit -m "test: add E2E seed data specification

Contract document for the server team to build ingestion tooling.
Defines test users (3 roles), teams, projects, threat models with
all child entities, and survey/admin placeholders.

Refs #574"
```

---

### Task 10: Schema-Driven Field Definitions (JSON)

**Files:**
- Create: `e2e/schema/field-definitions.json`

- [ ] **Step 1: Create field-definitions.json**

Populate from the TMI OpenAPI spec at `/Users/efitz/Projects/tmi/api-schema/tmi-openapi.json`. Only include user-editable fields (exclude read-only fields like `id`, `created_at`, `modified_at`, `deleted_at`, `created_by`, `modified_by`, and computed/child arrays like `threats`, `assets`, `documents`, `diagrams`, `repositories`, `notes`). The `uiSelector` values use `data-testid` attributes — some may not exist in the UI yet (Phase 1 will surface those gaps).

```json
{
  "version": "1.0",
  "description": "Field definitions derived from TMI OpenAPI spec. Source of truth for field-coverage tests and OpenAPI validation.",
  "entities": {
    "threat_model": [
      { "apiName": "name", "uiSelector": "[data-testid='tm-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='tm-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "threat_model_framework", "uiSelector": "[data-testid='tm-framework-select']", "type": "select", "required": true, "editable": true, "options": ["STRIDE", "LINDDUN", "PASTA", "Custom"] },
      { "apiName": "status", "uiSelector": "[data-testid='tm-status-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "owner", "uiSelector": "[data-testid='tm-owner-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "security_reviewer", "uiSelector": "[data-testid='tm-reviewer-input']", "type": "text", "required": false, "editable": true },
      { "apiName": "project_id", "uiSelector": "[data-testid='tm-project-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "issue_uri", "uiSelector": "[data-testid='tm-issue-uri-input']", "type": "text", "required": false, "editable": true, "validationRules": ["uri"] },
      { "apiName": "alias", "uiSelector": "[data-testid='tm-alias-chips']", "type": "chips", "required": false, "editable": true },
      { "apiName": "is_confidential", "uiSelector": "[data-testid='tm-confidential-toggle']", "type": "toggle", "required": false, "editable": true },
      { "apiName": "metadata", "uiSelector": "[data-testid='tm-metadata-button']", "type": "chips", "required": false, "editable": true }
    ],
    "threat": [
      { "apiName": "name", "uiSelector": "[data-testid='threat-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='threat-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "threat_type", "uiSelector": "[data-testid='threat-type-select']", "type": "multiselect", "required": true, "editable": true },
      { "apiName": "severity", "uiSelector": "[data-testid='threat-severity-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "priority", "uiSelector": "[data-testid='threat-priority-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "status", "uiSelector": "[data-testid='threat-status-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "score", "uiSelector": "[data-testid='threat-score-input']", "type": "text", "required": false, "editable": true },
      { "apiName": "mitigated", "uiSelector": "[data-testid='threat-mitigated-toggle']", "type": "toggle", "required": false, "editable": true },
      { "apiName": "mitigation", "uiSelector": "[data-testid='threat-mitigation-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "cwe_id", "uiSelector": "[data-testid='threat-cwe-chips']", "type": "chips", "required": false, "editable": true },
      { "apiName": "cvss", "uiSelector": "[data-testid='threat-cvss-chips']", "type": "chips", "required": false, "editable": true },
      { "apiName": "ssvc", "uiSelector": "[data-testid='threat-ssvc-section']", "type": "text", "required": false, "editable": true },
      { "apiName": "issue_uri", "uiSelector": "[data-testid='threat-issue-uri-input']", "type": "text", "required": false, "editable": true, "validationRules": ["uri"] },
      { "apiName": "include_in_report", "uiSelector": "[data-testid='threat-include-report-toggle']", "type": "toggle", "required": false, "editable": true },
      { "apiName": "metadata", "uiSelector": "[data-testid='threat-metadata-button']", "type": "chips", "required": false, "editable": true }
    ],
    "asset": [
      { "apiName": "name", "uiSelector": "[data-testid='asset-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='asset-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "type", "uiSelector": "[data-testid='asset-type-select']", "type": "select", "required": true, "editable": true, "options": ["data", "hardware", "software", "infrastructure", "service", "personnel"] },
      { "apiName": "criticality", "uiSelector": "[data-testid='asset-criticality-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "classification", "uiSelector": "[data-testid='asset-classification-select']", "type": "multiselect", "required": false, "editable": true },
      { "apiName": "sensitivity", "uiSelector": "[data-testid='asset-sensitivity-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "include_in_report", "uiSelector": "[data-testid='asset-include-report-toggle']", "type": "toggle", "required": false, "editable": true }
    ],
    "document": [
      { "apiName": "name", "uiSelector": "[data-testid='document-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='document-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "uri", "uiSelector": "[data-testid='document-uri-input']", "type": "text", "required": true, "editable": true, "validationRules": ["uri"] },
      { "apiName": "include_in_report", "uiSelector": "[data-testid='document-include-report-toggle']", "type": "toggle", "required": false, "editable": true }
    ],
    "repository": [
      { "apiName": "name", "uiSelector": "[data-testid='repository-name-input']", "type": "text", "required": false, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='repository-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "type", "uiSelector": "[data-testid='repository-type-select']", "type": "select", "required": false, "editable": true, "options": ["git", "svn", "mercurial", "other"] },
      { "apiName": "uri", "uiSelector": "[data-testid='repository-uri-input']", "type": "text", "required": true, "editable": true, "validationRules": ["uri"] },
      { "apiName": "include_in_report", "uiSelector": "[data-testid='repository-include-report-toggle']", "type": "toggle", "required": false, "editable": true }
    ],
    "note": [
      { "apiName": "name", "uiSelector": "[data-testid='note-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='note-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "content", "uiSelector": "[data-testid='note-content-editor']", "type": "textarea", "required": true, "editable": true },
      { "apiName": "include_in_report", "uiSelector": "[data-testid='note-include-report-toggle']", "type": "toggle", "required": false, "editable": true }
    ],
    "team": [
      { "apiName": "name", "uiSelector": "[data-testid='team-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='team-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "status", "uiSelector": "[data-testid='team-status-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "email_address", "uiSelector": "[data-testid='team-email-input']", "type": "text", "required": false, "editable": true, "validationRules": ["email"] },
      { "apiName": "uri", "uiSelector": "[data-testid='team-uri-input']", "type": "text", "required": false, "editable": true, "validationRules": ["uri"] },
      { "apiName": "members", "uiSelector": "[data-testid='team-members-button']", "type": "chips", "required": false, "editable": true },
      { "apiName": "responsible_parties", "uiSelector": "[data-testid='team-responsible-parties-button']", "type": "chips", "required": false, "editable": true },
      { "apiName": "related_teams", "uiSelector": "[data-testid='team-related-teams-button']", "type": "chips", "required": false, "editable": true },
      { "apiName": "metadata", "uiSelector": "[data-testid='team-metadata-button']", "type": "chips", "required": false, "editable": true }
    ],
    "project": [
      { "apiName": "name", "uiSelector": "[data-testid='project-name-input']", "type": "text", "required": true, "editable": true },
      { "apiName": "description", "uiSelector": "[data-testid='project-description-input']", "type": "textarea", "required": false, "editable": true },
      { "apiName": "status", "uiSelector": "[data-testid='project-status-select']", "type": "select", "required": false, "editable": true },
      { "apiName": "team_id", "uiSelector": "[data-testid='project-team-select']", "type": "select", "required": true, "editable": true },
      { "apiName": "uri", "uiSelector": "[data-testid='project-uri-input']", "type": "text", "required": false, "editable": true, "validationRules": ["uri"] },
      { "apiName": "responsible_parties", "uiSelector": "[data-testid='project-responsible-parties-button']", "type": "chips", "required": false, "editable": true },
      { "apiName": "related_projects", "uiSelector": "[data-testid='project-related-projects-button']", "type": "chips", "required": false, "editable": true },
      { "apiName": "metadata", "uiSelector": "[data-testid='project-metadata-button']", "type": "chips", "required": false, "editable": true }
    ]
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/schema/field-definitions.json
git commit -m "test: add schema-driven field definitions for E2E tests

JSON source of truth mapping API fields to UI selectors for all
8 entity types. Derived from TMI OpenAPI spec.

Refs #574"
```

---

### Task 11: Schema-Driven Field Definitions (TypeScript Re-export)

**Files:**
- Create: `e2e/schema/field-definitions.ts`

- [ ] **Step 1: Create TypeScript re-export**

```typescript
import fieldData from './field-definitions.json';

export interface FieldDef {
  apiName: string;
  uiSelector: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'checkbox' | 'toggle' | 'date' | 'chips';
  required: boolean;
  editable: boolean;
  options?: string[];
  validationRules?: string[];
}

interface FieldDefinitions {
  version: string;
  description: string;
  entities: Record<string, FieldDef[]>;
}

const data = fieldData as FieldDefinitions;

export const THREAT_MODEL_FIELDS: FieldDef[] = data.entities.threat_model;
export const THREAT_FIELDS: FieldDef[] = data.entities.threat;
export const ASSET_FIELDS: FieldDef[] = data.entities.asset;
export const DOCUMENT_FIELDS: FieldDef[] = data.entities.document;
export const REPOSITORY_FIELDS: FieldDef[] = data.entities.repository;
export const NOTE_FIELDS: FieldDef[] = data.entities.note;
export const TEAM_FIELDS: FieldDef[] = data.entities.team;
export const PROJECT_FIELDS: FieldDef[] = data.entities.project;
```

- [ ] **Step 2: Commit**

```bash
git add e2e/schema/field-definitions.ts
git commit -m "test: add TypeScript re-export for field definitions

Typed FieldDef interface and per-entity exports consuming
field-definitions.json for Playwright tests.

Refs #574"
```

---

### Task 12: OpenAPI Schema Validator (Python)

**Files:**
- Create: `e2e/schema/validate-fields.py`
- Modify: `package.json` (script already added in Task 1)

- [ ] **Step 1: Create the Python validator**

```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx"]
# ///
"""
Validate field-definitions.json against the TMI OpenAPI spec.

Reports:
  - STALE: Field definition references an API field that doesn't exist (error, exit 1)
  - MISSING: API field exists but has no field definition (warning)

Usage:
  uv run e2e/schema/validate-fields.py [--spec PATH_OR_URL]
"""

import argparse
import json
import sys
from pathlib import Path

import httpx

DEFAULT_SPEC_URL = (
    "https://raw.githubusercontent.com/ericfitz/tmi/refs/heads/main/api-schema/tmi-openapi.json"
)
FIELD_DEFS_PATH = Path(__file__).parent / "field-definitions.json"

# Map from field-definitions.json entity key to OpenAPI schema name(s).
# Some entities use allOf composition with a Base schema.
ENTITY_SCHEMA_MAP = {
    "threat_model": ["ThreatModelBase", "ThreatModel"],
    "threat": ["ThreatBase", "Threat"],
    "asset": ["AssetBase", "Asset"],
    "document": ["DocumentBase", "Document"],
    "repository": ["RepositoryBase", "Repository"],
    "note": ["NoteBase", "Note"],
    "team": ["TeamBase", "Team"],
    "project": ["ProjectBase", "Project"],
}

# Fields that are read-only / system-managed and intentionally excluded from UI
IGNORED_API_FIELDS = {
    "id",
    "created_at",
    "modified_at",
    "deleted_at",
    "created_by",
    "modified_by",
    "reviewed_by",
    "reviewed_at",
    "threat_model_id",
    "access_status",
    "content_source",
    # Child entity arrays (managed via their own CRUD, not inline fields)
    "threats",
    "assets",
    "documents",
    "repositories",
    "diagrams",
    "notes",
    "authorization",
    "status_updated",
    # Fields managed via special UI (not inline form fields)
    "diagram_id",
    "cell_id",
    "asset_id",
    "timmy_enabled",
    "parameters",
}


def load_spec(spec_path: str) -> dict:
    """Load the OpenAPI spec from a local file or URL."""
    path = Path(spec_path)
    if path.exists():
        with open(path) as f:
            return json.load(f)
    # Try as URL
    resp = httpx.get(spec_path, follow_redirects=True, timeout=30)
    resp.raise_for_status()
    return resp.json()


def resolve_ref(spec: dict, ref: str) -> dict:
    """Resolve a $ref pointer within the spec."""
    parts = ref.lstrip("#/").split("/")
    obj = spec
    for p in parts:
        obj = obj[p]
    return obj


def collect_api_fields(spec: dict, schema_names: list[str]) -> set[str]:
    """Collect all property names from the given schema(s), resolving allOf."""
    schemas = spec.get("components", {}).get("schemas", {})
    fields: set[str] = set()

    for name in schema_names:
        schema = schemas.get(name, {})

        # Direct properties
        fields.update(schema.get("properties", {}).keys())

        # allOf composition
        for item in schema.get("allOf", []):
            if "$ref" in item:
                ref_schema = resolve_ref(spec, item["$ref"])
                fields.update(ref_schema.get("properties", {}).keys())
            else:
                fields.update(item.get("properties", {}).keys())

    return fields


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate field definitions against OpenAPI spec")
    parser.add_argument(
        "--spec",
        default=DEFAULT_SPEC_URL,
        help="Path or URL to the TMI OpenAPI spec JSON",
    )
    args = parser.parse_args()

    # Load inputs
    spec = load_spec(args.spec)
    with open(FIELD_DEFS_PATH) as f:
        field_defs = json.load(f)

    stale_count = 0
    missing_count = 0

    for entity_key, schema_names in ENTITY_SCHEMA_MAP.items():
        defs = field_defs.get("entities", {}).get(entity_key, [])
        def_field_names = {d["apiName"] for d in defs}
        api_fields = collect_api_fields(spec, schema_names)

        # Check for stale definitions (error)
        stale = def_field_names - api_fields
        for field in sorted(stale):
            print(f"  ERROR  [{entity_key}] STALE: '{field}' in field-definitions but not in API schema")
            stale_count += 1

        # Check for missing definitions (warning)
        missing = api_fields - def_field_names - IGNORED_API_FIELDS
        for field in sorted(missing):
            print(f"  WARN   [{entity_key}] MISSING: '{field}' in API schema but not in field-definitions")
            missing_count += 1

    # Summary
    print(f"\n{'='*60}")
    print(f"Entities checked: {len(ENTITY_SCHEMA_MAP)}")
    print(f"Stale definitions (errors): {stale_count}")
    print(f"Missing definitions (warnings): {missing_count}")

    if stale_count > 0:
        print("\nFAILED: Remove stale field definitions that reference nonexistent API fields.")
        return 1

    print("\nPASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Verify it runs**

```bash
uv run e2e/schema/validate-fields.py --spec /Users/efitz/Projects/tmi/api-schema/tmi-openapi.json
```

Expected: PASSED (or warnings for fields the UI intentionally omits). Fix any STALE errors by updating `field-definitions.json`.

- [ ] **Step 3: Commit**

```bash
git add e2e/schema/validate-fields.py
git commit -m "test: add OpenAPI schema validator for field definitions

Python script using uv run that compares field-definitions.json
against the TMI OpenAPI spec. Errors on stale definitions, warns
on missing UI coverage.

Refs #574"
```

---

### Task 13: Translation Scanner Helper

**Files:**
- Create: `e2e/helpers/translation-scanner.ts`

- [ ] **Step 1: Create translation-scanner.ts**

```typescript
import { Page } from '@playwright/test';

interface TranslationFailure {
  element: string;
  text: string;
  selector: string;
}

/**
 * Scans the page DOM for unresolved Transloco translation keys.
 *
 * Detection:
 * 1. Text nodes matching the pattern of a dotted key path
 *    (3+ dot-separated segments, alphanumeric/camelCase, no spaces)
 * 2. Elements with [transloco] attribute that have empty text content
 *
 * Throws with a descriptive error listing all missing translations.
 */
export async function assertNoMissingTranslations(page: Page): Promise<void> {
  const failures = await page.evaluate((): TranslationFailure[] => {
    const results: TranslationFailure[] = [];

    // Pattern: 3+ dot-separated segments, each alphanumeric/camelCase
    // e.g., "dashboard.threatModels.title" or "common.buttons.save"
    const keyPattern = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*){2,}$/;

    // Walk all text nodes
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();
      if (text && keyPattern.test(text)) {
        const parent = node.parentElement;
        const tagName = parent?.tagName?.toLowerCase() ?? 'unknown';
        const testId = parent?.getAttribute('data-testid') ?? '';
        const selector = testId ? `[data-testid="${testId}"]` : tagName;

        results.push({
          element: tagName,
          text,
          selector,
        });
      }
    }

    // Check elements with [transloco] attribute that are empty
    const translocoElements = document.querySelectorAll('[transloco]');
    for (const el of translocoElements) {
      const text = el.textContent?.trim();
      if (!text) {
        const tagName = el.tagName.toLowerCase();
        const testId = el.getAttribute('data-testid') ?? '';
        const translocoKey = el.getAttribute('transloco') ?? '';
        const selector = testId ? `[data-testid="${testId}"]` : `${tagName}[transloco="${translocoKey}"]`;

        results.push({
          element: tagName,
          text: `(empty) key=${translocoKey}`,
          selector,
        });
      }
    }

    return results;
  });

  if (failures.length > 0) {
    const details = failures
      .map(f => `  - ${f.selector}: "${f.text}"`)
      .join('\n');
    throw new Error(
      `Found ${failures.length} unresolved translation key(s):\n${details}`,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/translation-scanner.ts
git commit -m "test: add translation scanner helper for E2E tests

Scans page DOM for unresolved Transloco keys (dotted paths in
text nodes and empty [transloco] elements).

Refs #574"
```

---

### Task 14: Icon Integrity Checker

**Files:**
- Create: `e2e/helpers/icon-checker.ts`

- [ ] **Step 1: Create icon-checker.ts**

```typescript
import { Page } from '@playwright/test';

interface IconFailure {
  iconName: string;
  selector: string;
  reason: string;
}

/**
 * Verifies all Material icons on the page rendered correctly.
 *
 * For each mat-icon element, asserts:
 * - Non-zero bounding box (width > 0, height > 0)
 * - Visible content: SVG child element or non-empty text content (ligature)
 *
 * Throws with a descriptive error listing all broken icons.
 */
export async function assertIconsRendered(page: Page): Promise<void> {
  const icons = page.locator('mat-icon');
  const count = await icons.count();

  if (count === 0) {
    return; // No icons on page — nothing to check
  }

  const failures: IconFailure[] = [];

  for (let i = 0; i < count; i++) {
    const icon = icons.nth(i);

    // Skip hidden icons (e.g., in collapsed menus)
    const isVisible = await icon.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    const box = await icon.boundingBox();
    const iconName = await icon.textContent() ?? '';
    const testId = await icon.getAttribute('data-testid') ?? '';
    const selector = testId ? `[data-testid="${testId}"]` : `mat-icon:nth(${i})`;

    if (!box || box.width === 0 || box.height === 0) {
      failures.push({
        iconName: iconName.trim(),
        selector,
        reason: 'Zero-size bounding box',
      });
      continue;
    }

    // Check for content: SVG child or text ligature
    const hasSvg = await icon.locator('svg').count() > 0;
    const hasText = iconName.trim().length > 0;

    if (!hasSvg && !hasText) {
      failures.push({
        iconName: '(empty)',
        selector,
        reason: 'No SVG child and no text content',
      });
    }
  }

  if (failures.length > 0) {
    const details = failures
      .map(f => `  - ${f.selector} [${f.iconName}]: ${f.reason}`)
      .join('\n');
    throw new Error(
      `Found ${failures.length} broken icon(s):\n${details}`,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/icon-checker.ts
git commit -m "test: add icon integrity checker helper for E2E tests

Verifies all mat-icon elements have non-zero bounding boxes and
visible content (SVG or text ligature).

Refs #574"
```

---

### Task 15: Screenshot Baseline Helper

**Files:**
- Create: `e2e/helpers/screenshot.ts`

- [ ] **Step 1: Create screenshot.ts**

```typescript
import { expect, Locator, Page } from '@playwright/test';

export type ThemeMode = 'light' | 'dark' | 'light-colorblind' | 'dark-colorblind';

export const ALL_THEME_MODES: ThemeMode[] = [
  'light',
  'dark',
  'light-colorblind',
  'dark-colorblind',
];

export interface ScreenshotOptions {
  mask?: Locator[];
  threshold?: number;
  fullPage?: boolean;
  modes?: ThemeMode[];
}

/**
 * Apply a theme mode by toggling CSS classes on body and the CDK overlay container.
 * Matches ThemeService._applyThemeClasses() behavior.
 */
async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate((themeMode: ThemeMode) => {
    const body = document.body;
    const overlay = document.querySelector('.cdk-overlay-container');

    // Remove existing theme classes
    body.classList.remove('dark-theme', 'colorblind-palette');
    overlay?.classList.remove('dark-theme', 'colorblind-palette');

    // Apply new classes
    if (themeMode === 'dark' || themeMode === 'dark-colorblind') {
      body.classList.add('dark-theme');
      overlay?.classList.add('dark-theme');
    }
    if (themeMode === 'light-colorblind' || themeMode === 'dark-colorblind') {
      body.classList.add('colorblind-palette');
      overlay?.classList.add('colorblind-palette');
    }
  }, mode);

  // Wait for repaint
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  // Additional small delay for CSS transitions
  await page.waitForTimeout(200);
}

/**
 * Detect the current theme mode from body CSS classes.
 */
async function detectCurrentTheme(page: Page): Promise<ThemeMode> {
  return page.evaluate((): ThemeMode => {
    const isDark = document.body.classList.contains('dark-theme');
    const isColorblind = document.body.classList.contains('colorblind-palette');
    if (isDark && isColorblind) return 'dark-colorblind';
    if (isDark) return 'dark';
    if (isColorblind) return 'light-colorblind';
    return 'light';
  });
}

/**
 * Take screenshots across all theme modes (or a specified subset).
 *
 * For each mode: applies theme via CSS classes, waits for repaint,
 * takes a screenshot with Playwright's toHaveScreenshot().
 * Restores the original theme after all screenshots.
 *
 * Screenshot names: `{name}-{mode}.png`
 */
export async function takeThemeScreenshots(
  page: Page,
  name: string,
  options?: ScreenshotOptions,
): Promise<void> {
  const modes = options?.modes ?? ALL_THEME_MODES;
  const originalTheme = await detectCurrentTheme(page);

  try {
    for (const mode of modes) {
      await applyTheme(page, mode);
      await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
        threshold: options?.threshold ?? 0.2,
        fullPage: options?.fullPage ?? false,
        mask: options?.mask ?? [],
      });
    }
  } finally {
    // Restore original theme
    await applyTheme(page, originalTheme);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/screenshot.ts
git commit -m "test: add screenshot baseline helper with theme matrix

Wraps toHaveScreenshot() with 4-mode theme cycling (light, dark,
light-colorblind, dark-colorblind) via CSS class toggling.

Refs #574"
```

---

### Task 16: Accessibility Snapshot Helper

**Files:**
- Create: `e2e/helpers/accessibility.ts`

- [ ] **Step 1: Create accessibility.ts**

```typescript
import { Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES } from './screenshot';

interface AccessibilityFailure {
  theme: ThemeMode;
  check: string;
  details: string;
}

export interface AccessibilityOptions {
  skipThemes?: ThemeMode[];
}

/**
 * Apply a theme mode by toggling CSS classes.
 * (Duplicated from screenshot.ts to avoid circular deps — both are leaf helpers.)
 */
async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate((themeMode: ThemeMode) => {
    const body = document.body;
    const overlay = document.querySelector('.cdk-overlay-container');

    body.classList.remove('dark-theme', 'colorblind-palette');
    overlay?.classList.remove('dark-theme', 'colorblind-palette');

    if (themeMode === 'dark' || themeMode === 'dark-colorblind') {
      body.classList.add('dark-theme');
      overlay?.classList.add('dark-theme');
    }
    if (themeMode === 'light-colorblind' || themeMode === 'dark-colorblind') {
      body.classList.add('colorblind-palette');
      overlay?.classList.add('colorblind-palette');
    }
  }, mode);

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await page.waitForTimeout(200);
}

/**
 * Detect the current theme mode from body CSS classes.
 */
async function detectCurrentTheme(page: Page): Promise<ThemeMode> {
  return page.evaluate((): ThemeMode => {
    const isDark = document.body.classList.contains('dark-theme');
    const isColorblind = document.body.classList.contains('colorblind-palette');
    if (isDark && isColorblind) return 'dark-colorblind';
    if (isDark) return 'dark';
    if (isColorblind) return 'light-colorblind';
    return 'light';
  });
}

/**
 * Run accessibility checks across all theme modes.
 *
 * Checks per mode:
 * - All interactive elements are keyboard-focusable
 * - All form fields have label or aria-label
 * - No duplicate id attributes
 *
 * Throws with failures grouped by theme mode.
 */
export async function assertAccessibility(
  page: Page,
  options?: AccessibilityOptions,
): Promise<void> {
  const skipThemes = new Set(options?.skipThemes ?? []);
  const modes = ALL_THEME_MODES.filter(m => !skipThemes.has(m));
  const originalTheme = await detectCurrentTheme(page);
  const allFailures: AccessibilityFailure[] = [];

  try {
    for (const mode of modes) {
      await applyTheme(page, mode);

      const modeFailures = await page.evaluate((): { check: string; details: string }[] => {
        const failures: { check: string; details: string }[] = [];

        // Check 1: Form fields must have labels
        const formFields = document.querySelectorAll(
          'input, select, textarea, mat-select, mat-checkbox, mat-radio-group',
        );
        for (const field of formFields) {
          const el = field as HTMLElement;
          // Skip hidden fields
          if (el.offsetParent === null && el.getAttribute('type') !== 'hidden') continue;
          if (el.getAttribute('type') === 'hidden') continue;

          const hasLabel = !!el.getAttribute('aria-label')
            || !!el.getAttribute('aria-labelledby')
            || !!document.querySelector(`label[for="${el.id}"]`);

          if (!hasLabel && el.id) {
            failures.push({
              check: 'missing-label',
              details: `${el.tagName.toLowerCase()}#${el.id} has no label or aria-label`,
            });
          }
        }

        // Check 2: No duplicate IDs
        const allIds = document.querySelectorAll('[id]');
        const idCounts = new Map<string, number>();
        for (const el of allIds) {
          const id = el.id;
          if (id) {
            idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
          }
        }
        for (const [id, count] of idCounts) {
          if (count > 1) {
            failures.push({
              check: 'duplicate-id',
              details: `id="${id}" appears ${count} times`,
            });
          }
        }

        return failures;
      });

      for (const f of modeFailures) {
        allFailures.push({ theme: mode, ...f });
      }
    }
  } finally {
    await applyTheme(page, originalTheme);
  }

  if (allFailures.length > 0) {
    const grouped = new Map<ThemeMode, AccessibilityFailure[]>();
    for (const f of allFailures) {
      const list = grouped.get(f.theme) ?? [];
      list.push(f);
      grouped.set(f.theme, list);
    }

    const details = [...grouped.entries()]
      .map(([theme, failures]) => {
        const items = failures.map(f => `    - [${f.check}] ${f.details}`).join('\n');
        return `  ${theme}:\n${items}`;
      })
      .join('\n');

    throw new Error(
      `Found ${allFailures.length} accessibility issue(s):\n${details}`,
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add e2e/helpers/accessibility.ts
git commit -m "test: add accessibility snapshot helper for E2E tests

Checks form labels, duplicate IDs across all 4 theme modes.
Restores original theme after checks.

Refs #574"
```

---

### Task 17: Extract Shared Theme Utilities

The `applyTheme` and `detectCurrentTheme` functions are duplicated between `screenshot.ts` and `accessibility.ts`. Extract them into a shared module.

**Files:**
- Create: `e2e/helpers/theme-utils.ts`
- Modify: `e2e/helpers/screenshot.ts`
- Modify: `e2e/helpers/accessibility.ts`

- [ ] **Step 1: Create theme-utils.ts**

```typescript
import { Page } from '@playwright/test';

export type ThemeMode = 'light' | 'dark' | 'light-colorblind' | 'dark-colorblind';

export const ALL_THEME_MODES: ThemeMode[] = [
  'light',
  'dark',
  'light-colorblind',
  'dark-colorblind',
];

/**
 * Apply a theme mode by toggling CSS classes on body and the CDK overlay container.
 * Matches ThemeService._applyThemeClasses() behavior.
 */
export async function applyTheme(page: Page, mode: ThemeMode): Promise<void> {
  await page.evaluate((themeMode: ThemeMode) => {
    const body = document.body;
    const overlay = document.querySelector('.cdk-overlay-container');

    body.classList.remove('dark-theme', 'colorblind-palette');
    overlay?.classList.remove('dark-theme', 'colorblind-palette');

    if (themeMode === 'dark' || themeMode === 'dark-colorblind') {
      body.classList.add('dark-theme');
      overlay?.classList.add('dark-theme');
    }
    if (themeMode === 'light-colorblind' || themeMode === 'dark-colorblind') {
      body.classList.add('colorblind-palette');
      overlay?.classList.add('colorblind-palette');
    }
  }, mode);

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
  await page.waitForTimeout(200);
}

/**
 * Detect the current theme mode from body CSS classes.
 */
export async function detectCurrentTheme(page: Page): Promise<ThemeMode> {
  return page.evaluate((): ThemeMode => {
    const isDark = document.body.classList.contains('dark-theme');
    const isColorblind = document.body.classList.contains('colorblind-palette');
    if (isDark && isColorblind) return 'dark-colorblind';
    if (isDark) return 'dark';
    if (isColorblind) return 'light-colorblind';
    return 'light';
  });
}
```

- [ ] **Step 2: Update screenshot.ts to import from theme-utils**

Remove the `ThemeMode`, `ALL_THEME_MODES`, `applyTheme`, and `detectCurrentTheme` definitions from `screenshot.ts`. Replace with imports:

```typescript
import { expect, Locator, Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES, applyTheme, detectCurrentTheme } from './theme-utils';

export type { ThemeMode };
export { ALL_THEME_MODES };

export interface ScreenshotOptions {
  mask?: Locator[];
  threshold?: number;
  fullPage?: boolean;
  modes?: ThemeMode[];
}

export async function takeThemeScreenshots(
  page: Page,
  name: string,
  options?: ScreenshotOptions,
): Promise<void> {
  const modes = options?.modes ?? ALL_THEME_MODES;
  const originalTheme = await detectCurrentTheme(page);

  try {
    for (const mode of modes) {
      await applyTheme(page, mode);
      await expect(page).toHaveScreenshot(`${name}-${mode}.png`, {
        threshold: options?.threshold ?? 0.2,
        fullPage: options?.fullPage ?? false,
        mask: options?.mask ?? [],
      });
    }
  } finally {
    await applyTheme(page, originalTheme);
  }
}
```

- [ ] **Step 3: Update accessibility.ts to import from theme-utils**

Remove the `applyTheme` and `detectCurrentTheme` functions from `accessibility.ts`. Replace the local `ThemeMode` import:

```typescript
import { Page } from '@playwright/test';
import { type ThemeMode, ALL_THEME_MODES, applyTheme, detectCurrentTheme } from './theme-utils';
```

Remove all the duplicate function definitions — the rest of `accessibility.ts` stays the same (the `AccessibilityFailure` interface, `AccessibilityOptions`, and `assertAccessibility` function).

- [ ] **Step 4: Commit**

```bash
git add e2e/helpers/theme-utils.ts e2e/helpers/screenshot.ts e2e/helpers/accessibility.ts
git commit -m "refactor: extract shared theme utilities from E2E helpers

Move applyTheme and detectCurrentTheme to theme-utils.ts.
screenshot.ts and accessibility.ts import from the shared module.

Refs #574"
```

---

### Task 18: Visual Regression Triage Skill

**Files:**
- Create: `.claude/skills/visual-regression-triage.md`
- Modify: `.claude/CLAUDE.md`

- [ ] **Step 1: Create the skill file**

Create `.claude/skills/visual-regression-triage.md`:

```markdown
---
name: visual-regression-triage
description: Triage visual regression test failures by presenting baseline/actual/diff images with task context, then guiding the user to fix the bug or update the baseline
---

# Visual Regression Triage

Use this skill when a Playwright visual regression test fails (screenshot mismatch) during `pnpm test:e2e` or when the user mentions a screenshot test failure.

## Process

### Step 1: Gather Task Context

Before examining images, understand what the user is working on:

1. Run `git branch --show-current` to get the current branch
2. Run `git log --oneline -5` to see recent commits — look for issue references and conventional commit types
3. If commits or branch name reference a GitHub issue number, run `gh issue view <number> --repo ericfitz/tmi-ux --json title,body` to get the issue context
4. Run `git diff --name-only HEAD~5` to see recently changed files

### Step 2: Parse Failure Output

From the Playwright test output (provided by the user or from the most recent test run), identify which screenshot(s) failed. Playwright stores three files per failure in the test results directory (typically `test-results/`):

- `{test-name}/{screenshot-name}-actual.png` — what the test produced
- `{test-name}/{screenshot-name}-expected.png` — the baseline
- `{test-name}/{screenshot-name}-diff.png` — visual diff highlighting changes

Use the Glob tool to find these files:
```
test-results/**/*-actual.png
```

### Step 3: Present Evidence with Context

For each failing screenshot:

1. Read all three images (baseline, actual, diff) using the Read tool
2. Describe the visual differences you observe
3. Frame the analysis against the task context:
   - If the diff is on a page/component related to the current issue: flag as **likely expected change**
   - If the diff is on an unrelated page: flag as **likely unintended regression**
   - If uncertain: present both possibilities

Example framing:
- "You're working on #123 (feat: add widget to page Y). The screenshot diff for page Y shows a new button in the toolbar. This is likely an expected change from your feature work."
- "You're working on #456 (fix: auth token refresh). The screenshot diff for the dashboard shows shifted layout. This page isn't related to your current work — this looks like an unintended regression."

### Step 4: Ask for Decision

Present two options:

**Bug** — The visual change is unintended:
- Help identify the responsible code change by examining recent diffs to CSS, templates, and component files near the affected area
- Suggest a fix
- Offer to re-run the failing test: `pnpm test:e2e --project=visual-regression`

**Expected change** — The visual change is intentional:
- Ask the user to confirm
- Update the baseline by running the test with `--update-snapshots`:
  ```bash
  pnpm test:e2e --project=visual-regression --update-snapshots
  ```
- Re-run the test to verify it passes
- Stage and commit the updated baseline images
```

- [ ] **Step 2: Add triage skill reference to CLAUDE.md**

Add a new section to `.claude/CLAUDE.md` after the "Testing" section. Find the `## Versioning` heading and insert before it:

```markdown
## Automated Workflows

### Visual Regression Triage

When visual regression E2E tests fail (screenshot mismatch in `pnpm test:e2e`), invoke the `visual-regression-triage` skill to present the baseline, actual, and diff images, describe the differences, and guide resolution (fix bug or update baseline).
```

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/visual-regression-triage.md .claude/CLAUDE.md
git commit -m "test: add visual regression triage skill

Claude Code skill that triages screenshot test failures by
gathering task context, presenting baseline/actual/diff images,
and guiding bug fix or baseline update. Referenced in CLAUDE.md.

Refs #574"
```

---

### Task 19: Update E2E README

**Files:**
- Modify: `e2e/README.md`

- [ ] **Step 1: Rewrite the README**

Replace `e2e/README.md` with updated content reflecting the new structure:

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
# Run all tests (all projects)
pnpm test:e2e

# Run a specific project
pnpm test:e2e:workflows
pnpm test:e2e:field-coverage
pnpm test:e2e:visual-regression
pnpm test:e2e:admin

# Run with visible browser
pnpm test:e2e:headed

# Run in interactive UI mode
pnpm test:e2e:ui

# Run in debug mode
pnpm test:e2e:debug

# Validate field definitions against OpenAPI spec
pnpm run e2e:validate-schema
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `E2E_APP_URL` | `http://localhost:4200` | Frontend URL |
| `E2E_API_URL` | `http://localhost:8080` | Backend API URL |
| `E2E_OAUTH_PROVIDER` | `tmi` | OAuth provider for test login |

## Test Users

| User ID | Role | Description |
|---------|------|-------------|
| `test-user` | Normal user | Dashboard, intake, TM creation |
| `test-reviewer` | Security reviewer | + triage access |
| `test-admin` | Admin | + admin panel access |

Users are selected via the `login_hint` parameter in the TMI OAuth provider dialog.

## Project Structure

```
e2e/
├── config/          # Environment configuration
├── setup/           # Global setup (service availability check)
├── fixtures/        # Playwright test fixtures
│   ├── test-fixtures.ts   # Page object + flow fixtures
│   └── auth-fixtures.ts   # Role-aware auth (userTest, reviewerTest, adminTest, multiRoleTest)
├── schema/          # Field definitions and OpenAPI validator
├── seed/            # Seed data specification (server ingestion contract)
├── helpers/         # Reusable test utilities
│   ├── theme-utils.ts          # Theme mode toggling
│   ├── translation-scanner.ts  # Unresolved Transloco key detection
│   ├── icon-checker.ts         # Material icon rendering verification
│   ├── screenshot.ts           # Theme matrix screenshot baselines
│   └── accessibility.ts        # Accessibility checks across themes
├── pages/           # Page objects (element locators)
├── dialogs/         # Dialog objects (dialog-scoped locators)
├── flows/           # Multi-step user workflows (no assertions)
└── tests/
    ├── workflows/          # Scenario/lifecycle tests
    ├── field-coverage/     # Schema-driven field validation
    ├── visual-regression/  # Screenshot baselines + DOM assertions
    └── admin/              # Admin-specific tests
```

## Test Architecture

```
Tests (*.spec.ts)        — Scenarios with assertions
  └── Flows (*-flow.ts)  — Multi-step user workflows (no assertions)
    └── Page Objects      — Element locators and single-step helpers
      └── Dialog Objects  — Dialog-scoped locators
```

## Auth Fixtures

```typescript
// Single-role test (most common)
import { userTest as test } from '../../fixtures/auth-fixtures';
test('does something', async ({ userPage }) => { ... });

// Cross-role test
import { multiRoleTest as test } from '../../fixtures/auth-fixtures';
test('cross-role workflow', async ({ userPage, reviewerPage }) => { ... });
```

## Troubleshooting

**Tests fail at global setup:** Both services must be running. Check that the backend is accessible at the configured API URL.

**Auth test fails:** Verify the `tmi` OAuth provider is configured on the backend. The login dialog should accept a `login_hint` value.

**View test report:**

```bash
pnpm playwright show-report
```
```

- [ ] **Step 2: Commit**

```bash
git add e2e/README.md
git commit -m "docs: update E2E README for multi-project structure

Document new project layout, auth fixtures, test users, helpers,
and per-project run commands.

Refs #574"
```

---

### Task 20: Lint, Build, and Final Verification

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

```bash
pnpm run lint:all
```

Fix any lint errors. The E2E files are outside `src/` so they may not be covered by the Angular lint config — verify.

- [ ] **Step 2: Run build**

```bash
pnpm run build
```

The build should not be affected by E2E file changes (they're outside `src/`), but verify no config issues.

- [ ] **Step 3: Run the schema validator**

```bash
pnpm run e2e:validate-schema -- --spec /Users/efitz/Projects/tmi/api-schema/tmi-openapi.json
```

Fix any STALE errors in `field-definitions.json`.

- [ ] **Step 4: Verify Playwright config loads all projects**

```bash
npx playwright test --list --project=workflows
npx playwright test --list --project=field-coverage
npx playwright test --list --project=visual-regression
npx playwright test --list --project=admin
```

Expected: `workflows` lists the 4 migrated spec files' tests. Other projects list 0 tests (empty, just `.gitkeep`).

- [ ] **Step 5: Commit any fixes**

If any of the above steps required fixes:

```bash
git add -A
git commit -m "test: fix lint and validation issues from E2E Phase 0

Refs #574"
```
