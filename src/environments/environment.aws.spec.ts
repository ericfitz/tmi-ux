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

  it('pins the advisory securityConfig copy so edits are deliberate', () => {
    // This compares environment.aws.ts against a literal in this same repo, so
    // it only detects edits to environment.aws.ts — it cannot see edits to
    // terraform/aws/cloudfront.tf, which is what actually decides the headers
    // browsers receive. It is a change-detector on the copy, not verification
    // of the edge. The copy feeds only generateRecommendedHeaders(), an
    // advisory report; drift here is a reporting inaccuracy, not a
    // vulnerability. If you change either file, change both by hand.
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
