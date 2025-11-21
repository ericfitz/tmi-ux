import { Environment } from './environment.interface';

/**
 * Test environment configuration
 * Used for running automated tests
 */
export const environment: Environment = {
  production: false,
  logLevel: 'WARN', // Only show warnings and errors in test environment
  apiUrl: 'https://api.test.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Test)',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
};
