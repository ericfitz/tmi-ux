// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { Subject, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HistoryIntegrationService } from './history-integration.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6GraphAdapter } from '../../infrastructure/adapters/x6-graph.adapter';
import { ICommandBus } from '../interfaces/command-bus.interface';
import { OperationStateTracker } from '../../infrastructure/services/operation-state-tracker.service';
import { HistoryService } from './history.service';

describe('HistoryIntegrationService', () => {
  let service: HistoryIntegrationService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockX6GraphAdapter: {
    setCommandContext: ReturnType<typeof vi.fn>;
    getInitialNodePosition: ReturnType<typeof vi.fn>;
    getGraph: ReturnType<typeof vi.fn>;
    dragCompleted$: Subject<any>;
    debouncedEdgeVerticesChanged$: Subject<any>;
    debouncedNodeResized$: Subject<any>;
    debouncedNodeDataChanged$: Subject<any>;
  };
  let mockCommandBus: {
    execute: ReturnType<typeof vi.fn>;
  };
  let mockOperationTracker: {
    startOperation: ReturnType<typeof vi.fn>;
    completeOperation: ReturnType<typeof vi.fn>;
    cancelOperation: ReturnType<typeof vi.fn>;
  };
  let mockHistoryService: {
    isUndoRedoInProgress: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockX6GraphAdapter = {
      setCommandContext: vi.fn(),
      getInitialNodePosition: vi.fn(),
      getGraph: vi.fn(),
      dragCompleted$: new Subject(),
      debouncedEdgeVerticesChanged$: new Subject(),
      debouncedNodeResized$: new Subject(),
      debouncedNodeDataChanged$: new Subject(),
    };

    mockCommandBus = {
      execute: vi.fn(),
    };

    mockOperationTracker = {
      startOperation: vi.fn(),
      completeOperation: vi.fn(),
      cancelOperation: vi.fn(),
    };

    mockHistoryService = {
      isUndoRedoInProgress: vi.fn(),
    };

    // Create the service directly without TestBed
    service = new HistoryIntegrationService(
      mockLogger as unknown as LoggerService,
      mockX6GraphAdapter as unknown as X6GraphAdapter,
      mockCommandBus as unknown as ICommandBus,
      mockOperationTracker as unknown as OperationStateTracker,
      mockHistoryService as unknown as HistoryService,
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Undo/Redo Prevention', () => {
    beforeEach(() => {
      // Initialize the service
      service.initialize('test-diagram', 'test-user');
    });

    // Note: Debounced node movement tests removed - functionality replaced by drag completion

    it('should skip debounced node resize during undo/redo operation', () => {
      // Arrange
      mockHistoryService.isUndoRedoInProgress.mockReturnValue(true);
      mockCommandBus.execute.mockReturnValue(of({}));

      // Act
      const nodeResizeEvent = {
        nodeId: 'test-node',
        width: 200,
        height: 150,
        oldWidth: 100,
        oldHeight: 75,
      };

      mockX6GraphAdapter.debouncedNodeResized$.next(nodeResizeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping debounced node resize during undo/redo operation',
        {
          nodeId: 'test-node',
          newSize: { width: 200, height: 150 },
          oldSize: { width: 100, height: 75 },
        },
      );
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should skip debounced node data change during undo/redo operation', () => {
      // Arrange
      mockHistoryService.isUndoRedoInProgress.mockReturnValue(true);
      mockCommandBus.execute.mockReturnValue(of({}));

      // Act
      const nodeDataChangeEvent = {
        nodeId: 'test-node',
        newData: { label: 'New Label' },
        oldData: { label: 'Old Label' },
      };

      mockX6GraphAdapter.debouncedNodeDataChanged$.next(nodeDataChangeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping debounced node data change during undo/redo operation',
        {
          nodeId: 'test-node',
          newData: { label: 'New Label' },
          oldData: { label: 'Old Label' },
        },
      );
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should skip debounced edge vertex change during undo/redo operation', () => {
      // Arrange
      mockHistoryService.isUndoRedoInProgress.mockReturnValue(true);
      mockCommandBus.execute.mockReturnValue(of({}));

      // Act
      const edgeVertexChangeEvent = {
        edgeId: 'test-edge',
        vertices: [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
        ],
      };

      mockX6GraphAdapter.debouncedEdgeVerticesChanged$.next(edgeVertexChangeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping debounced edge vertex change during undo/redo operation',
        {
          edgeId: 'test-edge',
          vertexCount: 2,
        },
      );
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('Normal Operation', () => {
    beforeEach(() => {
      // Initialize the service
      service.initialize('test-diagram', 'test-user');
      mockHistoryService.isUndoRedoInProgress.mockReturnValue(false);
    });

    it('should process remaining debounced events normally when undo/redo is not in progress', () => {
      // Arrange
      mockCommandBus.execute.mockReturnValue(of({}));

      const nodeResizeEvent = {
        nodeId: 'test-node',
        width: 200,
        height: 150,
        oldWidth: 100,
        oldHeight: 75,
      };

      const nodeDataChangeEvent = {
        nodeId: 'test-node',
        newData: { label: 'Updated Label' },
        oldData: { label: 'Original Label' },
      };

      const edgeVertexEvent = {
        edgeId: 'test-edge',
        vertices: [
          { x: 150, y: 150 },
          { x: 250, y: 250 },
        ],
      };

      // Act - Test remaining debounced events (node movement removed)
      mockX6GraphAdapter.debouncedNodeResized$.next(nodeResizeEvent);
      mockX6GraphAdapter.debouncedNodeDataChanged$.next(nodeDataChangeEvent);
      mockX6GraphAdapter.debouncedEdgeVerticesChanged$.next(edgeVertexEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Processing debounced node resize for history', {
        nodeId: 'test-node',
        newSize: { width: 200, height: 150 },
        oldSize: { width: 100, height: 75 },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing debounced node data change for history',
        {
          nodeId: 'test-node',
          newData: { label: 'Updated Label' },
          oldData: { label: 'Original Label' },
        },
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing debounced edge vertex change for history',
        {
          edgeId: 'test-edge',
          vertexCount: 2,
        },
      );

      expect(mockCommandBus.execute).toHaveBeenCalledTimes(1);
    });
  });
});
