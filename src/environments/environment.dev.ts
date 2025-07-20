import { Environment } from './environment.interface';

/**
 * Development environment configuration
 * Used when running the application in development mode
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  apiUrl: 'http://localhost:8080/api',
  authTokenExpiryMinutes: 1440, // 24 hours for easier development
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'dev@tmi.com',
  serverPort: 4200,
  serverInterface: '0.0.0.0',
  enableTLS: false,
  oauth: {
    google: {
      clientId: 'YOUR_GOOGLE_CLIENT_ID', // Replace with actual Google OAuth client ID
      redirectUri: 'http://localhost:4200/auth/callback',
    },
  },
};
