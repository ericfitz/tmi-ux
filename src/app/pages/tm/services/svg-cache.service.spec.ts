import { SvgCacheService } from './svg-cache.service';
import { vi } from 'vitest';

describe('SvgCacheService', () => {
  let service: SvgCacheService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
    };

    service = new SvgCacheService(mockLogger);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('SVG validation cache', () => {
    const testKey = 'test-diagram-123';

    it('should return false when validation cache does not exist', () => {
      expect(service.hasValidationCache(testKey)).toBe(false);
    });

    it('should return undefined when getting non-existent validation cache', () => {
      expect(service.getValidationCache(testKey)).toBeUndefined();
    });

    it('should store and retrieve validation cache', () => {
      service.setValidationCache(testKey, true);

      expect(service.hasValidationCache(testKey)).toBe(true);
      expect(service.getValidationCache(testKey)).toBe(true);
    });

    it('should store false validation results', () => {
      service.setValidationCache(testKey, false);

      expect(service.hasValidationCache(testKey)).toBe(true);
      expect(service.getValidationCache(testKey)).toBe(false);
    });
  });

  describe('SVG data URL cache', () => {
    const testKey = 'test-diagram-456';
    const testDataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';

    it('should return false when data URL cache does not exist', () => {
      expect(service.hasDataUrlCache(testKey)).toBe(false);
    });

    it('should return undefined when getting non-existent data URL cache', () => {
      expect(service.getDataUrlCache(testKey)).toBeUndefined();
    });

    it('should store and retrieve data URL cache', () => {
      service.setDataUrlCache(testKey, testDataUrl);

      expect(service.hasDataUrlCache(testKey)).toBe(true);
      expect(service.getDataUrlCache(testKey)).toBe(testDataUrl);
    });

    it('should store empty string data URLs', () => {
      service.setDataUrlCache(testKey, '');

      expect(service.hasDataUrlCache(testKey)).toBe(true);
      expect(service.getDataUrlCache(testKey)).toBe('');
    });
  });

  describe('cache management', () => {
    beforeEach(() => {
      // Populate caches with test data
      service.setValidationCache('validation-1', true);
      service.setValidationCache('validation-2', false);
      service.setDataUrlCache('dataurl-1', 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=');
      service.setDataUrlCache('dataurl-2', 'data:image/svg+xml;base64,PHN2ZzI+PC9zdmcyPg==');
    });

    it('should return correct cache statistics', () => {
      const stats = service.getCacheStats();

      expect(stats.validationCacheSize).toBe(2);
      expect(stats.dataUrlCacheSize).toBe(2);
    });

    it('should clear all caches', () => {
      service.clearAllCaches();

      const stats = service.getCacheStats();
      expect(stats.validationCacheSize).toBe(0);
      expect(stats.dataUrlCacheSize).toBe(0);

      // Verify caches are actually cleared
      expect(service.hasValidationCache('validation-1')).toBe(false);
      expect(service.hasDataUrlCache('dataurl-1')).toBe(false);
    });

    it('should clear caches without error', () => {
      service.clearAllCaches();

      // Verify caches are empty
      const stats = service.getCacheStats();
      expect(stats.validationCacheSize).toBe(0);
      expect(stats.dataUrlCacheSize).toBe(0);
    });
  });

  describe('cache isolation', () => {
    it('should maintain separate validation and data URL caches', () => {
      const key = 'same-key';

      service.setValidationCache(key, true);
      service.setDataUrlCache(key, 'test-url');

      expect(service.getValidationCache(key)).toBe(true);
      expect(service.getDataUrlCache(key)).toBe('test-url');

      // Clearing one should not affect the other
      service.setValidationCache('other-key', false);

      expect(service.getValidationCache(key)).toBe(true);
      expect(service.getDataUrlCache(key)).toBe('test-url');
    });
  });
});
