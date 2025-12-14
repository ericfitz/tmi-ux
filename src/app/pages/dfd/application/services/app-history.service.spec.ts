/**
 * Tests for AppHistoryService
 *
 * Test framework: Vitest
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-history.service.spec.ts
 * IMPORTANT: Do not skip or disable tests. Always troubleshoot to root cause and fix.
 */

import '@angular/compiler';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { of } from 'rxjs';
import { AppHistoryService } from './app-history.service';



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
    executeOperations: ReturnType<typeof vi.fn>;
  };
  let mockDiagramOperationBroadcaster: {
    broadcastOperations: ReturnType<typeof vi.fn>;
  };
  let mockPersistenceCoordinator: {
    persistOperations: ReturnType<typeof vi.fn>;
  };
  let mockAppStateService: {
    getCurrentState: ReturnType<typeof vi.fn>;
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
      executeOperations: vi.fn(() => of({ success: true, operationType: 'batch-operation' })),
    };

    mockDiagramOperationBroadcaster = {
      broadcastOperations: vi.fn(() => of(void 0)),
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
    };

    mockCellOperationConverter = {
      convertCellsToOperations: vi.fn(),
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
      mockDiagramOperationBroadcaster as any,
      mockPersistenceCoordinator as any,
      mockAppStateService as any,
      mockCellOperationConverter as any,
    );
  });

  // Note: Conversion logic tests have been moved to app-cell-operation-converter.service.spec.ts

  it('should be created', () => {
    expect(service).toBeDefined();
  });
});
