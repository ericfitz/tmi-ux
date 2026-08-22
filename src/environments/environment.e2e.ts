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
  // 30080 is the tmi-server NodePort. A `kubectl port-forward` to :8080 drops
  // every ~30-40s under E2E load, which surfaces as `status: 0` responses and
  // spurious failures (afterAll timeouts, "element not found") that look like
  // product bugs. The NodePort has no forwarding layer to drop.
  apiUrl: 'http://localhost:30080',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (E2E Testing)',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
  enableE2eTools: true,
  enableConfidentialThreatModels: true,
};
