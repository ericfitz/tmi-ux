import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { environment } from './environment.aws';

/**
 * The string scripts/deploy-aws.sh greps for in the built bundles to prove
 * dist/ was compiled with configuration=aws. Kept in sync with
 * AWS_BUILD_FINGERPRINT in that script.
 */
const AWS_BUILD_FINGERPRINT = 'TMI Project (AWS Demo)';

describe('AWS deployment environment', () => {
  it('is a production build so runtime config and CSP injection are active', () => {
    expect(environment.production).toBe(true);
  });

  it('points at the deployed TMI server', () => {
    expect(environment.apiUrl).toBe('https://api.tmi.dev');
  });

  it('pins operatorName, which scripts/deploy-aws.sh uses as the build fingerprint', () => {
    // deploy-aws.sh greps the built bundles for this exact string to prove
    // dist/ was compiled with configuration=aws before publishing to
    // www.tmi.dev. apiUrl cannot serve that purpose any more: since the server
    // moved to api.tmi.dev, environment.{container,hosted-container,oci}.ts
    // share that host, so a bundle built from any of them would pass a
    // host-based check. This value must stay UNIQUE across src/environments/*.ts
    // — if you rename it, update AWS_BUILD_FINGERPRINT in deploy-aws.sh too.
    expect(environment.operatorName).toBe(AWS_BUILD_FINGERPRINT);
  });

  it('is the ONLY environment file containing the fingerprint', () => {
    // The test above pins the aws value, but on its own it only guards one
    // direction. The dangerous direction is another environment file *adopting*
    // the string — e.g. a future environment.gcp.ts created by copying
    // environment.aws.ts — because then a `--configuration=gcp` bundle would
    // pass deploy-aws.sh's gate and be published to www.tmi.dev. A gate that
    // wrongly blocks is merely annoying; one that wrongly passes ships the
    // wrong apiUrl. This scans the directory on disk (rather than importing)
    // so it also covers gitignored/untracked environment files present on a
    // developer's machine, which a bundle-content gate is otherwise blind to.
    const dir = dirname(fileURLToPath(import.meta.url));
    const otherEnvFiles = readdirSync(dir).filter(
      file =>
        file.endsWith('.ts') &&
        !file.endsWith('.spec.ts') &&
        file !== 'environment.aws.ts' &&
        file !== 'environment.interface.ts',
    );

    // Guard: if the scan ever matches nothing, this test would pass vacuously.
    expect(otherEnvFiles.length).toBeGreaterThan(0);

    const offenders = otherEnvFiles.filter(file =>
      readFileSync(join(dir, file), 'utf8').includes(AWS_BUILD_FINGERPRINT),
    );
    expect(offenders).toEqual([]);
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
