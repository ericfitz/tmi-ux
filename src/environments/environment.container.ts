/**
 * Container Environment Configuration
 *
 * This file contains generic production defaults for container deployments.
 * Values here serve as fallbacks — they are intended to be overridden at
 * runtime via TMI_* environment variables passed to the container.
 *
 * The runtime override mechanism works as follows:
 * 1. server.js serves GET /config.json, mapping TMI_* env vars to Environment properties
 * 2. main.ts fetches /config.json before Angular bootstraps and patches the environment object
 * 3. Only properties with corresponding TMI_* env vars set are overridden
 *
 * See the env var mapping in server.js for the full list of supported variables.
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://api.tmi.dev',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Operator',
  operatorContact: 'contact@example.com',
  operatorJurisdiction: '',
  securityConfig: {
    enableHSTS: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: false,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  },
};
