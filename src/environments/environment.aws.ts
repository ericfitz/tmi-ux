/**
 * AWS Environment Configuration
 *
 * Used by the S3 + CloudFront deployment at https://app.aws.tmi.dev.
 * See docs/reference/aws-deployment.md and terraform/aws/.
 *
 * The securityConfig block below is what the application reports about its own
 * posture; the headers are actually emitted by the CloudFront response-headers
 * policy in terraform/aws/cloudfront.tf. Keep the two in sync.
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://server.aws.tmi.dev',
  authTokenExpiryMinutes: 60,
  operatorName: 'TMI Project (AWS Demo)',
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
