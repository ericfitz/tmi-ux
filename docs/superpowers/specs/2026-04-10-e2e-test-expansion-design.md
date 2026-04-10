# E2E Test Expansion Design

## Goal

Expand the Playwright E2E test suite from a single core lifecycle test into a scalable, well-structured test infrastructure with page objects, flows, custom fixtures, and three new test suites — while cleaning up legacy Cypress artifacts and stubbing CI integration.

Builds on the foundation established in `2026-04-09-playwright-integration-tests-design.md`.

## Context

The initial Playwright integration phase delivered:

- A single serial test suite (`core-lifecycle.spec.ts`) with 10 tests covering the happy-path CRUD lifecycle
- An auth helper, global setup, and test config
- `data-testid` attributes on ~20 elements across 7 components
- Chromium-only, live-backend testing against `localhost`

What's missing:

- No page object abstraction — tests use raw Playwright locators
- No reusable workflow compositions — common sequences are inlined
- Limited test coverage — only happy-path create/read/delete
- Legacy Cypress artifacts still present
- No CI integration

## Approach: Playwright Custom Fixtures

Use Playwright's [custom fixture system](https://playwright.dev/docs/test-fixtures) to inject page objects, dialog objects, and flow classes into tests. This is the idiomatic Playwright pattern and provides:

- Declarative test dependencies (tests declare what they need in their signature)
- Natural path to parallel execution (fixtures can manage isolation per-test)
- No inheritance hierarchy (composition over inheritance)
- Clean separation between locator layer, workflow layer, and assertion layer

## Architecture

### Three-Layer Design

```
Tests (assertions only)
  ↓ use
Flows (multi-step workflows, no assertions)
  ↓ compose
Page Objects + Dialog Objects (locators + single-step actions)
  ↓ wrap
Playwright Page API
```

**Page objects** expose named locators and single-step actions for a single page. They never navigate, never wait for page loads, and never assert.

**Dialog objects** follow the same pattern but scope all locators to `mat-dialog-container` to avoid collisions with the page behind the dialog.

**Flows** compose page objects and dialogs into multi-step user workflows (e.g., "create a threat model from the dashboard"). They handle navigation and waiting. They never assert.

**Tests** use flows to set up state and page objects to inspect results. Only tests contain assertions.

### Directory Structure

```
e2e/
  config/
    test.config.ts              (existing, unchanged)
  setup/
    global-setup.ts             (existing, unchanged)
  fixtures/
    test-fixtures.ts            (custom fixture definitions and wiring)
  pages/
    dashboard.page.ts
    tm-edit.page.ts
    threat-page.page.ts
    dfd-editor.page.ts
    triage.page.ts
    login.page.ts
    navbar.page.ts
  dialogs/
    create-tm.dialog.ts
    create-diagram.dialog.ts
    delete-confirm.dialog.ts
    threat-editor.dialog.ts
    cvss-calculator.dialog.ts
    cwe-picker.dialog.ts
  flows/
    auth.flow.ts                (replaces helpers/auth.ts)
    threat-model.flow.ts
    threat.flow.ts
    diagram.flow.ts
  tests/
    core-lifecycle.spec.ts      (existing, refactored to use fixtures)
    threat-editing.spec.ts      (new)
    navigation-routing.spec.ts  (new)
    error-scenarios.spec.ts     (new)
  helpers/
    (deleted — auth.ts moves to flows/auth.flow.ts)
```

### Fixture Wiring

```typescript
// e2e/fixtures/test-fixtures.ts
import { test as base } from '@playwright/test';

export const test = base.extend<{
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
}>({
  // Each fixture instantiates its class with the Playwright page
  dashboardPage: async ({ page }, use) => { await use(new DashboardPage(page)); },
  // Flows receive their page object dependencies
  threatFlow: async ({ page, tmEditPage, threatPage, cvssCalculatorDialog, cwePickerDialog }, use) => {
    await use(new ThreatFlow(page, tmEditPage, threatPage, cvssCalculatorDialog, cwePickerDialog));
  },
  // ... etc
});

export { expect } from '@playwright/test';
```

All test files import `{ test, expect }` from `../fixtures/test-fixtures` instead of from `@playwright/test`.

### Page Object Pattern

