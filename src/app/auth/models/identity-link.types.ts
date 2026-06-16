import type { components } from '@app/generated/api-types';

/** A single linked (secondary) identity. */
export type LinkedIdentity = components['schemas']['LinkedIdentity'];

/** Response of POST /me/identities/link/start. */
export type IdentityLinkStartResponse = components['schemas']['IdentityLinkStartResponse'];

/** Response of GET /me/identities/link/pending/{link_id}. */
export type PendingIdentityLinkResponse = components['schemas']['PendingIdentityLinkResponse'];

/** Response of GET /me/identities (primary + linked). */
export type MyIdentitiesResponse = components['schemas']['MyIdentitiesResponse'];

/** The primary identity sub-object inside MyIdentitiesResponse. */
export type PrimaryIdentity = MyIdentitiesResponse['primary'];

/** Server error codes we branch on (RFC6749 `error` field). */
export const IDENTITY_LINK_ERROR = {
  alreadyBound: 'identity_already_bound',
  identityMismatch: 'identity_mismatch',
} as const;

/**
 * Thrown by IdentityLinkService when a step-up-protected call returns
 * 401 + WWW-Authenticate: insufficient_user_authentication. The caller is
 * expected to invoke AuthService.initiateStepUp(returnUrl) and retry.
 */
export class StepUpRequiredError extends Error {
  constructor() {
    super('insufficient_user_authentication');
    this.name = 'StepUpRequiredError';
  }
}
