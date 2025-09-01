import { Environment } from './environment.interface';

/**
 * Development environment configuration
 * Used when running the application in development mode
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  debugComponents: [], // Enable component-specific debug logging for API calls
  apiUrl: 'http://localhost:8080',
  authTokenExpiryMinutes: 1440, // 24 hours for easier development
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'dev@tmi.com',
  serverPort: 4200,
  serverInterface: 'localhost',
  enableTLS: false,
  defaultAuthProvider: 'local',
  oauth: {
    local: {
      enabled: true,
      icon: 'fa-solid fa-laptop-code',
    },
  },
};
