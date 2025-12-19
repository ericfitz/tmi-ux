/**
 * Shared mock services for DFD application service tests
 * Provides reusable mock implementations to reduce duplication
 */

import { vi } from 'vitest';
import { BehaviorSubject, Subject, of } from 'rxjs';

/**
 * Create a mock LoggerService
 */
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
export function createMockOperationStateManager() {
  return {
    setDragInProgress: vi.fn(),
    getDragInProgress: vi.fn(() => false),
  };
}

/**
 * Create a mock AppDiagramService
 */
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

/**
 * Create a mock DfdCollaborationService
 */
export function createMockCollaborationService() {
  return {
    isCurrentUserPresenterModeActive: vi.fn(() => false),
    isCurrentUserPresenter: vi.fn(() => false),
    endCollaboration: vi.fn(() => of(undefined)),
    collaborationState$: new BehaviorSubject({
      isPresenterModeActive: false,
      isCollaborating: false,
    }),
  };
}

/**
 * Create a mock InfraDfdWebsocketAdapter
 */
export function createMockWebsocketAdapter() {
  return {
    operationRejected$: new Subject(),
    diagramOperations$: new Subject(),
    sendOperation: vi.fn(() => of(undefined)),
  };
}

/**
 * Create a mock AppDiagramResyncService
 */
export function createMockResyncService() {
  return {
    triggerResync: vi.fn(),
    resyncComplete$: new Subject(),
  };
}
