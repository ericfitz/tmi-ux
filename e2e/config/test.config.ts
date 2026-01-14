/**
 * E2E Test Configuration
 *
 * This configuration is used by Playwright e2e tests to:
 * - Know where the application is running (frontend)
 * - Know where the backend API is running
 * - Configure test-specific settings like timeouts
 *
 * Based on src/environments/environment.local.ts but specific to e2e testing
 */

export interface E2ETestConfig {
  /** Frontend application base URL */
  appUrl: string;
  /** Frontend application port */
  appPort: number;
  /** Backend API base URL */
  apiUrl: string;
  /** Backend API port */
  apiPort: number;
  /** Default timeout for waiting for services to be available (ms) */
  serviceAvailabilityTimeout: number;
  /** Default timeout for authentication operations (ms) */
  authTimeout: number;
  /** OAuth provider to use for tests */
  testOAuthProvider: string;
}

/**
 * Default e2e test configuration
 * Assumes local development setup with frontend on :4200 and backend on :8080
 */
export const testConfig: E2ETestConfig = {
  appUrl: process.env.E2E_APP_URL || 'http://localhost:4200',
  appPort: parseInt(process.env.E2E_APP_PORT || '4200', 10),
  apiUrl: process.env.E2E_API_URL || 'http://localhost:8080',
  apiPort: parseInt(process.env.E2E_API_PORT || '8080', 10),
  serviceAvailabilityTimeout: 30000, // 30 seconds
  authTimeout: 15000, // 15 seconds
  testOAuthProvider: process.env.E2E_OAUTH_PROVIDER || 'tmi',
};
