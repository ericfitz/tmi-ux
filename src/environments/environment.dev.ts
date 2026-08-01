import { Environment } from './environment.interface';

/**
 * Development environment configuration
 * Used when running the application in development mode
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  debugComponents: ['websocket-api', 'websocket-adapter'], // Enable component-specific debug logging for WebSocket messages
  // rp2 on the k3s-rp cluster. 30080 is the tmi-server NodePort; 8080 is only
  // the in-cluster Service port and is not reachable from outside the cluster.
  apiUrl: 'http://192.168.1.2:30080',
  authTokenExpiryMinutes: 1440, // 24 hours for easier development
  operatorName: 'Local development',
  operatorContact: '',
  operatorJurisdiction: '',
  serverPort: 4200,
  serverInterface: 'localhost',
  enableTLS: false,
  defaultAuthProvider: 'local',
  enableConfidentialThreatModels: true,
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
