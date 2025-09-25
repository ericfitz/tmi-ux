/**
 * Test suite for AppAutoSaveManager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';

import { AppAutoSaveManager } from './app-auto-save-manager.service';
import {
  AutoSaveTriggerEvent,
  AutoSaveContext,
  AutoSavePolicy,
  ChangeAnalyzer,
  SaveDecisionMaker,
} from '../../types/auto-save.types';
import { SaveResult } from '../../types/persistence.types';

describe('AppAutoSaveManager', () => {
  let service: AppAutoSaveManager;
  let mockLogger: any;
  let mockPersistenceCoordinator: any;
  let autoSaveContext: AutoSaveContext;

  beforeEach(() => {
    // Use fake timers for debouncing tests
    vi.useFakeTimers();

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

    // Create service directly without TestBed
    service = new AppAutoSaveManager(mockLogger, mockPersistenceCoordinator);

    // Create auto-save context
    autoSaveContext = {
      diagramId: 'test-diagram',
      userId: 'test-user',
      diagramData: { nodes: [], edges: [] },
      preferredStrategy: 'websocket',
    };
  });

  afterEach(() => {
    // Restore real timers
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should be enabled by default', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should have default policy', () => {
      const policy = service.getPolicy();
      expect(policy.mode).toBe('normal');
      expect(policy.changeThreshold).toBeGreaterThan(0);
      expect(policy.timeThresholdMs).toBeGreaterThan(0);
    });

    it('should have initial state', () => {
      const state = service.getState();
      expect(state.enabled).toBe(true);
      expect(state.pendingSave).toBe(false);
      expect(state.lastSaveTime).toBeNull();
      expect(state.changesSinceLastSave).toBe(0);
    });
  });

  describe('Enable/Disable Functionality', () => {
    it('should allow enabling and disabling', () => {
      service.disable();
      expect(service.isEnabled()).toBe(false);

      service.enable();
      expect(service.isEnabled()).toBe(true);
    });

    it('should update state when enabled/disabled', () => {
      service.disable();
      let state = service.getState();
      expect(state.enabled).toBe(false);

      service.enable();
      state = service.getState();
      expect(state.enabled).toBe(true);
    });

    it('should ignore triggers when disabled', () => {
      service.disable();

      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: result => {
            expect(result).toBe(false);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Policy Management', () => {
    it('should allow setting policy', () => {
      const newPolicy: AutoSavePolicy = {
        mode: 'aggressive',
        changeThreshold: 1,
        timeThresholdMs: 5000,
        maxDelayMs: 10000,
      };

      service.setPolicy(newPolicy);
      const policy = service.getPolicy();

      expect(policy.mode).toBe('aggressive');
      expect(policy.changeThreshold).toBe(1);
      expect(policy.timeThresholdMs).toBe(5000);
    });

    it('should allow setting policy mode only', () => {
      service.setPolicyMode('conservative');
      const policy = service.getPolicy();

      expect(policy.mode).toBe('conservative');
    });

    it('should update state when policy changes', () => {
      service.setPolicyMode('aggressive');
      const state = service.getState();

      expect(state.mode).toBe('aggressive');
    });
  });

  describe('Manual Save', () => {
    let saveResult: SaveResult;

    beforeEach(() => {
      saveResult = {
        success: true,
        operationId: 'manual-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };
    });

    it('should execute manual save successfully', () => {
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: (result: SaveResult) => {
            expect(result.success).toBe(true);
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should update state after successful manual save', () => {
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.manualSaves).toBe(1);

            const state = service.getState();
            expect(state.changesSinceLastSave).toBe(0);
            expect(state.lastSaveTime).not.toBeNull();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should cancel pending auto-save when manual save triggered', () => {
      // First trigger an auto-save that would be delayed
      service.setPolicyMode('conservative');

      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      // This should not trigger immediate save in conservative mode
      service.trigger(triggerEvent, autoSaveContext).subscribe();

      // Now trigger manual save
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));
      return new Promise<void>((resolve, _reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: () => {
            expect(service.isPendingSave()).toBe(false);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit save completed event', () => {
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.saveCompleted$.subscribe(result => {
          expect(result.success).toBe(true);
          resolve();
        });

        service.triggerManualSave(autoSaveContext).subscribe();
      });
    });
  });

  describe('Auto-Save Triggers', () => {
    let triggerEvent: AutoSaveTriggerEvent;
    let saveResult: SaveResult;

    beforeEach(() => {
      triggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      saveResult = {
        success: true,
        operationId: 'auto-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };

      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));
    });

    it('should trigger auto-save in aggressive mode', () => {
      service.setPolicyMode('aggressive');
      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: result => {
            // Trigger returns boolean, not SaveResult
            expect(result).toBe(true);
            // Advance timers to trigger debounced save
            vi.advanceTimersByTime(100); // aggressive mode debounce is 100ms
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should not trigger auto-save when disabled', () => {
      service.disable();

      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: _result => {
            expect(_result).toBe(false);
            expect(mockPersistenceCoordinator.save).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should track change count', () => {
      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: () => {
            const state = service.getState();
            expect(state.changesSinceLastSave).toBe(1);
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should emit trigger events', () => {
      return new Promise<void>((resolve, _reject) => {
        service.events$.subscribe(event => {
          if (event.type === 'trigger-received') {
            expect(event.triggerEvent).toBe(triggerEvent);
            expect(event.context).toBe(autoSaveContext);
            resolve();
          }
        });

        service.trigger(triggerEvent, autoSaveContext).subscribe();
      });
    });
  });

  describe('Save Decision Making', () => {
    let triggerEvent: AutoSaveTriggerEvent;

    beforeEach(() => {
      triggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };
    });

    it('should save immediately in aggressive mode', () => {
      service.setPolicyMode('aggressive');
      mockPersistenceCoordinator.save.mockReturnValue(
        of({
          success: true,
          operationId: 'save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: result => {
            expect(result).toBe(true); // Should trigger save
            // Advance timers to trigger the debounced save
            vi.advanceTimersByTime(150); // Wait for 100ms debounce + buffer
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should be conservative in conservative mode', () => {
      service.setPolicyMode('conservative');

      // Single change should not trigger save in conservative mode
      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: result => {
            expect(result).toBe(false); // No immediate save
            expect(mockPersistenceCoordinator.save).not.toHaveBeenCalled();
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should respect change threshold in normal mode', () => {
      service.setPolicyMode('normal');
      const policy = service.getPolicy();

      // Set a high change threshold
      service.setPolicy({ ...policy, changeThreshold: 5 });

      mockPersistenceCoordinator.save.mockReturnValue(
        of({
          success: true,
          operationId: 'save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      // Trigger multiple changes
      let completedTriggers = 0;
      const totalTriggers = 6; // One more than threshold

      return new Promise<void>((resolve, _reject) => {
        for (let i = 0; i < totalTriggers; i++) {
          service.trigger(triggerEvent, autoSaveContext).subscribe({
            next: _result => {
              completedTriggers++;

              if (completedTriggers === totalTriggers) {
                // Should have triggered save when threshold was reached
                // Wait for debounced save to execute
                vi.advanceTimersByTime(1100); // Wait for 1000ms debounce + buffer
                expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
                resolve();
              }
            },
            error: reject,
          });
        }
      });
    });
  });

  describe('Force Save', () => {
    it('should bypass all policies and save immediately', () => {
      service.setPolicyMode('manual'); // Use valid policy mode

      const saveResult: SaveResult = {
        success: true,
        operationId: 'force-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };

      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.forceSave(autoSaveContext).subscribe({
          next: (result: SaveResult) => {
            expect(result.success).toBe(true);
            expect(mockPersistenceCoordinator.save).toHaveBeenCalled();

            const stats = service.getStats();
            expect(stats.manualSaves).toBe(1); // Force save counts as manual save
            resolve();
          },
          error: reject,
        });
      });
    });

    it('should cancel pending save before forcing', () => {
      // Set up a pending save
      service.setPolicyMode('conservative');

      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      service.trigger(triggerEvent, autoSaveContext).subscribe();

      // Now force save
      mockPersistenceCoordinator.save.mockReturnValue(
        of({
          success: true,
          operationId: 'force-save-123',
          diagramId: 'test-diagram',
          timestamp: Date.now(),
          metadata: {},
        }),
      );

      return new Promise<void>((resolve, _reject) => {
        service.forceSave(autoSaveContext).subscribe({
          next: () => {
            expect(service.isPendingSave()).toBe(false);
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('Pending Save Management', () => {
    it('should track pending saves', () => {
      expect(service.isPendingSave()).toBe(false);
      expect(service.getNextScheduledSave()).toBeNull();
    });

    it('should allow cancelling pending saves', () => {
      // Initially no pending save
      expect(service.cancelPendingSave()).toBe(false);
    });
  });

  describe('Component Extension', () => {
    it('should allow adding change analyzers', () => {
      const mockAnalyzer: ChangeAnalyzer = {
        priority: 100,
        analyze: vi.fn().mockReturnValue({
          isSignificant: true,
          significance: 0.8,
          changeType: 'test',
          metadata: {},
        }),
      };

      expect(() => service.addAnalyzer(mockAnalyzer)).not.toThrow();
    });

    it('should allow removing change analyzers', () => {
      const mockAnalyzer: ChangeAnalyzer = {
        priority: 100,
        analyze: vi.fn(),
      };

      service.addAnalyzer(mockAnalyzer);
      expect(() => service.removeAnalyzer(mockAnalyzer)).not.toThrow();
    });

    it('should allow adding decision makers', () => {
      const mockDecisionMaker: SaveDecisionMaker = {
        priority: 100,
        decide: vi.fn().mockReturnValue({
          shouldSave: true,
          timing: 'immediate',
          reason: 'test decision',
        }),
      };

      expect(() => service.addDecisionMaker(mockDecisionMaker)).not.toThrow();
    });

    it('should allow adding event listeners', () => {
      const mockHandler = {
        handleEvent: vi.fn(),
      };

      expect(() => service.addEventListener(mockHandler)).not.toThrow();
      expect(() => service.removeEventListener(mockHandler)).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableAutoSave: false,
        debounceTimeMs: 2000,
      };

      service.configure(newConfig);
      const config = service.getConfiguration();

      // Note: The exact properties depend on the AutoSaveConfig interface
      expect(config).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track statistics correctly', () => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {},
      };

      mockPersistenceCoordinator.save.mockReturnValue(of(saveResult));

      return new Promise<void>((resolve, _reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: () => {
            const stats = service.getStats();
            expect(stats.totalSaves).toBe(1);
            expect(stats.successfulSaves).toBe(1);
            expect(stats.manualSaves).toBe(1);
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
      expect(stats.manualSaves).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle save operation failures', () => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.mockReturnValue(throwError(() => error));

      return new Promise<void>((resolve, _reject) => {
        service.triggerManualSave(autoSaveContext).subscribe({
          next: () => reject(new Error('Should have failed')),
          error: err => {
            expect(err.message).toBe('Save failed');

            const stats = service.getStats();
            expect(stats.failedSaves).toBe(1);
            resolve();
          },
        });
      });
    });

    it('should emit save failed events', () => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.mockReturnValue(throwError(() => error));

      return new Promise<void>((resolve, _reject) => {
        service.saveFailed$.subscribe(failure => {
          expect(failure.error).toBe('Save failed');
          expect(failure.context).toBe(autoSaveContext);
          resolve();
        });

        service.triggerManualSave(autoSaveContext).subscribe({
          next: () => {},
          error: () => {}, // Ignore error for this test
        });
      });
    });

    it('should handle trigger processing errors gracefully', () => {
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now(),
      };

      // This should not throw even if internal processing fails
      return new Promise<void>((resolve, _reject) => {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: _result => {
            // Should complete without throwing
            resolve();
          },
          error: reject,
        });
      });
    });
  });

  describe('State Observables', () => {
    it('should emit state changes', () => {
      let stateEmissions = 0;

      return new Promise<void>((resolve, _reject) => {
        service.state$.subscribe(state => {
          stateEmissions++;

          if (stateEmissions === 1) {
            // Initial state
            expect(state.enabled).toBe(true);
          } else if (stateEmissions === 2) {
            // After disable
            expect(state.enabled).toBe(false);
            resolve();
          }
        });

        // Trigger state change
        service.disable();
      });
    });

    it('should emit events', () => {
      return new Promise<void>((resolve, _reject) => {
        service.events$.subscribe(event => {
          expect(event.type).toBeDefined();
          expect(event.timestamp).toBeDefined();
          resolve();
        });

        // Trigger an event
        const triggerEvent: AutoSaveTriggerEvent = {
          type: 'operation-completed',
          operationType: 'create-node',
          affectedCellIds: ['node-1'],
          timestamp: Date.now(),
        };

        service.trigger(triggerEvent, autoSaveContext).subscribe();
      });
    });
  });

  describe('Cleanup', () => {
    it('should dispose cleanly', () => {
      expect(() => service.dispose()).not.toThrow();
    });

    it('should cancel pending saves on dispose', () => {
      service.dispose();
      expect(service.isPendingSave()).toBe(false);
    });
  });
});
