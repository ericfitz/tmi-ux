// This project uses vitest for all unit tests, with native vitest syntax
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  generateCodeVerifier,
  computeCodeChallenge,
  base64UrlEncode,
  generateRandomBytes,
  sha256,
} from './pkce-crypto.utils';

describe('PKCE Crypto Utils', () => {
  // Ensure all spies are restored after each test to prevent cross-test pollution
  afterEach(() => {
    vi.restoreAllMocks();
  });
  describe('generateRandomBytes', () => {
    it('should generate 32 bytes by default', () => {
      const bytes = generateRandomBytes();
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBe(32);
    });

    it('should generate the specified number of bytes', () => {
      const bytes = generateRandomBytes(16);
      expect(bytes.length).toBe(16);
    });

    it('should generate different values on each call', () => {
      const bytes1 = generateRandomBytes();
      const bytes2 = generateRandomBytes();
      expect(bytes1).not.toEqual(bytes2);
    });

    it('should use crypto.getRandomValues', () => {
      const spy = vi.spyOn(crypto, 'getRandomValues');
      generateRandomBytes();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('base64UrlEncode', () => {
    it('should encode bytes to base64url format', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).toBe('SGVsbG8');
    });

    it('should replace + with - (URL safe)', () => {
      // Create bytes that would produce + in standard base64
      const bytes = new Uint8Array([251, 239]); // Standard base64: "++8"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('+');
      expect(encoded).toContain('-');
    });

    it('should replace / with _ (URL safe)', () => {
      // Create bytes that would produce / in standard base64
      const bytes = new Uint8Array([255, 239]); // Standard base64: "/+8"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('/');
      expect(encoded).toContain('_');
    });

    it('should remove padding = characters', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111, 33]); // "Hello!" -> "SGVsbG8h"
      const encoded = base64UrlEncode(bytes);
      expect(encoded).not.toContain('=');
    });

    it('should handle empty array', () => {
      const bytes = new Uint8Array([]);
      const encoded = base64UrlEncode(bytes);
      expect(encoded).toBe('');
    });
  });

  describe('sha256', () => {
    it('should compute SHA-256 hash', async () => {
      const input = 'test-string';
      const hash = await sha256(input);
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32); // SHA-256 produces 32 bytes
    });

    it('should produce consistent hashes for same input', async () => {
      const input = 'consistent-input';
      const hash1 = await sha256(input);
      const hash2 = await sha256(input);
      expect(hash1).toEqual(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await sha256('input1');
      const hash2 = await sha256('input2');
      expect(hash1).not.toEqual(hash2);
    });

    it('should use SubtleCrypto.digest', async () => {
      const spy = vi.spyOn(crypto.subtle, 'digest');
      await sha256('test');
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('SHA-256');
      // Verify the digest function was called with encoded data (implementation detail)
      expect(spy.mock.calls[0][1]).toBeDefined();
      spy.mockRestore();
    });

    it('should handle empty string', async () => {
      const hash = await sha256('');
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });
  });

  describe('generateCodeVerifier', () => {
    it('should generate a 43-character string', () => {
      const verifier = generateCodeVerifier();
      expect(typeof verifier).toBe('string');
      expect(verifier.length).toBe(43);
    });

    it('should generate different verifiers on each call', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      expect(verifier1).not.toBe(verifier2);
    });

    it('should only contain URL-safe characters', () => {
      const verifier = generateCodeVerifier();
      // Base64url alphabet: A-Z, a-z, 0-9, -, _
      const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
      expect(verifier).toMatch(urlSafeRegex);
    });

    it('should not contain padding characters', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).not.toContain('=');
    });

    it('should meet RFC 7636 length requirements (43-128 characters)', () => {
      const verifier = generateCodeVerifier();
      expect(verifier.length).toBeGreaterThanOrEqual(43);
      expect(verifier.length).toBeLessThanOrEqual(128);
    });

    it('should be cryptographically random', () => {
      // Generate 100 verifiers and ensure they're all unique
      const verifiers = new Set<string>();
      for (let i = 0; i < 100; i++) {
        verifiers.add(generateCodeVerifier());
      }
      expect(verifiers.size).toBe(100);
    });
  });

  describe('computeCodeChallenge', () => {
    it('should generate a 43-character challenge', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBe(43);
    });

    it('should produce consistent challenge for same verifier', async () => {
      const verifier = 'test-verifier-1234567890-abcdefghijklmnop';
      const challenge1 = await computeCodeChallenge(verifier);
      const challenge2 = await computeCodeChallenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it('should produce different challenges for different verifiers', async () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      const challenge1 = await computeCodeChallenge(verifier1);
      const challenge2 = await computeCodeChallenge(verifier2);
      expect(challenge1).not.toBe(challenge2);
    });

    it('should only contain URL-safe characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);
      const urlSafeRegex = /^[A-Za-z0-9_-]+$/;
      expect(challenge).toMatch(urlSafeRegex);
    });

    it('should not contain padding characters', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);
      expect(challenge).not.toContain('=');
    });

    it('should use SHA-256 hashing', async () => {
      const verifier = 'test-verifier';
      const spy = vi.spyOn(crypto.subtle, 'digest');
      await computeCodeChallenge(verifier);
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls[0][0]).toBe('SHA-256');
      // Verify the digest function was called with encoded data (implementation detail)
      expect(spy.mock.calls[0][1]).toBeDefined();
      spy.mockRestore();
    });

    it('should handle empty verifier', async () => {
      const challenge = await computeCodeChallenge('');
      expect(typeof challenge).toBe('string');
      expect(challenge.length).toBe(43);
    });
  });

  describe('PKCE Flow Integration', () => {
    it('should generate valid verifier/challenge pairs for OAuth flow', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);

      // Verify RFC 7636 compliance
      expect(verifier.length).toBe(43);
      expect(challenge.length).toBe(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
      expect(verifier).not.toBe(challenge); // Challenge should be hash, not same as verifier
    });

    it('should generate 10 unique verifier/challenge pairs', async () => {
      const pairs = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const verifier = generateCodeVerifier();
        const challenge = await computeCodeChallenge(verifier);
        pairs.add(`${verifier}:${challenge}`);
      }

      expect(pairs.size).toBe(10);
    });

    it('should match RFC 7636 example format', async () => {
      // RFC 7636 specifies:
      // - code_verifier: 43-128 characters of [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
      // - code_challenge: base64url(sha256(code_verifier))
      // Our implementation uses [A-Za-z0-9_-] (subset of allowed chars, more URL-friendly)

      const verifier = generateCodeVerifier();
      const challenge = await computeCodeChallenge(verifier);

      // Verify format compliance
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });
  });

  // Skipping crypto API unavailability test as globalThis.crypto is read-only in vitest environment
});
