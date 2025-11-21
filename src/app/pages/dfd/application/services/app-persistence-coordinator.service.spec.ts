/**
 * Test suite for AppPersistenceCoordinator (Simplified)
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import {
  AppPersistenceCoordinator,
  SaveOperation,
  LoadOperation,
} from './app-persistence-coordinator.service';

describe('AppPersistenceCoordinator', () => {
  let service: AppPersistenceCoordinator;
  let mockLogger: any;
  let mockLocalStorageAdapter: any;
  let mockRestStrategy: any;
  let mockWebSocketStrategy: any;

  beforeEach(() => {
    // Create logger spy
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create localStorage adapter mock
    mockLocalStorageAdapter = {
      saveDiagram: vi.fn().mockReturnValue(of(true)),
      loadDiagram: vi.fn().mockReturnValue(of(null)),
    };

    // Create REST strategy mock
    mockRestStrategy = {
      type: 'rest',
      save: vi.fn().mockReturnValue(
        of({
          success: true,
          operationId: 'rest-save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
        }),
      ),
      load: vi.fn().mockReturnValue(
        of({
          success: true,
          diagramId: 'test-diagram',
          data: { cells: [] },
          source: 'api',
          timestamp: Date.now(),
        }),
      ),
    };

    // Create WebSocket strategy mock
    mockWebSocketStrategy = {
      type: 'websocket',
      save: vi.fn().mockReturnValue(
        of({
          success: true,
          operationId: 'ws-save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
        }),
      ),
      load: vi.fn().mockReturnValue(throwError(() => new Error('WebSocket does not support load'))),
    };

    // Create service directly
    service = new AppPersistenceCoordinator(
      mockLogger,
      mockLocalStorageAdapter,
      mockRestStrategy,
      mockWebSocketStrategy,
    );
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with zero statistics', () => {
      const stats = service.getStats();
      expect(stats.totalSaves).toBe(0);
      expect(stats.successfulSaves).toBe(0);
      expect(stats.failedSaves).toBe(0);
      expect(stats.totalLoads).toBe(0);
      expect(stats.successfulLoads).toBe(0);
      expect(stats.failedLoads).toBe(0);
    });
  });

  describe('Save Operations', () => {
    const saveOperation: SaveOperation = {
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
      data: { nodes: [], edges: [] },
    };

    it('should save via REST when useWebSocket=false', () => {
      return new Promise<void>((resolve, reject) => {
        service.save(saveOperation, false).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(mockRestStrategy.save).toHaveBeenCalledWith(saveOperation);
            expect(mockWebSocketStrategy.save).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should save via WebSocket when useWebSocket=true', () => {
      return new Promise<void>((resolve, reject) => {
        service.save(saveOperation, true).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(mockWebSocketStrategy.save).toHaveBeenCalledWith(saveOperation);
            expect(mockRestStrategy.save).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit save status events', () => {
      return new Promise<void>((resolve, reject) => {
        const statusEvents: any[] = [];

        service.saveStatus$.subscribe(event => {
          statusEvents.push(event);
        });

        service.save(saveOperation, false).subscribe({
          next: () => {
            expect(statusEvents.length).toBeGreaterThanOrEqual(2);
            expect(statusEvents[0].status).toBe('saving');
            expect(statusEvents[statusEvents.length - 1].status).toBe('saved');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track save statistics on success', () => {
      return new Promise<void>((resolve, reject) => {
        service.save(saveOperation, false).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalSaves).toBe(1);
            expect(stats.successfulSaves).toBe(1);
            expect(stats.failedSaves).toBe(0);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track save statistics on failure', () => {
      return new Promise<void>((resolve, reject) => {
        mockRestStrategy.save.mockReturnValue(
          of({
            success: false,
            operationId: 'save-123',
            diagramId: 'test-diagram',
            timestamp: Date.now(),
            error: 'Save failed',
          }),
        );

        service.save(saveOperation, false).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalSaves).toBe(1);
            expect(stats.successfulSaves).toBe(0);
            expect(stats.failedSaves).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit error status on save failure', () => {
      return new Promise<void>((resolve, reject) => {
        const statusEvents: any[] = [];

        service.saveStatus$.subscribe(event => {
          statusEvents.push(event);
        });

        mockRestStrategy.save.mockReturnValue(
          of({
            success: false,
            operationId: 'save-123',
            diagramId: 'test-diagram',
            timestamp: Date.now(),
            error: 'Save failed',
          }),
        );

        service.save(saveOperation, false).subscribe({
          next: () => {
            const errorEvent = statusEvents.find(e => e.status === 'error');
            expect(errorEvent).toBeDefined();
            expect(errorEvent?.error).toBe('Save failed');
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Save to LocalStorage', () => {
    it('should save to localStorage adapter', () => {
      return new Promise<void>((resolve, reject) => {
        service.saveToLocalStorage('test-diagram', 'test-tm', { cells: [] }).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(mockLocalStorageAdapter.saveDiagram).toHaveBeenCalledWith(
              'test-diagram',
              'test-tm',
              {
                cells: [],
              },
            );
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track localStorage save statistics', () => {
      return new Promise<void>((resolve, reject) => {
        service.saveToLocalStorage('test-diagram', 'test-tm', { cells: [] }).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.successfulSaves).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Load Operations', () => {
    const loadOperation: LoadOperation = {
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
    };

    it('should load from REST API', () => {
      return new Promise<void>((resolve, reject) => {
        service.load(loadOperation).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(mockRestStrategy.load).toHaveBeenCalledWith(loadOperation);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track load statistics on success', () => {
      return new Promise<void>((resolve, reject) => {
        service.load(loadOperation).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalLoads).toBe(1);
            expect(stats.successfulLoads).toBe(1);
            expect(stats.failedLoads).toBe(0);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track load statistics on failure', () => {
      return new Promise<void>((resolve, reject) => {
        mockRestStrategy.load.mockReturnValue(throwError(() => new Error('Load failed')));

        service.load(loadOperation).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: () => {
            const stats = service.getStats();
            expect(stats.totalLoads).toBe(1);
            expect(stats.successfulLoads).toBe(0);
            expect(stats.failedLoads).toBe(1);
            resolve();
          },
        });
      });
    });

    it('should fallback to localStorage when allowed and REST fails', () => {
      return new Promise<void>((resolve, reject) => {
        mockRestStrategy.load.mockReturnValue(throwError(() => new Error('REST failed')));
        mockLocalStorageAdapter.loadDiagram.mockReturnValue(
          of({
            diagramId: 'test-diagram',
            threatModelId: 'test-tm',
            data: { cells: [] },
            timestamp: Date.now(),
          }),
        );

        service.load(loadOperation, true).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(result.source).toBe('local-storage');
            expect(mockLocalStorageAdapter.loadDiagram).toHaveBeenCalledWith('test-diagram');
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should not fallback to localStorage when not allowed', () => {
      return new Promise<void>((resolve, reject) => {
        mockRestStrategy.load.mockReturnValue(throwError(() => new Error('REST failed')));

        service.load(loadOperation, false).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: error => {
            expect(error.message).toBe('REST failed');
            expect(mockLocalStorageAdapter.loadDiagram).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track multiple operations', () => {
      return new Promise<void>((resolve, reject) => {
        const saveOp: SaveOperation = {
          diagramId: 'test-diagram',
          threatModelId: 'test-tm',
          data: {},
        };
        const loadOp: LoadOperation = {
          diagramId: 'test-diagram',
          threatModelId: 'test-tm',
        };

        service.save(saveOp, false).subscribe({
          next: () => {
            service.load(loadOp).subscribe({
              next: () => {
                const stats = service.getStats();
                expect(stats.totalSaves).toBe(1);
                expect(stats.totalLoads).toBe(1);
                resolve();
              },
              error: reject,
            });
          },
          error: reject,
        });
      });
    });

    it('should reset statistics', () => {
      const saveOp: SaveOperation = {
        diagramId: 'test-diagram',
        threatModelId: 'test-tm',
        data: {},
      };

      service.save(saveOp, false).subscribe(() => {
        service.resetStats();
        const stats = service.getStats();
        expect(stats.totalSaves).toBe(0);
        expect(stats.successfulSaves).toBe(0);
        expect(stats.failedSaves).toBe(0);
      });
    });
  });

  describe('Cleanup', () => {
    it('should dispose observables', () => {
      service.dispose();
      // Should complete without error
      expect(true).toBe(true);
    });
  });
});
