// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Graph, Node, Edge } from '@antv/x6';
import { DfdEdgeService, ConnectionValidationArgs, MagnetValidationArgs } from './dfd-edge.service';
import { LoggerService } from '../../../core/services/logger.service';
import { X6ZOrderAdapter } from '../infrastructure/adapters/x6-z-order.adapter';
import { X6HistoryManager } from '../infrastructure/adapters/x6-history-manager';
import { VisualEffectsService } from '../infrastructure/services/visual-effects.service';
import { EdgeService } from '../infrastructure/services/edge.service';
import { GraphHistoryCoordinator } from './graph-history-coordinator.service';
import { initializeX6CellExtensions } from '../utils/x6-cell-extensions';
import { registerCustomShapes } from '../infrastructure/adapters/x6-shape-definitions';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

// Mock interfaces for complex dependencies

interface MockX6ZOrderAdapter {
  setEdgeZOrderFromConnectedNodes: ReturnType<typeof vi.fn>;
}

interface MockX6HistoryManager {
  executeCommand?: ReturnType<typeof vi.fn>;
}

interface MockGraphHistoryCoordinator {
  executeVisualEffect: ReturnType<typeof vi.fn>;
}

interface MockVisualEffectsService {
  applyCreationHighlight: ReturnType<typeof vi.fn>;
}

interface MockEdgeService {
  createEdge: ReturnType<typeof vi.fn>;
  removeEdge: ReturnType<typeof vi.fn>;
}

