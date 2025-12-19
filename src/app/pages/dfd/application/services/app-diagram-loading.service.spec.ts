/**
 * Unit tests for AppDiagramLoadingService
 * Tests: Vitest Framework
 * Run: pnpm test -- src/app/pages/dfd/application/services/app-diagram-loading.service.spec.ts
 * Policy: No tests are skipped or disabled
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { AppDiagramLoadingService } from './app-diagram-loading.service';
import {
  createMockLogger,
  createMockAppStateService,
  createMockHistoryService,
  createMockOperationStateManager,
  createMockDiagramService,
  createMockNodeConfigurationService,
  createMockX6GraphAdapter,
  createMockGraph,
} from './test-helpers/mock-services';

describe('AppDiagramLoadingService', () => {
  let service: AppDiagramLoadingService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockNodeConfigurationService: ReturnType<typeof createMockNodeConfigurationService>;
  let mockDiagramService: ReturnType<typeof createMockDiagramService>;
  let mockOperationStateManager: ReturnType<typeof createMockOperationStateManager>;
  let mockHistoryService: ReturnType<typeof createMockHistoryService>;
  let mockAppStateService: ReturnType<typeof createMockAppStateService>;
  let mockGraph: ReturnType<typeof createMockGraph>;
  let mockX6GraphAdapter: ReturnType<typeof createMockX6GraphAdapter>;

  const mockCells = [
    { id: 'cell1', shape: 'process', x: 100, y: 100 },
    { id: 'cell2', shape: 'actor', x: 200, y: 200 },
    { id: 'cell3', shape: 'store', x: 300, y: 300 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mocks using shared factories
    mockLogger = createMockLogger();
    mockNodeConfigurationService = createMockNodeConfigurationService();
    mockDiagramService = createMockDiagramService();
    mockOperationStateManager = createMockOperationStateManager();
    mockHistoryService = createMockHistoryService();
    mockAppStateService = createMockAppStateService();
    mockGraph = createMockGraph();
    mockX6GraphAdapter = createMockX6GraphAdapter();

    // Create service with mocks
    service = new AppDiagramLoadingService(
      mockLogger as any,
      mockNodeConfigurationService as any,
      mockDiagramService as any,
      mockOperationStateManager as any,
      mockHistoryService as any,
      mockAppStateService as any,
    );
  });

  afterEach(() => {
    // Service doesn't have ngOnDestroy
  });

  describe('Service Initialization', () => {
    it('should create the service', () => {
      expect(service).toBeDefined();
    });
  });

  describe('loadCellsIntoGraph()', () => {
    it('should load cells with default options', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockDiagramService.loadDiagramCellsBatch).toHaveBeenCalledWith(
        mockCells,
        mockGraph,
        'diagram-123',
        mockNodeConfigurationService,
      );
      expect(mockHistoryService.clear).toHaveBeenCalled();
      expect(mockX6GraphAdapter.updateAllEmbeddingAppearances).toHaveBeenCalled();
      expect(mockX6GraphAdapter.recalculateZOrder).toHaveBeenCalled();
      expect(mockGraph.zoomToFit).toHaveBeenCalledWith({ padding: 20, maxScale: 1.25 });
    });

    it('should clear existing cells when clearExisting is true', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          clearExisting: true,
        },
      );

      expect(mockGraph.clearCells).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Cleared existing cells from graph',
      );
    });

    it('should not clear cells when clearExisting is false', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          clearExisting: false,
        },
      );

      expect(mockGraph.clearCells).not.toHaveBeenCalled();
    });

    it('should always suppress history during diagram loading', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Diagram loading state set - history recording prevented',
      );
    });

    it('should restore diagram loading state after loading', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(true);
      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(false);
    });

    it('should set and restore isApplyingRemoteChange flag', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(true);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Set isApplyingRemoteChange flag - broadcasts suppressed',
      );
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Cleared isApplyingRemoteChange flag - broadcasts restored',
      );
    });

    it('should not modify isApplyingRemoteChange if already true', () => {
      mockAppStateService.getCurrentState.mockReturnValue({
        isApplyingRemoteChange: true,
        isBlockingOperations: false,
        isApplyingUndoRedo: false,
      });

      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      // Should be called once by getCurrentState check, but not restored
      expect(mockAppStateService.setApplyingRemoteChange).not.toHaveBeenCalled();
    });

    it('should update embedding appearances when updateEmbedding is true', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          updateEmbedding: true,
        },
      );

      expect(mockX6GraphAdapter.updateAllEmbeddingAppearances).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Updated embedding appearances after cell loading',
      );
    });

    it('should not update embedding when updateEmbedding is false', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          updateEmbedding: false,
        },
      );

      expect(mockX6GraphAdapter.updateAllEmbeddingAppearances).not.toHaveBeenCalled();
    });

    it('should always recalculate z-order after loading', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockX6GraphAdapter.recalculateZOrder).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Recalculated z-order after diagram load',
      );
    });

    it('should zoom to fit when cells are loaded', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockGraph.zoomToFit).toHaveBeenCalledWith({ padding: 20, maxScale: 1.25 });
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Centered and fitted diagram to viewport',
      );
    });

    it('should not zoom to fit when no cells are loaded', () => {
      service.loadCellsIntoGraph([], mockGraph as any, 'diagram-123', mockX6GraphAdapter as any);

      expect(mockGraph.zoomToFit).not.toHaveBeenCalled();
    });

    it('should clear history service after loading', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockHistoryService.clear).toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Cleared AppHistoryService history after diagram load',
      );
    });

    it('should log source when provided', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          source: 'initial-load',
        },
      );

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdDiagram',
        'Loading diagram cells into graph',
        expect.objectContaining({
          source: 'initial-load',
        }),
      );
    });

    it('should use "unknown" as default source', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdDiagram',
        'Loading diagram cells into graph',
        expect.objectContaining({
          source: 'unknown',
        }),
      );
    });

    it('should log cell information before loading', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdDiagram',
        'Loading diagram cells into graph',
        expect.objectContaining({
          cellCount: 3,
          diagramId: 'diagram-123',
          cells: [
            { id: 'cell1', shape: 'process' },
            { id: 'cell2', shape: 'actor' },
            { id: 'cell3', shape: 'store' },
          ],
        }),
      );
    });

    it('should log graph state after loading', () => {
      mockGraph.getCells.mockReturnValue([
        { id: 'cell1' } as any,
        { id: 'cell2' } as any,
        { id: 'cell3' } as any,
      ]);

      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramLoadingService',
        'Graph state after loading',
        expect.objectContaining({
          totalCellsInGraph: 3,
          cellIds: ['cell1', 'cell2', 'cell3'],
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should restore state flags even when loading throws error', () => {
      mockDiagramService.loadDiagramCellsBatch.mockImplementation(() => {
        throw new Error('Loading failed');
      });

      expect(() => {
        service.loadCellsIntoGraph(
          mockCells,
          mockGraph as any,
          'diagram-123',
          mockX6GraphAdapter as any,
        );
      }).toThrow('Loading failed');

      // Verify cleanup happened despite error
      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(false);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });

    it('should log error when loading fails', () => {
      const error = new Error('Loading failed');
      mockDiagramService.loadDiagramCellsBatch.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        service.loadCellsIntoGraph(
          mockCells,
          mockGraph as any,
          'diagram-123',
          mockX6GraphAdapter as any,
        );
      }).toThrow('Loading failed');

      expect(mockLogger.error).toHaveBeenCalledWith('Error loading diagram cells', error);
    });

    it('should rethrow error after cleanup', () => {
      mockDiagramService.loadDiagramCellsBatch.mockImplementation(() => {
        throw new Error('Loading failed');
      });

      expect(() => {
        service.loadCellsIntoGraph(
          mockCells,
          mockGraph as any,
          'diagram-123',
          mockX6GraphAdapter as any,
        );
      }).toThrow('Loading failed');
    });

    it('should not restore isApplyingRemoteChange if it was already true', () => {
      mockAppStateService.getCurrentState.mockReturnValue({
        isApplyingRemoteChange: true,
        isBlockingOperations: false,
        isApplyingUndoRedo: false,
      });

      mockDiagramService.loadDiagramCellsBatch.mockImplementation(() => {
        throw new Error('Loading failed');
      });

      expect(() => {
        service.loadCellsIntoGraph(
          mockCells,
          mockGraph as any,
          'diagram-123',
          mockX6GraphAdapter as any,
        );
      }).toThrow('Loading failed');

      // Should not call setApplyingRemoteChange at all
      expect(mockAppStateService.setApplyingRemoteChange).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty cell array', () => {
      service.loadCellsIntoGraph([], mockGraph as any, 'diagram-123', mockX6GraphAdapter as any);

      expect(mockDiagramService.loadDiagramCellsBatch).toHaveBeenCalledWith(
        [],
        mockGraph,
        'diagram-123',
        mockNodeConfigurationService,
      );
      expect(mockGraph.zoomToFit).not.toHaveBeenCalled();
    });

    it('should handle cells with minimal properties', () => {
      const minimalCells = [{ id: 'cell1', shape: 'process' }];

      service.loadCellsIntoGraph(
        minimalCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(mockDiagramService.loadDiagramCellsBatch).toHaveBeenCalledWith(
        minimalCells,
        mockGraph,
        'diagram-123',
        mockNodeConfigurationService,
      );
    });

    it('should handle all options set to false', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          clearExisting: false,
          updateEmbedding: false,
        },
      );

      expect(mockGraph.clearCells).not.toHaveBeenCalled();
      // Diagram loading always sets loading state
      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(true);
      expect(mockX6GraphAdapter.updateAllEmbeddingAppearances).not.toHaveBeenCalled();
      // Z-order should still be recalculated
      expect(mockX6GraphAdapter.recalculateZOrder).toHaveBeenCalled();
    });

    it('should handle all options set to true', () => {
      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
        {
          clearExisting: true,
          updateEmbedding: true,
        },
      );

      expect(mockGraph.clearCells).toHaveBeenCalled();
      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(true);
      expect(mockX6GraphAdapter.updateAllEmbeddingAppearances).toHaveBeenCalled();
      expect(mockX6GraphAdapter.recalculateZOrder).toHaveBeenCalled();
    });
  });

  describe('State Management Flow', () => {
    it('should set states in correct order', () => {
      const callOrder: string[] = [];

      mockOperationStateManager.setDiagramLoadingState.mockImplementation((value: boolean) => {
        callOrder.push(`loading:${value}`);
      });
      mockAppStateService.setApplyingRemoteChange.mockImplementation((value: boolean) => {
        callOrder.push(`remote:${value}`);
      });
      mockDiagramService.loadDiagramCellsBatch.mockImplementation(() => {
        callOrder.push('load');
      });

      service.loadCellsIntoGraph(
        mockCells,
        mockGraph as any,
        'diagram-123',
        mockX6GraphAdapter as any,
      );

      expect(callOrder).toEqual([
        'loading:true',
        'remote:true',
        'load',
        'remote:false',
        'loading:false',
      ]);
    });

    it('should maintain state consistency even with nested errors', () => {
      mockX6GraphAdapter.updateAllEmbeddingAppearances.mockImplementation(() => {
        throw new Error('Embedding update failed');
      });

      expect(() => {
        service.loadCellsIntoGraph(
          mockCells,
          mockGraph as any,
          'diagram-123',
          mockX6GraphAdapter as any,
        );
      }).toThrow('Embedding update failed');

      // State should still be restored
      expect(mockOperationStateManager.setDiagramLoadingState).toHaveBeenCalledWith(false);
      expect(mockAppStateService.setApplyingRemoteChange).toHaveBeenCalledWith(false);
    });
  });
});
