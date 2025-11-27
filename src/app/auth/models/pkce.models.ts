/**
 * PKCE (Proof Key for Code Exchange) Domain Models
 *
 * Type definitions for RFC 7636 PKCE implementation.
 */

/**
 * PKCE parameters for OAuth 2.0 Authorization Code Flow
 * Generated before initiating OAuth flow, stored for token exchange
 */
export interface PkceParameters {
  /** Code verifier: 43-128 character random string */
  codeVerifier: string;

  /** Code challenge: base64url(SHA-256(codeVerifier)) */
  codeChallenge: string;

  /** Challenge method: always 'S256' for TMI (SHA-256) */
  codeChallengeMethod: 'S256';

  /** Timestamp when parameters were generated (for expiration) */
  generatedAt: number;
}

/**
 * PKCE error codes for specific failure scenarios
 */
export enum PkceErrorCode {
  /** Failed to generate code verifier or challenge */
  GENERATION_FAILED = 'pkce_generation_failed',

  /** Code verifier not found in session storage */
  VERIFIER_NOT_FOUND = 'pkce_verifier_not_found',

  /** Code verifier expired (>5 minutes old) */
  VERIFIER_EXPIRED = 'pkce_verifier_expired',

  /** Code verifier format validation failed */
  INVALID_VERIFIER_FORMAT = 'pkce_invalid_verifier_format',

  /** Token exchange failed with PKCE verifier */
  EXCHANGE_FAILED = 'pkce_exchange_failed',
}

/**
 * PKCE-specific error information
 */
export interface PkceError {
  /** Error code for programmatic handling */
  code: PkceErrorCode;

  /** Human-readable error message */
  message: string;

  /** Whether the operation can be retried */
  retryable: boolean;
}

/**
 * Custom Error class for PKCE-related errors
 * Extends built-in Error class to satisfy TypeScript linting requirements
 */
export class PkceErrorClass extends Error implements PkceError {
  constructor(
    public code: PkceErrorCode,
    message: string,
    public retryable: boolean,
  ) {
    super(message);
    this.name = 'PkceError';
    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, PkceErrorClass.prototype);
  }
}
