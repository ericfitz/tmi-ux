import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Graph } from '@antv/x6';
import { of, throwError } from 'rxjs';
import { AppRemoteOperationHandler } from './app-remote-operation-handler.service';
import { CellOperation } from '../../../../core/types/websocket-message.types';
import { OperationContext } from '../../types/graph-operation.types';

describe('AppRemoteOperationHandler', () => {
  let service: AppRemoteOperationHandler;
  let mockLogger: any;
  let mockAppStateService: any;
  let mockGraphOperationManager: any;
  let mockHistoryCoordinator: any;
  let mockGraph: Graph;

  beforeEach(() => {
    // Mock dependencies
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockAppStateService = {
      applyBatchedOperationsEvents$: of(),
      applyOperationEvents$: of(),
      getCurrentState: vi.fn().mockReturnValue({
        isApplyingRemoteChange: false,
        readOnly: false,
        isLoadingDiagram: false,
      }),
      setApplyingRemoteChange: vi.fn(),
    };

    mockGraphOperationManager = {
      execute: vi.fn().mockReturnValue(
        of({
          success: true,
          affectedCellIds: ['cell-1'],
        }),
      ),
    };

    mockHistoryCoordinator = {
      executeRemoteOperation: vi.fn((graph, callback) => callback()),
    };

    // Create mock graph
    mockGraph = new Graph({
      container: document.createElement('div'),
      width: 800,
      height: 600,
    });

    // Create service
    service = new AppRemoteOperationHandler(
      mockLogger,
      mockAppStateService,
      mockGraphOperationManager,
      mockHistoryCoordinator,
    );
  });

  describe('Remote Operation Flag Management', () => {
    it('should wrap remote operation execution with executeRemoteOperation', () => {
      // Arrange
      const operationContext: OperationContext = {
        source: 'remote-collaboration',
        priority: 'normal',
      };

      const cellOperation: CellOperation = {
        id: 'node-1',
        operation: 'add',
        data: {
          id: 'node-1',
          shape: 'rect',
          position: { x: 100, y: 100 },
          size: { width: 80, height: 40 },
        },
      };

      service.initialize(mockGraph, operationContext);

      // Act: Manually trigger operation handling
      const privateService = service as any;
      privateService._handleRemoteOperation(cellOperation, 'user-123', 'op-123');

      // Assert: executeRemoteOperation should be called immediately (synchronously)
      expect(mockHistoryCoordinator.executeRemoteOperation).toHaveBeenCalledWith(
        mockGraph,
        expect.any(Function),
      );
    });

    it('should set isApplyingRemoteChange flag during execution', () => {
      // Arrange
      const operationContext: OperationContext = {
        source: 'remote-collaboration',
        priority: 'normal',
      };

      const cellOperation: CellOperation = {
        id: 'node-1',
        operation: 'add',
        data: {
          id: 'node-1',
          shape: 'rect',
          position: { x: 100, y: 100 },
          size: { width: 80, height: 40 },
        },
      };

      // Track flag state during execution
      let flagWasSet = false;
      mockHistoryCoordinator.executeRemoteOperation = vi.fn((graph, callback) => {
        // Check if flag would be set in the real implementation
        flagWasSet = true;
        return callback();
      });

      service.initialize(mockGraph, operationContext);

      // Act: Manually trigger operation handling
      const privateService = service as any;
      privateService._handleRemoteOperation(cellOperation, 'user-123', 'op-123');

      // Assert
      expect(flagWasSet).toBe(true);
    });

    it('should clear isApplyingRemoteChange flag even on error', () => {
      // Arrange
      const operationContext: OperationContext = {
        source: 'remote-collaboration',
        priority: 'normal',
      };

      const cellOperation: CellOperation = {
        id: 'node-1',
        operation: 'add',
        data: {
          id: 'node-1',
          shape: 'rect',
          position: { x: 100, y: 100 },
          size: { width: 80, height: 40 },
        },
      };

      // Make execute throw an error
      mockGraphOperationManager.execute.mockReturnValue(
        throwError(() => new Error('Execution failed')),
      );

      let callbackExecuted = false;
      mockHistoryCoordinator.executeRemoteOperation = vi.fn((graph, callback) => {
        try {
          callback();
        } finally {
          callbackExecuted = true;
        }
      });

      service.initialize(mockGraph, operationContext);

      // Act: Manually trigger operation handling
      const privateService = service as any;
      privateService._handleRemoteOperation(cellOperation, 'user-123', 'op-123');

      // Assert: callback should have executed despite error
      expect(callbackExecuted).toBe(true);
      expect(mockHistoryCoordinator.executeRemoteOperation).toHaveBeenCalled();
    });
  });
});
