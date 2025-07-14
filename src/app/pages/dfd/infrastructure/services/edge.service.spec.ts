// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { Graph, Node, Edge } from '@antv/x6';
import { EdgeService } from './edge.service';
import { EdgeQueryService } from './edge-query.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { X6EdgeSnapshot } from '../../types/x6-cell.types';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';

// Mock interfaces for type safety
interface MockLoggerService {
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
}

describe('EdgeService - X6 Integration Tests', () => {
  let service: EdgeService;
  let queryService: EdgeQueryService;
  let graph: Graph;
  let sourceNode: Node;
  let targetNode: Node;
  let mockLogger: MockLoggerService;

  beforeEach(() => {
    // Create mocks for dependencies
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    // Create services with mocked dependencies
    service = new EdgeService(mockLogger as unknown as LoggerService);
    queryService = new EdgeQueryService(mockLogger as unknown as LoggerService);

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
      const edgeData = EdgeData.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Data Flow',
      });

      const x6Edge = service.createEdge(graph, edgeData);

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
      const edgeData = EdgeData.createWithPorts(
        'edge-2',
        'source-1',
        'target-1',
        'top',
        'bottom',
        'Custom Flow',
      );

      const x6Edge = service.createEdge(graph, edgeData);

      expect(x6Edge.getSource()).toEqual({ cell: 'source-1', port: 'top' });
      expect(x6Edge.getTarget()).toEqual({ cell: 'target-1', port: 'bottom' });

      // Validate specific port visibility
      expect(sourceNode.getPortProp('top', 'attrs/circle/style/visibility')).toBe('visible');
      expect(targetNode.getPortProp('bottom', 'attrs/circle/style/visibility')).toBe('visible');
      expect(sourceNode.getPortProp('right', 'attrs/circle/style/visibility')).toBe('hidden');
      expect(targetNode.getPortProp('left', 'attrs/circle/style/visibility')).toBe('hidden');
    });

    it('should create edge from X6EdgeSnapshot', () => {
      const snapshot: X6EdgeSnapshot = {
        id: 'edge-3',
        shape: 'edge',
        source: { cell: 'source-1', port: 'right' },
        target: { cell: 'target-1', port: 'left' },
        attrs: {
          line: { stroke: '#ff0000', strokeWidth: 3 },
        },
        labels: [],
        vertices: [{ x: 200, y: 50 }],
        zIndex: 2,
        visible: true,
        data: [{ key: 'category', value: 'critical' }],
      };

      const x6Edge = service.createEdge(graph, snapshot);

      expect(x6Edge.id).toBe('edge-3');
      expect(x6Edge.getVertices()).toEqual([{ x: 200, y: 50 }]);
      expect(x6Edge.getZIndex()).toBe(2);
      expect(x6Edge.getAttrByPath('line/stroke')).toBe('#ff0000');
      expect(x6Edge.getAttrByPath('line/strokeWidth')).toBe(3);
    });
  });

  describe('Edge Updates', () => {
    let edge: Edge;

    beforeEach(() => {
      const edgeData = EdgeData.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Original Flow',
      });
      edge = service.createEdge(graph, edgeData);
    });

    it('should update edge label', () => {
      service.updateEdge(edge, { label: 'Updated Flow' });

      const labels = edge.getLabels();
      expect(labels[0]?.attrs?.['text']?.['text']).toBe('Updated Flow');
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
      const edgeData = EdgeData.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Test Flow',
      });
      service.createEdge(graph, edgeData);

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
      const edgeData1 = EdgeData.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Flow 1',
      });
      const edgeData2 = EdgeData.create({
        id: 'edge-2',
        sourceNodeId: 'target-1',
        targetNodeId: 'source-1',
        label: 'Flow 2',
      });

      service.createEdge(graph, edgeData1);
      service.createEdge(graph, edgeData2);
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

  describe('Edge Snapshots', () => {
    it('should create edge snapshot with correct structure', () => {
      const edgeData = EdgeData.create({
        id: 'edge-1',
        sourceNodeId: 'source-1',
        targetNodeId: 'target-1',
        label: 'Test Flow',
      });
      const edge = service.createEdge(graph, edgeData);

      // Mock the setMetadata method for testing
      (edge as any).setMetadata = vi.fn();
      (edge as any).getMetadata = vi.fn(() => [{ key: 'category', value: 'critical' }]);

      // Set metadata using X6 cell extensions
      (edge as any).setMetadata([{ key: 'category', value: 'critical' }]);

      const snapshot = service.createEdgeSnapshot(edge);

      expect(snapshot).toMatchObject({
        id: 'edge-1',
        shape: 'edge',
        source: { cell: 'source-1', port: 'right' },
        target: { cell: 'target-1', port: 'left' },
        zIndex: 1,
        visible: true,
      });

      expect(snapshot.data).toEqual([{ key: 'category', value: 'critical' }]);
    });
  });
});
