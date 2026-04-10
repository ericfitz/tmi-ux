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