```typescript
// e2e/pages/threat-page.page.ts
export class ThreatPage {
  constructor(private page: Page) {}

  // Locators as methods — fresh evaluation each call
  readonly nameInput = () => this.page.getByTestId('threat-page-name-input');
  readonly descriptionInput = () => this.page.getByTestId('threat-page-description-input');
  readonly saveButton = () => this.page.getByTestId('threat-page-save-button');
  readonly addCweButton = () => this.page.getByTestId('threat-page-add-cwe-button');
  readonly cweChips = () => this.page.getByTestId('threat-page-cwe-chip');
  readonly openCvssButton = () => this.page.getByTestId('threat-page-open-cvss-button');

  // Single-step actions
  async fillName(name: string) { await this.nameInput().fill(name); }
  async fillDescription(desc: string) { await this.descriptionInput().fill(desc); }
  async save() { await this.saveButton().click(); }
}
```

### Dialog Object Pattern

```typescript
// e2e/dialogs/cvss-calculator.dialog.ts
export class CvssCalculatorDialog {
  private dialog: Locator;
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly versionToggle = (v: string) => this.dialog.getByTestId(`cvss-version-${v}`);
  readonly metricValue = (metric: string, value: string) =>
    this.dialog.getByTestId(`cvss-metric-value-${metric}-${value}`);
  readonly scoreDisplay = () => this.dialog.getByTestId('cvss-score-display');
  readonly applyButton = () => this.dialog.getByTestId('cvss-apply-button');
  readonly cancelButton = () => this.dialog.getByTestId('cvss-cancel-button');

  async selectVersion(v: '3.1' | '4.0') { await this.versionToggle(v).click(); }
  async setMetric(metric: string, value: string) { await this.metricValue(metric, value).click(); }
  async apply() { await this.applyButton().click(); }
}
```

### Flow Pattern

```typescript
// e2e/flows/threat.flow.ts
export class ThreatFlow {
  constructor(
    private page: Page,
    private tmEditPage: TmEditPage,
    private threatPage: ThreatPage,
    private cvssDialog: CvssCalculatorDialog,
    private cwePickerDialog: CwePickerDialog,
  ) {}

  async createThreatFromTmEdit(name: string, threatType: string) {
    // Opens threat editor dialog, fills fields, saves, waits for navigation
  }

  async openThreat(name: string) {
    // Clicks threat in list, waits for threat page to load
  }

  async scoreThreatWithCvss(version: '3.1' | '4.0', metrics: Record<string, string>) {
    await this.threatPage.openCvssButton().click();
    await this.cvssDialog.selectVersion(version);
    for (const [metric, value] of Object.entries(metrics)) {
      await this.cvssDialog.setMetric(metric, value);
    }
    await this.cvssDialog.apply();
  }

  async addCweReference(searchTerm: string) {
    await this.threatPage.addCweButton().click();
    await this.cwePickerDialog.search(searchTerm);
    await this.cwePickerDialog.selectFirst();
    await this.cwePickerDialog.add();
  }
}
```

### Serial Suite Fixture Strategy

The `core-lifecycle.spec.ts` and `threat-editing.spec.ts` suites are serial — tests share state. Playwright fixtures default to per-test scope, which doesn't work for serial suites that share a browser context.

For serial suites, the test file continues to manage a shared `BrowserContext` and `Page` in `beforeAll`/`afterAll`. Page objects and flows are instantiated manually from the shared page rather than injected via fixtures:

```typescript
test.describe.serial('Core Lifecycle', () => {
  let context: BrowserContext;
  let page: Page;
  let authFlow: AuthFlow;
  let dashboardPage: DashboardPage;
  // ...

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
    dashboardPage = new DashboardPage(page);
    authFlow = new AuthFlow(page);
    // ...
  });

  test.afterAll(async () => { await context.close(); });

  test('login', async () => {
    await authFlow.login();
  });
});
```

Non-serial suites (`navigation-routing.spec.ts`, `error-scenarios.spec.ts`) use the fixture system directly — each test gets its own page and fixture instances.

## Test Suites

### Existing: Core Lifecycle (refactored)

Same 10 tests, same serial structure, same coverage. Refactored to use page objects and flows instead of raw locators. The `helpers/auth.ts` import is replaced by the `AuthFlow` class.

### New: Threat Editing (`threat-editing.spec.ts`)

Serial suite — creates a threat model in `beforeAll`, cleans up in `afterAll`.

