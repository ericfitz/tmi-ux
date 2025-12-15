/**
 * Integration tests for WebSocket message reflection prevention
 *
 * These tests verify that:
 * 1. Remote operations from server are NOT re-broadcast back
 * 2. Local operations ARE broadcast correctly
 * 3. Edge reconnection sends correct operation types
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Graph } from '@antv/x6';
import { Subject, of } from 'rxjs';
import { AppRemoteOperationHandler } from '../application/services/app-remote-operation-handler.service';
import { AppDiagramOperationBroadcaster } from '../application/services/app-diagram-operation-broadcaster.service';
import { CellOperation } from '../../../core/types/websocket-message.types';
import { OperationContext } from '../types/graph-operation.types';

describe('Collaboration Reflection Prevention (Integration)', () => {
  let graph: Graph;
  let remoteHandler: AppRemoteOperationHandler;
  let broadcaster: AppDiagramOperationBroadcaster;
  let appStateService: any;
  let mockLogger: any;
  let mockWebSocketAdapter: any;
  let mockCollaborationService: any;
  let mockGraphOperationManager: any;
  let mockHistoryCoordinator: any;
  let operationContext: OperationContext;

  beforeEach(() => {
    // Create real graph
    graph = new Graph({
      container: document.createElement('div'),
      width: 800,
      height: 600,
    });

    // Mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    // Mock WebSocket adapter
    mockWebSocketAdapter = {
      sendDiagramOperation: vi.fn(),
    };

    // Mock collaboration service
    mockCollaborationService = {
      isCollaborating: vi.fn().mockReturnValue(true),
    };

    // Create real AppStateService with mock subscriptions
    appStateService = {
      applyBatchedOperationsEvents$: new Subject(),
      applyOperationEvents$: new Subject(),
      getCurrentState: vi.fn().mockReturnValue({
        isApplyingRemoteChange: false,
        readOnly: false,
        isLoadingDiagram: false,
      }),
      setApplyingRemoteChange: vi.fn((value: boolean) => {
        // Update the mock to reflect the new state
        const currentState = appStateService.getCurrentState();
        appStateService.getCurrentState = vi.fn().mockReturnValue({
          ...currentState,
          isApplyingRemoteChange: value,
        });
      }),
    };

    // Mock history coordinator with working executeRemoteOperation
    mockHistoryCoordinator = {
      isDragInProgress: vi.fn().mockReturnValue(false),
      shouldExcludeAttribute: vi.fn().mockReturnValue(false),
      executeRemoteOperation: vi.fn((graph, callback) => {
        // Set flag before execution
        appStateService.setApplyingRemoteChange(true);
        try {
          return callback();
        } finally {
          // Clear flag after execution
          appStateService.setApplyingRemoteChange(false);
        }
      }),
    };

    // Mock graph operation manager
    mockGraphOperationManager = {
      execute: vi.fn().mockReturnValue(
        of({
          success: true,
          affectedCellIds: [],
        }),
      ),
    };

    // Setup operation context
    operationContext = {
      source: 'local-user',
      priority: 'normal',
    };

    // Create services
    remoteHandler = new AppRemoteOperationHandler(
      mockLogger,
      appStateService,
      mockGraphOperationManager,
      mockHistoryCoordinator,
    );

    broadcaster = new AppDiagramOperationBroadcaster(
      mockWebSocketAdapter,
      appStateService,
      mockCollaborationService,
      mockLogger,
      mockHistoryCoordinator,
    );

    // Initialize
    remoteHandler.initialize(graph, operationContext);
    broadcaster.initialize(graph);
  });

  describe('Remote Operation Reflection Prevention', () => {
    it('should NOT re-broadcast add operation received from server', async () => {
      // Arrange
      const remoteAddOperation: CellOperation = {
        id: 'node-1',
        operation: 'add',
        data: {
          id: 'node-1',
          shape: 'rect',
          position: { x: 100, y: 100 },
          size: { width: 80, height: 40 },
        },
      };

      // Simulate receiving operation from server
      const privateHandler = remoteHandler as any;

      // Act: Process remote operation
      privateHandler._handleRemoteOperation(remoteAddOperation, 'remote-user-123', 'op-123');

      // Assert: WebSocket should NOT be called during remote operation processing
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockWebSocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should NOT re-broadcast update operation received from server', async () => {
      // Arrange: First add a node
      graph.addNode({
        id: 'node-1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      const remoteUpdateOperation: CellOperation = {
        id: 'node-1',
        operation: 'update',
        data: {
          position: { x: 200, y: 200 },
        },
      };

      // Clear any calls from node creation
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Process remote update
      const privateHandler = remoteHandler as any;
      privateHandler._handleRemoteOperation(remoteUpdateOperation, 'remote-user-123', 'op-124');

      // Assert
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockWebSocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should NOT re-broadcast remove operation received from server', async () => {
      // Arrange: First add a node
      graph.addNode({
        id: 'node-1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      const remoteRemoveOperation: CellOperation = {
        id: 'node-1',
        operation: 'remove',
      };

      // Clear any calls from node creation
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Process remote remove
      const privateHandler = remoteHandler as any;
      privateHandler._handleRemoteOperation(remoteRemoveOperation, 'remote-user-123', 'op-125');

      // Assert
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(mockWebSocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });
  });

  describe('Local Operation Broadcasting', () => {
    it('should broadcast local edge source reconnection as ONE update operation', async () => {
      // Arrange: Create nodes and edge
      const node1 = graph.addNode({
        id: 'node-1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      const node2 = graph.addNode({
        id: 'node-2',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 80,
        height: 40,
      });

      const node3 = graph.addNode({
        id: 'node-3',
        shape: 'rect',
        x: 100,
        y: 300,
        width: 80,
        height: 40,
      });

      const edge = graph.addEdge({
        id: 'edge-1',
        source: node1,
        target: node2,
        shape: 'edge',
      });

      // Clear calls from setup
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Reconnect edge source
      edge.setSource(node3);

      // Assert: Should send ONE update operation
      await new Promise(resolve => setTimeout(resolve, 50));
      const calls = mockWebSocketAdapter.sendDiagramOperation.mock.calls;
      const updateCalls = calls.filter(
        call => call[0].operation === 'update' && call[0].id === 'edge-1',
      );

      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toMatchObject({
        id: 'edge-1',
        operation: 'update',
      });
    });

    it('should broadcast local edge target reconnection as ONE update operation', async () => {
      // Arrange: Create nodes and edge
      const node1 = graph.addNode({
        id: 'node-1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      const node2 = graph.addNode({
        id: 'node-2',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 80,
        height: 40,
      });

      const node3 = graph.addNode({
        id: 'node-3',
        shape: 'rect',
        x: 300,
        y: 300,
        width: 80,
        height: 40,
      });

      const edge = graph.addEdge({
        id: 'edge-1',
        source: node1,
        target: node2,
        shape: 'edge',
      });

      // Clear calls from setup
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Reconnect edge target
      edge.setTarget(node3);

      // Assert: Should send ONE update operation
      await new Promise(resolve => setTimeout(resolve, 50));
      const calls = mockWebSocketAdapter.sendDiagramOperation.mock.calls;
      const updateCalls = calls.filter(
        call => call[0].operation === 'update' && call[0].id === 'edge-1',
      );

      expect(updateCalls.length).toBe(1);
      expect(updateCalls[0][0]).toMatchObject({
        id: 'edge-1',
        operation: 'update',
      });
    });

    it('should broadcast local new edge creation as ONE add operation', async () => {
      // Arrange: Create nodes
      const node1 = graph.addNode({
        id: 'node-1',
        shape: 'rect',
        x: 100,
        y: 100,
        width: 80,
        height: 40,
      });

      const node2 = graph.addNode({
        id: 'node-2',
        shape: 'rect',
        x: 300,
        y: 100,
        width: 80,
        height: 40,
      });

      // Clear calls from setup
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Create new edge
      graph.addEdge({
        id: 'edge-1',
        source: node1,
        target: node2,
        shape: 'edge',
      });

      // Assert: Should send ONE add operation
      await new Promise(resolve => setTimeout(resolve, 50));
      const calls = mockWebSocketAdapter.sendDiagramOperation.mock.calls;
      const addCalls = calls.filter(call => call[0].operation === 'add' && call[0].id === 'edge-1');

      expect(addCalls.length).toBe(1);
    });

    it('should broadcast only local operations when local and remote occur simultaneously', async () => {
      // Arrange: Setup
      const remoteAddOperation: CellOperation = {
        id: 'remote-node',
        operation: 'add',
        data: {
          id: 'remote-node',
          shape: 'rect',
          position: { x: 100, y: 100 },
          size: { width: 80, height: 40 },
        },
      };

      // Clear any initial calls
      mockWebSocketAdapter.sendDiagramOperation.mockClear();

      // Act: Simultaneously process remote and local operations
      const privateHandler = remoteHandler as any;
      privateHandler._handleRemoteOperation(remoteAddOperation, 'remote-user-123', 'op-remote');

      // Add local node immediately after
      await new Promise(resolve => setTimeout(resolve, 10));
      graph.addNode({
        id: 'local-node',
        shape: 'rect',
        x: 300,
        y: 300,
        width: 80,
        height: 40,
      });

      // Assert: Only local node should be broadcast
      await new Promise(resolve => setTimeout(resolve, 100));
      const calls = mockWebSocketAdapter.sendDiagramOperation.mock.calls;
      const localNodeCalls = calls.filter(call => call[0].id === 'local-node');
      const remoteNodeCalls = calls.filter(call => call[0].id === 'remote-node');

      expect(localNodeCalls.length).toBeGreaterThan(0);
      expect(remoteNodeCalls.length).toBe(0);
    });
  });
});
