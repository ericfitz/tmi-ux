import { Environment } from './environment.interface';

/**
 * E2E Testing Environment Configuration
 *
 * Extends the development configuration with E2E testing tools enabled.
 * Used when running the application for Playwright E2E tests.
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG',
  debugComponents: ['DFD', 'websocket-api', 'websocket-adapter'],
  apiUrl: 'http://localhost:8080',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (E2E Testing)',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
  enableE2eTools: true,
  enableConfidentialThreatModels: true,
  enabledContentProviders: ['google_workspace', 'microsoft'],
};
