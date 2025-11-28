/**
 * PKCE (Proof Key for Code Exchange) Cryptographic Utilities
 *
 * Implements RFC 7636 PKCE for OAuth 2.0 public clients.
 * Provides pure functions for generating code verifiers and challenges.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

/**
 * Generate cryptographically secure random bytes
 * Uses Web Crypto API for hardware-accelerated random generation
 *
 * @param length Number of bytes to generate (1-1024), defaults to 32
 * @returns Uint8Array of random bytes
 * @throws Error if length is invalid
 */
export function generateRandomBytes(length: number = 32): Uint8Array {
  if (length < 1 || length > 1024) {
    throw new Error(`Invalid byte length: ${length}. Must be between 1 and 1024.`);
  }

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/**
 * Encode bytes as base64url (RFC 4648)
 * URL-safe encoding without padding
 *
 * @param bytes Uint8Array to encode
 * @returns Base64url-encoded string
 */
export function base64UrlEncode(bytes: Uint8Array): string {
  // Convert bytes to base64
  const base64 = btoa(String.fromCharCode(...bytes));

  // Make URL-safe: replace + with -, / with _, remove padding =
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Compute SHA-256 hash of input string
 * Uses Web Crypto API SubtleCrypto for hardware acceleration
 *
 * @param input String to hash
 * @returns Promise resolving to SHA-256 hash as Uint8Array
 * @throws Error if SubtleCrypto is not available
 */
export async function sha256(input: string): Promise<Uint8Array> {
  if (!crypto.subtle) {
    throw new Error('SubtleCrypto API not available. HTTPS required.');
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);

  return new Uint8Array(hashBuffer);
}

/**
 * Generate PKCE code verifier (RFC 7636)
 * Creates a cryptographically random 43-character string
 *
 * Format: base64url(32 random bytes) = 43 characters
 * Allowed characters: [A-Za-z0-9-._~]
 *
 * @returns 43-character code verifier string
 */
export function generateCodeVerifier(): string {
  const bytes = generateRandomBytes(32); // 32 bytes = 256 bits
  return base64UrlEncode(bytes); // Results in 43 characters
}

/**
 * Compute PKCE code challenge from verifier (RFC 7636)
 * Challenge = base64url(SHA-256(verifier))
 *
 * This is the S256 (SHA-256) challenge method required by TMI server.
 * The "plain" method is not supported.
 *
 * @param verifier Code verifier string (43-128 characters)
 * @returns Promise resolving to 43-character code challenge string
 */
export async function computeCodeChallenge(verifier: string): Promise<string> {
  const hash = await sha256(verifier);
  return base64UrlEncode(hash); // Results in 43 characters
}

/**
 * Validate code verifier format (RFC 7636 section 4.1)
 * Must be 43-128 characters: [A-Za-z0-9-._~]
 *
 * @param verifier String to validate
 * @returns True if verifier format is valid
 */
export function isValidCodeVerifier(verifier: string): boolean {
  if (!verifier || verifier.length < 43 || verifier.length > 128) {
    return false;
  }

  // RFC 7636: unreserved characters from RFC 3986
  const validPattern = /^[A-Za-z0-9\-._~]+$/;
  return validPattern.test(verifier);
}
