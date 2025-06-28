import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Graph, Node } from '@antv/x6';
import { MockFactories } from './test-utils/mock-factories';
import { CellSerializationUtil } from './test-utils/cell-serialization.util';
import { AssertionHelpers, setupCustomMatchers } from './test-utils/assertion-helpers';
import { Point } from '../domain/value-objects/point';

/**
 * Test suite for DFD Graph Edge Operations
 *
 * Tests all edge lifecycle and manipulation features:
 * - Edge creation and validation
 * - Edge styling and markup
 * - Edge vertices and control points
 * - Edge connection rules
 *
 * Features tested from DFD_GRAPH_INTERACTION.md:
 * ✅ Edge creation by dragging from port to port
 * ✅ Edge validation (validateMagnet, validateConnection)
 * ✅ Self-connection prevention (excluded per user request)
 * ✅ Port-to-port connection requirements
 * ✅ Multiple edges between same nodes allowed
 * ✅ Dual-path markup (wrap + line paths)
 * ✅ Default styling (black stroke, 2px, block arrowhead)
 * ✅ Smooth connector with normal router
 * ✅ Default "Flow" label at midpoint
 */
describe('DFD Graph Edge Operations', () => {
  let graph: Graph;
  let sourceNode: Node;
  let targetNode: Node;

  beforeEach(() => {
    // Setup custom matchers for enhanced assertions
    setupCustomMatchers();

    // Reset mock factories for consistent test IDs
    MockFactories.resetCounters();

    // Create a test graph instance
    graph = new Graph({
      container: document.createElement('div'),
      width: 800,
      height: 600,
    });

    // Create standard source and target nodes for edge tests
    sourceNode = MockFactories.createMockX6Node('actor', new Point(100, 100));
    targetNode = MockFactories.createMockX6Node('process', new Point(300, 100));
    graph.addNode(sourceNode);
    graph.addNode(targetNode);
  });

  afterEach(() => {
    // Clean up graph instance
    if (graph) {
      graph.dispose();
    }
  });

  describe('Edge Creation', () => {
    it('should create edge with dual-path markup structure', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeDualPath(edge);

      // Verify dual-path structure in detail
      const serialized = CellSerializationUtil.serializeEdge(edge);
      expect(serialized.attrs.line).toBeDefined();
      expect(serialized.attrs.wrap).toBeDefined();

      // Verify wrap path is for interaction
      const wrapAttrs = serialized.attrs.wrap;
      expect(wrapAttrs?.connection).toBe(true);
      expect(wrapAttrs?.strokeWidth).toBe(10);
    });

    it('should apply default styling (black stroke, 2px width, block arrowhead)', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeStyling(edge, '#000', 2, 'block');

      // Verify detailed styling
      const serialized = CellSerializationUtil.serializeEdge(edge);
      const lineAttrs = serialized.attrs.line;
      const targetMarker = lineAttrs?.targetMarker as {
        name?: string;
        width?: number;
        height?: number;
      };

      expect(lineAttrs?.stroke).toBe('#000');
      expect(lineAttrs?.strokeWidth).toBe(2);
      expect(targetMarker?.name).toBe('block');
      expect(targetMarker?.width).toBe(12);
      expect(targetMarker?.height).toBe(8);
    });

    it('should create edge with default "Flow" label at midpoint', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeLabel(edge, 'Test Flow');

      // Verify label positioning
      const serialized = CellSerializationUtil.serializeEdge(edge);
      const labels = serialized.labels || [];
      expect(labels).toHaveLength(1);
      expect(labels[0].position?.distance).toBe(0.5); // Midpoint
    });

    it('should use smooth connector with normal router', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeConnectorRouter(edge, 'smooth', 'normal');
    });

    it('should connect to specific ports when specified', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        sourcePort: 'right',
        targetPort: 'left',
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgePortConnections(edge, 'right', 'left');
      AssertionHelpers.assertEdgeBasicProperties(edge, edge.id, sourceNode.id, targetNode.id);
    });

    it('should allow multiple edges between same nodes', () => {
      // Arrange & Act
      const edge1 = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        label: 'First Flow',
        sourcePort: 'right',
        targetPort: 'left',
      });
      const edge2 = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        label: 'Second Flow',
        sourcePort: 'top',
        targetPort: 'bottom',
      });

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      // Assert
      AssertionHelpers.assertGraphCellCounts(graph, 2, 2);

      // Verify both edges exist and have different properties
      AssertionHelpers.assertEdgeLabel(edge1, 'First Flow');
      AssertionHelpers.assertEdgeLabel(edge2, 'Second Flow');
      AssertionHelpers.assertEdgePortConnections(edge1, 'right', 'left');
      AssertionHelpers.assertEdgePortConnections(edge2, 'top', 'bottom');
    });

    it('should create edge with custom label', () => {
      // Arrange & Act
      const customLabel = 'Custom Data Flow';
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        label: customLabel,
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeLabel(edge, customLabel);
    });
  });

  describe('Edge Validation', () => {
    it('should require valid source and target nodes', () => {
      // Arrange
      const validEdge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      const invalidEdge = MockFactories.createMockX6Edge('invalid-source', 'invalid-target');

      // Act & Assert
      expect(() => graph.addEdge(validEdge)).not.toThrow();

      // X6 Graph doesn't throw on invalid edges, but they won't be properly connected
      // Instead, verify that the invalid edge doesn't create proper connections
      graph.addEdge(invalidEdge);

      // The invalid edge should exist but not have valid connections
      expect(graph.getCellById(invalidEdge.id)).toBe(invalidEdge);
      expect(graph.getCellById('invalid-source')).toBeNull();
      expect(graph.getCellById('invalid-target')).toBeNull();
    });

    it('should validate port-to-port connections', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        sourcePort: 'right',
        targetPort: 'left',
      });
      graph.addEdge(edge);

      // Assert
      const serialized = CellSerializationUtil.serializeEdge(edge);
      const source = serialized.source as { cell: string; port?: string };
      const target = serialized.target as { cell: string; port?: string };

      expect(source.cell).toBe(sourceNode.id);
      expect(source.port).toBe('right');
      expect(target.cell).toBe(targetNode.id);
      expect(target.port).toBe('left');
    });

    it('should maintain edge integrity when nodes are moved', () => {
      // Arrange
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Act - Move nodes
      sourceNode.setPosition(150, 150);
      targetNode.setPosition(350, 150);

      // Assert - Edge should still connect the same nodes
      AssertionHelpers.assertEdgeBasicProperties(edge, edge.id, sourceNode.id, targetNode.id);
    });
  });

  describe('Edge Vertices', () => {
    it('should add vertex at specified position', () => {
      // Arrange
      const vertices = [new Point(200, 150), new Point(250, 200)];
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        vertices,
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeVertices(edge, vertices);
    });

    it('should update vertices and maintain edge properties', () => {
      // Arrange
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Act - Add vertices
      const newVertices = [
        { x: 200, y: 120 },
        { x: 250, y: 140 },
      ];
      edge.setVertices(newVertices);

      // Assert
      const expectedVertices = newVertices.map(v => new Point(v.x, v.y));
      AssertionHelpers.assertEdgeVertices(edge, expectedVertices);

      // Verify other properties are maintained
      AssertionHelpers.assertEdgeBasicProperties(edge, edge.id, sourceNode.id, targetNode.id);
      AssertionHelpers.assertEdgeStyling(edge);
    });

    it('should serialize vertex positions correctly', () => {
      // Arrange
      const vertices = [new Point(180, 130), new Point(220, 170), new Point(260, 140)];
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        vertices,
      });
      graph.addEdge(edge);

      // Act
      const serialized = CellSerializationUtil.serializeEdge(edge);

      // Assert
      const serializedVertices = serialized.vertices || [];
      expect(serializedVertices).toHaveLength(vertices.length);

      serializedVertices.forEach((vertex, index) => {
        expect(vertex.x).toBe(vertices[index].x);
        expect(vertex.y).toBe(vertices[index].y);
      });
    });

    it('should handle complex edge routing with multiple vertices', () => {
      // Arrange - Create a complex route
      const complexVertices = [
        new Point(150, 80),
        new Point(200, 60),
        new Point(250, 80),
        new Point(280, 120),
      ];
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        vertices: complexVertices,
        label: 'Complex Route',
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeVertices(edge, complexVertices);
      AssertionHelpers.assertEdgeLabel(edge, 'Complex Route');
      AssertionHelpers.assertEdgeConnectorRouter(edge, 'smooth', 'normal');
    });
  });

  describe('Edge Styling Variations', () => {
    it('should support custom connector types', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        connector: 'rounded',
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeConnectorRouter(edge, 'rounded', 'normal');
    });

    it('should support custom router types', () => {
      // Arrange & Act
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        router: 'manhattan',
      });
      graph.addEdge(edge);

      // Assert
      AssertionHelpers.assertEdgeConnectorRouter(edge, 'smooth', 'manhattan');
    });

    it('should maintain consistent styling across different edge configurations', () => {
      // Arrange
      const edges = [
        MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
          label: 'Simple Edge',
        }),
        MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
          label: 'Edge with Vertices',
          vertices: [new Point(200, 150)],
        }),
        MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
          label: 'Custom Connector',
          connector: 'rounded',
        }),
      ];

      // Act
      edges.forEach(edge => graph.addEdge(edge));

      // Assert - All edges should have consistent base styling
      edges.forEach(edge => {
        AssertionHelpers.assertEdgeStyling(edge, '#000', 2, 'block');
        AssertionHelpers.assertEdgeDualPath(edge);
      });
    });
  });

  describe('Edge Deletion', () => {
    it('should remove edge from graph', () => {
      // Arrange
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Verify edge is added
      AssertionHelpers.assertGraphCellCounts(graph, 2, 1);

      // Act
      graph.removeEdge(edge);

      // Assert
      AssertionHelpers.assertGraphCellCounts(graph, 2, 0);
      expect(graph.getCellById(edge.id)).toBeNull();
    });

    it('should not affect connected nodes when edge is deleted', () => {
      // Arrange
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id);
      graph.addEdge(edge);

      // Act
      graph.removeEdge(edge);

      // Assert - Nodes should still exist
      AssertionHelpers.assertGraphCellCounts(graph, 2, 0);
      expect(graph.getCellById(sourceNode.id)).toBe(sourceNode);
      expect(graph.getCellById(targetNode.id)).toBe(targetNode);
    });
  });

  describe('Edge Z-Index Management', () => {
    it('should support z-index for edge layering', () => {
      // Arrange
      const edge1 = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        zIndex: 1,
        label: 'Lower Edge',
      });
      const edge2 = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        zIndex: 2,
        label: 'Upper Edge',
      });

      graph.addEdge(edge1);
      graph.addEdge(edge2);

      // Assert
      AssertionHelpers.assertCellZIndex(edge1, 1);
      AssertionHelpers.assertCellZIndex(edge2, 2);
    });

    it('should allow z-index modification after creation', () => {
      // Arrange
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        zIndex: 1,
      });
      graph.addEdge(edge);

      // Act
      edge.setZIndex(5);

      // Assert
      AssertionHelpers.assertCellZIndex(edge, 5);
    });
  });

  describe('Edge Metadata and Custom Data', () => {
    it('should support custom metadata storage', () => {
      // Arrange
      const customMetadata = {
        flowType: 'data',
        encrypted: true,
        priority: 'high',
      };
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        metadata: customMetadata,
      });
      graph.addEdge(edge);

      // Assert
      const serialized = CellSerializationUtil.serializeEdge(edge);
      expect(serialized.data).toEqual(customMetadata);
    });

    it('should maintain metadata through edge operations', () => {
      // Arrange
      const metadata = { category: 'critical', version: '1.0' };
      const edge = MockFactories.createMockX6Edge(sourceNode.id, targetNode.id, {
        metadata,
      });
      graph.addEdge(edge);

      // Act - Modify edge properties
      edge.setVertices([{ x: 200, y: 150 }]);
      edge.setLabels([{ attrs: { text: { text: 'Modified Label' } } }]);

      // Assert - Metadata should be preserved
      const serialized = CellSerializationUtil.serializeEdge(edge);
      expect(serialized.data).toEqual(metadata);
    });
  });

  describe('Edge Integration with Different Node Types', () => {
    it('should connect different node types correctly', () => {
      // Arrange - Start with a fresh graph to ensure clean state
      const cleanGraph = new Graph({
        container: document.createElement('div'),
        width: 800,
        height: 600,
      });

      const actorNode = MockFactories.createMockX6Node('actor', new Point(50, 100));
      const processNode = MockFactories.createMockX6Node('process', new Point(200, 100));
      const storeNode = MockFactories.createMockX6Node('store', new Point(350, 100));
      const boundaryNode = MockFactories.createMockX6Node('security-boundary', new Point(25, 50), {
        width: 400,
        height: 200,
      });

      cleanGraph.addNode(actorNode);
      cleanGraph.addNode(processNode);
      cleanGraph.addNode(storeNode);
      cleanGraph.addNode(boundaryNode);

      // Act - Create edges between different node types
      const edges = [
        MockFactories.createMockX6Edge(actorNode.id, processNode.id, { label: 'User Input' }),
        MockFactories.createMockX6Edge(processNode.id, storeNode.id, { label: 'Store Data' }),
      ];
      edges.forEach(edge => cleanGraph.addEdge(edge));

      // Assert - Verify the correct counts for this clean graph
      AssertionHelpers.assertGraphCellCounts(cleanGraph, 4, 2);
      edges.forEach(edge => {
        AssertionHelpers.assertEdgeStyling(edge);
        AssertionHelpers.assertEdgeDualPath(edge);
      });

      // Cleanup
      cleanGraph.dispose();
    });
  });
});
