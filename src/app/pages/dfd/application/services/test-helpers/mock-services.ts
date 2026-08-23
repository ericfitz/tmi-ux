/**
 * Shared mock services for DFD application service tests
 * Provides reusable mock implementations to reduce duplication
 *
 * Each factory returns `typeof stub & <the real type>`. The stubs implement only
 * what the specs exercise, so they cannot satisfy the real types structurally —
 * asserting once here is what lets the specs inject them without an `as any` at
 * every constructor and call site, while the spy methods stay directly
 * assertable (#870).
 */

import { vi } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import type { Cell, Graph } from '@antv/x6';
import type { AppStateService } from '../app-state.service';
import type { AppHistoryService } from '../app-history.service';
import type { AppOperationStateManager } from '../app-operation-state-manager.service';
import type { AppDiagramService } from '../app-diagram.service';
import type { InfraNodeConfigurationService } from '../../../infrastructure/services/infra-node-configuration.service';
import type { InfraX6GraphAdapter } from '../../../infrastructure/adapters/infra-x6-graph.adapter';
import {
  createTypedMockLoggerService,
  type MockLoggerService,
} from '../../../../../../testing/mocks';

/**
 * Create a mock LoggerService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for LoggerService (pure)
export function createMockLogger(): MockLoggerService {
  return createTypedMockLoggerService();
}

/**
 * Create a mock AppStateService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppStateService with default idle state (pure)
export function createMockAppStateService() {
  const stub = {
    getCurrentState: vi.fn(() => ({
      isApplyingRemoteChange: false,
      isBlockingOperations: false,
      isApplyingUndoRedo: false,
    })),
    setApplyingRemoteChange: vi.fn(),
    setBlockOperations: vi.fn(),
    setApplyingUndoRedo: vi.fn(),
    resyncComplete: vi.fn(),
    state$: new BehaviorSubject({
      isApplyingRemoteChange: false,
      isBlockingOperations: false,
      isApplyingUndoRedo: false,
    }),
  };
  return stub as typeof stub & AppStateService;
}

/**
 * Create a mock AppHistoryService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppHistoryService with empty undo/redo stacks (pure)
export function createMockHistoryService() {
  const stub = {
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
  return stub as typeof stub & AppHistoryService;
}

/**
 * Create a mock AppOperationStateManager
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppOperationStateManager drag-state tracking (pure)
export function createMockOperationStateManager() {
  const stub = {
    setDragInProgress: vi.fn(),
    getDragInProgress: vi.fn(() => false),
  };
  return stub as typeof stub & AppOperationStateManager;
}

/**
 * Create a mock AppDiagramService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for AppDiagramService cell CRUD operations (pure)
export function createMockDiagramService() {
  const stub = {
    loadDiagramCellsBatch: vi.fn(),
    createCell: vi.fn(),
    updateCell: vi.fn(),
    deleteCell: vi.fn(),
  };
  return stub as typeof stub & AppDiagramService;
}

/**
 * Create a mock InfraNodeConfigurationService
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for InfraNodeConfigurationService returning default node config (pure)
export function createMockNodeConfigurationService() {
  const stub = {
    getNodeConfiguration: vi.fn(() => ({
      shape: 'process',
      size: { width: 100, height: 100 },
      ports: [],
    })),
  };
  return stub as typeof stub & InfraNodeConfigurationService;
}

/**
 * Create a mock InfraX6GraphAdapter
 */
// SEM@784333e554874f7fa67bb4ceff5b013495877ea8: build a vitest spy stub for InfraX6GraphAdapter graph rendering methods (pure)
export function createMockX6GraphAdapter() {
  const stub = {
    updateAllEmbeddingAppearances: vi.fn(),
    recalculateZOrder: vi.fn(),
    getGraph: vi.fn(),
    getCells: vi.fn(() => []),
  };
  return stub as typeof stub & InfraX6GraphAdapter;
}

/**
 * Create a mock Graph from AntV X6
 */
// SEM@4fb631d0431220cc47d07d47ff442af6cd5bcc57: build a vitest spy stub for an AntV X6 Graph instance (pure)
export function createMockGraph() {
  const stub = {
    getCells: vi.fn((): Cell[] => []),
    clearCells: vi.fn(),
    addCell: vi.fn(),
    removeCell: vi.fn(),
    zoomToFit: vi.fn(),
    centerContent: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    batchUpdate: vi.fn((callback: () => any) => callback()),
  };
  return stub as typeof stub & Graph;
}
