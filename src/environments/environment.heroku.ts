/**
 * Heroku Environment Configuration
 *
 * This file contains the environment configuration for Heroku deployment.
 * Values are configured for the production TMI API at https://api.tmi.dev
 *
 * To regenerate this file, run: scripts/configure-heroku-env.sh
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://api.tmi.dev',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Project (Development Demo)',
  operatorContact: 'https://github.com/ericfitz/tmi/discussions',
  operatorJurisdiction: 'Florida, United States of America',
  oauth: {},
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
