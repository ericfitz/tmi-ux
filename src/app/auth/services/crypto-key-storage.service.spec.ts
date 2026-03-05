// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import 'fake-indexeddb/auto';

import { expect, beforeEach, afterEach, describe, it } from 'vitest';
import { CryptoKeyStorageService } from './crypto-key-storage.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../testing/mocks';

describe('CryptoKeyStorageService', () => {
  let service: CryptoKeyStorageService;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    mockLogger = createTypedMockLoggerService();
    service = new CryptoKeyStorageService(
      mockLogger as unknown as import('../../core/services/logger.service').LoggerService,
    );
  });

  afterEach(async () => {
    // Clean up IndexedDB between tests
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
  });

  describe('getOrCreateTokenKey', () => {
    it('should generate a new key when none exists', async () => {
      const key = await service.getOrCreateTokenKey();

      expect(key).not.toBeNull();
      expect(key).toBeInstanceOf(CryptoKey);
    });

    it('should return a non-extractable AES-GCM key', async () => {
      const key = await service.getOrCreateTokenKey();

      expect(key).not.toBeNull();
      expect(key!.extractable).toBe(false);
      expect(key!.algorithm).toEqual(expect.objectContaining({ name: 'AES-GCM', length: 256 }));
      expect(key!.usages).toContain('encrypt');
      expect(key!.usages).toContain('decrypt');
    });

    it('should return cached key on second call', async () => {
      const key1 = await service.getOrCreateTokenKey();
      const key2 = await service.getOrCreateTokenKey();

      expect(key1).toBe(key2); // Same object reference (cached)
    });

    it('should retrieve existing key from IndexedDB on fresh service instance', async () => {
      // Generate key with first service instance
      const key1 = await service.getOrCreateTokenKey();
      expect(key1).not.toBeNull();

      // Create new service instance (no cache)
      const service2 = new CryptoKeyStorageService(
        mockLogger as unknown as import('../../core/services/logger.service').LoggerService,
      );
      const key2 = await service2.getOrCreateTokenKey();

      expect(key2).not.toBeNull();
      // Different object but same underlying key — verify by encrypting/decrypting
      const testData = new TextEncoder().encode('test payload');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1!, testData);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2!, ciphertext);
      expect(new TextDecoder().decode(decrypted)).toBe('test payload');
    });

    it('should return null when IndexedDB is unavailable', async () => {
      const originalIndexedDB = globalThis.indexedDB;
      try {
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });

        const freshService = new CryptoKeyStorageService(
          mockLogger as unknown as import('../../core/services/logger.service').LoggerService,
        );
        const key = await freshService.getOrCreateTokenKey();

        expect(key).toBeNull();
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'IndexedDB unavailable - token encryption key cannot be persisted',
        );
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', {
          value: originalIndexedDB,
          configurable: true,
        });
      }
    });

    it('should handle IndexedDB errors gracefully', async () => {
      const originalIndexedDB = globalThis.indexedDB;
      try {
        const faultyIndexedDB = {
          open: () => {
            const request = {} as IDBOpenDBRequest;
            setTimeout(() => {
              if (request.onerror) {
                request.error = new DOMException('Test error');
                request.onerror(new Event('error'));
              }
            }, 0);
            return request;
          },
        };
        Object.defineProperty(globalThis, 'indexedDB', {
          value: faultyIndexedDB,
          configurable: true,
        });

        const freshService = new CryptoKeyStorageService(
          mockLogger as unknown as import('../../core/services/logger.service').LoggerService,
        );
        const key = await freshService.getOrCreateTokenKey();

        expect(key).toBeNull();
        expect(mockLogger.error).toHaveBeenCalled();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', {
          value: originalIndexedDB,
          configurable: true,
        });
      }
    });

    it('should produce a key that works for encrypt/decrypt roundtrip', async () => {
      const key = await service.getOrCreateTokenKey();
      expect(key).not.toBeNull();

      const plaintext = JSON.stringify({ token: 'abc123', expiresAt: '2025-01-01' });
      const encoded = new TextEncoder().encode(plaintext);
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key!, encoded);
      const decryptedBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key!, ciphertext);
      const decrypted = new TextDecoder().decode(decryptedBuf);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe('deleteTokenKey', () => {
    it('should remove key from IndexedDB and clear cache', async () => {
      const key1 = await service.getOrCreateTokenKey();
      expect(key1).not.toBeNull();

      await service.deleteTokenKey();

      // Next call should generate a new key (different from original)
      const key2 = await service.getOrCreateTokenKey();
      expect(key2).not.toBeNull();

      // Verify it's a different key by testing cross-key decryption fails
      const testData = new TextEncoder().encode('test');
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key1!, testData);

      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2!, ciphertext),
      ).rejects.toThrow();
    });

    it('should handle IndexedDB unavailability gracefully', async () => {
      const originalIndexedDB = globalThis.indexedDB;
      try {
        Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true });

        const freshService = new CryptoKeyStorageService(
          mockLogger as unknown as import('../../core/services/logger.service').LoggerService,
        );

        // Should not throw
        await freshService.deleteTokenKey();
      } finally {
        Object.defineProperty(globalThis, 'indexedDB', {
          value: originalIndexedDB,
          configurable: true,
        });
      }
    });
  });
});
