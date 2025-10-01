/**
 * Production Environment Configuration
 *
 * This file contains the production environment configuration with optimized settings for deployment.
 * It provides secure, performance-oriented settings suitable for production environments.
 *
 * Key functionality:
 * - Enables production mode with optimizations
 * - Sets minimal logging levels for performance
 * - Configures production API endpoints
 * - Uses secure OAuth configuration for production
 * - Optimizes token expiry for security vs usability
 * - Provides production operator contact information
 * - Excludes local development provider for security
 */

import { Environment } from './environment.interface';

/**
 * Production environment configuration
 * Used when building for production
 */
export const environment: Environment = {
  production: true,
  logLevel: 'ERROR', // Only show errors in production
  apiUrl: 'https://api.example.com/v1',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
  oauth: {},
  securityConfig: {
    enableHSTS: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: false, // Enable only after careful consideration
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
    // Uncomment and set this to enable CSP violation reporting
    // cspReportUri: 'https://api.example.com/csp-report',
  },
};
