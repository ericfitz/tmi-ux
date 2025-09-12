import { Environment } from './environment.interface';

/**
 * Staging environment configuration
 * Used for testing in a production-like environment
 */
export const environment: Environment = {
  production: false, // Not true production but mimics it
  logLevel: 'WARN', // Only show warnings and errors in staging
  debugComponents: ['websocket-api', 'websocket-adapter'], // Enable WebSocket debug logging even in staging
  apiUrl: 'https://api.staging.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Staging)',
  operatorContact: 'contact@example.com',
  oauth: {
    local: {
      enabled: false, // Disable local provider in staging
    },
  },
  securityConfig: {
    enableHSTS: true,
    hstsMaxAge: 86400, // 1 day for staging
    hstsIncludeSubDomains: true,
    hstsPreload: false,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  },
};
