/**
 * Unit tests for AppOperationStateManager
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-operation-state-manager.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { AppOperationStateManager } from './app-operation-state-manager.service';
import {
  createMockLogger,
  createMockAppStateService,
  createMockGraph,
} from './test-helpers/mock-services';

describe('AppOperationStateManager', () => {
  let service: AppOperationStateManager;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockAppStateService: ReturnType<typeof createMockAppStateService>;
  let mockGraph: ReturnType<typeof createMockGraph>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockLogger = createMockLogger();
    mockAppStateService = createMockAppStateService();
    mockGraph = createMockGraph();

    service = new AppOperationStateManager(mockLogger as any);
    service.setAppStateService(mockAppStateService as any);
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should set AppStateService after construction', () => {
      const newService = new AppOperationStateManager(mockLogger as any);
      newService.setAppStateService(mockAppStateService as any);
      expect(newService).toBeDefined();
    });

    it('should initialize with no diagram loading state', () => {
      expect(service.isDiagramLoading()).toBe(false);
    });

    it('should initialize with no active drags', () => {
      expect(service.isAnyDragInProgress()).toBe(false);
    });
  });

  describe('Diagram Loading State', () => {
    it('should set diagram loading state', () => {
      service.setDiagramLoadingState(true);

      expect(service.isDiagramLoading()).toBe(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'GraphHistoryCoordinator',
        'Diagram loading state changed',
        { isLoading: true },
      );
    });

    it('should clear diagram loading state', () => {
      service.setDiagramLoadingState(true);
      service.setDiagramLoadingState(false);

      expect(service.isDiagramLoading()).toBe(false);
    });

    it('should exclude operations during diagram loading', () => {
      service.setDiagramLoadingState(true);

      expect(service.shouldExcludeDuringDiagramLoading()).toBe(true);
    });

    it('should not exclude operations when not loading', () => {
      service.setDiagramLoadingState(false);

      expect(service.shouldExcludeDuringDiagramLoading()).toBe(false);
    });
  });

  describe('executeWithDiagramLoading()', () => {
    it('should execute operation with diagram loading suppression', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeWithDiagramLoading(operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });

    it('should restore loading state after operation', () => {
      service.executeWithDiagramLoading(() => {
        expect(service.isDiagramLoading()).toBe(true);
      });

      expect(service.isDiagramLoading()).toBe(false);
    });

    it('should restore loading state even on error', () => {
      expect(() => {
        service.executeWithDiagramLoading(() => {
          throw new Error('Operation failed');
        });
      }).toThrow('Operation failed');

      expect(service.isDiagramLoading()).toBe(false);
    });
  });

  describe('Operation Type Management', () => {
    it('should set current operation type', () => {
      service.setCurrentOperationType('node-create');

      expect(service.getCurrentOperationType()).toBe('node-create');
    });

    it('should clear operation type', () => {
      service.setCurrentOperationType('node-create');
      service.setCurrentOperationType(null);

      expect(service.getCurrentOperationType()).toBeNull();
    });

    it('should exclude visual effect operations', () => {
      expect(service.shouldExcludeOperationType('visual-effect')).toBe(true);
    });

    it('should exclude port visibility operations', () => {
      expect(service.shouldExcludeOperationType('port-visibility')).toBe(true);
    });

    it('should exclude selection change operations', () => {
      expect(service.shouldExcludeOperationType('selection-change')).toBe(true);
    });

    it('should exclude interim move operations', () => {
      expect(service.shouldExcludeOperationType('node-move-interim')).toBe(true);
    });

    it('should not exclude node create operations', () => {
      expect(service.shouldExcludeOperationType('node-create')).toBe(false);
    });

    it('should not exclude undefined operation type', () => {
      expect(service.shouldExcludeOperationType(undefined)).toBe(false);
    });
  });

  describe('Drag Tracking', () => {
    it('should start drag tracking for move operation', () => {
      service.startDragTracking('cell-1', 'move', {
        position: { x: 100, y: 200 },
      });

      expect(service.isDragInProgress('cell-1')).toBe(true);
      expect(service.isAnyDragInProgress()).toBe(true);
    });

    it('should start drag tracking for resize operation', () => {
      service.startDragTracking('cell-1', 'resize', {
        size: { width: 100, height: 50 },
      });

      expect(service.isDragInProgress('cell-1')).toBe(true);
    });

    it('should start drag tracking for vertex operation', () => {
      service.startDragTracking('edge-1', 'vertex', {
        vertices: [{ x: 100, y: 100 }],
      });

      expect(service.isDragInProgress('edge-1')).toBe(true);
    });

    it('should cancel drag tracking', () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.cancelDragTracking('cell-1');

      expect(service.isDragInProgress('cell-1')).toBe(false);
      expect(service.isAnyDragInProgress()).toBe(false);
    });

    it('should check if specific cell is being dragged', () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });

      expect(service.isDragInProgress('cell-1')).toBe(true);
      expect(service.isDragInProgress('cell-2')).toBe(false);
    });

    it('should track multiple concurrent drags', () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.startDragTracking('cell-2', 'resize', { size: { width: 100, height: 50 } });

      expect(service.isDragInProgress('cell-1')).toBe(true);
      expect(service.isDragInProgress('cell-2')).toBe(true);
      expect(service.isAnyDragInProgress()).toBe(true);
    });
  });

  describe('Drag Completion', () => {
    it('should emit drag completion event when finalized', () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', {
        position: { x: 100, y: 200 },
      });

      service.finalizeDragTracking('cell-1', {
        position: { x: 150, y: 250 },
      });

      expect(completions).toHaveLength(1);
      expect(completions[0]).toMatchObject({
        cellId: 'cell-1',
        dragType: 'move',
        initialState: {
          position: { x: 100, y: 200 },
        },
        finalState: {
          position: { x: 150, y: 250 },
        },
      });
    });

    it('should clear drag tracking after finalization', () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.finalizeDragTracking('cell-1', { position: { x: 150, y: 250 } });

      expect(service.isDragInProgress('cell-1')).toBe(false);
    });

    it('should include duration in completion event', () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      vi.advanceTimersByTime(500);
      service.finalizeDragTracking('cell-1', { position: { x: 150, y: 250 } });

      expect(completions[0].duration).toBeGreaterThanOrEqual(500);
    });

    it('should handle finalization without final state', () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.finalizeDragTracking('cell-1', undefined as any);

      expect(completions[0].finalState).toEqual({});
    });

    it('should not emit event if drag not tracked', () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.finalizeDragTracking('cell-1', { position: { x: 150, y: 250 } });

      expect(completions).toHaveLength(0);
    });
  });

  describe('Drag Debouncing', () => {
    it('should update drag tracking and extend debounce timer', async () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.updateDragTracking('cell-1');

      // Advance timer by less than debounce delay
      await vi.advanceTimersByTimeAsync(100);
      expect(completions).toHaveLength(0);

      // Advance timer past debounce delay
      await vi.advanceTimersByTimeAsync(100);
      expect(completions).toHaveLength(1);
    });

    it('should reset debounce timer on multiple updates', async () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });

      // Update multiple times
      service.updateDragTracking('cell-1');
      await vi.advanceTimersByTimeAsync(100);

      service.updateDragTracking('cell-1');
      await vi.advanceTimersByTimeAsync(100);

      // Should not have completed yet
      expect(completions).toHaveLength(0);

      // Now advance past debounce
      await vi.advanceTimersByTimeAsync(100);
      expect(completions).toHaveLength(1);
    });

    it('should ignore updates for non-tracked drags', () => {
      service.updateDragTracking('cell-1');
      // Should not throw error
      expect(service.isDragInProgress('cell-1')).toBe(false);
    });

    it('should clear debounce timer when canceling drag', async () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.updateDragTracking('cell-1');
      service.cancelDragTracking('cell-1');

      await vi.advanceTimersByTimeAsync(200);
      expect(completions).toHaveLength(0);
    });
  });

  describe('executeRemoteOperation()', () => {
    it('should set and restore isApplyingRemoteChange flag', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeRemoteOperation(mockGraph as any, operation);

      expect(result).toBe('result');
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });

    it('should not modify flag if already applying remote change', () => {
      mockAppStateService.getCurrentState.mockReturnValue({
        isApplyingRemoteChange: true,
        isBlockingOperations: false,
        isApplyingUndoRedo: false,
      });

      service.executeRemoteOperation(mockGraph as any, () => 'result');

      expect(mockAppStateService.setApplyingRemoteChange).not.toHaveBeenCalled();
    });

    it('should restore flag even on error', () => {
      expect(() => {
        service.executeRemoteOperation(mockGraph as any, () => {
          throw new Error('Operation failed');
        });
      }).toThrow('Operation failed');

      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });
  });

  describe('Graph Operation Execution', () => {
    it('should execute atomic operation with batchUpdate', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeAtomicOperation(mockGraph as any, operation, 'node-create');

      expect(result).toBe('result');
      expect(mockGraph.batchUpdate).toHaveBeenCalled();
    });

    it('should execute compound operation with batchUpdate', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeCompoundOperation(mockGraph as any, operation, 'multi-delete');

      expect(result).toBe('result');
      expect(mockGraph.batchUpdate).toHaveBeenCalled();
    });

    it('should execute finalize drag operation with batchUpdate', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeFinalizeDragOperation(
        mockGraph as any,
        operation,
        'node-move-final',
      );

      expect(result).toBe('result');
      expect(mockGraph.batchUpdate).toHaveBeenCalled();
    });

    it('should execute visual effect directly', () => {
      const operation = vi.fn();

      service.executeVisualEffect(mockGraph as any, operation);

      expect(operation).toHaveBeenCalled();
      expect(mockGraph.batchUpdate).not.toHaveBeenCalled();
    });

    it('should execute atomic transaction', () => {
      const operation = vi.fn(() => 'result');

      const result = service.executeAtomicTransaction(mockGraph as any, operation, 'transaction');

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
    });
  });

  describe('Attribute Exclusion', () => {
    it('should exclude body filter attributes', () => {
      expect(service.shouldExcludeAttribute('body/filter')).toBe(true);
    });

    it('should exclude port visibility paths', () => {
      expect(
        service.shouldExcludeAttribute(undefined, 'ports/items/0/attrs/circle/style/visibility'),
      ).toBe(true);
    });

    it('should exclude selection attributes', () => {
      expect(service.shouldExcludeAttribute('selected')).toBe(true);
    });

    it('should exclude tool attributes', () => {
      expect(service.shouldExcludeAttribute('tools')).toBe(true);
    });

    it('should exclude zIndex attributes', () => {
      expect(service.shouldExcludeAttribute('zIndex')).toBe(true);
    });

    it('should not exclude label text changes', () => {
      expect(service.shouldExcludeAttribute('label/text')).toBe(false);
    });

    it('should not exclude position changes', () => {
      expect(service.shouldExcludeAttribute('position')).toBe(false);
    });

    it('should return false for undefined attributes', () => {
      expect(service.shouldExcludeAttribute(undefined, undefined)).toBe(false);
    });
  });

  describe('getDefaultOptionsForOperation()', () => {
    it('should return options excluding visual effects', () => {
      const options = service.getDefaultOptionsForOperation();

      expect(options).toEqual({
        includeVisualEffects: false,
        includePortVisibility: false,
        includeHighlighting: false,
        includeToolChanges: false,
      });
    });
  });

  describe('dispose()', () => {
    it('should clear all active timers on dispose', async () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.updateDragTracking('cell-1');

      service.dispose();

      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      await vi.advanceTimersByTimeAsync(200);
      expect(completions).toHaveLength(0);
    });

    it('should clear all active drags on dispose', () => {
      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.startDragTracking('cell-2', 'resize', { size: { width: 100, height: 50 } });

      service.dispose();

      expect(service.isAnyDragInProgress()).toBe(false);
    });

    it('should complete drag completions observable', () => {
      let completed = false;
      service.dragCompletions$.subscribe({
        complete: () => {
          completed = true;
        },
      });

      service.dispose();

      expect(completed).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle drag tracking without AppStateService', () => {
      const newService = new AppOperationStateManager(mockLogger as any);

      newService.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });

      expect(newService.isDragInProgress('cell-1')).toBe(true);
    });

    it('should handle executeRemoteOperation without AppStateService', () => {
      const newService = new AppOperationStateManager(mockLogger as any);

      const result = newService.executeRemoteOperation(mockGraph as any, () => 'result');

      expect(result).toBe('result');
    });

    it('should handle multiple finalizations of same drag', () => {
      const completions: any[] = [];
      service.dragCompletions$.subscribe(event => completions.push(event));

      service.startDragTracking('cell-1', 'move', { position: { x: 100, y: 200 } });
      service.finalizeDragTracking('cell-1', { position: { x: 150, y: 250 } });
      service.finalizeDragTracking('cell-1', { position: { x: 200, y: 300 } });

      expect(completions).toHaveLength(1);
    });

    it('should handle empty initial state in drag tracking', () => {
      service.startDragTracking('cell-1', 'move', {});

      expect(service.isDragInProgress('cell-1')).toBe(true);
    });
  });
});
