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
