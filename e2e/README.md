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
