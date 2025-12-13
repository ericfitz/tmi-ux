/**
 * @vitest-environment jsdom
 */

/**
 * Unit tests for AppDiagramOperationBroadcaster service
 *
 * Test execution:
 * pnpm test -- src/app/pages/dfd/application/services/app-diagram-operation-broadcaster.service.spec.ts
 *
 * IMPORTANT: Never skip tests or use .skip/.only in committed code
 */

import '@angular/compiler';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of, throwError } from 'rxjs';
import { AppDiagramOperationBroadcaster } from './app-diagram-operation-broadcaster.service';
import { createMockLogger, createMockAppStateService } from './test-helpers/mock-services';

describe('AppDiagramOperationBroadcaster', () => {
  let service: AppDiagramOperationBroadcaster;
  let mockWebsocketAdapter: any;
  let mockAppStateService: ReturnType<typeof createMockAppStateService>;
  let mockCollaborationService: any;
  let mockOperationStateManager: any;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockGraph: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock InfraWebsocketCollaborationAdapter
    mockWebsocketAdapter = {
      sendDiagramOperation: vi.fn(() => of(undefined)),
    };

    // Mock AppStateService with default state
    mockAppStateService = createMockAppStateService();

    // Mock DfdCollaborationService
    mockCollaborationService = {
      isCollaborating: vi.fn(() => true),
    };

    // Mock AppOperationStateManager
    mockOperationStateManager = {
      isDragInProgress: vi.fn(() => false),
      shouldExcludeAttribute: vi.fn(() => false),
    };

    // Mock LoggerService
    mockLogger = createMockLogger();

    // Mock X6 Graph
    mockGraph = {
      on: vi.fn(),
      off: vi.fn(),
      getCellById: vi.fn(),
      options: { id: 'test-graph' },
    };

    service = new AppDiagramOperationBroadcaster(
      mockWebsocketAdapter,
      mockAppStateService as any,
      mockCollaborationService,
      mockOperationStateManager,
      mockLogger as any,
    );
  });

  afterEach(() => {
    service.dispose();
  });

  describe('Initialization', () => {
    it('should initialize event listeners when in collaboration mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(true);

      service.initializeListeners(mockGraph);

      expect(mockGraph.on).toHaveBeenCalledWith('cell:added', expect.any(Function));
      expect(mockGraph.on).toHaveBeenCalledWith('cell:removed', expect.any(Function));
      expect(mockGraph.on).toHaveBeenCalledWith('cell:change:*', expect.any(Function));
      expect(mockGraph.on).toHaveBeenCalledWith('edge:change:source', expect.any(Function));
      expect(mockGraph.on).toHaveBeenCalledWith('edge:change:target', expect.any(Function));
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'DiagramOperationBroadcaster initialized',
        { graphId: 'test-graph' },
      );
    });

    it('should skip initialization when not in collaboration mode', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);

      service.initializeListeners(mockGraph);

      expect(mockGraph.on).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'Not in collaboration mode, skipping broadcast initialization',
      );
    });
  });

  describe('Atomic Operations', () => {
    it('should start an atomic operation', () => {
      service.startAtomicOperation();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'Started atomic operation',
      );
    });

    it('should warn when starting nested atomic operation', () => {
      service.startAtomicOperation();
      service.startAtomicOperation();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Already in atomic operation, nested operations not supported',
      );
    });

    it('should commit atomic operation with pending operations', () => {
      service.initializeListeners(mockGraph);
      service.startAtomicOperation();

      // Simulate a cell addition by calling the event handler
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      expect(onCellAdded).toBeDefined();

      const mockCell = {
        id: 'cell-1',
        shape: 'rect',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: () => 'Test Label',
        getAttrs: () => ({}),
      };

      mockGraph.getCellById.mockReturnValue(null); // New cell

      onCellAdded({ cell: mockCell });

      service.commitAtomicOperation();

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'cell-1',
          operation: 'add',
          data: {
            id: 'cell-1',
            shape: 'rect',
            x: 100,
            y: 200,
            width: 80,
            height: 60,
            label: 'Test Label',
          },
        },
      ]);
    });

    it('should handle empty atomic operation commit', () => {
      service.startAtomicOperation();
      service.commitAtomicOperation();

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'No operations to commit in atomic operation',
      );
    });

    it('should cancel atomic operation', () => {
      service.initializeListeners(mockGraph);
      service.startAtomicOperation();

      // Add a pending operation
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      const mockCell = {
        id: 'cell-1',
        shape: 'rect',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: () => 'Test Label',
        getAttrs: () => ({}),
      };
      mockGraph.getCellById.mockReturnValue(null);
      onCellAdded({ cell: mockCell });

      service.cancelAtomicOperation();

      // Should not send operations after cancel
      service.commitAtomicOperation();
      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should log error when commit fails', () => {
      const error = new Error('Network error');
      mockWebsocketAdapter.sendDiagramOperation.mockReturnValue(throwError(() => error));

      service.initializeListeners(mockGraph);
      service.startAtomicOperation();

      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      const mockCell = {
        id: 'cell-1',
        shape: 'rect',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: () => '',
        getAttrs: () => ({}),
      };
      mockGraph.getCellById.mockReturnValue(null);
      onCellAdded({ cell: mockCell });

      service.commitAtomicOperation();

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to broadcast atomic operation', error);
    });

    it('should skip atomic operations when not collaborating', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);

      service.startAtomicOperation();
      service.commitAtomicOperation();
      service.cancelAtomicOperation();

      expect(mockLogger.debugComponent).not.toHaveBeenCalled();
    });
  });

  describe('Event Listener Setup', () => {
    it('should register all required event listeners', () => {
      service.initializeListeners(mockGraph);

      const registeredEvents = mockGraph.on.mock.calls.map(([event]: any[]) => event);
      expect(registeredEvents).toContain('cell:added');
      expect(registeredEvents).toContain('cell:removed');
      expect(registeredEvents).toContain('cell:change:*');
      expect(registeredEvents).toContain('edge:change:source');
      expect(registeredEvents).toContain('edge:change:target');
    });

    it('should clean up event listeners on dispose', () => {
      service.initializeListeners(mockGraph);

      service.dispose();

      expect(mockGraph.off).toHaveBeenCalledTimes(5);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'DiagramOperationBroadcaster disposed',
      );
    });

    it('should cancel pending atomic operation on dispose', () => {
      service.initializeListeners(mockGraph);
      service.startAtomicOperation();

      service.dispose();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        'Cancelled atomic operation',
        { discardedOperations: 0 },
      );
    });
  });

  describe('Broadcast Filtering', () => {
    beforeEach(() => {
      service.initializeListeners(mockGraph);
    });

    it('should skip broadcast when applying remote change', () => {
      mockAppStateService.getCurrentState.mockReturnValue({
        isApplyingRemoteChange: true,
        isBlockingOperations: false,
        isApplyingUndoRedo: false,
        readOnly: false,
      });

      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      const mockCell = {
        id: 'cell-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        '✓ Skipping broadcast - applying remote change',
        expect.objectContaining({ isApplyingRemoteChange: true }),
      );
    });

    it('should block broadcast in read-only mode', () => {
      mockAppStateService.getCurrentState.mockReturnValue({
        isApplyingRemoteChange: false,
        isBlockingOperations: false,
        isApplyingUndoRedo: false,
        readOnly: true,
      });

      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      const mockCell = {
        id: 'cell-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '✓ Blocked local change broadcast in read-only mode',
        expect.any(Object),
      );
    });

    it('should skip broadcast when not collaborating', () => {
      mockCollaborationService.isCollaborating.mockReturnValue(false);

      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];
      const mockCell = {
        id: 'cell-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should skip intermediate drag position changes', () => {
      mockOperationStateManager.isDragInProgress.mockReturnValue(true);

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];
      const mockCell = { id: 'cell-1', isNode: () => true, isEdge: () => false };

      onCellChanged({
        cell: mockCell,
        key: 'position',
        current: { x: 150, y: 250 },
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        '✓ Skipping broadcast - intermediate drag event',
        expect.any(Object),
      );
    });

    it('should skip intermediate drag size changes', () => {
      mockOperationStateManager.isDragInProgress.mockReturnValue(true);

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];
      const mockCell = { id: 'cell-1', isNode: () => true, isEdge: () => false };

      onCellChanged({
        cell: mockCell,
        key: 'size',
        current: { width: 100, height: 80 },
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should skip intermediate drag vertices changes', () => {
      mockOperationStateManager.isDragInProgress.mockReturnValue(true);

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];
      const mockCell = { id: 'edge-1', isNode: () => false, isEdge: () => true };

      onCellChanged({
        cell: mockCell,
        key: 'vertices',
        current: [{ x: 100, y: 100 }],
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should skip visual-only attribute changes', () => {
      mockOperationStateManager.shouldExcludeAttribute.mockReturnValue(true);

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];
      const mockCell = { id: 'cell-1', isNode: () => true, isEdge: () => false };

      onCellChanged({
        cell: mockCell,
        key: 'attrs/body/filter',
        current: 'drop-shadow',
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        '✓ Skipping broadcast - visual-only changes',
        expect.objectContaining({ attributePaths: ['body/filter'] }),
      );
    });

    it('should skip port visibility changes', () => {
      // Port visibility changes are detected via visual attributes
      mockOperationStateManager.shouldExcludeAttribute.mockImplementation(
        (attrPath?: string, propPath?: string) => {
          if (propPath && propPath.includes('ports/items/') && propPath.includes('visibility')) {
            return true;
          }
          return false;
        },
      );

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];
      const mockCell = { id: 'cell-1', isNode: () => true, isEdge: () => false };

      onCellChanged({
        cell: mockCell,
        key: 'ports',
        current: {},
        options: { propertyPath: 'ports/items/0/attrs/circle/style/visibility' },
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'AppDiagramOperationBroadcaster',
        '✓ Skipping broadcast - port visibility only',
        expect.any(Object),
      );
    });
  });

  describe('Event to Operation Conversion', () => {
    beforeEach(() => {
      service.initializeListeners(mockGraph);
    });

    it('should convert cell:added event to add operation for new node', () => {
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        shape: 'process',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: (path: string) => (path === 'text/text' ? 'Process Node' : ''),
        getAttrs: () => ({ body: { fill: '#blue' } }),
      };

      mockGraph.getCellById.mockReturnValue(null); // New cell

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'add',
          data: {
            id: 'node-1',
            shape: 'process',
            x: 100,
            y: 200,
            width: 80,
            height: 60,
            label: 'Process Node',
            attrs: { body: { fill: '#blue' } },
          },
        },
      ]);
    });

    it('should convert cell:added event to add operation for new edge', () => {
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      const mockCell = {
        id: 'edge-1',
        shape: 'edge',
        isNode: () => false,
        isEdge: () => true,
        getSource: () => ({ cell: 'node-1', port: 'out' }),
        getTarget: () => ({ cell: 'node-2', port: 'in' }),
        getVertices: () => [{ x: 150, y: 150 }],
        getLabels: () => [{ attrs: { text: { text: 'Flow' } } }],
        getAttrs: () => ({ line: { stroke: '#000' } }),
      };

      mockGraph.getCellById.mockReturnValue(null); // New cell

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'edge-1',
          operation: 'add',
          data: {
            id: 'edge-1',
            shape: 'edge',
            source: { cell: 'node-1', port: 'out' },
            target: { cell: 'node-2', port: 'in' },
            vertices: [{ x: 150, y: 150 }],
            labels: [{ attrs: { text: { text: 'Flow' } } }],
            attrs: { line: { stroke: '#000' } },
          },
        },
      ]);
    });

    it('should convert cell:added event to update operation when cell exists', () => {
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        shape: 'process',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: () => 'Process',
        getAttrs: () => ({}),
      };

      const existingCell = { id: 'node-1' };
      mockGraph.getCellById.mockReturnValue(existingCell);

      onCellAdded({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'update',
          data: expect.any(Object),
        },
      ]);
    });

    it('should convert cell:removed event to remove operation', () => {
      const onCellRemoved = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:removed',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellRemoved({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'remove',
        },
      ]);
    });

    it('should convert position change to update operation', () => {
      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellChanged({
        cell: mockCell,
        key: 'position',
        current: { x: 150, y: 250 },
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'update',
          data: { x: 150, y: 250 },
        },
      ]);
    });

    it('should convert size change to update operation', () => {
      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellChanged({
        cell: mockCell,
        key: 'size',
        current: { width: 100, height: 80 },
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'update',
          data: { width: 100, height: 80 },
        },
      ]);
    });

    it('should convert label change to update operation', () => {
      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellChanged({
        cell: mockCell,
        key: 'attrs/text/text',
        current: 'Updated Label',
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'node-1',
          operation: 'update',
          data: { label: 'Updated Label' },
        },
      ]);
    });

    it('should convert vertices change to update operation', () => {
      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'edge-1',
        isNode: () => false,
        isEdge: () => true,
      };

      const vertices = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
      ];

      onCellChanged({
        cell: mockCell,
        key: 'vertices',
        current: vertices,
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'edge-1',
          operation: 'update',
          data: { vertices },
        },
      ]);
    });

    it('should convert edge source change to update operation', () => {
      const onEdgeSourceChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'edge:change:source',
      )?.[1];

      const mockEdge = {
        id: 'edge-1',
        isNode: () => false,
        isEdge: () => true,
        getSource: () => ({ cell: 'node-2', port: 'out' }),
        getTarget: () => ({ cell: 'node-3', port: 'in' }),
      };

      onEdgeSourceChanged({ cell: mockEdge });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'edge-1',
          operation: 'update',
          data: { source: { cell: 'node-2', port: 'out' } },
        },
      ]);
    });

    it('should convert edge target change to update operation', () => {
      const onEdgeTargetChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'edge:change:target',
      )?.[1];

      const mockEdge = {
        id: 'edge-1',
        isNode: () => false,
        isEdge: () => true,
        getSource: () => ({ cell: 'node-1', port: 'out' }),
        getTarget: () => ({ cell: 'node-3', port: 'in' }),
      };

      onEdgeTargetChanged({ cell: mockEdge });

      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        {
          id: 'edge-1',
          operation: 'update',
          data: { target: { cell: 'node-3', port: 'in' } },
        },
      ]);
    });

    it('should skip events with invalid cells', () => {
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      onCellAdded({ cell: null });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith('Cannot convert event - invalid cell', {
        event: 'cell:added',
      });
    });

    it('should skip changes with no semantic data', () => {
      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      // Change with no key or current value
      onCellChanged({ cell: mockCell });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });

    it('should exclude visual attributes from semantic changes', () => {
      mockOperationStateManager.shouldExcludeAttribute.mockReturnValue(true);

      const onCellChanged = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:change:*',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellChanged({
        cell: mockCell,
        key: 'attrs/body/filter',
        current: 'drop-shadow',
      });

      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      service.initializeListeners(mockGraph);
    });

    it('should log error when event handling fails', () => {
      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => {
          throw new Error('Position error');
        },
      };

      mockGraph.getCellById.mockReturnValue(null);

      onCellAdded({ cell: mockCell });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error handling cell event',
        expect.objectContaining({ event: 'cell:added' }),
      );
    });

    it('should log error when single operation broadcast fails', () => {
      const error = new Error('Broadcast failed');
      mockWebsocketAdapter.sendDiagramOperation.mockReturnValue(throwError(() => error));

      const onCellRemoved = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:removed',
      )?.[1];

      const mockCell = {
        id: 'node-1',
        isNode: () => true,
        isEdge: () => false,
      };

      onCellRemoved({ cell: mockCell });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to broadcast single operation', error);
    });
  });

  describe('Batching Operations', () => {
    beforeEach(() => {
      service.initializeListeners(mockGraph);
    });

    it('should batch operations during atomic operation', () => {
      service.startAtomicOperation();

      const onCellAdded = mockGraph.on.mock.calls.find(
        ([event]: any[]) => event === 'cell:added',
      )?.[1];

      const mockCell1 = {
        id: 'node-1',
        shape: 'rect',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 100, y: 100 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: (path: string) => (path === 'text/text' ? 'Node 1' : ''),
        getAttrs: () => ({}),
      };

      const mockCell2 = {
        id: 'node-2',
        shape: 'rect',
        isNode: () => true,
        isEdge: () => false,
        getPosition: () => ({ x: 200, y: 200 }),
        getSize: () => ({ width: 80, height: 60 }),
        getAttrByPath: (path: string) => (path === 'text/text' ? 'Node 2' : ''),
        getAttrs: () => ({}),
      };

      mockGraph.getCellById.mockReturnValue(null);

      onCellAdded({ cell: mockCell1 });
      onCellAdded({ cell: mockCell2 });

      // Operations should not be sent yet
      expect(mockWebsocketAdapter.sendDiagramOperation).not.toHaveBeenCalled();

      service.commitAtomicOperation();

      // Both operations should be sent together
      expect(mockWebsocketAdapter.sendDiagramOperation).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'node-1', operation: 'add' }),
        expect.objectContaining({ id: 'node-2', operation: 'add' }),
      ]);
    });
  });
});
