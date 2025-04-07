import { Environment } from './environment.interface';

/**
 * Test environment configuration
 * Used for running automated tests
 */
export const environment: Environment = {
  production: false,
  logLevel: 'WARNING', // Only show warnings and errors in test environment
  apiUrl: 'https://api.test.example.com/v1',
  authTokenExpiryMinutes: 60
};