/**
 * Test suite for PersistenceCoordinator
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { PersistenceCoordinator } from './persistence-coordinator.service';
import { LoggerService } from '../../../../core/services/logger.service';
import {
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
  PersistenceStrategy,
  CacheStatus
} from '../types/persistence.types';

describe('PersistenceCoordinator', () => {
  let service: PersistenceCoordinator;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockStrategy: jasmine.SpyObj<PersistenceStrategy>;

  beforeEach(() => {
    // Create logger spy
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'info', 'debug', 'warn', 'error'
    ]);

    // Create strategy spy
    mockStrategy = jasmine.createSpyObj('PersistenceStrategy', [
      'save', 'load', 'sync'
    ], {
      type: 'test-strategy',
      priority: 100
    });

    TestBed.configureTestingModule({
      providers: [
        PersistenceCoordinator,
        { provide: LoggerService, useValue: mockLogger }
      ]
    });

    service = TestBed.inject(PersistenceCoordinator);
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
      expect(strategies).toHaveSize(1);
    });

    it('should allow removing strategies', () => {
      service.addStrategy(mockStrategy);
      service.removeStrategy('test-strategy');
      const strategies = service.getStrategies();
      
      expect(strategies).not.toContain(mockStrategy);
      expect(strategies).toHaveSize(0);
    });

    it('should sort strategies by priority', () => {
      const lowPriorityStrategy = jasmine.createSpyObj('LowStrategy', 
        ['save', 'load'], { type: 'low', priority: 50 });
      const highPriorityStrategy = jasmine.createSpyObj('HighStrategy', 
        ['save', 'load'], { type: 'high', priority: 150 });

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
        metadata: { userId: 'test-user' }
      };

      expectedResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      service.addStrategy(mockStrategy);
    });

    it('should execute save operation successfully', (done) => {
      mockStrategy.save.and.returnValue(of(expectedResult));

      service.save(saveOperation).subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(true);
          expect(result.diagramId).toBe('test-diagram');
          expect(mockStrategy.save).toHaveBeenCalledWith(saveOperation);
          done();
        },
        error: done.fail
      });
    });

    it('should handle save operation failure', (done) => {
      const errorResult: SaveResult = {
        success: false,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        error: 'Save failed',
        metadata: {}
      };

      mockStrategy.save.and.returnValue(of(errorResult));

      service.save(saveOperation).subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(false);
          expect(result.error).toBe('Save failed');
          done();
        },
        error: done.fail
      });
    });

    it('should emit save status events', (done) => {
      mockStrategy.save.and.returnValue(of(expectedResult));

      // Subscribe to save status
      service.saveStatus$.subscribe(status => {
        if (status.status === 'saving') {
          expect(status.diagramId).toBe('test-diagram');
          done();
        }
      });

      service.save(saveOperation).subscribe();
    });

    it('should handle strategy not found error', (done) => {
      const invalidOperation: SaveOperation = {
        ...saveOperation,
        strategyType: 'nonexistent-strategy'
      };

      service.save(invalidOperation).subscribe({
        next: () => done.fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('not found');
          done();
        }
      });
    });

    it('should update cache on successful save', (done) => {
      mockStrategy.save.and.returnValue(of(expectedResult));
      
      service.save(saveOperation).subscribe({
        next: () => {
          // Check cache was updated
          service.getCacheStatus(saveOperation.diagramId).subscribe(status => {
            expect(status.status).toBe('valid');
            done();
          });
        },
        error: done.fail
      });
    });
  });

  describe('Load Operations', () => {
    let loadOperation: LoadOperation;
    let expectedResult: LoadResult;

    beforeEach(() => {
      loadOperation = {
        diagramId: 'test-diagram',
        strategyType: 'test-strategy',
        useCache: false
      };

      expectedResult = {
        success: true,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        timestamp: Date.now(),
        metadata: {}
      };

      service.addStrategy(mockStrategy);
    });

    it('should execute load operation successfully', (done) => {
      mockStrategy.load.and.returnValue(of(expectedResult));

      service.load(loadOperation).subscribe({
        next: (result: LoadResult) => {
          expect(result.success).toBe(true);
          expect(result.diagramId).toBe('test-diagram');
          expect(mockStrategy.load).toHaveBeenCalledWith(loadOperation);
          done();
        },
        error: done.fail
      });
    });

    it('should return cached result when available and valid', (done) => {
      // First, save some data to populate cache
      const saveOp: SaveOperation = {
        diagramId: 'test-diagram',
        data: { nodes: ['node1'], edges: ['edge1'] },
        strategyType: 'test-strategy'
      };

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      service.save(saveOp).subscribe(() => {
        // Now try to load with cache enabled
        const cachedLoadOp: LoadOperation = {
          ...loadOperation,
          useCache: true
        };

        service.load(cachedLoadOp).subscribe({
          next: (result: LoadResult) => {
            expect(result.success).toBe(true);
            expect(result.fromCache).toBe(true);
            expect(result.data).toEqual({ nodes: ['node1'], edges: ['edge1'] });
            // Strategy should not be called for cached result
            expect(mockStrategy.load).not.toHaveBeenCalled();
            done();
          },
          error: done.fail
        });
      });
    });

    it('should bypass cache when useCache is false', (done) => {
      mockStrategy.load.and.returnValue(of(expectedResult));

      const noCacheLoadOp: LoadOperation = {
        ...loadOperation,
        useCache: false
      };

      service.load(noCacheLoadOp).subscribe({
        next: (result: LoadResult) => {
          expect(result.success).toBe(true);
          expect(result.fromCache).toBeFalsy();
          expect(mockStrategy.load).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should handle load operation failure', (done) => {
      const errorResult: LoadResult = {
        success: false,
        operationId: 'load-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        error: 'Load failed',
        metadata: {}
      };

      mockStrategy.load.and.returnValue(of(errorResult));

      service.load(loadOperation).subscribe({
        next: (result: LoadResult) => {
          expect(result.success).toBe(false);
          expect(result.error).toBe('Load failed');
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Sync Operations', () => {
    let syncOperation: SyncOperation;
    let expectedResult: SyncResult;

    beforeEach(() => {
      syncOperation = {
        diagramId: 'test-diagram',
        strategyType: 'test-strategy',
        lastSyncTimestamp: Date.now() - 10000
      };

      expectedResult = {
        success: true,
        operationId: 'sync-123',
        diagramId: 'test-diagram',
        hasChanges: false,
        timestamp: Date.now(),
        metadata: {}
      };

      service.addStrategy(mockStrategy);
    });

    it('should execute sync operation successfully', (done) => {
      mockStrategy.sync.and.returnValue(of(expectedResult));

      service.sync(syncOperation).subscribe({
        next: (result: SyncResult) => {
          expect(result.success).toBe(true);
          expect(result.diagramId).toBe('test-diagram');
          expect(mockStrategy.sync).toHaveBeenCalledWith(syncOperation);
          done();
        },
        error: done.fail
      });
    });

    it('should handle sync operation failure', (done) => {
      const errorResult: SyncResult = {
        success: false,
        operationId: 'sync-123',
        diagramId: 'test-diagram',
        hasChanges: false,
        timestamp: Date.now(),
        error: 'Sync failed',
        metadata: {}
      };

      mockStrategy.sync.and.returnValue(of(errorResult));

      service.sync(syncOperation).subscribe({
        next: (result: SyncResult) => {
          expect(result.success).toBe(false);
          expect(result.error).toBe('Sync failed');
          done();
        },
        error: done.fail
      });
    });

    it('should handle strategy without sync support', (done) => {
      mockStrategy.sync = undefined as any;

      service.sync(syncOperation).subscribe({
        next: () => done.fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('does not support sync');
          done();
        }
      });
    });
  });

  describe('Batch Operations', () => {
    beforeEach(() => {
      service.addStrategy(mockStrategy);
    });

    it('should execute batch save operations', (done) => {
      const operations: SaveOperation[] = [
        {
          diagramId: 'diagram-1',
          data: { nodes: [], edges: [] },
          strategyType: 'test-strategy'
        },
        {
          diagramId: 'diagram-2',
          data: { nodes: [], edges: [] },
          strategyType: 'test-strategy'
        }
      ];

      mockStrategy.save.and.returnValues(
        of({
          success: true,
          operationId: 'save-1',
          diagramId: 'diagram-1',
          timestamp: Date.now(),
          metadata: {}
        }),
        of({
          success: true,
          operationId: 'save-2',
          diagramId: 'diagram-2',
          timestamp: Date.now(),
          metadata: {}
        })
      );

      service.saveBatch(operations).subscribe({
        next: (results: SaveResult[]) => {
          expect(results).toHaveSize(2);
          expect(results[0].diagramId).toBe('diagram-1');
          expect(results[1].diagramId).toBe('diagram-2');
          expect(mockStrategy.save).toHaveBeenCalledTimes(2);
          done();
        },
        error: done.fail
      });
    });

    it('should execute batch load operations', (done) => {
      const operations: LoadOperation[] = [
        {
          diagramId: 'diagram-1',
          strategyType: 'test-strategy',
          useCache: false
        },
        {
          diagramId: 'diagram-2',
          strategyType: 'test-strategy',
          useCache: false
        }
      ];

      mockStrategy.load.and.returnValues(
        of({
          success: true,
          operationId: 'load-1',
          diagramId: 'diagram-1',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {}
        }),
        of({
          success: true,
          operationId: 'load-2',
          diagramId: 'diagram-2',
          data: { nodes: [], edges: [] },
          timestamp: Date.now(),
          metadata: {}
        })
      );

      service.loadBatch(operations).subscribe({
        next: (results: LoadResult[]) => {
          expect(results).toHaveSize(2);
          expect(results[0].diagramId).toBe('diagram-1');
          expect(results[1].diagramId).toBe('diagram-2');
          expect(mockStrategy.load).toHaveBeenCalledTimes(2);
          done();
        },
        error: done.fail
      });
    });

    it('should handle empty batch operations', (done) => {
      service.saveBatch([]).subscribe({
        next: (results: SaveResult[]) => {
          expect(results).toHaveSize(0);
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Cache Management', () => {
    it('should return empty cache status for non-existent diagram', (done) => {
      service.getCacheStatus('nonexistent-diagram').subscribe({
        next: (status: CacheStatus) => {
          expect(status.status).toBe('empty');
          expect(status.diagramId).toBe('nonexistent-diagram');
          done();
        },
        error: done.fail
      });
    });

    it('should clear cache for specific diagram', (done) => {
      service.clearCache('test-diagram').subscribe({
        next: () => {
          // Should complete without error
          done();
        },
        error: done.fail
      });
    });

    it('should clear all cache entries', (done) => {
      service.clearCache().subscribe({
        next: () => {
          // Should complete without error
          done();
        },
        error: done.fail
      });
    });

    it('should invalidate cache entries', (done) => {
      service.invalidateCache('test-diagram').subscribe({
        next: () => {
          // Should complete without error
          done();
        },
        error: done.fail
      });
    });

    it('should return null for non-existent cache entry', (done) => {
      service.getCacheEntry('nonexistent-diagram').subscribe({
        next: (entry) => {
          expect(entry).toBeNull();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableCaching: false,
        operationTimeoutMs: 60000,
        maxCacheEntries: 50
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
    it('should track operation statistics', (done) => {
      service.addStrategy(mockStrategy);
      
      const saveOperation: SaveOperation = {
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        strategyType: 'test-strategy'
      };

      mockStrategy.save.and.returnValue(of({
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      service.save(saveOperation).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.totalOperations).toBe(1);
          expect(stats.successfulOperations).toBe(1);
          expect(stats.failedOperations).toBe(0);
          done();
        },
        error: done.fail
      });
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();
      
      expect(stats.totalOperations).toBe(0);
      expect(stats.successfulOperations).toBe(0);
      expect(stats.failedOperations).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });

    it('should provide health status', (done) => {
      service.getHealthStatus().subscribe({
        next: (health) => {
          expect(health.overall).toBeDefined();
          expect(health.strategies).toBeDefined();
          expect(health.cacheHealth).toBeDefined();
          expect(health.pendingOperations).toBeDefined();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Fallback Strategy', () => {
    it('should use fallback strategy when primary fails', (done) => {
      const fallbackStrategy = jasmine.createSpyObj('FallbackStrategy', 
        ['save', 'load'], { type: 'fallback', priority: 50 });

      service.addStrategy(mockStrategy);
      service.addStrategy(fallbackStrategy);
      service.setFallbackStrategy('fallback');

      const saveOperation: SaveOperation = {
        diagramId: 'test-diagram',
        data: { nodes: [], edges: [] },
        strategyType: 'test-strategy'
      };

      const successResult: SaveResult = {
        success: true,
        operationId: 'fallback-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      // Primary strategy fails
      mockStrategy.save.and.returnValue(throwError(() => new Error('Primary failed')));
      // Fallback succeeds
      fallbackStrategy.save.and.returnValue(of(successResult));

      service.save(saveOperation).subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(true);
          expect(fallbackStrategy.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Cleanup', () => {
    it('should dispose cleanly', () => {
      expect(() => service.dispose()).not.toThrow();
    });
  });
});