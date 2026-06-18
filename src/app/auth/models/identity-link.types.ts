import type { components } from '@app/generated/api-types';

/** A single linked (secondary) identity. */
// SEM@5e9aaca39e94d698760be129bf310946cae739ae: type alias for a single linked secondary identity from the API schema (pure)
export type LinkedIdentity = components['schemas']['LinkedIdentity'];

/** Response of POST /me/identities/link/start. */
// SEM@5e9aaca39e94d698760be129bf310946cae739ae: type alias for the identity link start response from the API schema (pure)
export type IdentityLinkStartResponse = components['schemas']['IdentityLinkStartResponse'];

/** Response of GET /me/identities/link/pending/{link_id}. */
// SEM@5e9aaca39e94d698760be129bf310946cae739ae: type alias for a pending identity link status response from the API schema (pure)
export type PendingIdentityLinkResponse = components['schemas']['PendingIdentityLinkResponse'];

/** Response of GET /me/identities (primary + linked). */
// SEM@5e9aaca39e94d698760be129bf310946cae739ae: type alias for the user's primary and linked identities response (pure)
export type MyIdentitiesResponse = components['schemas']['MyIdentitiesResponse'];

/** Server error codes we branch on (RFC6749 `error` field). */
export const IDENTITY_LINK_ERROR = {
  alreadyBound: 'identity_already_bound',
} as const;

/**
 * Thrown by IdentityLinkService when a step-up-protected call returns
 * 401 + WWW-Authenticate: insufficient_user_authentication. The caller is
 * expected to invoke AuthService.initiateStepUp(returnUrl) and retry.
 */
// SEM@5e9aaca39e94d698760be129bf310946cae739ae: error thrown when a step-up authentication challenge is required for a protected call (pure)
export class StepUpRequiredError extends Error {
  // SEM@5e9aaca39e94d698760be129bf310946cae739ae: initialize StepUpRequiredError with insufficient_user_authentication message (pure)
  constructor() {
    super('insufficient_user_authentication');
    this.name = 'StepUpRequiredError';
  }
}
