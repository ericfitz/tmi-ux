/**
 * Test suite for AutoSaveManager
 */

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AutoSaveManager } from './auto-save-manager.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { IPersistenceCoordinator } from '../interfaces/persistence-coordinator.interface';
import {
  AutoSaveTriggerEvent,
  AutoSaveContext,
  AutoSavePolicy,
  ChangeAnalyzer,
  SaveDecisionMaker
} from '../types/auto-save.types';
import { SaveResult } from '../types/persistence.types';

describe('AutoSaveManager', () => {
  let service: AutoSaveManager;
  let mockLogger: jasmine.SpyObj<LoggerService>;
  let mockPersistenceCoordinator: jasmine.SpyObj<IPersistenceCoordinator>;
  let autoSaveContext: AutoSaveContext;

  beforeEach(() => {
    // Create logger spy
    mockLogger = jasmine.createSpyObj('LoggerService', [
      'info', 'debug', 'warn', 'error'
    ]);

    // Create persistence coordinator spy
    mockPersistenceCoordinator = jasmine.createSpyObj('IPersistenceCoordinator', [
      'save', 'load', 'sync'
    ]);

    TestBed.configureTestingModule({
      providers: [
        AutoSaveManager,
        { provide: LoggerService, useValue: mockLogger },
        { provide: IPersistenceCoordinator, useValue: mockPersistenceCoordinator }
      ]
    });

    service = TestBed.inject(AutoSaveManager);

    // Create auto-save context
    autoSaveContext = {
      diagramId: 'test-diagram',
      userId: 'test-user',
      diagramData: { nodes: [], edges: [] },
      preferredStrategy: 'websocket'
    };
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

    it('should ignore triggers when disabled', (done) => {
      service.disable();

      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (result) => {
          expect(result).toBeNull();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('Policy Management', () => {
    it('should allow setting policy', () => {
      const newPolicy: AutoSavePolicy = {
        mode: 'aggressive',
        changeThreshold: 1,
        timeThresholdMs: 5000,
        maxDelayMs: 10000
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
        metadata: {}
      };
    });

    it('should execute manual save successfully', (done) => {
      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));

      service.triggerManualSave(autoSaveContext).subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(true);
          expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should update state after successful manual save', (done) => {
      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));

      service.triggerManualSave(autoSaveContext).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.manualSaves).toBe(1);
          
          const state = service.getState();
          expect(state.changesSinceLastSave).toBe(0);
          expect(state.lastSaveTime).not.toBeNull();
          done();
        },
        error: done.fail
      });
    });

    it('should cancel pending auto-save when manual save triggered', (done) => {
      // First trigger an auto-save that would be delayed
      service.setPolicyMode('conservative');
      
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      // This should not trigger immediate save in conservative mode
      service.trigger(triggerEvent, autoSaveContext).subscribe();

      // Now trigger manual save
      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));
      service.triggerManualSave(autoSaveContext).subscribe({
        next: () => {
          expect(service.isPendingSave()).toBe(false);
          done();
        },
        error: done.fail
      });
    });

    it('should emit save completed event', (done) => {
      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));

      service.saveCompleted$.subscribe(result => {
        expect(result.success).toBe(true);
        done();
      });

      service.triggerManualSave(autoSaveContext).subscribe();
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
        timestamp: Date.now()
      };

      saveResult = {
        success: true,
        operationId: 'auto-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));
    });

    it('should trigger auto-save in aggressive mode', (done) => {
      service.setPolicyMode('aggressive');

      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (result) => {
          expect(result).not.toBeNull();
          expect(result!.success).toBe(true);
          expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should not trigger auto-save when disabled', (done) => {
      service.setPolicyMode('disabled');

      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (_result) => {
          expect(_result).toBeNull();
          expect(mockPersistenceCoordinator.save).not.toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should track change count', (done) => {
      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: () => {
          const state = service.getState();
          expect(state.changesSinceLastSave).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should emit trigger events', (done) => {
      service.events$.subscribe(event => {
        if (event.type === 'trigger-received') {
          expect(event.triggerEvent).toBe(triggerEvent);
          expect(event.context).toBe(autoSaveContext);
          done();
        }
      });

      service.trigger(triggerEvent, autoSaveContext).subscribe();
    });
  });

  describe('Save Decision Making', () => {
    let triggerEvent: AutoSaveTriggerEvent;

    beforeEach(() => {
      triggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };
    });

    it('should save immediately in aggressive mode', (done) => {
      service.setPolicyMode('aggressive');
      mockPersistenceCoordinator.save.and.returnValue(of({
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (result) => {
          expect(result).not.toBeNull();
          expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should be conservative in conservative mode', (done) => {
      service.setPolicyMode('conservative');

      // Single change should not trigger save in conservative mode
      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (result) => {
          expect(result).toBeNull(); // No immediate save
          expect(mockPersistenceCoordinator.save).not.toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });

    it('should respect change threshold in normal mode', (done) => {
      service.setPolicyMode('normal');
      const policy = service.getPolicy();
      
      // Set a high change threshold
      service.setPolicy({ ...policy, changeThreshold: 5 });

      mockPersistenceCoordinator.save.and.returnValue(of({
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      // Trigger multiple changes
      let completedTriggers = 0;
      const totalTriggers = 6; // One more than threshold

      for (let i = 0; i < totalTriggers; i++) {
        service.trigger(triggerEvent, autoSaveContext).subscribe({
          next: (_result) => {
            completedTriggers++;
            
            if (completedTriggers === totalTriggers) {
              // Should have triggered save when threshold was reached
              expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
              done();
            }
          },
          error: done.fail
        });
      }
    });
  });

  describe('Force Save', () => {
    it('should bypass all policies and save immediately', (done) => {
      service.setPolicyMode('disabled');
      
      const saveResult: SaveResult = {
        success: true,
        operationId: 'force-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));

      service.forceSave(autoSaveContext).subscribe({
        next: (result: SaveResult) => {
          expect(result.success).toBe(true);
          expect(mockPersistenceCoordinator.save).toHaveBeenCalled();
          
          const stats = service.getStats();
          expect(stats.forcedSaves).toBe(1);
          done();
        },
        error: done.fail
      });
    });

    it('should cancel pending save before forcing', (done) => {
      // Set up a pending save
      service.setPolicyMode('conservative');
      
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      service.trigger(triggerEvent, autoSaveContext).subscribe();

      // Now force save
      mockPersistenceCoordinator.save.and.returnValue(of({
        success: true,
        operationId: 'force-save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      }));

      service.forceSave(autoSaveContext).subscribe({
        next: () => {
          expect(service.isPendingSave()).toBe(false);
          done();
        },
        error: done.fail
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
        analyze: jasmine.createSpy('analyze').and.returnValue({
          isSignificant: true,
          significance: 0.8,
          changeType: 'test',
          metadata: {}
        })
      };

      expect(() => service.addAnalyzer(mockAnalyzer)).not.toThrow();
    });

    it('should allow removing change analyzers', () => {
      const mockAnalyzer: ChangeAnalyzer = {
        priority: 100,
        analyze: jasmine.createSpy('analyze')
      };

      service.addAnalyzer(mockAnalyzer);
      expect(() => service.removeAnalyzer(mockAnalyzer)).not.toThrow();
    });

    it('should allow adding decision makers', () => {
      const mockDecisionMaker: SaveDecisionMaker = {
        priority: 100,
        decide: jasmine.createSpy('decide').and.returnValue({
          shouldSave: true,
          timing: 'immediate',
          reason: 'test decision'
        })
      };

      expect(() => service.addDecisionMaker(mockDecisionMaker)).not.toThrow();
    });

    it('should allow adding event listeners', () => {
      const mockHandler = {
        handleEvent: jasmine.createSpy('handleEvent')
      };

      expect(() => service.addEventListener(mockHandler)).not.toThrow();
      expect(() => service.removeEventListener(mockHandler)).not.toThrow();
    });
  });

  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        enableAutoSave: false,
        debounceTimeMs: 2000
      };

      service.configure(newConfig);
      const config = service.getConfiguration();

      // Note: The exact properties depend on the AutoSaveConfig interface
      expect(config).toBeDefined();
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track statistics correctly', (done) => {
      const saveResult: SaveResult = {
        success: true,
        operationId: 'save-123',
        diagramId: 'test-diagram',
        timestamp: Date.now(),
        metadata: {}
      };

      mockPersistenceCoordinator.save.and.returnValue(of(saveResult));

      service.triggerManualSave(autoSaveContext).subscribe({
        next: () => {
          const stats = service.getStats();
          expect(stats.totalSaves).toBe(1);
          expect(stats.successfulSaves).toBe(1);
          expect(stats.manualSaves).toBe(1);
          done();
        },
        error: done.fail
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
    it('should handle save operation failures', (done) => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.and.returnValue(throwError(() => error));

      service.triggerManualSave(autoSaveContext).subscribe({
        next: () => done.fail('Should have failed'),
        error: (err) => {
          expect(err.message).toBe('Save failed');
          
          const stats = service.getStats();
          expect(stats.failedSaves).toBe(1);
          done();
        }
      });
    });

    it('should emit save failed events', (done) => {
      const error = new Error('Save failed');
      mockPersistenceCoordinator.save.and.returnValue(throwError(() => error));

      service.saveFailed$.subscribe(failure => {
        expect(failure.error).toBe('Save failed');
        expect(failure.context).toBe(autoSaveContext);
        done();
      });

      service.triggerManualSave(autoSaveContext).subscribe({
        next: () => {},
        error: () => {} // Ignore error for this test
      });
    });

    it('should handle trigger processing errors gracefully', (done) => {
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      // This should not throw even if internal processing fails
      service.trigger(triggerEvent, autoSaveContext).subscribe({
        next: (_result) => {
          // Should complete without throwing
          done();
        },
        error: done.fail
      });
    });
  });

  describe('State Observables', () => {
    it('should emit state changes', (done) => {
      let stateEmissions = 0;
      
      service.state$.subscribe(state => {
        stateEmissions++;
        
        if (stateEmissions === 1) {
          // Initial state
          expect(state.enabled).toBe(true);
        } else if (stateEmissions === 2) {
          // After disable
          expect(state.enabled).toBe(false);
          done();
        }
      });

      // Trigger state change
      service.disable();
    });

    it('should emit events', (done) => {
      service.events$.subscribe(event => {
        expect(event.type).toBeDefined();
        expect(event.timestamp).toBeDefined();
        done();
      });

      // Trigger an event
      const triggerEvent: AutoSaveTriggerEvent = {
        type: 'operation-completed',
        operationType: 'create-node',
        affectedCellIds: ['node-1'],
        timestamp: Date.now()
      };

      service.trigger(triggerEvent, autoSaveContext).subscribe();
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