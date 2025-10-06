/**
 * Test suite for AppAutoSaveManager (History-Based, Zero-Debouncing Architecture)
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, Observable } from 'rxjs';

import { AppAutoSaveManager } from './app-auto-save-manager.service';
import { AutoSaveContext } from '../../types/auto-save.types';
import { SaveResult } from '../../types/persistence.types';

describe('AppAutoSaveManager (History-Based)', () => {
  let service: AppAutoSaveManager;
  let mockLogger: any;
  let mockPersistenceCoordinator: any;
  let autoSaveContext: AutoSaveContext;

  beforeEach(() => {
    // Create logger spy
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create persistence coordinator spy
    mockPersistenceCoordinator = {
      save: vi.fn(),
      load: vi.fn(),
      sync: vi.fn(),
    };

    // Create service
    service = new AppAutoSaveManager(mockLogger, mockPersistenceCoordinator);

    // Create auto-save context with lazy data callback
    autoSaveContext = {
      diagramId: 'test-diagram',
      threatModelId: 'test-tm',
      userId: 'test-user',
      userEmail: 'test@example.com',
      userName: 'Test User',
      getDiagramData: () => ({ nodes: [{ id: 'node1' }], edges: [{ id: 'edge1' }] }),
      preferredStrategy: 'rest',
    };
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should have default policy with auto mode', () => {
      const policy = service.getPolicy();
      expect(policy.mode).toBe('auto');
      expect(policy.maxQueueDepth).toBe(100);
      expect(policy.maxRetryAttempts).toBe(3);
    });

    it('should have initial save tracking state', () => {
      const tracking = service.getSaveTracking();
      expect(tracking.localHistoryIndex).toBe(0);
      expect(tracking.lastSavedHistoryIndex).toBe(-1);
      expect(tracking.serverUpdateVector).toBe(0);
      expect(tracking.lastSavedUpdateVector).toBe(0);
      expect(tracking.saveInProgress).toBe(false);
      expect(tracking.pendingHistoryChanges).toBe(0);
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should allow enabling and disabling', () => {
      service.disable();
      expect(service.isEnabled()).toBe(false);

      service.enable();
      expect(service.isEnabled()).toBe(true);
    });

    it('should not trigger saves when disabled', () => {
      service.disable();

      return new Promise<void>((resolve, reject) => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          next: result => {
            expect(result).toBe(false);
            expect(mockPersistenceCoordinator.save).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Policy Management', () => {
    it('should allow setting policy mode', () => {
      service.setPolicyMode('manual');
      const policy = service.getPolicy();
      expect(policy.mode).toBe('manual');
    });

    it('should allow setting full policy', () => {
      service.setPolicy({
        mode: 'manual',
        maxQueueDepth: 50,
        maxRetryAttempts: 5,
      });

      const policy = service.getPolicy();
      expect(policy.mode).toBe('manual');
      expect(policy.maxQueueDepth).toBe(50);
      expect(policy.maxRetryAttempts).toBe(5);
    });
  });

  describe('History-Based Triggers', () => {
    let saveResult: SaveResult;

    beforeEach(() => {
      saveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: { update_vector: 1 },
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));
    });

    it('should trigger save for new history index', () => {
      return new Promise<void>((resolve, reject) => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          next: result => {
            expect(result).toBe(true);
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should deduplicate already-saved history index', () => {
      // First save at index 1
      return service
        .trigger(1, autoSaveContext, false, false)
        .toPromise()
        .then(() => {
          // Try to save same index again
          return new Promise<void>((resolve, reject) => {
            service.trigger(1, autoSaveContext, false, false).subscribe({
              next: result => {
                expect(result).toBe(false);
                expect(mockPersistenceCoordinator.save).toHaveBeenCalledTimes(1);
                resolve();
              },
              error: reject,
            });
          });
        });
    });

    it('should track history index and update_vector after save', () => {
      return new Promise<void>((resolve, reject) => {
        service.trigger(5, autoSaveContext, false, false).subscribe({
          next: () => {
            const tracking = service.getSaveTracking();
            expect(tracking.lastSavedHistoryIndex).toBe(5);
            expect(tracking.serverUpdateVector).toBe(1);
            expect(tracking.lastSavedUpdateVector).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should mark undo operations in metadata', () => {
      return new Promise<void>((resolve, reject) => {
        service.trigger(2, autoSaveContext, true, false).subscribe({
          next: () => {
            const saveCall = mockPersistenceCoordinator.save.mock.calls[0][0];
            expect(saveCall.metadata.isUndo).toBe(true);
            expect(saveCall.metadata.isRedo).toBe(false);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should mark redo operations in metadata', () => {
      return new Promise<void>((resolve, reject) => {
        service.trigger(2, autoSaveContext, false, true).subscribe({
          next: () => {
            const saveCall = mockPersistenceCoordinator.save.mock.calls[0][0];
            expect(saveCall.metadata.isUndo).toBe(false);
            expect(saveCall.metadata.isRedo).toBe(true);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Queue Management', () => {
    it('should prevent concurrent saves', done => {
      // Return an observable that emits after a delay
      mockPersistenceCoordinator.save.mockReturnValue(
        new Observable(subscriber => {
          setTimeout(() => {
            subscriber.next({ success: true, operationId: 'slow', metadata: {} });
            subscriber.complete();
          }, 100);
        }),
      );

      // Start first save
      service.trigger(1, autoSaveContext, false, false).subscribe();

      // Immediately try second save while first is in progress
      service.trigger(2, autoSaveContext, false, false).subscribe({
        next: result => {
          expect(result).toBe(false); // Should not trigger while save in progress
          done();
        },
        error: done,
      });
    });

    it('should enforce max queue depth', () => {
      service.setPolicy({ mode: 'auto', maxQueueDepth: 5, maxRetryAttempts: 3 });

      return new Promise<void>((resolve, reject) => {
        // Try to save with queue depth > 5 (index 10 when lastSaved is -1)
        service.trigger(10, autoSaveContext, false, false).subscribe({
          next: result => {
            expect(result).toBe(false); // Should reject due to queue depth
            resolve();
          },
          error: reject,
        });
      });
    });

  });

  describe('Manual Save', () => {
    it('should execute manual save successfully', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'manual-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: result => {
            expect(result.success).toBe(true);
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit save completed event', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'manual-save',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>(resolve => {
        service.saveCompleted$.subscribe(result => {
          expect(result.success).toBe(true);
          resolve();
        });

        service.triggerManualSave(autoSaveContext).subscribe();
      });
    });
  });

  describe('Server Update Vector Tracking', () => {
    it('should update server update_vector', () => {
      service.updateServerUpdateVector(42);
      const tracking = service.getSaveTracking();
      expect(tracking.serverUpdateVector).toBe(42);
    });

    it('should extract update_vector from save response', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: { update_vector: 99 },
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, reject) => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          next: () => {
            const tracking = service.getSaveTracking();
            expect(tracking.serverUpdateVector).toBe(99);
            expect(tracking.lastSavedUpdateVector).toBe(99);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle save failures', () => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.mockReturnValue(throwError(() => error));

      return new Promise<void>((resolve, reject) => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: err => {
            expect(err.message).toBe('Save failed');
            resolve();
          },
        });
      });
    });

    it('should emit save failed events', () => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.mockReturnValue(throwError(() => error));

      return new Promise<void>(resolve => {
        service.saveFailed$.subscribe(failure => {
          expect(failure.error).toContain('Save failed');
          resolve();
        });

        service.trigger(1, autoSaveContext, false, false).subscribe({
          error: () => {}, // Ignore error
        });
      });
    });

    it('should reset saveInProgress flag on error', () => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.mockReturnValue(throwError(() => error));

      return new Promise<void>(resolve => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          error: () => {
            const tracking = service.getSaveTracking();
            expect(tracking.saveInProgress).toBe(false);
            resolve();
          },
        });
      });
    });
  });

  describe('Statistics', () => {
    it('should track save statistics', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, reject) => {
        service.trigger(1, autoSaveContext, false, false).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalSaves).toBe(1);
            expect(stats.successfulSaves).toBe(1);
            expect(stats.autoSaves).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should reset statistics', () => {
      service.resetStats();
      const stats = service.getStats();
      expect(stats.totalSaves).toBe(0);
      expect(stats.successfulSaves).toBe(0);
      expect(stats.failedSaves).toBe(0);
    });
  });

  describe('State Observables', () => {
    it('should emit save completed events', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>(resolve => {
        service.saveCompleted$.subscribe(result => {
          expect(result.success).toBe(true);
          resolve();
        });

        service.trigger(1, autoSaveContext, false, false).subscribe();
      });
    });
  });
});
