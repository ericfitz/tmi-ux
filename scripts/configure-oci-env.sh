#!/bin/bash

# Script to create environment.oci.ts for TMI-UX OCI Container Instance deployment
# This file is committed to the repository

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ENV_FILE="${SCRIPT_DIR}/../src/environments/environment.oci.ts"

echo "Creating environment.oci.ts for OCI Container Instance deployment..."

cat > "${ENV_FILE}" << 'EOF'
/**
 * OCI Container Instance Environment Configuration
 *
 * This file contains the environment configuration for Oracle Cloud Infrastructure (OCI)
 * Container Instance deployment. Values are configured for the production TMI API.
 *
 * To regenerate this file, run: scripts/configure-oci-env.sh
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://api.tmi.dev',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Project (OCI)',
  operatorContact: 'https://github.com/ericfitz/tmi/discussions',
  operatorJurisdiction: 'Florida, United States of America',
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

echo "Created ${ENV_FILE}"
echo ""
echo "Remember to commit this file:"
echo "  git add src/environments/environment.oci.ts"
echo "  git commit -m 'Update OCI environment configuration'"
echo ""
echo "Then deploy to OCI:"
echo "  ./scripts/push-oci.sh"
