import { HttpErrorResponse } from '@angular/common/http';

import { generateRandomBytes } from './pkce-crypto.utils';

/**
 * Detect the step-up challenge on a 401 response.
 * Primary signal: WWW-Authenticate header (requires the server to expose it
 * via Access-Control-Expose-Headers — see tmi#455).
 * Fallback: error code in the JSON body.
 */
// SEM@8115293f499cb35560c587d54dc47a72f5e72ec4: detect whether a 401 response signals a step-up authentication challenge (pure)
export function isStepUpChallenge(error: HttpErrorResponse): boolean {
  if (error.status !== 401) {
    return false;
  }
  const header = error.headers?.get('WWW-Authenticate') ?? '';
  if (header.toLowerCase().includes('insufficient_user_authentication')) {
    return true;
  }
  const body = error.error as { error?: string } | null;
  return body?.error === 'insufficient_user_authentication';
}

/**
 * Build the OAuth state parameter for a step-up round-trip.
 * Same base64-JSON format as AuthService.generateRandomState, with an
 * additional stepUp flag so the callback knows which flow it is finishing.
 */
// SEM@f416334cbe65cf2b4e746b5a9c2243637cd94ebb: build a CSRF-protected OAuth state parameter for a step-up round-trip (pure)
export function buildStepUpState(returnUrl: string): string {
  const array = generateRandomBytes(16);
  const csrf = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');

  const stateJson = JSON.stringify({ csrf, returnUrl, stepUp: true });
  const encoder = new TextEncoder();
  return btoa(String.fromCharCode(...encoder.encode(stateJson)));
}

/**
 * Build the query parameters for GET /oauth2/step_up. Single source of truth for
 * the request contract shared by AuthService.initiateStepUp (top-level redirect)
 * and StepUpService.beginStepUp (XHR, JSON-negotiated).
 */
// SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: build query parameters for the step-up OAuth authorization request (pure)
export function buildStepUpRequestParams(
  state: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  origin: string = window.location.origin,
): Record<string, string> {
  return {
    client_callback: `${origin}/oauth2/callback`,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  };
}

/**
 * Serialize step-up request params into a full GET URL for top-level navigation.
 * Every value is percent-encoded (the base64 state can contain '+', '/', '=').
 */
// SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: serialize step-up request params into a full percent-encoded GET URL (pure)
export function buildStepUpUrl(apiBaseUrl: string, params: Record<string, string>): string {
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl.slice(0, -1) : apiBaseUrl;
  const query = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `${base}/oauth2/step_up?${query}`;
}
