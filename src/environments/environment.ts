/**
 * Default Development Environment Configuration
 *
 * This file contains the default environment configuration used during local development.
 * It provides development-friendly settings with verbose logging and local OAuth configuration.
 *
 * Key functionality:
 * - Enables debug logging for development and testing
 * - Configures local API server endpoint (localhost:8080)
 * - Sets up OAuth providers for local development testing
 * - Uses development-friendly settings for token expiry
 * - Provides default operator information for development
 * - Disables production optimizations for better debugging
 */

import { Environment } from './environment.interface';

/**
 * Default environment configuration (development)
 * This is the default environment used during local development
 */
export const environment: Environment = {
  production: false,
  logLevel: 'DEBUG', // Most verbose logging in development
  debugComponents: ['DFD', 'websocket-api', 'websocket-adapter'], // Enable debug logging for DFD component and WebSocket API
  apiUrl: 'http://localhost:8080', // TMI server running locally
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator (Development)',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
  oauth: {
    local: {
      enabled: true,
      icon: 'fa-solid fa-laptop-code',
    },
  },
};
