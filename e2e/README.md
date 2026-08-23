# E2E Integration Tests

Playwright-based integration tests for TMI-UX, running against a live local backend.

## Prerequisites

Only the backend must be running:

1. **TMI backend** on `http://localhost:30080` (tmi-server NodePort; or set `E2E_API_URL`)

The backend must have the `tmi` OAuth provider configured (auto-grants tokens without IdP interaction).

The frontend is started automatically: the `webServer` block in `playwright.config.ts` boots a fresh
`ng serve --configuration=e2e` on `http://localhost:4200` for every run (`reuseExistingServer: false`),
so tests can never silently target a stale, pre-existing dev server. Do **not** start `ng serve`
manually — Playwright refuses to run if port 4200 is already in use. To test against an externally
managed frontend instead, set `E2E_APP_URL`; that skips the managed server and health-checks the URL
in global setup.

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

## Cleaning Up Leaked Test Data

Every spec's cleanup is a best-effort `try`/`catch`, so any test that fails before its
cleanup block leaves its `E2E `-prefixed entities behind — and deliberate negative-control
runs (asserting that a test fails without its fix) leak by design.

This matters more than it sounds. The dashboard paginates: once enough leaked threat
models pile up, the seeded `Seed TM - Full Fields` slides off page one and unrelated specs
start failing with a signature that points nowhere near the cause. A local database once
reached 78 leaked threat models against 3 real ones, and diagnosing it cost hours.

```bash
# Report what would be removed, without removing it
pnpm run e2e:clean -- --dry-run

# Remove it
pnpm run e2e:clean

# Options
pnpm run e2e:clean -- --help
```

The tool deletes through the API (never SQL — sixteen tables have a `NO ACTION` foreign
key to `threat_models`, so a direct `DELETE` rolls back on the `assets` FK), authenticates
each test user through the OAuth stub, and keys strictly off the `E2E ` name prefix, so
seeded `Seed …` fixtures are never touched. It covers threat models, projects, teams,
surveys and the survey responses that would otherwise block a survey's deletion. It exits
non-zero if any deletion fails rather than swallowing the error.

It needs the API and the OAuth stub, but **not** a browser or the app dev server — so it
still works after a run has died hard, or while Playwright is holding port 4200.

Run `--dry-run` first if the database matters to you.

## Environment Variables

| Variable             | Default                  | Description                                                                                 |
| -------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `E2E_APP_URL`        | `http://localhost:4200`  | Frontend URL; when set, disables the managed `webServer` and targets an external deployment |
| `E2E_API_URL`        | `http://localhost:30080` | Backend API URL                                                                             |
| `E2E_OAUTH_PROVIDER` | `tmi`                    | OAuth provider for test login                                                               |
| `E2E_OAUTH_STUB_URL` | `http://localhost:8079`  | OAuth stub, used by `e2e:clean` to authenticate without a browser                           |

## Test Users

| User ID         | Role              | Description                    |
| --------------- | ----------------- | ------------------------------ |
| `test-user`     | Normal user       | Dashboard, intake, TM creation |
| `test-reviewer` | Security reviewer | + triage access                |
| `test-admin`    | Admin             | + admin panel access           |

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
