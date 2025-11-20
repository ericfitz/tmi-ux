import { defineConfig, devices } from '@playwright/test';

// Import test configuration
// Use dynamic import to avoid TypeScript compilation issues
const testConfig = {
  appUrl: process.env.E2E_APP_URL || 'http://localhost:4200',
  appPort: parseInt(process.env.E2E_APP_PORT || '4200', 10),
  apiUrl: process.env.E2E_API_URL || 'http://localhost:8080',
  apiPort: parseInt(process.env.E2E_API_PORT || '8080', 10),
};

/**
 * Playwright configuration for TMI-UX e2e tests
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* Global setup to verify services are available */
  globalSetup: './e2e/setup/global-setup.ts',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: testConfig.appUrl,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm run dev:local',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
