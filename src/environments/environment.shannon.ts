import { Environment } from './environment.interface';

/**
 * Shannon penetration testing environment configuration
 * Used when running the app for Shannon security testing from Docker
 * API URL uses host.docker.internal so Playwright inside Docker can reach the host backend
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG',
  apiUrl: 'http://host.docker.internal:8080',
  authTokenExpiryMinutes: 1440,
  operatorName: 'TMI Operator (Shannon Testing)',
  operatorContact: 'https://github.com/ericfitz/tmi/discussions',
  operatorJurisdiction: '',
  serverPort: 4200,
  serverInterface: '0.0.0.0',
  enableTLS: false,
  defaultAuthProvider: 'local',
};
