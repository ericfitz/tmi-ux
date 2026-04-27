import '@angular/compiler';

import { describe, it, expect } from 'vitest';
import type { components } from '@app/generated/api-types';

type ReasonCode = NonNullable<components['schemas']['DocumentAccessDiagnostics']>['reason_code'];
type RemediationAction = NonNullable<components['schemas']['AccessRemediation']>['action'];

/**
 * Build-time contract: every reason_code enum value must map to a translation
 * key. TypeScript fails compilation if a server enum value is missing here.
 */
const REASON_CODE_KEYS: Record<ReasonCode, string> = {
  token_not_linked: 'documentAccess.reason.tokenNotLinked',
  token_refresh_failed: 'documentAccess.reason.tokenRefreshFailed',
  token_transient_failure: 'documentAccess.reason.tokenTransientFailure',
  picker_registration_invalid: 'documentAccess.reason.pickerRegistrationInvalid',
  no_accessible_source: 'documentAccess.reason.noAccessibleSource',
  source_not_found: 'documentAccess.reason.sourceNotFound',
  fetch_error: 'documentAccess.reason.fetchError',
  other: 'documentAccess.reason.other',
};

const REMEDIATION_ACTION_KEYS: Record<RemediationAction, string> = {
  link_account: 'documentAccess.remediation.linkAccount',
  relink_account: 'documentAccess.remediation.relinkAccount',
  repick_file: 'documentAccess.remediation.repickFile',
  share_with_service_account: 'documentAccess.remediation.shareWithServiceAccount',
  repick_after_share: 'documentAccess.remediation.repickAfterShare',
  retry: 'documentAccess.remediation.retry',
  contact_owner: 'documentAccess.remediation.contactOwner',
};

function lookup(en: unknown, dottedKey: string): unknown {
  let cursor: unknown = en;
  for (const segment of dottedKey.split('.')) {
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

describe('access diagnostics enum coverage', () => {
  it('every reason_code has a translation key', async () => {
    const en = (await import('../../../assets/i18n/en-US.json')).default;
    for (const key of Object.values(REASON_CODE_KEYS)) {
      expect(typeof lookup(en, key), `Missing translation: ${key}`).toBe('string');
    }
  });

  it('every remediation action has a translation key', async () => {
    const en = (await import('../../../assets/i18n/en-US.json')).default;
    for (const key of Object.values(REMEDIATION_ACTION_KEYS)) {
      expect(typeof lookup(en, key), `Missing translation: ${key}`).toBe('string');
    }
  });
});

export { REASON_CODE_KEYS, REMEDIATION_ACTION_KEYS };
