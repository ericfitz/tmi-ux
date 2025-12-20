/**
 * Unit tests for AppHistoryService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-history.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AppHistoryService } from './app-history.service';
import { HistoryEntry } from '../../types/history.types';
import { Cell } from '../../../../core/types/websocket-message.types';

describe('AppHistoryService', () => {
  let service: AppHistoryService;
  let mockLogger: {
    debugComponent: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  let mockCollaborationService: {
    getCurrentUserEmail: ReturnType<typeof vi.fn>;
    isCollaborating: ReturnType<typeof vi.fn>;
  };
  let mockGraphOperationManager: {
    execute: ReturnType<typeof vi.fn>;
  };
  let mockPersistenceCoordinator: {
    persistOperations: ReturnType<typeof vi.fn>;
  };
  let mockAppStateService: {
    getCurrentState: ReturnType<typeof vi.fn>;
    setApplyingUndoRedo: ReturnType<typeof vi.fn>;
  };
  let mockCellOperationConverter: {
    convertCellsToOperations: ReturnType<typeof vi.fn>;
    convertCellToOperation: ReturnType<typeof vi.fn>;
    createNodeOperation: ReturnType<typeof vi.fn>;
    createNodeUpdateOperation: ReturnType<typeof vi.fn>;
    createEdgeOperation: ReturnType<typeof vi.fn>;
    createEdgeUpdateOperation: ReturnType<typeof vi.fn>;
    createDeleteOperation: ReturnType<typeof vi.fn>;
  };

  const mockOperationContext = {
    graph: {} as any,
    x6GraphAdapter: {} as any,
  };

  const createMockCell = (id: string, x = 100, y = 100): Cell => ({
    id,
    shape: 'process',
    x,
    y,
    width: 100,
    height: 60,
    label: `Cell ${id}`,
  });

  const createMockHistoryEntry = (
    id: string,
    cells: Cell[],
    previousCells: Cell[] = [],
  ): HistoryEntry => ({
    id,
    timestamp: Date.now(),
    operationType: 'add-node',
    description: 'Test operation',
    cells,
    previousCells,
    operationId: `op-${id}`,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      debugComponent: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };

    mockCollaborationService = {
      getCurrentUserEmail: vi.fn(() => 'test@example.com'),
      isCollaborating: vi.fn(() => false),
    };

    mockGraphOperationManager = {
      execute: vi.fn(() =>
        of({ success: true, operationType: 'add-node' as const, affectedCellIds: ['cell-1'] }),
      ),
    };

    mockPersistenceCoordinator = {
      persistOperations: vi.fn(() => of(void 0)),
    };

    mockAppStateService = {
      getCurrentState: vi.fn(() => ({
        syncState: {
          isSynced: true,
          pendingOperations: 0,
          lastSyncTimestamp: Date.now(),
          isResyncing: false,
        },
        pendingRemoteOperations: [],
        isApplyingRemoteChange: false,
        isApplyingUndoRedo: false,
        lastOperationId: null,
        conflictCount: 0,
        readOnly: false,
      })),
      setApplyingUndoRedo: vi.fn(),
    };

    mockCellOperationConverter = {
      convertCellsToOperations: vi.fn(() => [
        {
          operationType: 'update-node',
          nodeId: 'cell-1',
          updates: {},
        },
      ]),
      convertCellToOperation: vi.fn(),
      createNodeOperation: vi.fn(),
      createNodeUpdateOperation: vi.fn(),
      createEdgeOperation: vi.fn(),
      createEdgeUpdateOperation: vi.fn(),
      createDeleteOperation: vi.fn(),
    };

    service = new AppHistoryService(
      mockLogger as any,
      mockCollaborationService as any,
      mockGraphOperationManager as any,
      mockPersistenceCoordinator as any,
      mockAppStateService as any,
      mockCellOperationConverter as any,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default configuration', () => {
      const state = service.getHistoryState();
      expect(state.maxStackSize).toBe(50);
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
      expect(state.currentIndex).toBe(-1);
    });

    it('should initialize with operation context', () => {
      service.initialize(mockOperationContext, 'diagram-1', 'tm-1');

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppHistoryService',
        'AppHistoryService initialized with context',
        expect.objectContaining({
          diagramId: 'diagram-1',
          threatModelId: 'tm-1',
          maxHistorySize: 50,
        }),
      );
    });

    it('should initialize with custom configuration', () => {
      service.initialize(mockOperationContext, 'diagram-1', 'tm-1', {
        maxHistorySize: 100,
        enabled: false,
      });

      const state = service.getHistoryState();
      expect(state.maxStackSize).toBe(100);
    });

    it('should expose observable properties', () => {
      expect(service.historyStateChange$).toBeDefined();
      expect(service.historyOperation$).toBeDefined();
      expect(service.canUndo$).toBeDefined();
      expect(service.canRedo$).toBeDefined();
    });
  });

  describe('canUndo() and canRedo()', () => {
    it('should return false when undo stack is empty', () => {
      expect(service.canUndo()).toBe(false);
    });

    it('should return false when redo stack is empty', () => {
      expect(service.canRedo()).toBe(false);
    });

    it('should return true when undo stack has entries', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(service.canUndo()).toBe(true);
    });

    it('should return false when history is disabled', () => {
      service.updateConfig({ enabled: false });

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(service.canUndo()).toBe(false);
    });
  });

  describe('addHistoryEntry()', () => {
    it('should add entry to undo stack', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      const state = service.getHistoryState();
      expect(state.undoStack).toHaveLength(1);
      expect(state.undoStack[0]).toEqual(entry);
    });

    it('should clear redo stack when adding new entry', () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);

      // Manually populate redo stack for testing
      (service as any)._historyState.redoStack = [entry1];

      const entry3 = createMockHistoryEntry('3', [createMockCell('cell-3')]);
      service.addHistoryEntry(entry3);

      const newState = service.getHistoryState();
      expect(newState.redoStack).toEqual([]);
    });

    it('should update current index', () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);

      service.addHistoryEntry(entry1);
      expect(service.getHistoryState().currentIndex).toBe(0);

      service.addHistoryEntry(entry2);
      expect(service.getHistoryState().currentIndex).toBe(1);
    });

    it('should enforce stack size limit', () => {
      service.updateConfig({ maxHistorySize: 3 });

      for (let i = 0; i < 5; i++) {
        const entry = createMockHistoryEntry(`${i}`, [createMockCell(`cell-${i}`)]);
        service.addHistoryEntry(entry);
      }

      const state = service.getHistoryState();
      expect(state.undoStack).toHaveLength(3);
      expect(state.undoStack[0].id).toBe('2'); // First two removed
    });

    it('should emit history state change event', () => {
      const stateChanges: any[] = [];
      service.historyStateChange$.subscribe(event => stateChanges.push(event));

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0]).toMatchObject({
        canUndo: true,
        canRedo: false,
        undoStackSize: 1,
        redoStackSize: 0,
        changeType: 'entry-added',
      });
    });

    it('should emit history operation event', () => {
      const operationEvents: any[] = [];
      service.historyOperation$.subscribe(event => operationEvents.push(event));

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(operationEvents).toHaveLength(1);
      expect(operationEvents[0]).toMatchObject({
        operationType: 'add',
        entry,
        success: true,
      });
    });

    it('should not add entry when history is disabled', () => {
      service.updateConfig({ enabled: false });

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      const state = service.getHistoryState();
      expect(state.undoStack).toHaveLength(0);
    });

    it('should update canUndo$ observable', () => {
      const canUndoValues: boolean[] = [];
      service.canUndo$.subscribe(value => canUndoValues.push(value));

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(canUndoValues).toContain(true);
    });
  });

  describe('undo()', () => {
    beforeEach(() => {
      service.initialize(mockOperationContext, 'diagram-1', 'tm-1');
    });

    it('should fail if undo stack is empty', () => {
      return new Promise<void>((resolve, reject) => {
        service.undo().subscribe({
          error: error => {
            try {
              expect(error.message).toContain('no operations in undo stack');
              resolve();
            } catch (e) {
              reject(new Error(String(e)));
            }
          },
        });
      });
    });

    it('should fail if not initialized', async () => {
      const uninitializedService = new AppHistoryService(
        mockLogger as any,
        mockCollaborationService as any,
        mockGraphOperationManager as any,
        mockPersistenceCoordinator as any,
        mockAppStateService as any,
        mockCellOperationConverter as any,
      );

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      uninitializedService.addHistoryEntry(entry);

      await expect(async () => {
        await new Promise((resolve, reject) => {
          uninitializedService.undo().subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('operation context not initialized');

      uninitializedService.ngOnDestroy();
    });

    it('should pop from undo stack', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          const state = service.getHistoryState();
          expect(state.undoStack).toHaveLength(0);
          resolve();
        });
      });
    });

    it('should push to redo stack', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          const state = service.getHistoryState();
          expect(state.redoStack).toHaveLength(1);
          expect(state.redoStack[0]).toEqual(entry);
          resolve();
        });
      });
    });

    it('should set applyingUndoRedo flag during execution', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await new Promise<void>((resolve, reject) => {
        service.undo().subscribe({
          complete: () => {
            // Use setTimeout to ensure finalize has run
            setTimeout(() => {
              try {
                expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(true);
                expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(false);
                resolve();
              } catch (e) {
                reject(e instanceof Error ? e : new Error(String(e)));
              }
            }, 0);
          },
          error: reject,
        });
      });
    });

    it('should convert cells to operations', async () => {
      const cell = createMockCell('cell-1');
      const prevCell = createMockCell('cell-1', 50, 50);
      const entry = createMockHistoryEntry('1', [cell], [prevCell]);
      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          expect(mockCellOperationConverter.convertCellsToOperations).toHaveBeenCalledWith(
            [prevCell],
            [cell],
            'undo-redo',
          );
          resolve();
        });
      });
    });

    it('should execute operations via graph operation manager', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          expect(mockGraphOperationManager.execute).toHaveBeenCalled();
          resolve();
        });
      });
    });

    it('should emit history state change event', async () => {
      const stateChanges: any[] = [];
      service.historyStateChange$.subscribe(event => stateChanges.push(event));

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      // Clear the 'entry-added' event
      stateChanges.length = 0;

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          const undoEvent = stateChanges.find(e => e.changeType === 'undo');
          expect(undoEvent).toBeDefined();
          expect(undoEvent.canUndo).toBe(false);
          expect(undoEvent.canRedo).toBe(true);
          resolve();
        });
      });
    });

    it('should emit history operation event', async () => {
      const operationEvents: any[] = [];
      service.historyOperation$.subscribe(event => operationEvents.push(event));

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      // Clear the 'add' event
      operationEvents.length = 0;

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          expect(operationEvents).toHaveLength(1);
          expect(operationEvents[0]).toMatchObject({
            operationType: 'undo',
            success: true,
          });
          resolve();
        });
      });
    });

    it('should handle execution failure', async () => {
      mockGraphOperationManager.execute.mockReturnValue(
        throwError(() => new Error('Execution failed')),
      );

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await expect(async () => {
        await new Promise((resolve, reject) => {
          service.undo().subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('Execution failed');

      // Entry should be back on undo stack
      const state = service.getHistoryState();
      expect(state.undoStack).toHaveLength(1);
    });

    it('should clear applyingUndoRedo flag on error', async () => {
      mockGraphOperationManager.execute.mockReturnValue(
        throwError(() => new Error('Execution failed')),
      );

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await expect(async () => {
        await new Promise((resolve, reject) => {
          service.undo().subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('Execution failed');

      expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(false);
    });

    it('should fail if no operations generated', async () => {
      mockCellOperationConverter.convertCellsToOperations.mockReturnValue([]);

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);
      service.addHistoryEntry(entry);

      await expect(async () => {
        await new Promise((resolve, reject) => {
          service.undo().subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('Failed to generate undo operations');
    });
  });

  describe('redo()', () => {
    beforeEach(() => {
      service.initialize(mockOperationContext, 'diagram-1', 'tm-1');
    });

    it('should fail if redo stack is empty', async () => {
      await expect(async () => {
        await new Promise((resolve, reject) => {
          service.redo().subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('no operations in redo stack');
    });

    it('should pop from redo stack', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);

      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          service.redo().subscribe(() => {
            const state = service.getHistoryState();
            expect(state.redoStack).toHaveLength(0);
            resolve();
          });
        });
      });
    });

    it('should push to undo stack', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);

      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          service.redo().subscribe(() => {
            const state = service.getHistoryState();
            expect(state.undoStack).toHaveLength(1);
            expect(state.undoStack[0]).toEqual(entry);
            resolve();
          });
        });
      });
    });

    it('should set applyingUndoRedo flag during execution', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);

      service.addHistoryEntry(entry);

      await new Promise<void>((resolve, reject) => {
        service.undo().subscribe({
          complete: () => {
            vi.clearAllMocks();
            service.redo().subscribe({
              complete: () => {
                // Use setTimeout to ensure finalize has run
                setTimeout(() => {
                  try {
                    expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(true);
                    expect(mockAppStateService.setApplyingUndoRedo).toHaveBeenCalledWith(false);
                    resolve();
                  } catch (e) {
                    reject(e instanceof Error ? e : new Error(String(e)));
                  }
                }, 0);
              },
              error: reject,
            });
          },
          error: reject,
        });
      });
    });

    it('should emit history state change event', async () => {
      const stateChanges: any[] = [];
      service.historyStateChange$.subscribe(event => stateChanges.push(event));

      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);

      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          stateChanges.length = 0; // Clear previous events

          service.redo().subscribe(() => {
            const redoEvent = stateChanges.find(e => e.changeType === 'redo');
            expect(redoEvent).toBeDefined();
            expect(redoEvent.canUndo).toBe(true);
            expect(redoEvent.canRedo).toBe(false);
            resolve();
          });
        });
      });
    });

    it('should handle execution failure', async () => {
      const cell = createMockCell('cell-1');
      const entry = createMockHistoryEntry('1', [cell], []);

      service.addHistoryEntry(entry);

      await new Promise<void>((resolve, reject) => {
        service.undo().subscribe({
          next: () => {
            mockGraphOperationManager.execute.mockReturnValue(
              throwError(() => new Error('Redo failed')),
            );

            service.redo().subscribe({
              error: error => {
                try {
                  expect(error.message).toBe('Redo failed');
                  // Entry should be back on redo stack
                  const state = service.getHistoryState();
                  expect(state.redoStack).toHaveLength(1);
                  resolve();
                } catch (e) {
                  reject(e instanceof Error ? e : new Error(String(e)));
                }
              },
            });
          },
          error: reject,
        });
      });
    });
  });

  describe('clear() and clearHistory()', () => {
    it('should clear all stacks', () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);

      service.clear();

      const state = service.getHistoryState();
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
      expect(state.currentIndex).toBe(-1);
    });

    it('should emit state change event', () => {
      const stateChanges: any[] = [];
      service.historyStateChange$.subscribe(event => stateChanges.push(event));

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      stateChanges.length = 0; // Clear previous events
      service.clearHistory();

      expect(stateChanges).toHaveLength(1);
      expect(stateChanges[0].changeType).toBe('cleared');
    });

    it('should log the operation', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      service.clearHistory();

      expect(mockLogger.info).toHaveBeenCalledWith('Clearing history', expect.any(Object));
    });
  });

  describe('getHistoryState()', () => {
    it('should return a copy of the state', () => {
      const state1 = service.getHistoryState();
      const state2 = service.getHistoryState();

      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2);
      expect(state1.undoStack).not.toBe(state2.undoStack);
    });

    it('should reflect current state', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      const state = service.getHistoryState();
      expect(state.undoStack).toHaveLength(1);
      expect(state.currentIndex).toBe(0);
    });
  });

  describe('getUndoStack() and getRedoStack()', () => {
    it('should return copies of stacks', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      const undoStack = service.getUndoStack();
      expect(undoStack).toHaveLength(1);
      expect(undoStack).not.toBe((service as any)._historyState.undoStack);
    });

    it('should return empty arrays for empty stacks', () => {
      expect(service.getUndoStack()).toEqual([]);
      expect(service.getRedoStack()).toEqual([]);
    });
  });

  describe('getStats()', () => {
    it('should return statistics', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('totalHistoryEntries');
      expect(stats).toHaveProperty('undoCount');
      expect(stats).toHaveProperty('redoCount');
    });

    it('should track total entries', () => {
      service.addHistoryEntry(createMockHistoryEntry('1', [createMockCell('cell-1')]));
      service.addHistoryEntry(createMockHistoryEntry('2', [createMockCell('cell-2')]));

      const stats = service.getStats();
      expect(stats.totalHistoryEntries).toBe(2);
    });

    it('should return a copy', () => {
      const stats1 = service.getStats();
      const stats2 = service.getStats();

      expect(stats1).toEqual(stats2);
      expect(stats1).not.toBe(stats2);
    });
  });

  describe('findEntryByOperationId()', () => {
    it('should find entry by operation ID', () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);

      const found = service.findEntryByOperationId('op-2');
      expect(found).toEqual(entry2);
    });

    it('should return null if not found', () => {
      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      const found = service.findEntryByOperationId('nonexistent');
      expect(found).toBeNull();
    });

    it('should search from most recent to oldest', () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      entry1.operationId = 'same-id';
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);
      entry2.operationId = 'same-id';

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);

      const found = service.findEntryByOperationId('same-id');
      expect(found?.id).toBe('2'); // Most recent
    });
  });

  describe('undoUntilOperationId()', () => {
    beforeEach(() => {
      service.initialize(mockOperationContext, 'diagram-1', 'tm-1');
    });

    it('should fail if operation ID not found', async () => {
      service.addHistoryEntry(createMockHistoryEntry('1', [createMockCell('cell-1')]));

      await expect(async () => {
        await new Promise((resolve, reject) => {
          service.undoUntilOperationId('nonexistent').subscribe({
            error: reject,
          });
        });
      }).rejects.toThrow('Cannot find history entry');
    });

    it('should undo multiple operations', async () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);
      const entry3 = createMockHistoryEntry('3', [createMockCell('cell-3')]);

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);
      service.addHistoryEntry(entry3);

      await new Promise<void>(resolve => {
        service.undoUntilOperationId('op-1').subscribe(result => {
          expect(result.undoCount).toBe(3);
          expect(result.success).toBe(true);
          resolve();
        });
      });
    });

    it('should undo to specific operation', async () => {
      const entry1 = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      const entry2 = createMockHistoryEntry('2', [createMockCell('cell-2')]);
      const entry3 = createMockHistoryEntry('3', [createMockCell('cell-3')]);

      service.addHistoryEntry(entry1);
      service.addHistoryEntry(entry2);
      service.addHistoryEntry(entry3);

      await new Promise<void>(resolve => {
        service.undoUntilOperationId('op-2').subscribe(result => {
          expect(result.undoCount).toBe(2); // Undo entry3 and entry2
          expect(result.success).toBe(true);
          resolve();
        });
      });
    });
  });

  describe('updateConfig()', () => {
    it('should update configuration', () => {
      service.updateConfig({ maxHistorySize: 100 });

      const state = service.getHistoryState();
      expect(state.maxStackSize).toBe(100);
    });

    it('should update enabled flag', () => {
      service.updateConfig({ enabled: false });

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(service.canUndo()).toBe(false);
    });

    it('should log the update', () => {
      service.updateConfig({ maxHistorySize: 100 });

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppHistoryService',
        'History configuration updated',
        expect.objectContaining({ maxHistorySize: 100 }),
      );
    });
  });

  describe('Observable Events', () => {
    it('should update canUndo$ when state changes', () => {
      const canUndoValues: boolean[] = [];
      service.canUndo$.subscribe(value => canUndoValues.push(value));

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      expect(canUndoValues).toContain(false); // Initial
      expect(canUndoValues).toContain(true); // After add
    });

    it('should update canRedo$ when state changes', async () => {
      const canRedoValues: boolean[] = [];
      service.canRedo$.subscribe(value => canRedoValues.push(value));

      service.initialize(mockOperationContext, 'diagram-1', 'tm-1');

      const entry = createMockHistoryEntry('1', [createMockCell('cell-1')]);
      service.addHistoryEntry(entry);

      await new Promise<void>(resolve => {
        service.undo().subscribe(() => {
          expect(canRedoValues).toContain(false); // Initial
          expect(canRedoValues).toContain(true); // After undo
          resolve();
        });
      });
    });
  });

  describe('ngOnDestroy()', () => {
    it('should complete all subjects', () => {
      const completeSpy = vi.fn();

      service.historyStateChange$.subscribe({ complete: completeSpy });
      service.historyOperation$.subscribe({ complete: completeSpy });
      service.canUndo$.subscribe({ complete: completeSpy });
      service.canRedo$.subscribe({ complete: completeSpy });

      service.ngOnDestroy();

      expect(completeSpy).toHaveBeenCalledTimes(4);
    });

    it('should log destruction', () => {
      service.ngOnDestroy();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppHistoryService',
        'AppHistoryService destroyed',
      );
    });
  });
});
