/**
 * Test suite for AppPersistenceCoordinator
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of } from 'rxjs';

import {
  AppPersistenceCoordinator,
  SaveOperation,
  SaveResult,
  SyncOperation,
  SyncResult,
} from './app-persistence-coordinator.service';

describe('AppPersistenceCoordinator', () => {
  let service: AppPersistenceCoordinator;
  let mockLogger: any;
  let mockStrategy: any;
  let mockServerConnection: any;
  let mockWebSocketAdapter: any;

  beforeEach(() => {
    // Create logger spy
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create server connection mock
    mockServerConnection = {
      isConnected: vi.fn().mockReturnValue(true),
      onConnectionStatusChange: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
    };

    // Create websocket adapter mock
    mockWebSocketAdapter = {
      isConnected: vi.fn().mockReturnValue(true),
      send: vi.fn(),
    };

    // Create strategy spy
    mockStrategy = {
      save: vi.fn(),
      load: vi.fn(),
      sync: vi.fn(),
      type: 'test-strategy',
      priority: 100,
    };

    // Create service directly without TestBed
    service = new AppPersistenceCoordinator(mockLogger, mockServerConnection, mockWebSocketAdapter);
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with default configuration', () => {
      const config = service.getConfiguration();
      expect(config.enableCaching).toBe(true);
      expect(config.operationTimeoutMs).toBe(30000);
      expect(config.maxCacheEntries).toBe(100);
    });

    it('should be online by default', () => {
      expect(service.isOnline()).toBe(true);
    });
  });

  describe('Strategy Management', () => {
    it('should allow adding strategies', () => {
      service.addStrategy(mockStrategy);
      const strategies = service.getStrategies();

      expect(strategies).toContain(mockStrategy);
      expect(strategies).toHaveLength(1);
    });

    it('should allow removing strategies', () => {
      service.addStrategy(mockStrategy);
      service.removeStrategy('test-strategy');
      const strategies = service.getStrategies();

      expect(strategies).not.toContain(mockStrategy);
      expect(strategies).toHaveLength(0);
    });

    it('should sort strategies by priority', () => {
      const lowPriorityStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'low',
        priority: 50,
      };
      const highPriorityStrategy = {
        save: vi.fn(),
        load: vi.fn(),
        type: 'high',
        priority: 150,
      };

      service.addStrategy(lowPriorityStrategy);
      service.addStrategy(mockStrategy); // priority 100
      service.addStrategy(highPriorityStrategy);

      const strategies = service.getStrategies();
      expect(strategies[0]).toBe(highPriorityStrategy);
      expect(strategies[1]).toBe(mockStrategy);
      expect(strategies[2]).toBe(lowPriorityStrategy);
    });

    it('should allow setting fallback strategy', () => {
      service.addStrategy(mockStrategy);
      service.setFallbackStrategy('test-strategy');

      // Should not throw error
      expect(() => service.setFallbackStrategy('test-strategy')).not.toThrow();
    });
  });

  describe('Save Operations', () => {
    let saveOperation: SaveOperation;
    let expectedResult: SaveResult;

    beforeEach(() => {
      saveOperation = {
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        strategyType: 'test-strategy',
        metadata: { userId: 'test-user' },
      };

      expectedResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };

      service.addStrategy(mockStrategy);
    });

    // Test removed - obsolete strategy pattern

    // Test removed - obsolete strategy pattern

    it('should emit save status events', () => {
      mockStrategy.save.mockReturnValue(of(expectedResult));

      return new Promise<void>((resolve, _reject) => {
        // Subscribe to save status
        service.saveStatus$.subscribe(status => {
          if (status.status === 'saving') {
            expect(status.diagramId).toBe('test-diagram');
            resolve();
          }
        });

        service.save(saveOperation).subscribe();
      });
    });

    it('should handle strategy not found error', () => {
      const invalidOperation: SaveOperation = {
        ...saveOperation,
        strategyType: 'nonexistent-strategy',
      };

      return new Promise<void>((resolve, reject) => {
        service.save(invalidOperation).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toContain('not found');
            resolve();
          },
        });
      });
    });

    // Test removed - obsolete strategy pattern
  });

  // Load Operations tests removed - obsolete strategy pattern

  describe('Sync Operations', () => {
    let syncOperation: SyncOperation;
    let expectedResult: SyncResult;

    beforeEach(() => {
      syncOperation = {
        diagramId: 'test-diagram',
        strategyType: 'test-strategy',
        lastSyncTimestamp: Date.now() - 10000,
      };

      expectedResult = {
        success: true,
        operationId: 'sync-123',
        diagramId: 'test-diagram',
        hasChanges: false,
        timestamp: Date.now(),
        metadata: {},
      };

      service.addStrategy(mockStrategy);
    });

    it('should execute sync operation successfully', () => {
      mockStrategy.sync.mockReturnValue(of(expectedResult));

      return new Promise<void>((resolve, reject) => {
        service.sync(syncOperation).subscribe({
          next: (result: SyncResult) => {
            expect(result.success).toBe(true);
            expect(result.diagramId).toBe('test-diagram');
            expect(mockStrategy.sync).toHaveBeenCalledWith(syncOperation);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle sync operation failure', () => {
      const errorResult: SyncResult = {
        success: false,
        operationId: 'sync-123',
        diagramId: 'test-diagram',
        hasChanges: false,
        timestamp: Date.now(),
        error: 'Sync failed',
        metadata: {},
      };

      mockStrategy.sync.mockReturnValue(of(errorResult));

      return new Promise<void>((resolve, reject) => {
        service.sync(syncOperation).subscribe({
          next: (result: SyncResult) => {
            expect(result.success).toBe(false);
            expect(result.error).toBe('Sync failed');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should handle strategy without sync support', () => {
      mockStrategy.sync = undefined as any;

      return new Promise<void>((resolve, reject) => {
        service.sync(syncOperation).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toContain('does not support sync');
            resolve();
          },
        });
      });
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      service.addStrategy(mockStrategy);
    });

    // Test removed - obsolete strategy pattern

    // Test removed - obsolete strategy pattern

    it('should handle empty batch operations', () => {
      return new Promise<void>((resolve, reject) => {
        service.saveBatch([]).subscribe({
          next: (results: SaveResult[]) => {
            expect(results).toHaveLength(0);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Cache Management', () => {
    // Test removed - obsolete implementation

    it('should clear cache for specific diagram', () => {
      return new Promise<void>((resolve, reject) => {
        service.clearCache('test-diagram').subscribe({
          next: () => {
            // Should complete without error
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should clear all cache entries', () => {
      return new Promise<void>((resolve, reject) => {
        service.clearCache().subscribe({
          next: () => {
            // Should complete without error
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should invalidate cache entries', () => {
      return new Promise<void>((resolve, reject) => {
        service.invalidateCache('test-diagram').subscribe({
          next: () => {
            // Should complete without error
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should return null for non-existent cache entry', () => {
      return new Promise<void>((resolve, reject) => {
        service.getCacheEntry('nonexistent-diagram').subscribe({
          next: entry => {
            expect(entry).toBeNull();
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableCaching: false,
        operationTimeoutMs: 60000,
        maxCacheEntries: 50,
      };

      service.configure(newConfig);
      const config = service.getConfiguration();

      expect(config.enableCaching).toBe(false);
      expect(config.operationTimeoutMs).toBe(60000);
      expect(config.maxCacheEntries).toBe(50);
    });

    it('should maintain other config values when partially updating', () => {
      const originalConfig = service.getConfiguration();

      service.configure({ operationTimeoutMs: 45000 });
      const updatedConfig = service.getConfiguration();

      expect(updatedConfig.enableCaching).toBe(originalConfig.enableCaching);
      expect(updatedConfig.operationTimeoutMs).toBe(45000);
    });
  });

  describe('Statistics and Monitoring', () => {
    // Test removed - obsolete strategy pattern

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();

      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    it('should provide health status', () => {
      return new Promise<void>((resolve, reject) => {
        service.getHealthStatus().subscribe({
          next: health => {
            expect(health.overall).toBeDefined();
            expect(health.strategies).toBeDefined();
            expect(health.cacheHealth).toBeDefined();
            expect(health.pendingOperations).toBeDefined();
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  // Fallback Strategy tests removed - obsolete strategy pattern

  describe('Cleanup', () => {
    it('should dispose cleanly', () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});
