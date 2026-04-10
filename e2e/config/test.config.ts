export interface E2ETestConfig {
  /** Frontend application base URL */
  appUrl: string;
  /** Backend API base URL */
  apiUrl: string;
  /** OAuth provider ID for test login */
  testOAuthProvider: string;
  /** Timeout for waiting for services to be available (ms) */
  serviceAvailabilityTimeout: number;
}

export const testConfig: E2ETestConfig = {
  appUrl: process.env.E2E_APP_URL || 'http://localhost:4200',
  apiUrl: process.env.E2E_API_URL || 'http://localhost:8080',
  testOAuthProvider: process.env.E2E_OAUTH_PROVIDER || 'tmi',
  serviceAvailabilityTimeout: 30000,
};
