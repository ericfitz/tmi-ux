import { describe, expect, it } from 'vitest';

import { environment } from './environment.aws';

describe('AWS deployment environment', () => {
  it('is a production build so runtime config and CSP injection are active', () => {
    expect(environment.production).toBe(true);
  });

  it('points at the deployed TMI server', () => {
    expect(environment.apiUrl).toBe('https://server.aws.tmi.dev');
  });

  it('has no trailing slash on apiUrl', () => {
    // SecurityConfigService derives the CSP connect-src origin from this value
    // via `new URL(environment.apiUrl).origin`; a trailing slash is silently
    // tolerated there but breaks naive string concatenation elsewhere.
    expect(environment.apiUrl.endsWith('/')).toBe(false);
  });

  it('declares exactly the security headers CloudFront is configured to send', () => {
    // Mirrors terraform/aws/cloudfront.tf. If you change one, change both:
    // this object is what the app reports about itself, not what is enforced.
    expect(environment.securityConfig).toEqual({
      enableHSTS: true,
      hstsMaxAge: 31536000,
      hstsIncludeSubDomains: true,
      hstsPreload: false,
      frameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
    });
  });
});
