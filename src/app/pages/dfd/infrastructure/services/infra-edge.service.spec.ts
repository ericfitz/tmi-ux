// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { Graph, Node, Edge } from '@antv/x6';
import { EdgeService } from './edge.service';
import { EdgeQueryService } from './edge-query.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { PortStateManagerService } from './port-state-manager.service';
import { X6CoreOperationsService } from './x6-core-operations.service';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';
import { expect, beforeEach, afterEach, describe, it } from 'vitest';

// Mock interface for LoggerService only (cross-cutting concern)

describe('EdgeService - X6 Integration Tests', () => {
  let service: EdgeService;
  let queryService: EdgeQueryService;
  let portStateManager: PortStateManagerService;
  let x6CoreOps: X6CoreOperationsService;
  let graph: Graph;
  let sourceNode: Node;
  let targetNode: Node;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    // Initialize X6 cell extensions
    initializeX6CellExtensions();

    // Create mock for LoggerService (cross-cutting concern)
    mockLogger = createTypedMockLoggerService();

    // Create real service instances for integration testing
    queryService = new EdgeQueryService(mockLogger as unknown as LoggerService);
    portStateManager = new PortStateManagerService(
      queryService,
      mockLogger as unknown as LoggerService,
    );
    x6CoreOps = new X6CoreOperationsService(mockLogger as unknown as LoggerService);
    // Create EdgeService with real port management services
    service = new EdgeService(mockLogger as unknown as LoggerService, portStateManager, x6CoreOps);

    // Create real X6 graph instance
    const container = document.createElement('div');
    graph = new Graph({ container });

    // Create test nodes using basic X6 shapes
    sourceNode = graph.addNode({
      id: 'source-1',
      shape: 'rect',
      x: 100,
      y: 100,
      width: 120,
      height: 80,
      ports: [
        { id: 'top', position: { name: 'top' } },
        { id: 'right', position: { name: 'right' } },
        { id: 'bottom', position: { name: 'bottom' } },
        { id: 'left', position: { name: 'left' } },
      ],
    });

    targetNode = graph.addNode({
      id: 'target-1',
      shape: 'rect',
      x: 300,
      y: 100,
      width: 140,
      height: 100,
      ports: [
        { id: 'top', position: { name: 'top' } },
        { id: 'right', position: { name: 'right' } },
        { id: 'bottom', position: { name: 'bottom' } },
        { id: 'left', position: { name: 'left' } },
      ],
    });

    // Set initial port visibility to hidden
    sourceNode.getPorts().forEach(port => {
      sourceNode.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
    });
    targetNode.getPorts().forEach(port => {
      targetNode.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
    });
  });

  afterEach(() => {
    graph.dispose();
  });

  describe('Edge Creation', () => {
    it('should create edge with correct X6 properties and update port visibility', () => {
      const edgeInfo = EdgeInfo.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Data Flow',
      });

      const x6Edge = service.createEdge(graph, edgeInfo);

      // Validate edge properties
      expect(x6Edge.id).toBe('edge-1');
      expect(x6Edge.getSource()).toEqual({ cell: 'source-1', port: 'right' });
      expect(x6Edge.getTarget()).toEqual({ cell: 'target-1', port: 'left' });
      expect(x6Edge.shape).toBe('edge');

      // Validate edge visual properties
      expect(x6Edge.getAttrByPath('line/stroke')).toBe('#000000');
      expect(x6Edge.getAttrByPath('line/strokeWidth')).toBe(2);
      expect(x6Edge.getAttrByPath('line/targetMarker')).toMatchObject({
        name: 'classic',
        size: 8,
      });

      // Validate connected ports are visible
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('visible');
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('visible');

      // Validate other ports remain hidden
      expect(sourceNode.getPortProp('top', 'attrs/circle/style/visibility')).toBe('hidden');
      expect(targetNode.getPortProp('top', 'attrs/circle/style/visibility')).toBe('hidden');
    });

    it('should create edge with specific ports', () => {
      const edgeInfo = EdgeInfo.createWithPorts(
        'edge-2',
        'source-1',
        'target-1',
        'top',
        'bottom',
        'Custom Flow',
      );

      const x6Edge = service.createEdge(graph, edgeInfo);

      expect(x6Edge.getSource()).toEqual({ cell: 'source-1', port: 'top' });
      expect(x6Edge.getTarget()).toEqual({ cell: 'target-1', port: 'bottom' });

      // Validate specific port visibility
      expect(sourceNode.getPortProp('top', 'attrs/circle/style/visibility')).toBe('visible');
      expect(targetNode.getPortProp('bottom', 'attrs/circle/style/visibility')).toBe('visible');
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('hidden');
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('hidden');
    });
  });

  describe('Edge Updates', () => {
    let edge: Edge;

    beforeEach(() => {
      const edgeInfo = EdgeInfo.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Original Flow',
      });
      edge = service.createEdge(graph, edgeInfo);
    });

    it('should update edge label', () => {
      service.updateEdge(edge, { label: 'Updated Flow' });

      // Use standardized getLabel method
      expect((edge as any).getLabel()).toBe('Updated Flow');
    });

    it('should update edge vertices', () => {
      const vertices = [
        { x: 200, y: 50 },
        { x: 250, y: 150 },
      ];

      service.updateEdge(edge, { vertices });

      expect(edge.getVertices()).toEqual(vertices);
    });

    it('should update edge connection and port visibility', () => {
      const newTargetNode = graph.addNode({
        id: 'new-target',
        shape: 'rect',
        x: 400,
        y: 200,
        ports: [{ id: 'left', position: { name: 'left' } }],
      });
      newTargetNode.setPortProp('left', 'attrs/circle/style/visibility', 'hidden');

      service.updateEdge(
        edge,
        {
          target: { cell: 'new-target', port: 'left' },
        },
        { graph },
      );

      // Validate edge connection
      expect(edge.getTarget()).toEqual({ cell: 'new-target', port: 'left' });

      // Validate old target port is hidden
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('hidden');

      // Validate new target port is visible
      expect(newTargetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('visible');

      // Validate source port remains visible
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('visible');
    });
  });

  describe('Edge Removal', () => {
    it('should remove edge and hide connected ports', () => {
      const edgeInfo = EdgeInfo.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Test Flow',
      });
      service.createEdge(graph, edgeInfo);

      // Verify ports are visible after edge creation
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('visible');
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('visible');

      const removed = service.removeEdge(graph, 'edge-1');

      expect(removed).toBe(true);
      expect(graph.getCellById('edge-1')).toBeNull();

      // Validate ports are hidden after edge removal
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('hidden');
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('hidden');
    });

    it('should return false when removing non-existent edge', () => {
      const removed = service.removeEdge(graph, 'non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('Edge Queries', () => {
    beforeEach(() => {
      const edgeInfo1 = EdgeInfo.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Flow 1',
      });
      const edgeInfo2 = EdgeInfo.create({
        id: 'edge-2',
        sourceNodeId: 'target-1',
        targetNodeId: 'source-1',
        label: 'Flow 2',
      });

      service.createEdge(graph, edgeInfo1);
      service.createEdge(graph, edgeInfo2);
    });

    it('should get edge by ID', () => {
      const edge = service.getEdge(graph, 'edge-1');

      expect(edge).toBeDefined();
      expect(edge?.id).toBe('edge-1');
    });

    it('should return null for non-existent edge', () => {
      const edge = service.getEdge(graph, 'non-existent');

      expect(edge).toBeNull();
    });

    it('should get all edges', () => {
      const edges = service.getEdges(graph);

      expect(edges).toHaveLength(2);
      expect(edges.map(e => e.id)).toContain('edge-1');
      expect(edges.map(e => e.id)).toContain('edge-2');
    });

    it('should find edges connected to node', () => {
      const connectedEdges = queryService.findEdgesConnectedToNode(graph, 'source-1');

      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges.map(e => e.id)).toContain('edge-1');
      expect(connectedEdges.map(e => e.id)).toContain('edge-2');
    });

    it('should check if port is connected', () => {
      const isConnected = queryService.isPortConnected(graph, 'source-1', 'right');
      const isNotConnected = queryService.isPortConnected(graph, 'source-1', 'top');

      expect(isConnected).toBe(true);
      expect(isNotConnected).toBe(false);
    });

    it('should get connected ports for node', () => {
      const connectedPorts = queryService.getConnectedPorts(graph, 'source-1');

      expect(connectedPorts.map(p => p.portId)).toContain('right');
      expect(connectedPorts.map(p => p.portId)).toContain('left');
      expect(connectedPorts.map(p => p.portId)).not.toContain('top');
      expect(connectedPorts.map(p => p.portId)).not.toContain('bottom');
    });
  });
});
