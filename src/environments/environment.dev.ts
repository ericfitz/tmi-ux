import { Environment } from './environment.interface';

/**
 * Development environment configuration
 * Used when running the application in development mode
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  debugComponents: ['websocket-api', 'websocket-adapter'], // Enable component-specific debug logging for WebSocket messages
  apiUrl: 'http://localhost:8080',
  authTokenExpiryMinutes: 1440, // 24 hours for easier development
  operatorName: 'TMI Project (Development Demo)',
  operatorContact: 'https://github.com/ericfitz/tmi/discussions',
  operatorJurisdiction: 'Florida, United States of America',
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
  securityConfig: {
    enableHSTS: false, // Disabled in development (no TLS)
    hstsMaxAge: 300, // 5 minutes for testing
    hstsIncludeSubDomains: false,
    hstsPreload: false,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    // explicitly do NOT request sensitive permissions
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
    // CSP violations logged to console in development
  },
};
