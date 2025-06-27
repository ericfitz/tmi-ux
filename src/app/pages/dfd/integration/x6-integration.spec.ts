/**
 * X6 Integration Tests
 *
 * These tests verify the integration between our clean architecture domain layer
 * and the X6 graph library. Due to X6's dependency on SVG DOM methods that aren't
 * fully supported in JSDOM, we use a mock-based approach to test the integration.
 *
 * Test Coverage:
 * - Node operations (add, move, remove) with mocked X6 graph
 * - Edge operations (add, remove) with mocked X6 graph
 * - Complex workflows with multiple operations
 * - Event integration and propagation
 * - Error handling with invalid operations
 * - Performance testing with large datasets
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { DiagramNode } from '../domain/value-objects/diagram-node';
import { DiagramEdge } from '../domain/value-objects/diagram-edge';
import { NodeData } from '../domain/value-objects/node-data';
import { EdgeData } from '../domain/value-objects/edge-data';
import { Point } from '../domain/value-objects/point';
import { LoggerService } from '../../../core/services/logger.service';

// Type definitions for X6 mocks
interface MockNodeConfig {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  label?: string;
}

interface MockEdgeConfig {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface MockPosition {
  x: number;
  y: number;
}

interface MockSize {
  width: number;
  height: number;
}

interface MockAttrs {
  text: { text: string };
}

interface MockLabel {
  attrs: MockAttrs;
}

interface MockPort {
  id: string;
  group: string;
}

interface MockNode {
  id: string;
  isNode: () => boolean;
  getPosition: () => MockPosition;
  getSize: () => MockSize;
  getAttrs: () => MockAttrs;
  setPosition: (x: number, y: number) => void;
  setLabel: (label: string) => void;
  getPorts: () => MockPort[];
  setPortProp: (portId: string, path: string, value: unknown) => void;
}

interface MockEdge {
  id: string;
  isEdge: () => boolean;
  getSourceCellId: () => string;
  getTargetCellId: () => string;
  getLabels: () => MockLabel[];
  setLabel: (label: string) => void;
  attr: (path?: string) => unknown;
}

interface MockEventHandler {
  (data: unknown): void;
}

interface MockViFunction {
  (...args: unknown[]): unknown;
  mock: {
    calls: unknown[][];
  };
}

interface MockGraph {
  addNode: (config: MockNodeConfig) => MockNode;
  addEdge: (config: MockEdgeConfig) => MockEdge;
  removeNode: (nodeOrId: string | MockNode) => void;
  removeEdge: (edgeOrId: string | MockEdge) => void;
  getNodes: () => MockNode[];
  getEdges: () => MockEdge[];
  getCellById: (id: string) => MockNode | MockEdge | null;
  clearCells: () => void;
  zoomToFit: () => void;
  centerContent: () => void;
  on: MockViFunction;
  off: MockViFunction;
  dispose: () => void;
  findViewByCell: (cell: MockNode | MockEdge) => unknown;
}

// Mock X6 Graph to avoid SVG DOM dependencies
vi.mock('@antv/x6', () => {
  let mockNodes: Map<string, MockNode>;
  let mockEdges: Map<string, MockEdge>;

  const createMockNode = (config: MockNodeConfig, mockGraph?: MockGraph): MockNode => {
    let currentPosition: MockPosition = { x: config.x || 0, y: config.y || 0 };

    return {
      id: config.id,
      isNode: vi.fn(() => true),
      getPosition: vi.fn(() => currentPosition),
      getSize: vi.fn(() => ({ width: config.width || 120, height: config.height || 60 })),
      getAttrs: vi.fn(() => ({ text: { text: config.label || '' } })),
      setPosition: vi.fn((x: number, y: number) => {
        const previous = { ...currentPosition };
        currentPosition = { x, y };

        // Trigger node:change:position event
        if (mockGraph) {
          mockGraph.on.mock.calls.forEach((call: unknown[]) => {
            const [event, handler] = call as [string, MockEventHandler];
            if (event === 'node:change:position') {
              handler({
                node: { id: config.id },
                current: currentPosition,
                previous,
              });
            }
          });
        }
      }),
      setLabel: vi.fn(),
      getPorts: vi.fn(() => [
        { id: 'top', group: 'top' },
        { id: 'right', group: 'right' },
        { id: 'bottom', group: 'bottom' },
        { id: 'left', group: 'left' },
      ]),
      setPortProp: vi.fn(),
    };
  };

  const createMockEdge = (config: MockEdgeConfig): MockEdge => ({
    id: config.id,
    isEdge: vi.fn(() => true),
    getSourceCellId: vi.fn(() => config.source),
    getTargetCellId: vi.fn(() => config.target),
    getLabels: vi.fn(() => (config.label ? [{ attrs: { text: { text: config.label } } }] : [])),
    setLabel: vi.fn(),
    attr: vi.fn((path?: string) => {
      if (path === 'line') {
        return {
          stroke: '#000000',
          strokeWidth: 2,
          targetMarker: {
            name: 'block',
            width: 12,
            height: 8,
            fill: '#000000',
            stroke: '#000000',
          },
        };
      }
      if (!path) {
        // Return all attributes when no path is specified
        return {
          line: {
            stroke: '#000000',
            strokeWidth: 2,
            targetMarker: {
              name: 'block',
              width: 12,
              height: 8,
              fill: '#000000',
              stroke: '#000000',
            },
          },
        };
      }
      return undefined;
    }),
  });

  return {
    Graph: vi.fn().mockImplementation(() => {
      // Reset state for each new graph instance
      mockNodes = new Map();
      mockEdges = new Map();

      const mockGraph = {
        addNode: vi.fn((config: MockNodeConfig) => {
          const node = createMockNode(config, mockGraph as MockGraph);
          mockNodes.set(config.id, node);
          // Trigger node:added event
          mockGraph.on.mock.calls.forEach((call: unknown[]) => {
            const [event, handler] = call as [string, MockEventHandler];
            if (event === 'node:added') {
              handler({ node });
            }
          });
          return node;
        }),
        addEdge: vi.fn((config: MockEdgeConfig) => {
          const edge = createMockEdge(config);
          mockEdges.set(config.id, edge);
          // Trigger edge:added event
          mockGraph.on.mock.calls.forEach((call: unknown[]) => {
            const [event, handler] = call as [string, MockEventHandler];
            if (event === 'edge:added') {
              handler({ edge });
            }
          });
          // Also trigger edge:connected event for proper lifecycle handling
          mockGraph.on.mock.calls.forEach((call: unknown[]) => {
            const [event, handler] = call as [string, MockEventHandler];
            if (event === 'edge:connected') {
              handler({ edge });
            }
          });
          return edge;
        }),
        removeNode: vi.fn((nodeOrId: string | MockNode) => {
          const id = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
          const node = mockNodes.get(id);
          mockNodes.delete(id);
          // Remove connected edges
          for (const [edgeId, edge] of mockEdges.entries()) {
            if (edge.getSourceCellId() === id || edge.getTargetCellId() === id) {
              mockEdges.delete(edgeId);
            }
          }
          // Trigger node:removed event
          if (node) {
            mockGraph.on.mock.calls.forEach((call: unknown[]) => {
              const [event, handler] = call as [string, MockEventHandler];
              if (event === 'node:removed') {
                handler({ node });
              }
            });
          }
        }),
        removeEdge: vi.fn((edgeOrId: string | MockEdge) => {
          const id = typeof edgeOrId === 'string' ? edgeOrId : edgeOrId.id;
          const edge = mockEdges.get(id);
          mockEdges.delete(id);
          // Trigger edge:removed event
          if (edge) {
            mockGraph.on.mock.calls.forEach((call: unknown[]) => {
              const [event, handler] = call as [string, MockEventHandler];
              if (event === 'edge:removed') {
                handler({ edge });
              }
            });
          }
        }),
        getNodes: vi.fn(() => Array.from(mockNodes.values())),
        getEdges: vi.fn(() => Array.from(mockEdges.values())),
        getCellById: vi.fn((id: string) => mockNodes.get(id) || mockEdges.get(id) || null),
        clearCells: vi.fn(() => {
          mockNodes.clear();
          mockEdges.clear();
        }),
        zoomToFit: vi.fn(),
        centerContent: vi.fn(),
        on: vi.fn(),
        off: vi.fn(),
        dispose: vi.fn(),
        findViewByCell: vi.fn(() => null),
      };

      return mockGraph;
    }),
    Shape: {
      Rect: {
        define: vi.fn(),
      },
    },
    Node: vi.fn(),
    Edge: vi.fn(),
    Cell: vi.fn(),
  };
});

describe('X6 Integration Tests', () => {
  let adapter: X6GraphAdapter;
  let container: HTMLElement;
  let mockLogger: LoggerService;

  beforeEach(() => {
    // Create mock container
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });

    // Create mock logger
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
      shouldLogComponent: vi.fn(() => true),
    } as unknown as LoggerService;

    // Create fresh adapter instance
    adapter = new X6GraphAdapter(mockLogger);
    adapter.initialize(container);
  });

  describe('Node Operations Integration', () => {
    it('should add a node and verify X6 graph state', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 100),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);

      // Act
      adapter.addNode(node);

      // Assert
      const x6Graph = adapter.getGraph();
      const x6Nodes = x6Graph.getNodes();
      expect(x6Nodes).toHaveLength(1);

      const addedNode = x6Nodes[0];
      expect(addedNode.id).toBe('node-1');
      expect(addedNode.getPosition()).toEqual({ x: 100, y: 100 });
      expect(addedNode.getSize()).toEqual({ width: 120, height: 60 });
      expect((addedNode.getAttrs() as unknown as MockAttrs).text?.text).toBe('Test Process');
    });

    it('should move a node and verify position update', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 100),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);
      adapter.addNode(node);

      // Act
      const newPosition = new Point(200, 150);
      adapter.moveNode('node-1', newPosition);

      // Assert
      const x6Graph = adapter.getGraph();
      const x6Node = x6Graph.getCellById('node-1');
      expect(x6Node).toBeTruthy();
      expect((x6Node as unknown as MockNode).setPosition).toHaveBeenCalledWith(200, 150);
    });

    it('should remove a node and verify X6 graph state', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 100),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);
      adapter.addNode(node);

      // Verify node was added
      let x6Graph = adapter.getGraph();
      expect(x6Graph.getNodes()).toHaveLength(1);

      // Act
      adapter.removeNode('node-1');

      // Assert
      x6Graph = adapter.getGraph();
      expect(x6Graph.removeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'node-1' }));
      expect(x6Graph.getNodes()).toHaveLength(0);
    });
  });

  describe('Edge Operations Integration', () => {
    beforeEach(() => {
      // Add source and target nodes for edge tests
      const sourceNodeData = new NodeData(
        'source-node',
        'process',
        'Source Process',
        new Point(100, 100),
        120,
        60,
      );
      const targetNodeData = new NodeData(
        'target-node',
        'store',
        'Target Store',
        new Point(300, 100),
        120,
        60,
      );
      const sourceNode = new DiagramNode(sourceNodeData);
      const targetNode = new DiagramNode(targetNodeData);

      adapter.addNode(sourceNode);
      adapter.addNode(targetNode);
    });

    it('should add an edge and verify X6 graph state', () => {
      // Arrange
      const edgeData = new EdgeData(
        'edge-1',
        'source-node',
        'target-node',
        undefined,
        undefined,
        'Test Data Flow',
      );
      const edge = new DiagramEdge(edgeData);

      // Act
      adapter.addEdge(edge);

      // Assert
      const x6Graph = adapter.getGraph();
      const x6Edges = x6Graph.getEdges();
      expect(x6Edges).toHaveLength(1);

      const addedEdge = x6Edges[0];
      expect(addedEdge.id).toBe('edge-1');
      expect(addedEdge.getSourceCellId()).toBe('source-node');
      expect(addedEdge.getTargetCellId()).toBe('target-node');

      const labels = addedEdge.getLabels();
      expect(labels.length > 0 ? (labels[0].attrs as unknown as MockAttrs)?.text?.text : '').toBe(
        'Test Data Flow',
      );
    });

    it('should remove an edge and verify X6 graph state', () => {
      // Arrange
      const edgeData = new EdgeData(
        'edge-1',
        'source-node',
        'target-node',
        undefined,
        undefined,
        'Test Data Flow',
      );
      const edge = new DiagramEdge(edgeData);
      adapter.addEdge(edge);

      // Verify edge was added
      let x6Graph = adapter.getGraph();
      expect(x6Graph.getEdges()).toHaveLength(1);

      // Act
      adapter.removeEdge('edge-1');

      // Assert
      x6Graph = adapter.getGraph();
      expect(x6Graph.removeEdge).toHaveBeenCalledWith(expect.objectContaining({ id: 'edge-1' }));
      expect(x6Graph.getEdges()).toHaveLength(0);
    });
  });

  describe('Complex Workflow Integration', () => {
    it('should handle multiple operations in sequence', () => {
      // Arrange
      const node1Data = new NodeData(
        'node-1',
        'process',
        'Process 1',
        new Point(100, 100),
        120,
        60,
      );
      const node2Data = new NodeData('node-2', 'store', 'Store 1', new Point(300, 100), 120, 60);
      const node3Data = new NodeData('node-3', 'actor', 'Actor 1', new Point(200, 200), 120, 60);

      const node1 = new DiagramNode(node1Data);
      const node2 = new DiagramNode(node2Data);
      const node3 = new DiagramNode(node3Data);

      // Act - Add nodes
      adapter.addNode(node1);
      adapter.addNode(node2);
      adapter.addNode(node3);

      // Add edges
      const edge1Data = new EdgeData('edge-1', 'node-1', 'node-2', undefined, undefined, 'Flow 1');
      const edge2Data = new EdgeData('edge-2', 'node-2', 'node-3', undefined, undefined, 'Flow 2');

      const edge1 = new DiagramEdge(edge1Data);
      const edge2 = new DiagramEdge(edge2Data);

      adapter.addEdge(edge1);
      adapter.addEdge(edge2);

      // Move nodes
      adapter.moveNode('node-1', new Point(150, 150));
      adapter.moveNode('node-3', new Point(250, 250));

      // Assert
      const x6Graph = adapter.getGraph();
      expect(x6Graph.getNodes()).toHaveLength(3);
      expect(x6Graph.getEdges()).toHaveLength(2);

      const movedNode1 = x6Graph.getCellById('node-1');
      const movedNode3 = x6Graph.getCellById('node-3');
      expect((movedNode1 as unknown as MockNode).setPosition).toHaveBeenCalledWith(150, 150);
      expect((movedNode3 as unknown as MockNode).setPosition).toHaveBeenCalledWith(250, 250);
    });

    it('should handle node removal with connected edges', () => {
      // Arrange
      const node1Data = new NodeData(
        'node-1',
        'process',
        'Process 1',
        new Point(100, 100),
        120,
        60,
      );
      const node2Data = new NodeData('node-2', 'store', 'Store 1', new Point(300, 100), 120, 60);

      const node1 = new DiagramNode(node1Data);
      const node2 = new DiagramNode(node2Data);

      adapter.addNode(node1);
      adapter.addNode(node2);

      const edgeData = new EdgeData('edge-1', 'node-1', 'node-2', undefined, undefined, 'Flow 1');
      const edge = new DiagramEdge(edgeData);
      adapter.addEdge(edge);

      // Act - Remove source node
      adapter.removeNode('node-1');

      // Assert - Mock automatically handles edge removal
      const x6Graph = adapter.getGraph();
      expect(x6Graph.removeNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'node-1' }));
      expect(x6Graph.getNodes()).toHaveLength(1);
      expect(x6Graph.getEdges()).toHaveLength(0); // Edge removed automatically
    });
  });

  describe('Event Integration', () => {
    it('should emit events when X6 graph changes', () => {
      // Arrange
      const nodeAddedEvents: unknown[] = [];
      const nodeMovedEvents: unknown[] = [];
      const edgeAddedEvents: unknown[] = [];

      adapter.nodeAdded$.subscribe(event => nodeAddedEvents.push(event));
      adapter.nodeMoved$.subscribe(event => nodeMovedEvents.push(event));
      adapter.edgeAdded$.subscribe(event => edgeAddedEvents.push(event));

      // Act - Add node
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 100),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);
      adapter.addNode(node);

      // Move node
      adapter.moveNode('node-1', new Point(200, 150));

      // Add another node and edge
      const node2Data = new NodeData('node-2', 'store', 'Test Store', new Point(300, 100), 120, 60);
      const node2 = new DiagramNode(node2Data);
      adapter.addNode(node2);

      const edgeData = new EdgeData(
        'edge-1',
        'node-1',
        'node-2',
        undefined,
        undefined,
        'Test Flow',
      );
      const edge = new DiagramEdge(edgeData);
      adapter.addEdge(edge);

      // Assert
      expect(nodeAddedEvents).toHaveLength(2);
      expect(nodeMovedEvents).toHaveLength(1);
      expect(edgeAddedEvents).toHaveLength(1);

      expect((nodeAddedEvents[0] as { id: string }).id).toBe('node-1');
      expect((nodeMovedEvents[0] as { nodeId: string }).nodeId).toBe('node-1');
      expect((nodeMovedEvents[0] as { position: Point }).position).toEqual(new Point(200, 150));
      expect((edgeAddedEvents[0] as { id: string }).id).toBe('edge-1');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle invalid node operations gracefully', () => {
      // Act & Assert - Moving non-existent node should not throw
      expect(() => {
        adapter.moveNode('non-existent', new Point(100, 100));
      }).not.toThrow();

      // Act & Assert - Removing non-existent node should not throw
      expect(() => {
        adapter.removeNode('non-existent');
      }).not.toThrow();
    });

    it('should handle invalid edge operations gracefully', () => {
      // Act & Assert - Adding edge with non-existent nodes should not throw
      expect(() => {
        const edgeData = new EdgeData(
          'edge-1',
          'non-existent-1',
          'non-existent-2',
          undefined,
          undefined,
          'Invalid Flow',
        );
        const edge = new DiagramEdge(edgeData);
        adapter.addEdge(edge);
      }).not.toThrow();

      // Act & Assert - Removing non-existent edge should not throw
      expect(() => {
        adapter.removeEdge('non-existent');
      }).not.toThrow();
    });
  });

  describe('Performance Integration', () => {
    it('should handle large number of operations efficiently', () => {
      const startTime = performance.now();

      // Add 100 nodes
      for (let i = 0; i < 100; i++) {
        const nodeData = new NodeData(
          `node-${i}`,
          'process',
          `Process ${i}`,
          new Point(100 + (i % 10) * 150, 100 + Math.floor(i / 10) * 100),
          120,
          60,
        );
        const node = new DiagramNode(nodeData);
        adapter.addNode(node);
      }

      // Add 50 edges
      for (let i = 0; i < 50; i++) {
        const edgeData = new EdgeData(
          `edge-${i}`,
          `node-${i}`,
          `node-${i + 1}`,
          undefined,
          undefined,
          `Flow ${i}`,
        );
        const edge = new DiagramEdge(edgeData);
        adapter.addEdge(edge);
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert
      const x6Graph = adapter.getGraph();
      expect(x6Graph.getNodes()).toHaveLength(100);
      expect(x6Graph.getEdges()).toHaveLength(50);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });

  describe('Graph Utility Operations', () => {
    it('should clear all nodes and edges', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(100, 100),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);
      adapter.addNode(node);

      // Act
      adapter.clear();

      // Assert
      const x6Graph = adapter.getGraph();
      expect(x6Graph.clearCells).toHaveBeenCalled();
    });

    it('should fit content to viewport', () => {
      // Arrange
      const nodeData = new NodeData(
        'node-1',
        'process',
        'Test Process',
        new Point(1000, 1000),
        120,
        60,
      );
      const node = new DiagramNode(nodeData);
      adapter.addNode(node);

      // Act & Assert - Should not throw
      expect(() => {
        adapter.fitToContent();
      }).not.toThrow();

      expect(() => {
        adapter.centerContent();
      }).not.toThrow();

      const x6Graph = adapter.getGraph();
      expect(x6Graph.zoomToFit).toHaveBeenCalled();
      expect(x6Graph.centerContent).toHaveBeenCalled();
    });
  });

  describe('Node and Edge Retrieval', () => {
    beforeEach(() => {
      // Add test data
      const node1Data = new NodeData(
        'node-1',
        'process',
        'Process 1',
        new Point(100, 100),
        120,
        60,
      );
      const node2Data = new NodeData('node-2', 'store', 'Store 1', new Point(300, 100), 120, 60);

      const node1 = new DiagramNode(node1Data);
      const node2 = new DiagramNode(node2Data);

      adapter.addNode(node1);
      adapter.addNode(node2);

      const edgeData = new EdgeData('edge-1', 'node-1', 'node-2', undefined, undefined, 'Flow 1');
      const edge = new DiagramEdge(edgeData);
      adapter.addEdge(edge);
    });

    it('should retrieve nodes and edges correctly', () => {
      // Act & Assert
      const nodes = adapter.getNodes();
      const edges = adapter.getEdges();

      expect(nodes).toHaveLength(2);
      expect(edges).toHaveLength(1);

      const node1 = adapter.getNode('node-1');
      const node2 = adapter.getNode('node-2');
      const edge1 = adapter.getEdge('edge-1');

      expect(node1).toBeTruthy();
      expect(node2).toBeTruthy();
      expect(edge1).toBeTruthy();

      expect(node1!.id).toBe('node-1');
      expect(node2!.id).toBe('node-2');
      expect(edge1!.id).toBe('edge-1');
    });

    it('should return null for non-existent nodes and edges', () => {
      // Act & Assert
      const nonExistentNode = adapter.getNode('non-existent');
      const nonExistentEdge = adapter.getEdge('non-existent');

      expect(nonExistentNode).toBeNull();
      expect(nonExistentEdge).toBeNull();
    });
  });
});