describe('DfdEdgeService - Comprehensive Tests', () => {
  let service: DfdEdgeService;
  let graph: Graph;
  let mockLogger: MockLoggerService;
  let mockX6ZOrderAdapter: MockX6ZOrderAdapter;
  let mockX6HistoryManager: MockX6HistoryManager;
  let mockVisualEffectsService: MockVisualEffectsService;
  let mockEdgeService: MockEdgeService;
  let mockGraphHistoryCoordinator: MockGraphHistoryCoordinator;

  beforeEach(() => {
    // Initialize X6 cell extensions and register DFD shapes
    initializeX6CellExtensions();
    registerCustomShapes();

    // Create real X6 graph for integration testing
    graph = new Graph({
      container: document.createElement('div'),
      width: 800,
      height: 600,
    });

    // Create mocks for complex dependencies
    mockLogger = createTypedMockLoggerService();

    mockX6ZOrderAdapter = {
      setEdgeZOrderFromConnectedNodes: vi.fn(),
    };

    mockX6HistoryManager = {};

    mockVisualEffectsService = {
      applyCreationHighlight: vi.fn(),
    };

    mockGraphHistoryCoordinator = {
      executeVisualEffect: vi.fn((graph, operation) => operation()),
    };

    mockEdgeService = {
      createEdge: vi.fn(),
      removeEdge: vi.fn(),
    };

    // Create service instance
    service = new DfdEdgeService(
      mockLogger as unknown as LoggerService,
      mockX6ZOrderAdapter as unknown as X6ZOrderAdapter,
      mockX6HistoryManager as unknown as X6HistoryManager,
      mockVisualEffectsService as unknown as VisualEffectsService,
      mockEdgeService as unknown as EdgeService,
      mockGraphHistoryCoordinator as unknown as GraphHistoryCoordinator,
    );
  });

  afterEach(() => {
    graph.dispose();
  });

  describe('Edge Management - handleEdgeAdded', () => {
    it('should validate and accept valid edge with proper nodes', async () => {
      // Create test nodes
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
        width: 120,
        height: 60,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
        width: 140,
        height: 40,
      });

      // Create test edge
      const edge = graph.addEdge({
        id: 'test-edge',
        source: { cell: sourceNode.id },
        target: { cell: targetNode.id },
      });

      const result = await service.handleEdgeAdded(edge, graph, 'test-diagram', true).toPromise();

      expect(result).toBeUndefined(); // void return type
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Edge validated successfully',
        expect.objectContaining({
          edgeId: 'test-edge',
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        }),
      );
    });

    it('should throw error when graph not initialized', async () => {
      const edge = graph.addEdge({
        id: 'test-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      });

      await expect(async () => {
        await service.handleEdgeAdded(edge, graph, 'test-diagram', false).toPromise();
      }).rejects.toThrow('Graph is not initialized');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot handle edge added: Graph is not initialized',
      );
    });

    it('should remove and throw error for edge without valid source/target', async () => {
      const edge = graph.addEdge({
        id: 'invalid-edge',
        source: { cell: '' },
        target: { cell: 'target' },
      });

      await expect(async () => {
        await service.handleEdgeAdded(edge, graph, 'test-diagram', true).toPromise();
      }).rejects.toThrow('Edge added without valid source or target nodes');

      expect(mockEdgeService.removeEdge).toHaveBeenCalledWith(graph, 'invalid-edge');
    });

    it('should remove and throw error for edge referencing non-existent nodes', async () => {
      const edge = graph.addEdge({
        id: 'orphan-edge',
        source: { cell: 'non-existent-source' },
        target: { cell: 'non-existent-target' },
      });

      await expect(async () => {
        await service.handleEdgeAdded(edge, graph, 'test-diagram', true).toPromise();
      }).rejects.toThrow('Edge references non-existent nodes');

      expect(mockEdgeService.removeEdge).toHaveBeenCalledWith(graph, 'orphan-edge');
    });
  });

  describe('Edge Vertices Management - handleEdgeVerticesChanged', () => {
    it('should handle vertices change for valid edge', async () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      const edge = graph.addEdge({
        id: 'test-edge',
        source: { cell: sourceNode.id },
        target: { cell: targetNode.id },
      });

      const vertices = [
        { x: 200, y: 150 },
        { x: 250, y: 120 },
      ];

      const result = await service
        .handleEdgeVerticesChanged(edge.id, vertices, graph, 'test-diagram', true)
        .toPromise();

      expect(result).toBeUndefined(); // void return type
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Edge vertices changed',
        expect.objectContaining({
          edgeId: edge.id,
          vertexCount: 2,
          vertices,
        }),
      );
    });

    it('should throw error when graph not initialized for vertices change', async () => {
      const vertices = [{ x: 200, y: 150 }];

      await expect(async () => {
        await service
          .handleEdgeVerticesChanged('edge-id', vertices, graph, 'test-diagram', false)
          .toPromise();
      }).rejects.toThrow('Graph is not initialized');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot handle edge vertices changed: Graph is not initialized',
      );
    });

    it('should throw error for vertices change on non-existent edge', async () => {
      const vertices = [{ x: 200, y: 150 }];

      await expect(async () => {
        await service
          .handleEdgeVerticesChanged('non-existent-edge', vertices, graph, 'test-diagram', true)
          .toPromise();
      }).rejects.toThrow('Edge not found for vertices update');
    });
  });

  describe('Inverse Connection Creation', () => {
    it('should create inverse connection for valid edge', async () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      const originalEdge = graph.addEdge({
        id: 'original-edge',
        source: { cell: sourceNode.id, port: 'right' },
        target: { cell: targetNode.id, port: 'left' },
      });

      // Mock the edge service to return a mock edge
      const mockInverseEdge = { id: 'inverse-edge-mock' };
      mockEdgeService.createEdge.mockReturnValue(mockInverseEdge);

      const result = await service
        .addInverseConnection(originalEdge, graph, 'test-diagram')
        .toPromise();

      expect(result).toBeUndefined(); // void return type
      expect(mockEdgeService.createEdge).toHaveBeenCalledWith(
        graph,
        expect.objectContaining({
          source: expect.objectContaining({
            cell: targetNode.id, // Swapped
            port: 'left', // Swapped
          }),
          target: expect.objectContaining({
            cell: sourceNode.id, // Swapped
            port: 'right', // Swapped
          }),
        }),
        expect.objectContaining({
          ensureVisualRendering: true,
          updatePortVisibility: true,
        }),
      );
      expect(mockX6ZOrderAdapter.setEdgeZOrderFromConnectedNodes).toHaveBeenCalledWith(
        graph,
        mockInverseEdge,
      );
      expect(mockVisualEffectsService.applyCreationHighlight).toHaveBeenCalledWith(
        mockInverseEdge,
        graph,
      );
    });

    it('should throw error for inverse connection with missing source/target', async () => {
      const invalidEdge = graph.addEdge({
        id: 'invalid-edge',
        source: { cell: '' },
        target: { cell: 'target' },
      });

      await expect(async () => {
        await service.addInverseConnection(invalidEdge, graph, 'test-diagram').toPromise();
      }).rejects.toThrow('Cannot create inverse connection: edge missing source or target');
    });
  });

  describe('Edge Creation', () => {
    it('should create edge between valid nodes with default ports and label', () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      const mockCreatedEdge = { id: 'created-edge-mock' };
      mockEdgeService.createEdge.mockReturnValue(mockCreatedEdge);

      const result = service.createEdge(graph, sourceNode.id, targetNode.id);

      expect(result).toBe(mockCreatedEdge);
      expect(mockEdgeService.createEdge).toHaveBeenCalledWith(
        graph,
        expect.objectContaining({
          source: expect.objectContaining({
            cell: sourceNode.id,
            port: 'right',
          }),
          target: expect.objectContaining({
            cell: targetNode.id,
            port: 'left',
          }),
          attrs: expect.objectContaining({
            text: expect.objectContaining({
              text: 'Flow',
            }),
          }),
        }),
        expect.objectContaining({
          ensureVisualRendering: true,
          updatePortVisibility: true,
        }),
      );
      expect(mockVisualEffectsService.applyCreationHighlight).toHaveBeenCalledWith(
        mockCreatedEdge,
        graph,
      );
    });

    it('should create edge with custom ports and label', () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      const mockCreatedEdge = { id: 'created-edge-mock' };
      mockEdgeService.createEdge.mockReturnValue(mockCreatedEdge);

      const result = service.createEdge(
        graph,
        sourceNode.id,
        targetNode.id,
        'top',
        'bottom',
        'Custom Flow',
      );

      expect(result).toBe(mockCreatedEdge);
      expect(mockEdgeService.createEdge).toHaveBeenCalledWith(
        graph,
        expect.objectContaining({
          source: expect.objectContaining({
            cell: sourceNode.id,
            port: 'top',
          }),
          target: expect.objectContaining({
            cell: targetNode.id,
            port: 'bottom',
          }),
          attrs: expect.objectContaining({
            text: expect.objectContaining({
              text: 'Custom Flow',
            }),
          }),
        }),
        expect.any(Object),
      );
    });

    it('should return null for non-existent source node', () => {
      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      const result = service.createEdge(graph, 'non-existent-source', targetNode.id);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Source or target node not found',
        expect.objectContaining({
          sourceNodeId: 'non-existent-source',
          targetNodeId: targetNode.id,
        }),
      );
    });

    it('should return null for invalid connection based on DFD rules', () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'store', // Datastore can only connect to process
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'actor', // External entity cannot be target of datastore
        x: 300,
        y: 100,
      });

      const result = service.createEdge(graph, sourceNode.id, targetNode.id);

      expect(result).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Invalid connection attempt',
        expect.objectContaining({
          sourceType: 'store',
          targetType: 'actor',
        }),
      );
    });
  });

  describe('Edge Label Management', () => {
    let testEdge: Edge;

    beforeEach(() => {
      testEdge = graph.addEdge({
        id: 'test-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      });

      // Mock the setLabel method
      (testEdge as any).setLabel = vi.fn();
      (testEdge as any).getLabel = vi.fn().mockReturnValue('Test Label');
    });

    it('should update edge label', () => {
      service.updateEdgeLabel(testEdge, 'New Label');

      expect((testEdge as any).setLabel).toHaveBeenCalledWith('New Label');
      expect(mockLogger.info).toHaveBeenCalledWith('Edge label updated', {
        edgeId: testEdge.id,
        label: 'New Label',
      });
    });

    it('should remove edge label', () => {
      service.removeEdgeLabel(testEdge);

      expect((testEdge as any).setLabel).toHaveBeenCalledWith('');
      expect(mockLogger.info).toHaveBeenCalledWith('Edge label removed', {
        edgeId: testEdge.id,
      });
    });

    it('should get edge label', () => {
      const result = service.getEdgeLabel(testEdge);

      expect(result).toBe('Test Label');
      expect((testEdge as any).getLabel).toHaveBeenCalled();
    });

    it('should handle missing setLabel method gracefully', () => {
      // Mock an edge without setLabel method
      const mockEdgeWithoutSetLabel = {
        id: 'edge-without-setlabel',
        setLabel: undefined,
      } as any;

      service.updateEdgeLabel(mockEdgeWithoutSetLabel, 'New Label');

      expect(mockLogger.warn).toHaveBeenCalledWith('Edge does not support setLabel method', {
        edgeId: mockEdgeWithoutSetLabel.id,
      });
    });
  });

  describe('Edge Style Management', () => {
    let testEdge: Edge;

    beforeEach(() => {
      testEdge = graph.addEdge({
        id: 'test-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      });

      testEdge.setAttrs = vi.fn();
    });

    it('should update edge style with all properties', () => {
      const style = {
        stroke: '#ff0000',
        strokeWidth: 3,
        strokeDasharray: '5,5',
      };

      service.updateEdgeStyle(testEdge, style);

      expect(testEdge.setAttrs).toHaveBeenCalledWith({
        'line/stroke': '#ff0000',
        'line/strokeWidth': 3,
        'line/strokeDasharray': '5,5',
      });
      expect(mockLogger.info).toHaveBeenCalledWith('Edge style updated', {
        edgeId: testEdge.id,
        style,
      });
    });

    it('should update edge style with partial properties', () => {
      const style = {
        stroke: '#00ff00',
      };

      service.updateEdgeStyle(testEdge, style);

      expect(testEdge.setAttrs).toHaveBeenCalledWith({
        'line/stroke': '#00ff00',
      });
    });
  });

  describe('Edge Query Operations', () => {
    let sourceNode: Node;
    let targetNode: Node;
    let testEdge: Edge;

    beforeEach(() => {
      sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      testEdge = graph.addEdge({
        id: 'test-edge',
        source: { cell: sourceNode.id },
        target: { cell: targetNode.id },
      });
    });

    it('should check if edge is connected to node', () => {
      expect(service.isEdgeConnectedToNode(testEdge, sourceNode.id)).toBe(true);
      expect(service.isEdgeConnectedToNode(testEdge, targetNode.id)).toBe(true);
      expect(service.isEdgeConnectedToNode(testEdge, 'unrelated-node')).toBe(false);
    });

    it('should get all edges connected to a node', () => {
      const edges = service.getNodeEdges(graph, sourceNode.id);

      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe(testEdge.id);
    });

    it('should get incoming edges for a node', () => {
      const incomingEdges = service.getIncomingEdges(graph, targetNode.id);

      expect(incomingEdges).toHaveLength(1);
      expect(incomingEdges[0].id).toBe(testEdge.id);

      const noIncomingEdges = service.getIncomingEdges(graph, sourceNode.id);
      expect(noIncomingEdges).toHaveLength(0);
    });

    it('should get outgoing edges for a node', () => {
      const outgoingEdges = service.getOutgoingEdges(graph, sourceNode.id);

      expect(outgoingEdges).toHaveLength(1);
      expect(outgoingEdges[0].id).toBe(testEdge.id);

      const noOutgoingEdges = service.getOutgoingEdges(graph, targetNode.id);
      expect(noOutgoingEdges).toHaveLength(0);
    });

    it('should remove all edges connected to a node', () => {
      service.removeNodeEdges(graph, sourceNode.id);

      expect(mockEdgeService.removeEdge).toHaveBeenCalledWith(graph, testEdge.id);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Removed edges connected to node',
        expect.objectContaining({
          nodeId: sourceNode.id,
          edgeCount: 1,
        }),
      );
    });
  });

  describe('Edge Connection Validation', () => {
    let sourceNode: Node;
    let targetNode: Node;

    beforeEach(() => {
      sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
        ports: {
          items: [
            { id: 'top', group: 'top' },
            { id: 'right', group: 'right' },
            { id: 'bottom', group: 'bottom' },
            { id: 'left', group: 'left' },
          ],
        },
      });

      targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
        ports: {
          items: [
            { id: 'top', group: 'top' },
            { id: 'right', group: 'right' },
            { id: 'bottom', group: 'bottom' },
            { id: 'left', group: 'left' },
          ],
        },
      });
    });

    it('should validate valid edge connection', () => {
      const result = service.validateEdgeConnection(
        graph,
        sourceNode.id,
        targetNode.id,
        'right',
        'left',
      );

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject connection to non-existent source node', () => {
      const result = service.validateEdgeConnection(graph, 'non-existent-source', targetNode.id);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Source node not found');
    });

    it('should reject connection to non-existent target node', () => {
      const result = service.validateEdgeConnection(graph, sourceNode.id, 'non-existent-target');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target node not found');
    });

    it('should reject self-connection', () => {
      const result = service.validateEdgeConnection(graph, sourceNode.id, sourceNode.id);

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Cannot connect node to itself');
    });

    it('should reject connection not allowed by DFD rules', () => {
      const externalEntityNode = graph.addNode({
        id: 'external-entity',
        shape: 'actor',
        x: 500,
        y: 100,
      });

      const result = service.validateEdgeConnection(
        graph,
        targetNode.id, // datastore
        externalEntityNode.id, // external entity - not allowed
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Connection not allowed by DFD rules');
    });

    it('should reject connection to non-existent source port', () => {
      const result = service.validateEdgeConnection(
        graph,
        sourceNode.id,
        targetNode.id,
        'non-existent-port',
        'left',
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Source port not found');
    });

    it('should reject connection to non-existent target port', () => {
      const result = service.validateEdgeConnection(
        graph,
        sourceNode.id,
        targetNode.id,
        'right',
        'non-existent-port',
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target port not found');
    });

    it('should reject duplicate connections', () => {
      // Create an existing edge
      graph.addEdge({
        id: 'existing-edge',
        source: { cell: sourceNode.id, port: 'right' },
        target: { cell: targetNode.id, port: 'left' },
      });

      const result = service.validateEdgeConnection(
        graph,
        sourceNode.id,
        targetNode.id,
        'right',
        'left',
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Connection already exists');
    });
  });

  describe('Connection Validation - Magnet and Port Validation', () => {
    it('should validate magnet with correct attributes', () => {
      const mockMagnet = document.createElement('div');
      mockMagnet.setAttribute('magnet', 'true');
      mockMagnet.setAttribute('port-group', 'top');

      const args: MagnetValidationArgs = { magnet: mockMagnet };
      const result = service.isMagnetValid(args);

      expect(result).toBe(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdEdge',
        'isMagnetValid result',
        expect.objectContaining({
          magnetAttribute: 'true',
          portGroup: 'top',
          isValid: true,
        }),
      );
    });

    it('should reject magnet with invalid attributes', () => {
      const mockMagnet = document.createElement('div');
      mockMagnet.setAttribute('magnet', 'false');

      const args: MagnetValidationArgs = { magnet: mockMagnet };
      const result = service.isMagnetValid(args);

      expect(result).toBe(false);
    });

    it('should reject magnet validation when no magnet provided', () => {
      const args: MagnetValidationArgs = { magnet: null as any };
      const result = service.isMagnetValid(args);

      expect(result).toBe(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdEdge',
        'isMagnetValid: no magnet found',
      );
    });

    it('should validate connection between different ports', () => {
      const mockSourceView = { id: 'source-view' };
      const mockTargetView = { id: 'target-view' };
      const mockSourceMagnet = document.createElement('div');
      const mockTargetMagnet = document.createElement('div');

      mockSourceMagnet.setAttribute('port-group', 'right');
      mockTargetMagnet.setAttribute('port-group', 'left');

      const args: ConnectionValidationArgs = {
        sourceView: mockSourceView,
        targetView: mockTargetView,
        sourceMagnet: mockSourceMagnet,
        targetMagnet: mockTargetMagnet,
      };

      const result = service.isConnectionValid(args);

      expect(result).toBe(true);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdEdge',
        'Connection validation passed',
      );
    });

    it('should reject connection to same port on same node', () => {
      const mockView = { id: 'same-view' };
      const mockMagnet = document.createElement('div');

      const args: ConnectionValidationArgs = {
        sourceView: mockView,
        targetView: mockView,
        sourceMagnet: mockMagnet,
        targetMagnet: mockMagnet,
      };

      const result = service.isConnectionValid(args);

      expect(result).toBe(false);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdEdge',
        'Connection rejected: same port on same node',
      );
    });
  });

  describe('DFD Connection Rules', () => {
    let processNode: Node;
    let datastoreNode: Node;
    let externalEntityNode: Node;

    beforeEach(() => {
      processNode = graph.addNode({
        id: 'process-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      datastoreNode = graph.addNode({
        id: 'datastore-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      externalEntityNode = graph.addNode({
        id: 'external-entity-node',
        shape: 'actor',
        x: 500,
        y: 100,
      });
    });

    it('should allow process to connect to datastore', () => {
      const result = service.isNodeConnectionValid(processNode, datastoreNode);
      expect(result).toBe(true);
    });

    it('should allow process to connect to external entity', () => {
      const result = service.isNodeConnectionValid(processNode, externalEntityNode);
      expect(result).toBe(true);
    });

    it('should allow process to connect to another process', () => {
      const anotherProcessNode = graph.addNode({
        id: 'another-process',
        shape: 'process',
        x: 700,
        y: 100,
      });

      const result = service.isNodeConnectionValid(processNode, anotherProcessNode);
      expect(result).toBe(true);
    });

    it('should allow datastore to connect to process', () => {
      const result = service.isNodeConnectionValid(datastoreNode, processNode);
      expect(result).toBe(true);
    });

    it('should allow external entity to connect to process', () => {
      const result = service.isNodeConnectionValid(externalEntityNode, processNode);
      expect(result).toBe(true);
    });

    it('should reject datastore to external entity connection', () => {
      const result = service.isNodeConnectionValid(datastoreNode, externalEntityNode);
      expect(result).toBe(false);
    });

    it('should reject external entity to datastore connection', () => {
      const result = service.isNodeConnectionValid(externalEntityNode, datastoreNode);
      expect(result).toBe(false);
    });

    it('should get valid connection targets for process', () => {
      const targets = service.getValidConnectionTargets('process');
      expect(targets).toEqual(['store', 'actor', 'process']);
    });

    it('should get valid connection targets for datastore', () => {
      const targets = service.getValidConnectionTargets('store');
      expect(targets).toEqual(['process']);
    });

    it('should check if shapes can connect', () => {
      expect(service.canShapesConnect('process', 'store')).toBe(true);
      expect(service.canShapesConnect('store', 'actor')).toBe(false);
    });
  });

  describe('Node Shape Validation', () => {
    it('should validate valid node shapes', () => {
      const validShapes = service.getValidNodeShapes();
      expect(validShapes).toEqual(['process', 'store', 'actor', 'security-boundary', 'text-box']);
    });

    it('should validate node shape without throwing', () => {
      expect(() => {
        service.validateNodeShape('process', 'test-node');
      }).not.toThrow();
    });

    it('should throw error for invalid node shape', () => {
      expect(() => {
        service.validateNodeShape('invalid-shape', 'test-node');
      }).toThrow("Invalid node shape: 'invalid-shape' is not a recognized shape type");
    });

    it('should throw error for empty node shape', () => {
      expect(() => {
        service.validateNodeShape('', 'test-node');
      }).toThrow('Invalid node shape: shape property must be a non-empty string');
    });

    it('should validate X6 node shape', () => {
      const mockX6Node = {
        id: 'test-node',
        shape: 'process',
      } as Node;

      expect(() => {
        service.validateX6NodeShape(mockX6Node);
      }).not.toThrow();
    });

    it('should warn for unexpected X6 node shape', () => {
      const mockX6Node = {
        id: 'test-node',
        shape: 'unexpected-shape',
      } as Node;

      service.validateX6NodeShape(mockX6Node);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'X6 node created with unexpected shape',
        expect.objectContaining({
          nodeId: 'test-node',
          shape: 'unexpected-shape',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle EdgeService failures gracefully in createEdge', () => {
      const sourceNode = graph.addNode({
        id: 'source-node',
        shape: 'process',
        x: 100,
        y: 100,
      });

      const targetNode = graph.addNode({
        id: 'target-node',
        shape: 'store',
        x: 300,
        y: 100,
      });

      mockEdgeService.createEdge.mockImplementation(() => {
        throw new Error('EdgeService failed');
      });

      const result = service.createEdge(graph, sourceNode.id, targetNode.id);

      expect(result).toBeNull();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create edge',
        expect.objectContaining({
          error: expect.any(Error),
          sourceNodeId: sourceNode.id,
          targetNodeId: targetNode.id,
        }),
      );
    });

    it('should handle label method failures gracefully', () => {
      const testEdge = graph.addEdge({
        id: 'test-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      });

      (testEdge as any).setLabel = vi.fn().mockImplementation(() => {
        throw new Error('Label method failed');
      });

      service.updateEdgeLabel(testEdge, 'New Label');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update edge label',
        expect.objectContaining({
          error: expect.any(Error),
          edgeId: testEdge.id,
          label: 'New Label',
        }),
      );
    });

    it('should handle style update failures gracefully', () => {
      const testEdge = graph.addEdge({
        id: 'test-edge',
        source: { cell: 'source' },
        target: { cell: 'target' },
      });

      testEdge.setAttrs = vi.fn().mockImplementation(() => {
        throw new Error('Style update failed');
      });

      const style = { stroke: '#ff0000' };
      service.updateEdgeStyle(testEdge, style);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to update edge style',
        expect.objectContaining({
          error: expect.any(Error),
          edgeId: testEdge.id,
          style,
        }),
      );
    });
  });
});
