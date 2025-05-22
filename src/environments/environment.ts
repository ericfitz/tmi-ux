import { Environment } from './environment.interface';

/**
 * Default environment configuration (development)
 * This is the default environment used during local development
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  apiUrl: 'http://localhost:8080', // TMI server running locally
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'contact@example.com',
  oauth: {
    google: {
      clientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with actual Google OAuth client ID
      redirectUri: 'http://localhost:4200/auth/callback',
    },
  },
};
