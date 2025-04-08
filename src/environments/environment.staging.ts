import { Environment } from './environment.interface';

/**
 * Staging environment configuration
 * Used for testing in a production-like environment
 */
export const environment: Environment = {
  production: false, // Not true production but mimics it
  logLevel: 'WARNING', // Only show warnings and errors in staging
  apiUrl: 'https://api.staging.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Staging)',
  operatorContact: 'contact@example.com',
};
