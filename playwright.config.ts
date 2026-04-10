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

  /* Web server is managed externally — start both frontend and backend before running tests */
});
