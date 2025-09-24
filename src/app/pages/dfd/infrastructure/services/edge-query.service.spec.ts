// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { Graph, Node, Edge } from '@antv/x6';
import { EdgeQueryService } from './edge-query.service';
import { LoggerService } from '../../../core/services/logger.service';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../../testing/mocks';

// Mock SVG methods for X6 compatibility
const mockMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  e: 0,
  f: 0,
  inverse: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
  multiply: vi.fn().mockReturnThis(),
  translate: vi.fn().mockReturnThis(),
  scale: vi.fn().mockReturnThis(),
  rotate: vi.fn().mockReturnThis(),
};

Object.defineProperty(SVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getScreenCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'getCTM', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

Object.defineProperty(SVGSVGElement.prototype, 'createSVGMatrix', {
  writable: true,
  value: vi.fn().mockReturnValue(mockMatrix),
});

describe('EdgeQueryService', () => {
  let service: EdgeQueryService;
  let mockLogger: MockLoggerService;
  let graph: Graph;
  let container: HTMLElement;

  beforeEach(() => {
    // Create mock logger
    mockLogger = createTypedMockLoggerService();

    // Create service instance
    service = new EdgeQueryService(mockLogger as unknown as LoggerService);

    // Create container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Create graph
    graph = new Graph({
      container,
      width: 800,
      height: 600,
    });
  });

  afterEach(() => {
    // Clean up graph and container
    if (graph) {
      graph.dispose();
    }
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('Edge Queries Connected to Node', () => {
    let node1: Node;
    let node2: Node;
    let node3: Node;
    let edge1: Edge;
    let edge2: Edge;
    let edge3: Edge;

    beforeEach(() => {
      // Create test nodes
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'right' },
          { id: 'port2', group: 'left' },
        ],
      });

      node2 = graph.addNode({
        shape: 'ellipse',
        x: 300,
        y: 100,
        width: 80,
        height: 80,
        ports: [
          { id: 'port3', group: 'left' },
          { id: 'port4', group: 'right' },
        ],
      });

      node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port5', group: 'left' }],
      });

      // Create test edges
      edge1 = graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port3' },
      });

      edge2 = graph.addEdge({
        source: { cell: node2.id, port: 'port4' },
        target: { cell: node3.id, port: 'port5' },
      });

      edge3 = graph.addEdge({
        source: { cell: node1.id, port: 'port2' },
        target: { cell: node3.id, port: 'port5' },
      });
    });

    it('should find edges connected to a specific node', () => {
      const connectedEdges = service.findEdgesConnectedToNode(graph, node1.id);

      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges).toContain(edge1);
      expect(connectedEdges).toContain(edge3);
      expect(connectedEdges).not.toContain(edge2);
    });

    it('should find edges connected to node as source', () => {
      const connectedEdges = service.findEdgesConnectedToNode(graph, node2.id);

      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges).toContain(edge1); // node2 as target
      expect(connectedEdges).toContain(edge2); // node2 as source
    });

    it('should find edges connected to node as target', () => {
      const connectedEdges = service.findEdgesConnectedToNode(graph, node3.id);

      expect(connectedEdges).toHaveLength(2);
      expect(connectedEdges).toContain(edge2); // node3 as target
      expect(connectedEdges).toContain(edge3); // node3 as target
    });

    it('should return empty array for node with no connections', () => {
      const isolatedNode = graph.addNode({
        shape: 'rect',
        x: 700,
        y: 300,
        width: 100,
        height: 50,
      });

      const connectedEdges = service.findEdgesConnectedToNode(graph, isolatedNode.id);

      expect(connectedEdges).toHaveLength(0);
    });

    it('should return empty array for non-existent node', () => {
      const connectedEdges = service.findEdgesConnectedToNode(graph, 'non-existent-node');

      expect(connectedEdges).toHaveLength(0);
    });

    it('should handle graph with no edges', () => {
      const emptyGraph = new Graph({
        container: document.createElement('div'),
        width: 400,
        height: 400,
      });

      const testNode = emptyGraph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const connectedEdges = service.findEdgesConnectedToNode(emptyGraph, testNode.id);

      expect(connectedEdges).toHaveLength(0);

      emptyGraph.dispose();
    });
  });

  describe('Edge Queries Between Nodes', () => {
    let node1: Node;
    let node2: Node;
    let node3: Node;
    let edge1: Edge;
    let edge2: Edge;

    beforeEach(() => {
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
      });

      node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
      });

      edge1 = graph.addEdge({
        source: node1.id,
        target: node2.id,
      });

      edge2 = graph.addEdge({
        source: node2.id,
        target: node1.id, // Reverse direction
      });
    });

    it('should find edges between two specific nodes', () => {
      const edgesBetween = service.findEdgesBetweenNodes(graph, node1.id, node2.id);

      expect(edgesBetween).toHaveLength(2);
      expect(edgesBetween).toContain(edge1);
      expect(edgesBetween).toContain(edge2);
    });

    it('should find edges in both directions', () => {
      const edgesBetween1 = service.findEdgesBetweenNodes(graph, node1.id, node2.id);
      const edgesBetween2 = service.findEdgesBetweenNodes(graph, node2.id, node1.id);

      expect(edgesBetween1).toEqual(edgesBetween2);
      expect(edgesBetween1).toHaveLength(2);
    });

    it('should return empty array for nodes with no connection', () => {
      const edgesBetween = service.findEdgesBetweenNodes(graph, node1.id, node3.id);

      expect(edgesBetween).toHaveLength(0);
    });

    it('should return empty array for non-existent nodes', () => {
      const edgesBetween = service.findEdgesBetweenNodes(graph, 'non-existent-1', 'non-existent-2');

      expect(edgesBetween).toHaveLength(0);
    });

    it('should handle self-loops', () => {
      const selfLoopEdge = graph.addEdge({
        source: node1.id,
        target: node1.id,
      });

      const edgesBetween = service.findEdgesBetweenNodes(graph, node1.id, node1.id);

      expect(edgesBetween).toHaveLength(1);
      expect(edgesBetween).toContain(selfLoopEdge);
    });
  });

  describe('Port Connection Queries', () => {
    let node1: Node;
    let node2: Node;
    let edge: Edge;

    beforeEach(() => {
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'right' },
          { id: 'port2', group: 'left' },
        ],
      });

      node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port3', group: 'left' },
          { id: 'port4', group: 'right' },
        ],
      });

      edge = graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port3' },
      });
    });

    it('should find edges connected to a specific port', () => {
      const connectedEdges = service.findEdgesConnectedToPort(graph, node1.id, 'port1');

      expect(connectedEdges).toHaveLength(1);
      expect(connectedEdges).toContain(edge);
    });

    it('should find edges connected to target port', () => {
      const connectedEdges = service.findEdgesConnectedToPort(graph, node2.id, 'port3');

      expect(connectedEdges).toHaveLength(1);
      expect(connectedEdges).toContain(edge);
    });

    it('should return empty array for unconnected port', () => {
      const connectedEdges = service.findEdgesConnectedToPort(graph, node1.id, 'port2');

      expect(connectedEdges).toHaveLength(0);
    });

    it('should check if a specific port is connected', () => {
      expect(service.isPortConnected(graph, node1.id, 'port1')).toBe(true);
      expect(service.isPortConnected(graph, node2.id, 'port3')).toBe(true);
      expect(service.isPortConnected(graph, node1.id, 'port2')).toBe(false);
      expect(service.isPortConnected(graph, node2.id, 'port4')).toBe(false);
    });

    it('should get all connected ports for a node', () => {
      const connectedPorts = service.getConnectedPorts(graph, node1.id);

      expect(connectedPorts).toHaveLength(1);
      expect(connectedPorts[0]).toEqual({
        portId: 'port1',
        edgeId: edge.id,
        direction: 'source',
      });
    });

    it('should get connected ports for target node', () => {
      const connectedPorts = service.getConnectedPorts(graph, node2.id);

      expect(connectedPorts).toHaveLength(1);
      expect(connectedPorts[0]).toEqual({
        portId: 'port3',
        edgeId: edge.id,
        direction: 'target',
      });
    });

    it('should handle node with multiple connected ports', () => {
      // Add another edge to node1
      const node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port5', group: 'left' }],
      });

      const edge2 = graph.addEdge({
        source: { cell: node1.id, port: 'port2' },
        target: { cell: node3.id, port: 'port5' },
      });

      const connectedPorts = service.getConnectedPorts(graph, node1.id);

      expect(connectedPorts).toHaveLength(2);
      expect(connectedPorts).toContainEqual({
        portId: 'port1',
        edgeId: edge.id,
        direction: 'source',
      });
      expect(connectedPorts).toContainEqual({
        portId: 'port2',
        edgeId: edge2.id,
        direction: 'source',
      });
    });

    it('should return empty array for node with no connected ports', () => {
      const isolatedNode = graph.addNode({
        shape: 'rect',
        x: 700,
        y: 300,
        width: 100,
        height: 50,
        ports: [{ id: 'isolated-port', group: 'top' }],
      });

      const connectedPorts = service.getConnectedPorts(graph, isolatedNode.id);

      expect(connectedPorts).toHaveLength(0);
    });
  });

  describe('Edge Queries by Metadata', () => {
    let edge1: Edge;
    let edge2: Edge;
    let edge3: Edge;

    beforeEach(() => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
      });

      const node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
      });

      edge1 = graph.addEdge({
        source: node1.id,
        target: node2.id,
      });

      edge2 = graph.addEdge({
        source: node2.id,
        target: node3.id,
      });

      edge3 = graph.addEdge({
        source: node1.id,
        target: node3.id,
      });

      // Mock metadata for edges
      (edge1 as any).getMetadata = vi.fn().mockReturnValue([
        { key: 'type', value: 'data-flow' },
        { key: 'priority', value: 'high' },
      ]);

      (edge2 as any).getMetadata = vi.fn().mockReturnValue([
        { key: 'type', value: 'control-flow' },
        { key: 'priority', value: 'low' },
      ]);

      (edge3 as any).getMetadata = vi.fn().mockReturnValue([
        { key: 'type', value: 'data-flow' },
        { key: 'priority', value: 'medium' },
      ]);
    });

    it('should find edges by single metadata criterion', () => {
      const dataFlowEdges = service.findEdgesByMetadata(graph, { type: 'data-flow' });

      expect(dataFlowEdges).toHaveLength(2);
      expect(dataFlowEdges).toContain(edge1);
      expect(dataFlowEdges).toContain(edge3);
      expect(dataFlowEdges).not.toContain(edge2);
    });

    it('should find edges by multiple metadata criteria', () => {
      const highPriorityDataFlowEdges = service.findEdgesByMetadata(graph, {
        type: 'data-flow',
        priority: 'high',
      });

      expect(highPriorityDataFlowEdges).toHaveLength(1);
      expect(highPriorityDataFlowEdges).toContain(edge1);
    });

    it('should return empty array for non-matching criteria', () => {
      const nonExistentEdges = service.findEdgesByMetadata(graph, {
        type: 'non-existent-type',
      });

      expect(nonExistentEdges).toHaveLength(0);
    });

    it('should handle edges without metadata', () => {
      const edgeWithoutMetadata = graph.addEdge({
        source: graph.getNodes()[0].id,
        target: graph.getNodes()[1].id,
      });

      // Don't mock getMetadata for this edge, so it returns undefined
      const edgesWithType = service.findEdgesByMetadata(graph, { type: 'any-type' });

      expect(edgesWithType).not.toContain(edgeWithoutMetadata);
    });

    it('should handle edges with empty metadata', () => {
      const edgeWithEmptyMetadata = graph.addEdge({
        source: graph.getNodes()[0].id,
        target: graph.getNodes()[1].id,
      });

      (edgeWithEmptyMetadata as any).getMetadata = vi.fn().mockReturnValue([]);

      const edgesWithType = service.findEdgesByMetadata(graph, { type: 'any-type' });

      expect(edgesWithType).not.toContain(edgeWithEmptyMetadata);
    });
  });

  describe('Edge Connection Validation', () => {
    let node1: Node;
    let node2: Node;
    let validEdge: Edge;
    let invalidEdge: Edge;

    beforeEach(() => {
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port1', group: 'right' }],
      });

      node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port2', group: 'left' }],
      });

      validEdge = graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port2' },
      });
    });

    it('should find edge by connection with port specification', () => {
      const foundEdge = service.findEdgeBetweenPorts(graph, node1.id, node2.id, 'port1', 'port2');

      expect(foundEdge).toBe(validEdge);
    });

    it('should find edge by connection with source port only', () => {
      const foundEdge = service.findEdgeBetweenPorts(graph, node1.id, node2.id, 'port1');

      expect(foundEdge).toBe(validEdge);
    });

    it('should find edge by connection with target port only', () => {
      const foundEdge = service.findEdgeBetweenPorts(graph, node1.id, node2.id, undefined, 'port2');

      expect(foundEdge).toBe(validEdge);
    });

    it('should find edge by connection without port specification', () => {
      const foundEdge = service.findEdgeBetweenPorts(graph, node1.id, node2.id);

      expect(foundEdge).toBe(validEdge);
    });

    it('should return null for non-existent connection', () => {
      const node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
      });

      const foundEdge = service.findEdgeBetweenPorts(graph, node1.id, node3.id);

      expect(foundEdge).toBeNull();
    });

    it('should return null for wrong port specification', () => {
      const foundEdge = service.findEdgeBetweenPorts(
        graph,
        node1.id,
        node2.id,
        'wrong-port',
        'port2',
      );

      expect(foundEdge).toBeNull();
    });

    it('should validate edge connections and find no issues for valid edges', () => {
      const validationResults = service.validateEdgeConnections(graph);

      expect(validationResults).toHaveLength(0);
      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'DfdEdgeQuery',
        'Edge connection validation passed',
        {
          totalEdges: 1,
        },
      );
    });

    it('should validate edge connections and find issues for invalid edges', () => {
      // Create edge with non-existent source node
      invalidEdge = graph.addEdge({
        source: 'non-existent-node',
        target: node2.id,
      });

      const validationResults = service.validateEdgeConnections(graph);

      expect(validationResults).toHaveLength(1);
      expect(validationResults[0].edgeId).toBe(invalidEdge.id);
      expect(validationResults[0].issues).toContain(
        'Source node non-existent-node not found or not a node',
      );

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Edge connection validation found issues',
        expect.any(Object),
      );
    });

    it('should validate edge connections and find port issues', () => {
      // Create edge with non-existent port
      invalidEdge = graph.addEdge({
        source: { cell: node1.id, port: 'non-existent-port' },
        target: { cell: node2.id, port: 'port2' },
      });

      const validationResults = service.validateEdgeConnections(graph);

      expect(validationResults).toHaveLength(1);
      expect(validationResults[0].issues).toContain(
        'Source port non-existent-port not found on node ' + node1.id,
      );
    });

    it('should validate edge connections and find missing node ID issues', () => {
      // Create edge with missing source
      invalidEdge = graph.addEdge({
        target: node2.id,
      });

      const validationResults = service.validateEdgeConnections(graph);

      expect(validationResults).toHaveLength(1);
      expect(validationResults[0].issues).toContain('Missing source node ID');
    });
  });

  describe('Node Edge Statistics', () => {
    let node1: Node;
    let node2: Node;
    let node3: Node;

    beforeEach(() => {
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port1', group: 'right' },
          { id: 'port2', group: 'left' },
          { id: 'port3', group: 'top' },
        ],
      });

      node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [
          { id: 'port4', group: 'left' },
          { id: 'port5', group: 'right' },
        ],
      });

      node3 = graph.addNode({
        shape: 'rect',
        x: 500,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port6', group: 'left' }],
      });

      // Create edges: node1 -> node2, node2 -> node3, node3 -> node1
      graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port4' },
      });

      graph.addEdge({
        source: { cell: node2.id, port: 'port5' },
        target: { cell: node3.id, port: 'port6' },
      });

      graph.addEdge({
        source: { cell: node3.id, port: 'port6' },
        target: { cell: node1.id, port: 'port2' },
      });
    });

    it('should get node edge statistics', () => {
      const stats = service.getNodeEdgeStatistics(graph, node1.id);

      expect(stats).toEqual({
        totalEdges: 2,
        incomingEdges: 1,
        outgoingEdges: 1,
        connectedPorts: 2,
        unconnectedPorts: 1,
      });
    });

    it('should get statistics for node with only outgoing edges', () => {
      const isolatedNode = graph.addNode({
        shape: 'rect',
        x: 700,
        y: 300,
        width: 100,
        height: 50,
        ports: [{ id: 'isolated-port', group: 'right' }],
      });

      graph.addEdge({
        source: { cell: isolatedNode.id, port: 'isolated-port' },
        target: { cell: node1.id, port: 'port3' },
      });

      const stats = service.getNodeEdgeStatistics(graph, isolatedNode.id);

      expect(stats).toEqual({
        totalEdges: 1,
        incomingEdges: 0,
        outgoingEdges: 1,
        connectedPorts: 1,
        unconnectedPorts: 0,
      });
    });

    it('should get statistics for node with no connections', () => {
      const isolatedNode = graph.addNode({
        shape: 'rect',
        x: 700,
        y: 300,
        width: 100,
        height: 50,
        ports: [
          { id: 'isolated-port1', group: 'right' },
          { id: 'isolated-port2', group: 'left' },
        ],
      });

      const stats = service.getNodeEdgeStatistics(graph, isolatedNode.id);

      expect(stats).toEqual({
        totalEdges: 0,
        incomingEdges: 0,
        outgoingEdges: 0,
        connectedPorts: 0,
        unconnectedPorts: 2,
      });
    });

    it('should return zero statistics for non-existent node', () => {
      const stats = service.getNodeEdgeStatistics(graph, 'non-existent-node');

      expect(stats).toEqual({
        totalEdges: 0,
        incomingEdges: 0,
        outgoingEdges: 0,
        connectedPorts: 0,
        unconnectedPorts: 0,
      });
    });

    it('should handle node that is not actually a node', () => {
      // Add an edge and try to get stats for it (should fail gracefully)
      const edge = graph.addEdge({
        source: node1.id,
        target: node2.id,
      });

      const stats = service.getNodeEdgeStatistics(graph, edge.id);

      expect(stats).toEqual({
        totalEdges: 0,
        incomingEdges: 0,
        outgoingEdges: 0,
        connectedPorts: 0,
        unconnectedPorts: 0,
      });
    });
  });

  describe('Edge Connection Summary', () => {
    let node1: Node;
    let node2: Node;
    let edge1: Edge;
    let edge2: Edge;

    beforeEach(() => {
      node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port1', group: 'right' }],
      });

      node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port2', group: 'left' }],
      });

      edge1 = graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port2' },
      });

      edge2 = graph.addEdge({
        source: node1.id,
        target: node2.id, // No ports specified
      });
    });

    it('should get edge connection summary', () => {
      const summary = service.getConnectionSummary(graph);

      expect(summary.totalEdges).toBe(2);
      expect(summary.edgesWithPorts).toBe(1);
      expect(summary.edgesWithoutPorts).toBe(1);
      expect(summary.uniqueConnections).toBe(2);
      expect(summary.connectionDetails).toHaveLength(2);

      expect(summary.connectionDetails).toContainEqual({
        edgeId: edge1.id,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        sourcePortId: 'port1',
        targetPortId: 'port2',
      });

      expect(summary.connectionDetails).toContainEqual({
        edgeId: edge2.id,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        sourcePortId: undefined,
        targetPortId: undefined,
      });
    });

    it('should handle empty graph', () => {
      const emptyGraph = new Graph({
        container: document.createElement('div'),
        width: 400,
        height: 400,
      });

      const summary = service.getConnectionSummary(emptyGraph);

      expect(summary.totalEdges).toBe(0);
      expect(summary.edgesWithPorts).toBe(0);
      expect(summary.edgesWithoutPorts).toBe(0);
      expect(summary.uniqueConnections).toBe(0);
      expect(summary.connectionDetails).toHaveLength(0);

      emptyGraph.dispose();
    });

    it('should count unique connections correctly', () => {
      // Add duplicate connection (same source and target, same ports)
      graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port2' },
      });

      const summary = service.getConnectionSummary(graph);

      expect(summary.totalEdges).toBe(3);
      expect(summary.uniqueConnections).toBe(2); // Should still be 2 unique connections
      expect(summary.connectionDetails).toHaveLength(3);
    });

    it('should handle edges with partial port information', () => {
      const partialPortEdge = graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: node2.id, // No target port
      });

      const summary = service.getConnectionSummary(graph);

      expect(summary.edgesWithPorts).toBe(1); // Only edge1 has both ports
      expect(summary.edgesWithoutPorts).toBe(2); // edge2 and partialPortEdge
      expect(summary.connectionDetails).toContainEqual({
        edgeId: partialPortEdge.id,
        sourceNodeId: node1.id,
        targetNodeId: node2.id,
        sourcePortId: 'port1',
        targetPortId: undefined,
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle graph with no nodes', () => {
      const emptyGraph = new Graph({
        container: document.createElement('div'),
        width: 400,
        height: 400,
      });

      const connectedEdges = service.findEdgesConnectedToNode(emptyGraph, 'any-node');
      const edgesBetween = service.findEdgesBetweenNodes(emptyGraph, 'node1', 'node2');
      const portConnected = service.isPortConnected(emptyGraph, 'node1', 'port1');
      const connectedPorts = service.getConnectedPorts(emptyGraph, 'node1');
      const stats = service.getNodeEdgeStatistics(emptyGraph, 'node1');

      expect(connectedEdges).toHaveLength(0);
      expect(edgesBetween).toHaveLength(0);
      expect(portConnected).toBe(false);
      expect(connectedPorts).toHaveLength(0);
      expect(stats.totalEdges).toBe(0);

      emptyGraph.dispose();
    });

    it('should handle malformed edge data gracefully', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
      });

      // Create edge and then manually corrupt its data
      const edge = graph.addEdge({
        source: node1.id,
        target: node2.id,
      });

      // Mock corrupted edge methods
      vi.spyOn(edge, 'getSourceCellId').mockReturnValue(null as any);
      vi.spyOn(edge, 'getTargetCellId').mockReturnValue(null as any);

      const connectedEdges = service.findEdgesConnectedToNode(graph, node1.id);
      expect(connectedEdges).toHaveLength(0);
    });

    it('should handle concurrent access to edge queries', () => {
      const node1 = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port1', group: 'right' }],
      });

      const node2 = graph.addNode({
        shape: 'rect',
        x: 300,
        y: 100,
        width: 100,
        height: 50,
        ports: [{ id: 'port2', group: 'left' }],
      });

      graph.addEdge({
        source: { cell: node1.id, port: 'port1' },
        target: { cell: node2.id, port: 'port2' },
      });

      // Simulate concurrent queries
      const results = Promise.all([
        Promise.resolve(service.findEdgesConnectedToNode(graph, node1.id)),
        Promise.resolve(service.isPortConnected(graph, node1.id, 'port1')),
        Promise.resolve(service.getConnectedPorts(graph, node1.id)),
        Promise.resolve(service.getNodeEdgeStatistics(graph, node1.id)),
      ]);

      return results.then(([edges, connected, ports, stats]) => {
        expect(edges).toHaveLength(1);
        expect(connected).toBe(true);
        expect(ports).toHaveLength(1);
        expect(stats.totalEdges).toBe(1);
      });
    });

    it('should handle large numbers of edges efficiently', () => {
      const nodes = Array.from({ length: 10 }, (_, i) =>
        graph.addNode({
          shape: 'rect',
          x: 100 + i * 50,
          y: 100,
          width: 40,
          height: 40,
          ports: [{ id: `port${i}`, group: 'right' }],
        }),
      );

      // Create edges between all nodes (fully connected)
      const edges: Edge[] = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          edges.push(
            graph.addEdge({
              source: { cell: nodes[i].id, port: `port${i}` },
              target: { cell: nodes[j].id, port: `port${j}` },
            }),
          );
        }
      }

      const startTime = Date.now();
      const connectedEdges = service.findEdgesConnectedToNode(graph, nodes[0].id);
      const endTime = Date.now();

      // Should complete in reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      expect(connectedEdges).toHaveLength(9); // Connected to 9 other nodes
    });

    it('should handle nodes with no ports gracefully', () => {
      const nodeWithoutPorts = graph.addNode({
        shape: 'rect',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
      });

      const stats = service.getNodeEdgeStatistics(graph, nodeWithoutPorts.id);
      const connectedPorts = service.getConnectedPorts(graph, nodeWithoutPorts.id);

      expect(stats.unconnectedPorts).toBe(0);
      expect(connectedPorts).toHaveLength(0);
    });

    it('should handle null or undefined parameters gracefully', () => {
      // These methods should return empty results for null graphs
      expect(service.findEdgesConnectedToNode(null as any, 'node1')).toEqual([]);
      expect(service.findEdgesBetweenNodes(null as any, 'node1', 'node2')).toEqual([]);
      expect(service.isPortConnected(null as any, 'node1', 'port1')).toBe(false);
      expect(service.getConnectedPorts(null as any, 'node1')).toEqual([]);

      const stats = service.getNodeEdgeStatistics(null as any, 'node1');
      expect(stats.totalEdges).toBe(0);

      expect(service.validateEdgeConnections(null as any)).toEqual([]);

      const summary = service.getConnectionSummary(null as any);
      expect(summary.totalEdges).toBe(0);
    });
  });
});
