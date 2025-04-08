import { Environment } from './environment.interface';

/**
 * Production environment configuration
 * Used when building for production
 */
export const environment: Environment = {
  production: true,
  logLevel: 'ERROR', // Only show errors in production
  apiUrl: 'https://api.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator',
  operatorContact: 'contact@example.com',
};