| # | Test | Action | Verification |
|---|------|--------|-------------|
| 1 | Create a threat | Open TM, create threat via editor dialog | Threat appears in threats list |
| 2 | Edit threat fields | Open threat page, modify name/description/severity/status, save | Fields persist after page reload |
| 3 | Score with CVSS 3.1 | Open CVSS calculator, set base metrics, apply | Score and vector string visible on threat page |
| 4 | Score with CVSS 4.0 | Open CVSS calculator, switch to 4.0, set metrics, apply | 4.0 score and vector visible |
| 5 | Add CWE reference | Open CWE picker, search "79", select, add | CWE chip appears on threat page |
| 6 | Delete the threat | Delete via menu, confirm | Threat removed from list |

### New: Navigation & Routing (`navigation-routing.spec.ts`)

Independent tests (not serial) — each test uses fixture-provided page isolation.

| # | Test | Action | Verification |
|---|------|--------|-------------|
| 1 | Deep link to threat model | Navigate directly to `/tm/:id` | Page loads, name matches |
| 2 | Deep link to nonexistent resource | Navigate to `/tm/00000000-0000-0000-0000-000000000000` | Error handling (redirect or error display) |
| 3 | Auth guard redirect | Clear session, navigate to `/dashboard` | Redirected to `/login` |
| 4 | Role guard redirect | In a fresh context (no login), navigate to `/triage` | Redirected to `/login` or `/unauthorized` (auth guard fires first if unauthenticated; role guard fires if authenticated but lacking reviewer role). Test verifies the user does not land on `/triage`. |
| 5 | Back/forward navigation | Dashboard -> open TM -> browser back | Returns to dashboard |
| 6 | Navbar navigation | Click dashboard link, then intake link | Routes to correct pages |

Note: Tests 1-2 require a threat model to exist. Test 1 will create one in a setup step and store the ID; test 2 uses a known-nonexistent UUID. Tests 3-6 are self-contained.

### New: Error Scenarios (`error-scenarios.spec.ts`)

Independent tests focused on client-side error handling and validation.

| # | Test | Action | Verification |
|---|------|--------|-------------|
| 1 | Unauthorized page displays correctly | Navigate to `/unauthorized?statusCode=403&reason=no_permission` | Card content correct, OK button navigates home |
| 2 | Wildcard route redirects home | Navigate to `/this-route-does-not-exist` | Redirected to `/` |
| 3 | Delete confirmation validation | Open delete dialog, type wrong text | Button stays disabled; type correct text, button enables |
| 4 | Form validation prevents save | Open create-TM dialog, leave name empty | Submit button disabled; enter name, button enables |

Since we use a live backend with no API mocking, we focus on error scenarios that can be triggered through the UI. Server-side error testing (500s, timeouts) is out of scope.

## data-testid Attributes

### Naming Convention

Pattern: `{component}-{element-type}` — flat, no nesting, grep-friendly.

### New Attributes by Component

#### Threat Page (`threat-page.component.html`)

| Attribute | Element |
|-----------|---------|
| `threat-page-name-input` | Name text input |
| `threat-page-description-input` | Description textarea |
| `threat-page-severity-select` | Severity dropdown |
| `threat-page-score-input` | Score number input |
| `threat-page-priority-select` | Priority dropdown |
| `threat-page-status-select` | Status dropdown |
| `threat-page-save-button` | Save button |
| `threat-page-delete-button` | Delete button (in kebab menu) |
| `threat-page-add-cwe-button` | Add CWE Reference button |
| `threat-page-cwe-chip` | Each CWE chip |
| `threat-page-open-cvss-button` | CVSS calculator launch button/chip |
| `threat-page-cvss-chip` | Each CVSS score chip |
| `threat-page-threat-type-chip` | Each threat type chip |
| `threat-page-add-mapping-button` | Add Mapping button |

#### Threat Editor Dialog (`threat-editor-dialog.component.html`)

| Attribute | Element |
|-----------|---------|
| `threat-editor-name-input` | Name text input |
| `threat-editor-description-input` | Description textarea |
| `threat-editor-type-select` | Threat type multi-select |
| `threat-editor-severity-select` | Severity dropdown |
| `threat-editor-save-button` | Save button |
| `threat-editor-cancel-button` | Cancel button |

#### CVSS Calculator Dialog (`cvss-calculator-dialog.component.html`)

| Attribute | Element |
|-----------|---------|
| `cvss-version-3.1` | Version 3.1 toggle button |
| `cvss-version-4.0` | Version 4.0 toggle button |
| `cvss-metric-{shortName}` | Each metric button toggle group (e.g., `cvss-metric-AV`) |
| `cvss-metric-value-{shortName}-{value}` | Individual metric value button (e.g., `cvss-metric-value-AV-N`) |
| `cvss-score-display` | Computed score display |
| `cvss-vector-display` | Vector string display |
| `cvss-apply-button` | Apply/save button |
| `cvss-cancel-button` | Cancel button |

