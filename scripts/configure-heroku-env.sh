#!/bin/bash

# Script to create environment.heroku.ts for tmi-ux Heroku deployment
# This file is committed to the repository

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="${SCRIPT_DIR}/../src/environments/environment.heroku.ts"

echo "Creating environment.heroku.ts for Heroku deployment..."

cat > "${ENV_FILE}" << 'EOF'
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
  operatorContact: 'github@efitz.net',
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
EOF

echo "✓ Created ${ENV_FILE}"
echo ""
echo "Remember to commit this file:"
echo "  git add src/environments/environment.heroku.ts"
echo "  git commit -m 'Update Heroku environment configuration'"
echo ""
echo "Then deploy to Heroku:"
echo "  git push heroku main"
