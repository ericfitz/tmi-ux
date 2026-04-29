# Playwright Integration Tests Design

## Goal

Build a trustworthy Playwright integration test suite that verifies the core user lifecycle against a live local backend, identifies broken user flows, and serves as a regression safety net after code changes.

## Context

The existing `e2e/` directory contains test infrastructure written ~1000 commits ago. It is untrusted:

- Auth tests are skipped due to a broken OAuth callback assumption
- Feature tests silently pass when no data exists (false confidence)
- Selectors rely on CSS classes that may have drifted
- Auth helpers assume JWT tokens in localStorage; the app now uses httpOnly cookies
- No `data-testid` attributes exist in the codebase

This is a clean rewrite, not a patch.

## Approach

A single serial test suite (`test.describe.serial`) modeling the full threat model lifecycle. Tests run in order, sharing a `BrowserContext` that holds the httpOnly session cookie. Each test depends on the previous one — if auth fails, everything after it fails, which is the correct behavior.

Tests create their own data and clean up by exercising delete flows as real test assertions.

## Test Flow

| Step | Test Name | Action | Verification |
|------|-----------|--------|-------------|
| 1 | `login via OAuth` | Click TMI provider button, wait for callback redirect | Landed on protected page (not `/login`, not `/oauth2/callback`) |
| 2 | `create a threat model` | Click create button, fill form, submit | Card appears in TM list with correct name |
| 3 | `open the threat model` | Click the card | Detail view loads, name matches what was created |
| 4 | `create a diagram` | Click add diagram, fill dialog (type + name), submit | Diagram row appears in diagram table |
| 5 | `open the DFD editor` | Click diagram row | Graph container element is visible |
| 6 | `add nodes to the diagram` | Click actor/process/store toolbar buttons, click canvas | Node count increases after each addition |
| 7 | `close the diagram` | Click close button | Back on TM detail page |
| 8 | `delete the diagram` | Click diagram delete button, confirm dialog | Diagram removed from table |
| 9 | `delete the threat model` | Navigate to TM list, click delete, confirm dialog | Card removed from list |

Step 10 is implicit: auth validity is tested throughout. Any step failing after login indicates either a broken flow or an auth regression.

## Architecture

### Browser & Auth

- **Chromium only** — cross-browser testing is out of scope; we are testing functionality, not rendering
- **Shared `BrowserContext`** created in `beforeAll`, closed in `afterAll` — the httpOnly session cookie persists across all tests without localStorage manipulation
- **Shared `Page`** instance — the serial tests model a single user session
- **Auth verification** — after OAuth login, verify by confirming navigation to a protected route; no attempt to read the httpOnly cookie from JavaScript

### Selectors

All interactive elements targeted by tests use `data-testid` attributes. No CSS class selectors, no fragile DOM structure assumptions.

### Configuration

Environment-variable driven, with sensible defaults for local development:

| Variable | Default | Purpose |
|----------|---------|---------|
| `E2E_APP_URL` | `http://localhost:4200` | Frontend URL |
| `E2E_API_URL` | `http://localhost:8080` | Backend API URL |
| `E2E_OAUTH_PROVIDER` | `tmi` | OAuth provider ID for test login |

## Files

### Deleted (entire existing `e2e/` directory)

Everything in `e2e/` is removed. The existing tests, helpers, config, README, and test plan are all untrusted and replaced.

### Created

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Rewritten. Chromium only, `testDir: './e2e'`, global setup, dev server auto-start, screenshots/video on failure |
| `e2e/config/test.config.ts` | URLs and timeouts from environment variables |
| `e2e/setup/global-setup.ts` | Pre-test check that frontend and backend are reachable |
| `e2e/helpers/auth.ts` | `loginWithTmiProvider(page)` — clicks OAuth button, waits for redirect chain to complete, verifies landing on protected page. No localStorage, no `force: true` |
| `e2e/tests/core-lifecycle.spec.ts` | The 9-step serial lifecycle test |
| `e2e/README.md` | Prerequisites, how to run, troubleshooting |

### Modified (adding `data-testid` attributes)

#### `src/app/pages/dashboard/dashboard.component.html`

| Attribute | Element |
|-----------|---------|
| `data-testid="create-threat-model-button"` | Create TM button |
| `data-testid="threat-model-card"` | Each TM card |
| `data-testid="threat-model-delete-button"` | Each card's delete button |