#### CWE Picker Dialog (`cwe-picker-dialog.component.html`)

| Attribute | Element |
|-----------|---------|
| `cwe-picker-search-input` | Search text input |
| `cwe-picker-item` | Each weakness list item |
| `cwe-picker-add-button` | Add CWE Reference button |
| `cwe-picker-cancel-button` | Cancel button |

#### Triage List (`triage-list.component.html`)

| Attribute | Element |
|-----------|---------|
| `triage-search-input` | Search input |
| `triage-status-filter` | Status multi-select |
| `triage-template-filter` | Template dropdown |
| `triage-clear-filters-button` | Clear Filters button |
| `triage-response-row` | Each response table row |
| `triage-error-retry-button` | Error state retry button |

#### Navbar (`navbar.component.html`)

| Attribute | Element |
|-----------|---------|
| `navbar-home-menu` | Home menu trigger button |
| `navbar-dashboard-link` | Dashboard nav link |
| `navbar-intake-link` | Intake nav link |
| `navbar-triage-link` | Triage nav link |
| `navbar-admin-link` | Admin nav link |
| `navbar-user-menu` | User profile menu trigger |
| `navbar-logout-button` | Logout button |

### Elements NOT Getting Test IDs

- CVSS metric accordion panels (tests interact via metric toggles directly)
- Material paginator controls (use built-in accessibility labels)
- Decorative elements, status icons, layout containers

## Cypress Cleanup

### Delete

| File | Reason |
|------|--------|
| `src/testing/page-objects/page-object.base.ts` | Legacy Cypress page object base class, unused |
| `coverage/tmi-ux/scripts/run-cypress-tests.js.html` | Stale Cypress coverage report |

### Modify

| File | Change |
|------|--------|
| `src/testing/matchers/graph-matchers.ts` | Remove `Cypress` window check, simplify to Vitest/Chai path only |
| `.dockerignore` | Remove `cypress/screenshots/`, `cypress/videos/`, `cypress/downloads/` entries |
| `.github/codeql/codeql-config.yml` | Remove `cypress/**` from ignore paths |

### Leave As-Is

| File | Reason |
|------|--------|
| `.sccignore` | Line count tool config, harmless |

## CI Stub

A manual-trigger-only GitHub Actions workflow at `.github/workflows/e2e-tests.yml`:

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
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - run: npx playwright install --with-deps chromium
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:e2e
        env:
          E2E_APP_URL: ${{ inputs.app_url }}
          E2E_API_URL: ${{ inputs.api_url }}
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

This is intentionally non-functional without a running backend. Full CI integration (backend provisioning, trigger strategy, browser matrix) is tracked as a separate issue.

## Separate GitHub Issue

Create `ops: integrate E2E tests into CI pipeline` to track:

- Backend service provisioning in CI (Docker Compose or GitHub service containers)
- Trigger strategy (on PR, on push to main, on schedule)
- Parallel browser matrix
- Test result reporting (PR comments, status checks)
- Secrets management for OAuth test credentials

## Refactoring Core Lifecycle Test

The existing `core-lifecycle.spec.ts` is refactored to use page objects and flows while preserving its serial structure and test coverage:

- Import `{ test, expect }` from fixtures (though serial suites instantiate manually in `beforeAll`)
- Replace raw `page.getByTestId(...)` calls with page object methods
- Replace inline multi-step sequences with flow method calls
- Delete `e2e/helpers/auth.ts` — its logic moves to `AuthFlow`

No behavioral changes — same tests, same assertions, same serial execution order.

## Out of Scope

- API mocking / fixture data seeding
- Parallel test execution (infrastructure supports it later via fixtures)
- Cross-browser testing (Firefox, WebKit)
- Collaboration / WebSocket testing
- Admin page testing
- Intake survey testing
- Performance / load testing
- Visual regression testing

## Success Criteria

1. `pnpm test:e2e` runs all 4 test suites (26 tests total) against local backend + frontend
2. All tests pass on Chromium
3. Page objects, dialogs, and flows are reusable across suites
4. No Cypress artifacts remain in the codebase (except harmless `.sccignore` entry)
5. CI workflow file exists and is syntactically valid (manual trigger only)
6. Separate CI integration issue is created and linked to project
7. Core lifecycle test behavior is unchanged after refactoring
