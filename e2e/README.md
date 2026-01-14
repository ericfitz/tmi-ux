# E2E Tests

This directory contains end-to-end tests for TMI-UX using Playwright.

## Structure

```
e2e/
├── helpers/          # Shared helper functions
│   ├── auth.ts       # Authentication helpers
│   ├── navigation.ts # Navigation helpers
│   └── dfd.ts        # DFD-specific helpers
├── tests/            # Test specifications
│   ├── smoke.spec.ts            # Smoke tests
│   ├── auth.spec.ts             # Authentication tests
│   ├── threat-models.spec.ts    # Threat model management tests
│   ├── dfd-basic.spec.ts        # DFD basic functionality tests
│   └── navigation.spec.ts       # Navigation tests
├── TEST_PLAN.md      # Comprehensive test plan
└── README.md         # This file
```

## Running Tests

### Run all tests
```bash
pnpm test:e2e
```

### Run tests in UI mode (interactive)
```bash
pnpm test:e2e:ui
```

### Run tests in debug mode
```bash
pnpm test:e2e:debug
```

### Run tests with headed browser
```bash
pnpm test:e2e:headed
```

### Run tests on specific browser
```bash
pnpm test:e2e:chromium
pnpm test:e2e:firefox
pnpm test:e2e:webkit
```

### Run specific test file
```bash
pnpm test:e2e tests/smoke.spec.ts
```

### Run tests matching a pattern
```bash
pnpm test:e2e --grep="authentication"
```

## Test Development

### Writing New Tests

1. Create a new test file in `e2e/tests/` with the `.spec.ts` extension
2. Import necessary helpers from `e2e/helpers/`
3. Use Playwright's `test` and `expect` APIs
4. Follow existing patterns for consistency

Example:
```typescript
import { test, expect } from '@playwright/test';
import { setupMockAuth } from '../helpers/auth';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockAuth(page);
  });

  test('should do something', async ({ page }) => {
    await page.goto('/some-route');
    await expect(page.locator('.some-element')).toBeVisible();
  });
});
```

### Helper Functions

Helper functions are organized by feature area:

- **auth.ts**: Authentication setup, login, logout
- **navigation.ts**: Page navigation helpers
- **dfd.ts**: DFD diagram interaction helpers

Add new helpers to existing files or create new helper files for new feature areas.

## Configuration

### Environment Variables

The e2e tests can be configured using environment variables:

- `E2E_APP_URL` - Frontend application URL (default: `http://localhost:4200`)
- `E2E_APP_PORT` - Frontend application port (default: `4200`)
- `E2E_API_URL` - Backend API URL (default: `http://localhost:8080`)
- `E2E_API_PORT` - Backend API port (default: `8080`)
- `E2E_OAUTH_PROVIDER` - OAuth provider to use for tests (default: `tmi`)

### Configuration Files

- **Main Config**: `playwright.config.ts` at the project root
- **Test Config**: `e2e/config/test.config.ts` - centralized test configuration
- **Global Setup**: `e2e/setup/global-setup.ts` - runs before tests to verify services are available

Key settings:
- Base URL: Configurable via `E2E_APP_URL` (default: `http://localhost:4200`)
- Browsers: Chromium, Firefox, WebKit
- Auto-start dev server before tests
- Screenshot on failure
- Video on failure
- Trace on first retry
- Service availability check before running tests

### Prerequisites

Before running e2e tests, ensure both services are running:

1. **Frontend Application**: Running on the configured `E2E_APP_URL`
2. **Backend API**: Running on the configured `E2E_API_URL`

The test suite includes a **global setup** that verifies both services are available before running any tests. If either service is unavailable, the tests will fail fast with a clear error message.

## Authentication in Tests

All tests use fresh OAuth credentials obtained through the configured test provider:

1. Before each test, `clearAuth()` clears all authentication state
2. Tests that require authentication call `loginWithTmiProvider()` which:
   - Navigates to the login page
   - Clicks the configured OAuth provider button
   - Waits for the OAuth flow to complete
   - Verifies the auth token is stored

This ensures each test starts with a clean state and fresh credentials from the backend.

## Best Practices

1. **Fresh Credentials**: Tests obtain fresh OAuth credentials for each run
2. **Page Objects**: Use helper functions instead of repeating selectors
3. **Explicit Waits**: Use `waitForLoadState` and `expect().toBeVisible()` instead of arbitrary timeouts
4. **Isolation**: Each test should be independent and not rely on other tests
5. **Cleanup**: Tests clean up after themselves (though Playwright resets context between tests)
6. **Descriptive Names**: Test names should clearly describe what is being tested
7. **Cross-Browser**: Tests should work on all three browsers (Chromium, Firefox, WebKit)

## Troubleshooting

### Tests failing locally

1. Make sure dev server is not already running on port 4200
2. Check that all dependencies are installed: `pnpm install`
3. Try running with `--headed` flag to see what's happening
4. Check screenshot and video artifacts in `test-results/`

### Tests passing locally but failing in CI

1. Check for timing issues - add appropriate waits
2. Verify mock data setup is consistent
3. Check for environment-specific issues

### Debug mode not working

Make sure you have the Playwright browsers installed:
```bash
pnpm playwright install
```

## Reports

After running tests, an HTML report is generated. To view it:
```bash
pnpm playwright show-report
```

The report includes:
- Test results with pass/fail status
- Screenshots and videos for failed tests
- Traces for debugging (on retry)
- Test duration and performance metrics
