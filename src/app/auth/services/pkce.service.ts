/**
 * PKCE (Proof Key for Code Exchange) Service
 *
 * Manages the lifecycle of PKCE parameters for OAuth 2.0 flows:
 * - Generation of code verifier and challenge
 * - Secure storage in sessionStorage
 * - Retrieval for token exchange
 * - Expiration and cleanup
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7636
 */

import { Injectable } from '@angular/core';
import { LoggerService } from '../../core/services/logger.service';
import { PkceParameters, PkceErrorCode, PkceErrorClass } from '../models/pkce.models';
import { generateCodeVerifier, computeCodeChallenge } from '../utils/pkce-crypto.utils';

@Injectable({
  providedIn: 'root',
})
export class PkceService {
  private readonly VERIFIER_STORAGE_KEY = 'pkce_verifier';
  private readonly VERIFIER_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private logger: LoggerService) {}

  /**
   * Generate PKCE parameters for OAuth authorization request
   * Automatically stores verifier in sessionStorage for later exchange
   *
   * @returns Promise resolving to PKCE parameters
   * @throws PkceError if generation fails
   */
  async generatePkceParameters(): Promise<PkceParameters> {
    try {
      // Generate code verifier (32 random bytes → 43 characters)
      const codeVerifier = generateCodeVerifier();

      // Compute code challenge (SHA-256 of verifier → 43 characters)
      const codeChallenge = await computeCodeChallenge(codeVerifier);

      const params: PkceParameters = {
        codeVerifier,
        codeChallenge,
        codeChallengeMethod: 'S256',
        generatedAt: Date.now(),
      };

      // Store in sessionStorage (auto-clears on tab close)
      this.storeVerifier(params);

      this.logger.debugComponent('PKCE', 'Generated PKCE parameters', {
        challengeLength: codeChallenge.length,
        verifierLength: codeVerifier.length,
        expiresIn: `${this.VERIFIER_MAX_AGE_MS / 1000}s`,
      });

      return params;
    } catch (error) {
      // Re-throw PkceErrorClass as-is to preserve error details
      if (error instanceof PkceErrorClass) {
        throw error;
      }
      // Duck-type check for PKCE error structure (handles errors across different realms/contexts)
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        'retryable' in error &&
        typeof (error as { retryable: unknown }).retryable === 'boolean'
      ) {
        // Re-throw errors that have PKCE error structure
        throw error;
      }
      // Wrap other errors
      this.logger.error('Failed to generate PKCE parameters', error);
      throw new PkceErrorClass(
        PkceErrorCode.GENERATION_FAILED,
        'Failed to generate PKCE parameters',
        true,
      );
    }
  }

  /**
   * Retrieve stored code verifier for token exchange
   * Validates expiration and throws error if not found or expired
   *
   * @returns Code verifier string
   * @throws PkceError if verifier not found or expired
   */
  retrieveVerifier(): string {
    const stored = sessionStorage.getItem(this.VERIFIER_STORAGE_KEY);

    if (!stored) {
      this.logger.warn('PKCE verifier not found in sessionStorage');
      throw new PkceErrorClass(
        PkceErrorCode.VERIFIER_NOT_FOUND,
        'PKCE verifier not found - possible session loss or tab closure',
        false,
      );
    }

    let params: PkceParameters;
    try {
      params = JSON.parse(stored) as PkceParameters;
    } catch (error) {
      this.logger.error('Failed to parse stored PKCE parameters', error);
      this.clearVerifier(); // Clear corrupted data
      throw new PkceErrorClass(
        PkceErrorCode.VERIFIER_NOT_FOUND,
        'Invalid PKCE verifier format in storage',
        false,
      );
    }

    // Check expiration (5 minutes)
    const age = Date.now() - params.generatedAt;
    if (age > this.VERIFIER_MAX_AGE_MS) {
      this.logger.warn('PKCE verifier expired', {
        age: `${Math.floor(age / 1000)}s`,
        maxAge: `${this.VERIFIER_MAX_AGE_MS / 1000}s`,
      });
      this.clearVerifier();
      throw new PkceErrorClass(
        PkceErrorCode.VERIFIER_EXPIRED,
        `PKCE verifier expired after ${Math.floor(age / 1000)} seconds`,
        true,
      );
    }

    this.logger.debugComponent('PKCE', 'Retrieved PKCE verifier', {
      age: `${Math.floor(age / 1000)}s`,
      verifierLength: params.codeVerifier.length,
    });

    return params.codeVerifier;
  }

  /**
   * Clear stored PKCE verifier
   * Should be called after successful token exchange or on error
   */
  clearVerifier(): void {
    const hadVerifier = sessionStorage.getItem(this.VERIFIER_STORAGE_KEY) !== null;
    sessionStorage.removeItem(this.VERIFIER_STORAGE_KEY);

    if (hadVerifier) {
      this.logger.debugComponent('PKCE', 'Cleared PKCE verifier from sessionStorage');
    }
  }

  /**
   * Check if a PKCE verifier is currently stored
   * Useful for debugging and state management
   *
   * @returns True if verifier exists in storage
   */
  hasStoredVerifier(): boolean {
    return sessionStorage.getItem(this.VERIFIER_STORAGE_KEY) !== null;
  }

  /**
   * Store PKCE parameters in sessionStorage
   * Private method used by generatePkceParameters()
   *
   * @param params PKCE parameters to store
   */
  private storeVerifier(params: PkceParameters): void {
    try {
      sessionStorage.setItem(this.VERIFIER_STORAGE_KEY, JSON.stringify(params));
    } catch (error) {
      this.logger.error('Failed to store PKCE verifier in sessionStorage', error);
      // This could fail if sessionStorage is full or disabled
      throw new PkceErrorClass(
        PkceErrorCode.GENERATION_FAILED,
        'Failed to store PKCE verifier - sessionStorage unavailable',
        false,
      );
    }
  }
}
