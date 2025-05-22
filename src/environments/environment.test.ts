import { Environment } from './environment.interface';

/**
 * Test environment configuration
 * Used for running automated tests
 */
export const environment: Environment = {
  production: false,
  logLevel: 'WARNING', // Only show warnings and errors in test environment
  apiUrl: 'https://api.test.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Test)',
  operatorContact: 'contact@example.com',
  oauth: {
    google: {
      clientId: 'TEST_GOOGLE_CLIENT_ID', // Mock client ID for testing
      redirectUri: 'http://localhost:4200/auth/callback',
    },
  },
};
