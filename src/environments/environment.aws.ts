/**
 * AWS Environment Configuration
 *
 * Used by the S3 + CloudFront deployment at https://www.tmi.dev.
 * See docs/reference/aws-deployment.md and terraform/aws/.
 *
 * The securityConfig block below is a hand-maintained copy of the headers the
 * CloudFront response-headers policy in terraform/aws/cloudfront.tf actually
 * emits. Nothing here is enforced: it feeds only generateRecommendedHeaders()
 * in core/services/security-config.service.ts, which publishes an advisory
 * observable. Drift makes that report wrong, nothing more.
 *
 * environment.aws.spec.ts pins this block against a literal in the same repo,
 * so it catches edits here but cannot see edits to cloudfront.tf. Keeping the
 * two in sync is a manual discipline, not something the test verifies.
 */

import { Environment } from './environment.interface';

export const environment: Environment = {
  production: true,
  logLevel: 'INFO',
  apiUrl: 'https://api.tmi.dev',
  authTokenExpiryMinutes: 60,
  // NOTE: scripts/deploy-aws.sh greps the built bundles for this exact string
  // to prove dist/ was compiled with configuration=aws. apiUrl can no longer
  // serve as that fingerprint — environment.{container,hosted-container,oci}.ts
  // all use https://api.tmi.dev too. Keep this value UNIQUE across
  // src/environments/*.ts, or update the check in deploy-aws.sh with it.
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
