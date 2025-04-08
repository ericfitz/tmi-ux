import { Environment } from './environment.interface';

/**
 * Default environment configuration (development)
 * This is the default environment used during local development
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  apiUrl: 'https://api.dev.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'contact@example.com',
};
