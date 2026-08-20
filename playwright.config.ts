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
  reporter: process.env.CI
    ? 'json'
    : [['json', { outputFile: 'test-results/e2e-results.json' }], ['html']],

  use: {
    baseURL: testConfig.appUrl,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Playwright owns the frontend dev-server lifecycle so tests can never run
  // against a stale, pre-existing `ng serve` process (see #827). With
  // reuseExistingServer: false, Playwright refuses to start if something is
  // already listening on the port. Setting E2E_APP_URL skips this block to
  // target an externally managed deployment. The backend (E2E_API_URL) is
  // always external; global-setup health-checks it.
  webServer: process.env.E2E_APP_URL
    ? undefined
    : {
        command: 'pnpm run dev:e2e:server',
        url: testConfig.appUrl,
        reuseExistingServer: false,
        timeout: 180_000,
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
    // Live Google Drive integration tests. Excluded from default `playwright test`
    // execution; invoke explicitly via `pnpm test:e2e:google-drive`. Requires
    // gitignored `e2e/config/google-drive.local.json`; tests skip when absent.
    {
      name: 'google-drive-live',
      testDir: './e2e/tests/google-drive-live',
      timeout: 5 * 60 * 1000,
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
      },
    },
  ],
});
