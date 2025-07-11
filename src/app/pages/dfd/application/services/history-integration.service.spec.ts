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
    getNodeSnapshot: ReturnType<typeof vi.fn>;
    dragCompleted$: Subject<any>;
    edgeVerticesChanged$: Subject<any>;
    nodeResized$: Subject<any>;
    nodeDataChanged$: Subject<any>;
  };
  let mockCommandBus: {
    execute: ReturnType<typeof vi.fn>;
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
      getNodeSnapshot: vi.fn(),
      dragCompleted$: new Subject(),
      edgeVerticesChanged$: new Subject(),
      nodeResized$: new Subject(),
      nodeDataChanged$: new Subject(),
    };

    mockCommandBus = {
      execute: vi.fn(),
    };

    mockHistoryService = {
      isUndoRedoInProgress: vi.fn(),
    };

    // Setup default mock return values
    mockX6GraphAdapter.getNodeSnapshot.mockReturnValue({
      id: 'test-node',
      attrs: { text: { text: 'Test Node' } },
      type: 'process',
    });

    // Create the service directly without TestBed
    service = new HistoryIntegrationService(
      mockLogger as unknown as LoggerService,
      mockX6GraphAdapter as unknown as X6GraphAdapter,
      mockCommandBus as unknown as ICommandBus,
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

    it('should skip immediate node resize during undo/redo operation', () => {
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

      mockX6GraphAdapter.nodeResized$.next(nodeResizeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping node resize during undo/redo operation',
        {
          nodeId: 'test-node',
          newSize: { width: 200, height: 150 },
          oldSize: { width: 100, height: 75 },
        },
      );
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should skip immediate node data change during undo/redo operation', () => {
      // Arrange
      mockHistoryService.isUndoRedoInProgress.mockReturnValue(true);
      mockCommandBus.execute.mockReturnValue(of({}));

      // Act
      const nodeDataChangeEvent = {
        nodeId: 'test-node',
        newData: { label: 'New Label' },
        oldData: { label: 'Old Label' },
      };

      mockX6GraphAdapter.nodeDataChanged$.next(nodeDataChangeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping node data change during undo/redo operation',
        {
          nodeId: 'test-node',
          newData: { label: 'New Label' },
          oldData: { label: 'Old Label' },
        },
      );
      expect(mockCommandBus.execute).not.toHaveBeenCalled();
    });

    it('should skip immediate edge vertex change during undo/redo operation', () => {
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

      mockX6GraphAdapter.edgeVerticesChanged$.next(edgeVertexChangeEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Skipping edge vertex change during undo/redo operation',
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

      // Mock the graph and node/edge data for _getCurrentNodeData and _getCurrentEdgeData
      const mockNode = {
        id: 'test-node',
        position: () => ({ x: 100, y: 100 }),
        size: () => ({ width: 200, height: 150 }),
        attr: (path: string) => (path === 'text/text' ? 'Test Node' : undefined),
        getData: () => ({ type: 'process' }),
        getMetadata: () => [{ key: 'type', value: 'process' }],
        shape: 'ellipse',
        isNode: () => true,
      };

      const mockEdge = {
        id: 'test-edge',
        getSourceCellId: () => 'source-node',
        getTargetCellId: () => 'target-node',
        getSourcePortId: () => 'source-port',
        getTargetPortId: () => 'target-port',
        getVertices: () => [
          { x: 150, y: 150 },
          { x: 250, y: 250 },
        ],
        getData: () => ({ label: 'Test Edge' }),
        isEdge: () => true,
      };

      const mockGraph = {
        getCellById: (id: string) => {
          if (id === 'test-node') return mockNode;
          if (id === 'test-edge') return mockEdge;
          return null;
        },
      };

      mockX6GraphAdapter.getGraph.mockReturnValue(mockGraph);
    });

    it('should process immediate events normally when undo/redo is not in progress', () => {
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

      // Act - Test immediate events (node movement removed)
      mockX6GraphAdapter.nodeResized$.next(nodeResizeEvent);
      mockX6GraphAdapter.nodeDataChanged$.next(nodeDataChangeEvent);
      mockX6GraphAdapter.edgeVerticesChanged$.next(edgeVertexEvent);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith('Processing node resize for history', {
        nodeId: 'test-node',
        newSize: { width: 200, height: 150 },
        oldSize: { width: 100, height: 75 },
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Processing immediate node data change for history',
        {
          nodeId: 'test-node',
          newData: { label: 'Updated Label' },
          oldData: { label: 'Original Label' },
        },
      );

      expect(mockLogger.info).toHaveBeenCalledWith('Processing edge vertex change for history', {
        edgeId: 'test-edge',
        vertexCount: 2,
      });

      // The test should expect 3 calls since we're triggering 3 different immediate events
      // Each event type (node resize, node data change, edge vertex change) should trigger a command
      expect(mockCommandBus.execute).toHaveBeenCalledTimes(3);
    });
  });
});
