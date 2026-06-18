/**
 * Shared mock services for DFD application service tests
 * Provides reusable mock implementations to reduce duplication
 */

import { vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';

/**
 * Create a mock LoggerService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for LoggerService (pure)
export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    debugComponent: vi.fn(),
  };
}

/**
 * Create a mock AppStateService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppStateService with default idle state (pure)
export function createMockAppStateService() {
  return {
    getCurrentState: vi.fn(() => ({
      isApplyingRemoteChange: false,
      isBlockingOperations: false,
      isApplyingUndoRedo: false,
    })),
    setApplyingRemoteChange: vi.fn(),
    setBlockOperations: vi.fn(),
    setApplyingUndoRedo: vi.fn(),
    state$: new BehaviorSubject({
      isApplyingRemoteChange: false,
      isBlockingOperations: false,
      isApplyingUndoRedo: false,
    }),
  };
}

/**
 * Create a mock AppHistoryService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppHistoryService with empty undo/redo stacks (pure)
export function createMockHistoryService() {
  return {
    clear: vi.fn(),
    addHistoryEntry: vi.fn(),
    canUndo: vi.fn(() => false),
    canRedo: vi.fn(() => false),
    undo: vi.fn(() => of({ success: true, operationType: 'undo' as const, affectedCellIds: [] })),
    redo: vi.fn(() => of({ success: true, operationType: 'redo' as const, affectedCellIds: [] })),
    findEntryByOperationId: vi.fn(() => null),
    undoUntilOperationId: vi.fn(() => of({ undoCount: 0, success: true })),
    getHistoryState: vi.fn(() => ({
      undoStack: [],
      redoStack: [],
      maxStackSize: 50,
      currentIndex: -1,
    })),
  };
}

/**
 * Create a mock AppOperationStateManager
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppOperationStateManager drag-state tracking (pure)
export function createMockOperationStateManager() {
  return {
    setDragInProgress: vi.fn(),
    getDragInProgress: vi.fn(() => false),
  };
}

/**
 * Create a mock AppDiagramService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppDiagramService cell CRUD operations (pure)
export function createMockDiagramService() {
  return {
    loadDiagramCellsBatch: vi.fn(),
    createCell: vi.fn(),
    updateCell: vi.fn(),
    deleteCell: vi.fn(),
  };
}

/**
 * Create a mock InfraNodeConfigurationService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for InfraNodeConfigurationService returning default node config (pure)
export function createMockNodeConfigurationService() {
  return {
    getNodeConfiguration: vi.fn(() => ({
      shape: 'process',
      size: { width: 100, height: 100 },
      ports: [],
    })),
  };
}

/**
 * Create a mock InfraX6GraphAdapter
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for InfraX6GraphAdapter graph rendering methods (pure)
export function createMockX6GraphAdapter() {
  return {
    updateAllEmbeddingAppearances: vi.fn(),
    recalculateZOrder: vi.fn(),
    getGraph: vi.fn(),
    getCells: vi.fn(() => []),
  };
}

/**
 * Create a mock Graph from AntV X6
 */
// SEM@4fb631d0431220cc47d07d47ff442af6cd5bcc57: build a vitest spy stub for an AntV X6 Graph instance (pure)
export function createMockGraph() {
  return {
    getCells: vi.fn(() => []),
    clearCells: vi.fn(),
    addCell: vi.fn(),
    removeCell: vi.fn(),
    zoomToFit: vi.fn(),
    centerContent: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    batchUpdate: vi.fn((callback: () => any) => callback()),
  };
}