#### `src/app/pages/tm/tm-edit.component.html`

| Attribute | Element |
|-----------|---------|
| `data-testid="threat-model-name"` | TM name field |
| `data-testid="add-diagram-button"` | Add diagram button |
| `data-testid="diagram-row"` | Each diagram table row |
| `data-testid="diagram-delete-button"` | Each diagram's delete button |

#### `src/app/pages/dashboard/create-threat-model-dialog/create-threat-model-dialog.component.ts` (inline template)

| Attribute | Element |
|-----------|---------|
| `data-testid="create-tm-name-input"` | Name input (required) |
| `data-testid="create-tm-submit"` | Create button |

#### `src/app/pages/tm/components/create-diagram-dialog/create-diagram-dialog.component.html`

| Attribute | Element |
|-----------|---------|
| `data-testid="diagram-type-select"` | Diagram type dropdown |
| `data-testid="diagram-name-input"` | Diagram name input |
| `data-testid="create-diagram-submit"` | Create/OK button |

#### `src/app/pages/dfd/presentation/components/dfd.component.html`

| Attribute | Element |
|-----------|---------|
| `data-testid="graph-container"` | The X6 graph canvas |
| `data-testid="add-actor-button"` | Actor toolbar button |
| `data-testid="add-process-button"` | Process toolbar button |
| `data-testid="add-store-button"` | Store toolbar button |
| `data-testid="close-diagram-button"` | Close/back button |

#### `src/app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component.html`

| Attribute | Element |
|-----------|---------|
| `data-testid="delete-confirm-input"` | Typed confirmation input ("gone forever") |
| `data-testid="delete-confirm-button"` | Delete button |

## Implementation Notes

### Serial Test Pattern

```typescript
test.describe.serial('Core Lifecycle', () => {
  let context: BrowserContext;
  let page: Page;
  let threatModelId: string;
  let diagramId: string;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('login via OAuth', async () => { /* ... */ });
  test('create a threat model', async () => { /* ... */ });
  // ... remaining steps
});
```

### Auth Helper

```typescript
export async function loginWithTmiProvider(page: Page): Promise<void> {
  await page.goto('/login');
  const providerButton = page.locator(
    `button[data-provider="${testConfig.testOAuthProvider}"]`
  );
  await providerButton.waitFor({ state: 'visible' });
  await Promise.all([
    page.waitForURL(url =>
      !url.pathname.includes('/login') && !url.pathname.includes('/oauth2/callback')
    ),
    providerButton.click(),
  ]);
  // httpOnly cookie is now set in the BrowserContext — no localStorage check needed
}
```

### Node Verification in DFD

Nodes are rendered by the X6 graph library as elements with class `.x6-node`. After clicking a toolbar button and then clicking the canvas, verify the node count increased. This is the only place we use a CSS class selector — it belongs to the graph library, not our code, so it is stable.

### Delete Confirmation Dialog

Delete operations for threat models and diagrams use a shared `DeleteConfirmationDialogComponent` (`src/app/shared/components/delete-confirmation-dialog/`). Both types require **typed confirmation** — the user must type "gone forever" in an input field before the delete button is enabled.

The test must:
1. Click the delete button on the entity
2. Wait for the confirmation dialog to appear
3. Type "gone forever" in the confirmation input
4. Click the delete button (which is now enabled)
5. Wait for the dialog to close and the entity to disappear

`data-testid` attributes needed on the delete confirmation dialog:
- `data-testid="delete-confirm-input"` — the typed confirmation input
- `data-testid="delete-confirm-button"` — the delete button

## Out of Scope

- Cross-browser testing (Firefox, WebKit)
- Admin, intake, triage flows
- Collaboration / WebSocket testing
- Export functionality
- API-based data setup helpers
- CI/CD pipeline integration
- Edge cases (error states, permission denied, concurrent editing)

These can be added as separate test files later, evolving toward a hybrid approach if needed.

## Success Criteria

1. Run `pnpm test:e2e` with local backend + frontend running
2. All 9 steps pass on Chromium
3. If any user flow is currently broken, the specific step fails with a clear error
4. Tests complete in under 60 seconds
5. No silent skips, no false passes
