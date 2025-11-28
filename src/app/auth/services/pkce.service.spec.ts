// This project uses vitest for all unit tests, with native vitest syntax
// Execute all tests using: "pnpm run test"
// Execute this test only using: "pnpm run test" followed by the relative path to this test file from the project root.

import '@angular/compiler';

import { PkceService } from './pkce.service';
import { PkceErrorCode } from '../models/pkce.models';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import * as pkceCryptoUtils from '../utils/pkce-crypto.utils';

describe('PkceService', () => {
  let service: PkceService;
  let mockLogger: any;

  beforeEach(() => {
    // Clear sessionStorage before each test
    sessionStorage.clear();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    service = new PkceService(mockLogger);
  });

  afterEach(() => {
    sessionStorage.clear();
    // Restore all mocks to ensure sessionStorage methods aren't mocked in subsequent tests
    vi.restoreAllMocks();
  });

  describe('Service Creation', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have correct storage key', () => {
      expect((service as any).VERIFIER_STORAGE_KEY).toBe('pkce_verifier');
    });

    it('should have 5-minute expiration', () => {
      expect((service as any).VERIFIER_MAX_AGE_MS).toBe(5 * 60 * 1000);
    });
  });

  describe('generatePkceParameters', () => {
    it('should generate valid PKCE parameters', async () => {
      const params = await service.generatePkceParameters();

      expect(params).toBeDefined();
      expect(params.codeVerifier).toBeDefined();
      expect(params.codeChallenge).toBeDefined();
      expect(params.codeChallengeMethod).toBe('S256');
      expect(params.generatedAt).toBeGreaterThan(0);
    });

    it('should generate 43-character verifier and challenge', async () => {
      const params = await service.generatePkceParameters();

      expect(params.codeVerifier.length).toBe(43);
      expect(params.codeChallenge.length).toBe(43);
    });

    it('should store verifier in sessionStorage', async () => {
      await service.generatePkceParameters();

      const stored = sessionStorage.getItem('pkce_verifier');
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.codeVerifier).toBeDefined();
      expect(parsed.codeChallenge).toBeDefined();
      expect(parsed.codeChallengeMethod).toBe('S256');
      expect(parsed.generatedAt).toBeDefined();
    });

    it('should set generatedAt to current timestamp', async () => {
      const before = Date.now();
      const params = await service.generatePkceParameters();
      const after = Date.now();

      expect(params.generatedAt).toBeGreaterThanOrEqual(before);
      expect(params.generatedAt).toBeLessThanOrEqual(after);
    });

    it('should log debug message on success', async () => {
      await service.generatePkceParameters();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'PKCE',
        'Generated PKCE parameters',
        expect.objectContaining({
          challengeLength: 43,
          verifierLength: 43,
          expiresIn: '300s',
        }),
      );
    });

    it('should throw PkceError on crypto failure', async () => {
      vi.spyOn(pkceCryptoUtils, 'generateCodeVerifier').mockImplementation(() => {
        throw new Error('Crypto failed');
      });

      await expect(service.generatePkceParameters()).rejects.toMatchObject({
        code: PkceErrorCode.GENERATION_FAILED,
        message: 'Failed to generate PKCE parameters',
        retryable: true,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to generate PKCE parameters',
        expect.any(Error),
      );
    });

    it('should throw PkceError if sessionStorage is unavailable', async () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      try {
        await expect(service.generatePkceParameters()).rejects.toMatchObject({
          code: PkceErrorCode.GENERATION_FAILED,
          message: 'Failed to store PKCE verifier - sessionStorage unavailable',
          retryable: false,
        });
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });

    it('should generate unique parameters on each call', async () => {
      const params1 = await service.generatePkceParameters();
      const params2 = await service.generatePkceParameters();

      expect(params1.codeVerifier).not.toBe(params2.codeVerifier);
      expect(params1.codeChallenge).not.toBe(params2.codeChallenge);
    });
  });

  describe('retrieveVerifier', () => {
    it('should retrieve stored verifier', async () => {
      const params = await service.generatePkceParameters();
      const verifier = service.retrieveVerifier();

      expect(verifier).toBe(params.codeVerifier);
    });

    it('should log debug message on successful retrieval', async () => {
      await service.generatePkceParameters();
      mockLogger.debugComponent.mockClear();

      service.retrieveVerifier();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'PKCE',
        'Retrieved PKCE verifier',
        expect.objectContaining({
          age: expect.stringMatching(/^\d+s$/),
          verifierLength: 43,
        }),
      );
    });

    it('should throw VERIFIER_NOT_FOUND if no verifier stored', () => {
      expect(() => service.retrieveVerifier()).toThrow(
        expect.objectContaining({
          code: PkceErrorCode.VERIFIER_NOT_FOUND,
          message: 'PKCE verifier not found - possible session loss or tab closure',
          retryable: false,
        }),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith('PKCE verifier not found in sessionStorage');
    });

    it('should throw VERIFIER_NOT_FOUND if stored data is corrupted', () => {
      sessionStorage.setItem('pkce_verifier', 'invalid-json');

      expect(() => service.retrieveVerifier()).toThrow(
        expect.objectContaining({
          code: PkceErrorCode.VERIFIER_NOT_FOUND,
          message: 'Invalid PKCE verifier format in storage',
          retryable: false,
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to parse stored PKCE parameters',
        expect.any(Error),
      );
    });

    it('should clear corrupted data', () => {
      sessionStorage.setItem('pkce_verifier', 'invalid-json');

      try {
        service.retrieveVerifier();
      } catch {
        // Expected to throw
      }

      expect(sessionStorage.getItem('pkce_verifier')).toBeNull();
    });

    it('should throw VERIFIER_EXPIRED if verifier is older than 5 minutes', async () => {
      await service.generatePkceParameters();

      // Manually update timestamp to 6 minutes ago
      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      expect(() => service.retrieveVerifier()).toThrow(
        expect.objectContaining({
          code: PkceErrorCode.VERIFIER_EXPIRED,
          message: expect.stringMatching(/^PKCE verifier expired after \d+ seconds$/),
          retryable: true,
        }),
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PKCE verifier expired',
        expect.objectContaining({
          age: expect.stringMatching(/^\d+s$/),
          maxAge: '300s',
        }),
      );
    });

    it('should clear expired verifier', async () => {
      await service.generatePkceParameters();

      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - 6 * 60 * 1000;
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      try {
        service.retrieveVerifier();
      } catch {
        // Expected to throw
      }

      expect(sessionStorage.getItem('pkce_verifier')).toBeNull();
    });

    it('should accept verifier that is exactly 5 minutes old', async () => {
      await service.generatePkceParameters();

      // Set to exactly 5 minutes in the past minus 1ms to account for execution time
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000 - 1);

      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = fiveMinutesAgo;
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      expect(() => service.retrieveVerifier()).not.toThrow();
    });

    it('should accept verifier that is 4 minutes old', async () => {
      await service.generatePkceParameters();

      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - 4 * 60 * 1000;
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      expect(() => service.retrieveVerifier()).not.toThrow();
    });
  });

  describe('clearVerifier', () => {
    it('should clear stored verifier', async () => {
      await service.generatePkceParameters();
      expect(sessionStorage.getItem('pkce_verifier')).toBeTruthy();

      service.clearVerifier();
      expect(sessionStorage.getItem('pkce_verifier')).toBeNull();
    });

    it('should log debug message when clearing existing verifier', async () => {
      await service.generatePkceParameters();
      mockLogger.debugComponent.mockClear();

      service.clearVerifier();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'PKCE',
        'Cleared PKCE verifier from sessionStorage',
      );
    });

    it('should not log message when no verifier exists', () => {
      mockLogger.debugComponent.mockClear();

      service.clearVerifier();

      expect(mockLogger.debugComponent).not.toHaveBeenCalled();
    });

    it('should be idempotent', () => {
      service.clearVerifier();
      service.clearVerifier();
      service.clearVerifier();

      expect(sessionStorage.getItem('pkce_verifier')).toBeNull();
    });
  });

  describe('hasStoredVerifier', () => {
    it('should return false when no verifier stored', () => {
      expect(service.hasStoredVerifier()).toBe(false);
    });

    it('should return true when verifier is stored', async () => {
      await service.generatePkceParameters();
      expect(service.hasStoredVerifier()).toBe(true);
    });

    it('should return false after clearing verifier', async () => {
      await service.generatePkceParameters();
      expect(service.hasStoredVerifier()).toBe(true);

      service.clearVerifier();
      expect(service.hasStoredVerifier()).toBe(false);
    });

    it('should return true even if stored data is corrupted', () => {
      sessionStorage.setItem('pkce_verifier', 'invalid-json');
      expect(service.hasStoredVerifier()).toBe(true);
    });

    it('should return true even if verifier is expired', async () => {
      await service.generatePkceParameters();

      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      expect(service.hasStoredVerifier()).toBe(true);
    });
  });

  describe('PKCE Flow Integration', () => {
    it('should support complete OAuth PKCE flow', async () => {
      // 1. Generate parameters before OAuth redirect
      const params = await service.generatePkceParameters();
      expect(params.codeVerifier).toBeDefined();
      expect(params.codeChallenge).toBeDefined();

      // 2. Parameters should be stored automatically
      expect(service.hasStoredVerifier()).toBe(true);

      // 3. After OAuth callback, retrieve verifier for token exchange
      const verifier = service.retrieveVerifier();
      expect(verifier).toBe(params.codeVerifier);

      // 4. Clear verifier after successful token exchange
      service.clearVerifier();
      expect(service.hasStoredVerifier()).toBe(false);
    });

    it('should handle tab closure scenario (sessionStorage auto-clear)', async () => {
      await service.generatePkceParameters();

      // Simulate tab closure by clearing sessionStorage
      sessionStorage.clear();

      expect(() => service.retrieveVerifier()).toThrow(
        expect.objectContaining({
          code: PkceErrorCode.VERIFIER_NOT_FOUND,
        }),
      );
    });

    it('should handle page refresh during OAuth flow', async () => {
      await service.generatePkceParameters();
      const stored = sessionStorage.getItem('pkce_verifier');

      // Simulate page refresh - sessionStorage persists
      sessionStorage.clear();
      sessionStorage.setItem('pkce_verifier', stored!);

      expect(() => service.retrieveVerifier()).not.toThrow();
    });

    it('should handle slow OAuth provider response (near expiration)', async () => {
      await service.generatePkceParameters();

      // Simulate 4 minutes 50 seconds delay
      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - (4 * 60 + 50) * 1000;
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      // Should still work (within 5-minute window)
      expect(() => service.retrieveVerifier()).not.toThrow();
    });

    it('should reject OAuth provider response after timeout', async () => {
      await service.generatePkceParameters();

      // Simulate 5 minutes 10 seconds delay
      const stored = sessionStorage.getItem('pkce_verifier');
      const params = JSON.parse(stored!);
      params.generatedAt = Date.now() - (5 * 60 + 10) * 1000;
      sessionStorage.setItem('pkce_verifier', JSON.stringify(params));

      // Should be expired
      expect(() => service.retrieveVerifier()).toThrow(
        expect.objectContaining({
          code: PkceErrorCode.VERIFIER_EXPIRED,
        }),
      );
    });
  });

  describe('Error Scenarios', () => {
    it('should handle concurrent OAuth flows (overwrite)', async () => {
      const params1 = await service.generatePkceParameters();
      const params2 = await service.generatePkceParameters();

      // Second generation should overwrite first
      const verifier = service.retrieveVerifier();
      expect(verifier).toBe(params2.codeVerifier);
      expect(verifier).not.toBe(params1.codeVerifier);
    });

    it('should handle sessionStorage quota exceeded', async () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException('QuotaExceededError');
      });

      try {
        await expect(service.generatePkceParameters()).rejects.toMatchObject({
          code: PkceErrorCode.GENERATION_FAILED,
        });
      } finally {
        Storage.prototype.setItem = originalSetItem;
      }
    });
  });
});
