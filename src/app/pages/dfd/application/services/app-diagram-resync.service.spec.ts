/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for AppDiagramResyncService
 *
 * Test execution:
 * pnpm test -- src/app/pages/dfd/application/services/app-diagram-resync.service.spec.ts
 *
 * IMPORTANT: Never skip tests or use .skip/.only in committed code
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AppDiagramResyncService } from './app-diagram-resync.service';
import {
  createMockLogger,
  createMockAppStateService,
  createMockGraph,
} from './test-helpers/mock-services';

describe('AppDiagramResyncService', () => {
  let service: AppDiagramResyncService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockThreatModelService: any;
  let mockAppStateService: ReturnType<typeof createMockAppStateService>;
  let mockDiagramLoadingService: any;
  let mockDfdStateStore: any;
  let mockGraph: ReturnType<typeof createMockGraph>;
  let mockX6GraphAdapter: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLogger = createMockLogger();

    mockThreatModelService = {
      getDiagramById: vi.fn(() =>
        of({
          id: 'diagram-1',
          name: 'Test Diagram',
          cells: [
            { id: 'cell-1', shape: 'process' },
            { id: 'cell-2', shape: 'edge' },
          ],
          update_vector: 42,
        }),
      ),
    };

    mockAppStateService = createMockAppStateService();
    mockAppStateService.resyncComplete = vi.fn();

    mockDiagramLoadingService = {
      loadCellsIntoGraph: vi.fn(),
    };

    mockDfdStateStore = {
      updateState: vi.fn(),
    };

    mockGraph = createMockGraph();

    mockX6GraphAdapter = {
      updateAllEmbeddingAppearances: vi.fn(),
      recalculateZOrder: vi.fn(),
    };

    service = new AppDiagramResyncService(
      mockLogger as any,
      mockThreatModelService,
      mockAppStateService as any,
      mockDiagramLoadingService,
      mockDfdStateStore,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with diagram context', () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      expect(service.isResyncInProgress()).toBe(false);
    });

    it('should provide default configuration', () => {
      const config = service.getConfig();

      expect(config).toEqual({
        debounceMs: 1000,
        maxRetries: 3,
        retryDelayMs: 2000,
      });
    });
  });

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      service.updateConfig({ debounceMs: 500, maxRetries: 5 });

      const config = service.getConfig();

      expect(config.debounceMs).toBe(500);
      expect(config.maxRetries).toBe(5);
      expect(config.retryDelayMs).toBe(2000); // Unchanged
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramResyncService',
        'Resync configuration updated',
        expect.objectContaining({
          debounceMs: 500,
          maxRetries: 5,
        }),
      );
    });

    it('should allow partial configuration updates', () => {
      service.updateConfig({ retryDelayMs: 3000 });

      const config = service.getConfig();

      expect(config.debounceMs).toBe(1000); // Unchanged
      expect(config.maxRetries).toBe(3); // Unchanged
      expect(config.retryDelayMs).toBe(3000); // Updated
    });

    it('should return a copy of configuration', () => {
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });
  });

  describe('Resync Triggering', () => {
    it('should warn if triggered before initialization', () => {
      service.triggerResync();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot trigger resync - service not properly initialized',
      );
    });

    it('should trigger resync after initialization', () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      service.triggerResync();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramResyncService',
        'Resync triggered - will be debounced',
      );
    });

    it('should debounce multiple resync triggers', async () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      service.triggerResync();
      service.triggerResync();
      service.triggerResync();

      // Should not fetch immediately
      expect(mockThreatModelService.getDiagramById).not.toHaveBeenCalled();

      // Advance time past debounce
      await vi.advanceTimersByTimeAsync(1000);

      // Should fetch only once
      expect(mockThreatModelService.getDiagramById).toHaveBeenCalledTimes(1);
    });

    it('should restart debounce timer on new trigger', async () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      service.triggerResync();

      // Advance time partially
      await vi.advanceTimersByTimeAsync(500);

      // Trigger again, should restart timer
      service.triggerResync();

      // Advance to original debounce end
      await vi.advanceTimersByTimeAsync(500);

      // Should not have fetched yet (timer was restarted)
      expect(mockThreatModelService.getDiagramById).not.toHaveBeenCalled();

      // Advance remaining time
      await vi.advanceTimersByTimeAsync(500);

      // Now should fetch
      expect(mockThreatModelService.getDiagramById).toHaveBeenCalledTimes(1);
    });
  });

  describe('Resync Execution', () => {
    beforeEach(() => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);
    });

    it('should fetch diagram data from server', async () => {
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockThreatModelService.getDiagramById).toHaveBeenCalledWith('tm-1', 'diagram-1');
    });

    it('should load cells into graph', async () => {
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockDiagramLoadingService.loadCellsIntoGraph).toHaveBeenCalledWith(
        [
          { id: 'cell-1', shape: 'process' },
          { id: 'cell-2', shape: 'edge' },
        ],
        mockGraph,
        'diagram-1',
        mockX6GraphAdapter,
        {
          clearExisting: true,
          updateEmbedding: true,
          source: 'resync',
        },
      );
    });

    it('should set and clear remote change flag', async () => {
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });

    it('should update state store with update vector', async () => {
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockDfdStateStore.updateState).toHaveBeenCalledWith(
        { updateVector: 42 },
        'AppDiagramResyncService.resync',
      );
    });

    it('should mark resync as complete in app state', async () => {
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockAppStateService.resyncComplete).toHaveBeenCalled();
    });

    it('should emit resync started event', async () => {
      const startedEvents: any[] = [];
      service.resyncStarted$.subscribe(() => startedEvents.push(true));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(startedEvents).toHaveLength(1);
    });

    it('should emit resync completed event with success', async () => {
      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toMatchObject({
        success: true,
        cellsUpdated: 2,
      });
      expect(completedEvents[0].timestamp).toBeDefined();
    });

    it('should track resync in progress', async () => {
      expect(service.isResyncInProgress()).toBe(false);

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      // After completion
      expect(service.isResyncInProgress()).toBe(false);
    });

    it('should skip duplicate resync when already in progress', async () => {
      // Make the first resync slow
      mockThreatModelService.getDiagramById.mockReturnValue(
        new Promise(resolve =>
          setTimeout(
            () =>
              resolve({
                id: 'diagram-1',
                name: 'Test',
                cells: [],
                update_vector: 1,
              }),
            5000,
          ),
        ),
      );

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      // Try to trigger another resync while first is in progress
      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      // Should only call once
      expect(mockThreatModelService.getDiagramById).toHaveBeenCalledTimes(1);
    });

    it('should handle null update vector', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(
        of({
          id: 'diagram-1',
          name: 'Test',
          cells: [],
          update_vector: null,
        }),
      );

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      // Should not update state store
      expect(mockDfdStateStore.updateState).not.toHaveBeenCalled();
    });

    it('should handle undefined update vector', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(
        of({
          id: 'diagram-1',
          name: 'Test',
          cells: [],
        }),
      );

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      // Should not update state store
      expect(mockDfdStateStore.updateState).not.toHaveBeenCalled();
    });

    it('should handle diagram with no cells', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(
        of({
          id: 'diagram-1',
          name: 'Empty Diagram',
          cells: [],
          update_vector: 1,
        }),
      );

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockDiagramLoadingService.loadCellsIntoGraph).toHaveBeenCalledWith(
        [],
        mockGraph,
        'diagram-1',
        mockX6GraphAdapter,
        expect.any(Object),
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);
    });

    it('should handle diagram not found error', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(of(null));

      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000); // Initial debounce

      // Need to advance timers for all retry attempts
      await vi.advanceTimersByTimeAsync(2000); // Retry 1
      await vi.advanceTimersByTimeAsync(4000); // Retry 2
      await vi.advanceTimersByTimeAsync(8000); // Retry 3

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].success).toBe(false);
      expect(completedEvents[0].error).toContain('Diagram diagram-1 not found');
    });

    it('should handle server fetch error', async () => {
      const error = new Error('Network error');
      mockThreatModelService.getDiagramById.mockReturnValue(throwError(() => error));

      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockLogger.error).toHaveBeenCalledWith('Resync operation failed', error);
    });

    it('should retry on failure', async () => {
      let attemptCount = 0;
      mockThreatModelService.getDiagramById.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 2) {
          return throwError(() => new Error('Temporary failure'));
        }
        return of({
          id: 'diagram-1',
          name: 'Test',
          cells: [],
          update_vector: 1,
        });
      });

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000); // Initial trigger
      await vi.advanceTimersByTimeAsync(2000); // First retry delay

      expect(attemptCount).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Resync attempt 1 failed'),
        expect.any(Object),
      );
    });

    it('should use exponential backoff for retries', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(throwError(() => new Error('Failure')));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000); // Initial trigger

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 2000ms'),
        expect.any(Object),
      );

      await vi.advanceTimersByTimeAsync(2000); // First retry

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 4000ms'),
        expect.any(Object),
      );

      await vi.advanceTimersByTimeAsync(4000); // Second retry

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('retrying in 8000ms'),
        expect.any(Object),
      );
    });

    it('should fail after max retries', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(
        throwError(() => new Error('Permanent failure')),
      );

      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000); // Initial
      await vi.advanceTimersByTimeAsync(2000); // Retry 1
      await vi.advanceTimersByTimeAsync(4000); // Retry 2
      await vi.advanceTimersByTimeAsync(8000); // Retry 3

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].success).toBe(false);
      expect(completedEvents[0].error).toContain('Failed after 3 attempts');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Resync failed after maximum retries',
        expect.any(Object),
      );
    });

    it('should clear remote change flag even on error', async () => {
      mockDiagramLoadingService.loadCellsIntoGraph.mockImplementation(() => {
        throw new Error('Load failed');
      });

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });

    it('should clear in-progress flag even on error', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(throwError(() => new Error('Failure')));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);

      expect(service.isResyncInProgress()).toBe(false);
    });

    it('should handle missing graph reference during update', async () => {
      // Make the diagram loading fail due to missing graph
      mockDiagramLoadingService.loadCellsIntoGraph.mockImplementation(() => {
        throw new Error('Graph reference or adapter not available');
      });

      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000); // Initial debounce

      // Need to advance timers for all retry attempts
      await vi.advanceTimersByTimeAsync(2000); // Retry 1
      await vi.advanceTimersByTimeAsync(4000); // Retry 2
      await vi.advanceTimersByTimeAsync(8000); // Retry 3

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].success).toBe(false);
      expect(completedEvents[0].error).toContain('Graph reference or adapter not available');
    });
  });

  describe('State Management', () => {
    it('should reset service state', () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      service.reset();

      service.triggerResync();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot trigger resync - service not properly initialized',
      );
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramResyncService',
        'AppDiagramResyncService reset',
      );
    });

    it('should clear in-progress flag on reset', () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      (service as any)._isResyncInProgress = true;

      service.reset();

      expect(service.isResyncInProgress()).toBe(false);
    });
  });

  describe('Lifecycle', () => {
    it('should cleanup on destroy', () => {
      service.ngOnDestroy();

      expect(mockLogger.info).toHaveBeenCalledWith('Destroying AppDiagramResyncService');
    });

    it('should not process triggers after destroy', async () => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);

      service.ngOnDestroy();

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockThreatModelService.getDiagramById).not.toHaveBeenCalled();
    });
  });

  describe('Observable Events', () => {
    beforeEach(() => {
      service.initialize('diagram-1', 'tm-1', mockGraph as any, mockX6GraphAdapter);
    });

    it('should provide resyncStarted observable', () => {
      expect(service.resyncStarted$).toBeDefined();
    });

    it('should provide resyncCompleted observable', () => {
      expect(service.resyncCompleted$).toBeDefined();
    });

    it('should emit events in correct order', async () => {
      const events: string[] = [];

      service.resyncStarted$.subscribe(() => events.push('started'));
      service.resyncCompleted$.subscribe(() => events.push('completed'));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);

      expect(events).toEqual(['started', 'completed']);
    });

    it('should emit completed event on error', async () => {
      mockThreatModelService.getDiagramById.mockReturnValue(throwError(() => new Error('Error')));

      const completedEvents: any[] = [];
      service.resyncCompleted$.subscribe(event => completedEvents.push(event));

      service.triggerResync();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);
      await vi.advanceTimersByTimeAsync(4000);
      await vi.advanceTimersByTimeAsync(8000);

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].success).toBe(false);
    });
  });
});
