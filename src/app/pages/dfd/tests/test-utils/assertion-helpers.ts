import { Node, Edge, Graph } from '@antv/x6';
import { expect } from 'vitest';
import {
  CellSerializationUtil,
  NodeSerializedState,
  EdgeSerializedState,
} from './cell-serialization.util';
import { NodeType } from '../../domain/value-objects/node-data';
import { Point } from '../../domain/value-objects/point';

/**
 * Custom assertion helpers for graph component testing
 */
export class AssertionHelpers {
  /**
   * Assert that a node has the expected basic properties
   */
  static assertNodeBasicProperties(
    node: Node,
    expectedId: string,
    expectedShape: string,
    expectedPosition: Point,
    expectedSize: { width: number; height: number },
  ): void {
    const serialized = CellSerializationUtil.serializeNode(node);

    expect(serialized.id).toBe(expectedId);
    expect(serialized.shape).toBe(expectedShape);
    expect(serialized.position.x).toBe(expectedPosition.x);
    expect(serialized.position.y).toBe(expectedPosition.y);
    expect(serialized.size.width).toBe(expectedSize.width);
    expect(serialized.size.height).toBe(expectedSize.height);
  }

  /**
   * Assert that a node has the expected styling attributes
   */
  static assertNodeStyling(
    node: Node,
    expectedStroke: string = '#000',
    expectedStrokeWidth: number = 2,
    expectedFill?: string,
  ): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const bodyAttrs = serialized.attrs.body || {};

    expect(bodyAttrs.stroke).toBe(expectedStroke);
    expect(bodyAttrs.strokeWidth).toBe(expectedStrokeWidth);

    if (expectedFill !== undefined) {
      expect(bodyAttrs.fill).toBe(expectedFill);
    }
  }

  /**
   * Assert that a node has the expected label
   */
  static assertNodeLabel(node: Node, expectedLabel: string): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const labelAttrs = serialized.attrs.label || {};

    expect(labelAttrs.text).toBe(expectedLabel);
  }

  /**
   * Assert that a node has the expected font family (Roboto Condensed)
   */
  static assertNodeFontFamily(node: Node, expectedFontFamily: string = 'Roboto Condensed'): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const labelAttrs = serialized.attrs.label || {};

    expect(labelAttrs.fontFamily).toBe(expectedFontFamily);
  }

  /**
   * Assert that a node has the correct port configuration
   */
  static assertNodePorts(node: Node): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const isValid = CellSerializationUtil.validateNodePorts(serialized);

    expect(isValid).toBe(true);

    const ports = serialized.ports?.items || [];
    expect(ports).toHaveLength(4);

    const expectedGroups = ['top', 'right', 'bottom', 'left'];
    const actualGroups = ports.map(port => port.group);
    expectedGroups.forEach(group => {
      expect(actualGroups).toContain(group);
    });
  }

  /**
   * Assert that a node has the expected shape-specific properties
   */
  static assertNodeShapeSpecific(node: Node, nodeType: NodeType): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const bodyAttrs = serialized.attrs.body || {};

    switch (nodeType) {
      case 'actor':
        expect(serialized.shape).toBe('rect');
        expect(bodyAttrs.rx).toBeDefined();
        expect(bodyAttrs.ry).toBeDefined();
        break;
      case 'process':
        expect(serialized.shape).toBe('ellipse');
        break;
      case 'store':
        expect(serialized.shape).toBe('custom-store');
        break;
      case 'security-boundary':
        expect(serialized.shape).toBe('rect');
        expect(bodyAttrs.strokeDasharray).toBeDefined();
        expect(bodyAttrs.fill).toBe('transparent');
        break;
      case 'textbox':
        expect(serialized.shape).toBe('rect');
        expect(bodyAttrs.fill).toBe('transparent');
        expect(bodyAttrs.stroke).toBe('transparent');
        break;
    }
  }

  /**
   * Assert that an edge has the expected basic properties
   */
  static assertEdgeBasicProperties(
    edge: Edge,
    expectedId: string,
    expectedSourceId: string,
    expectedTargetId: string,
  ): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);

    expect(serialized.id).toBe(expectedId);

    const source = serialized.source as { cell: string; port?: string };
    const target = serialized.target as { cell: string; port?: string };

    expect(source.cell).toBe(expectedSourceId);
    expect(target.cell).toBe(expectedTargetId);
  }

  /**
   * Assert that an edge has the expected dual-path markup
   */
  static assertEdgeDualPath(edge: Edge): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const isValid = CellSerializationUtil.validateEdgeDualPath(serialized);

    expect(isValid).toBe(true);

    const attrs = serialized.attrs;
    expect(attrs.line).toBeDefined();
    expect(attrs.wrap).toBeDefined();
  }

  /**
   * Assert that an edge has the expected styling
   */
  static assertEdgeStyling(
    edge: Edge,
    expectedStroke: string = '#000',
    expectedStrokeWidth: number = 2,
    expectedTargetMarker: string = 'block',
  ): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const lineAttrs = serialized.attrs.line || {};
    const targetMarker = (lineAttrs.targetMarker as { name?: string }) || {};

    expect(lineAttrs.stroke).toBe(expectedStroke);
    expect(lineAttrs.strokeWidth).toBe(expectedStrokeWidth);
    expect(targetMarker.name).toBe(expectedTargetMarker);
  }

  /**
   * Assert that an edge has the expected label
   */
  static assertEdgeLabel(edge: Edge, expectedLabel: string): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const labels = serialized.labels || [];

    expect(labels).toHaveLength(1);
    expect(labels[0].attrs.text.text).toBe(expectedLabel);
  }

  /**
   * Assert that an edge has the expected connector and router
   */
  static assertEdgeConnectorRouter(
    edge: Edge,
    expectedConnector: string = 'smooth',
    expectedRouter: string = 'normal',
  ): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const connector = (serialized.connector as { name: string }) || {};
    const router = (serialized.router as { name: string }) || {};

    expect(connector.name).toBe(expectedConnector);
    expect(router.name).toBe(expectedRouter);
  }

  /**
   * Assert that an edge has the expected vertices
   */
  static assertEdgeVertices(edge: Edge, expectedVertices: Point[]): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const vertices = serialized.vertices || [];

    expect(vertices).toHaveLength(expectedVertices.length);

    vertices.forEach((vertex, index) => {
      expect(vertex.x).toBe(expectedVertices[index].x);
      expect(vertex.y).toBe(expectedVertices[index].y);
    });
  }

  /**
   * Assert that a node is embedded with the expected depth and styling
   */
  static assertNodeEmbedding(node: Node, expectedDepth: number): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const isEmbedded = CellSerializationUtil.isNodeEmbedded(serialized);
    const actualDepth = CellSerializationUtil.getEmbeddingDepth(serialized);
    const hasValidStyling = CellSerializationUtil.validateEmbeddedNodeStyling(
      serialized,
      expectedDepth,
    );

    if (expectedDepth > 0) {
      expect(isEmbedded).toBe(true);
      expect(actualDepth).toBe(expectedDepth);
      expect(hasValidStyling).toBe(true);
    } else {
      expect(actualDepth).toBe(0);
    }
  }

  /**
   * Assert that a graph contains the expected number of nodes and edges
   */
  static assertGraphCellCounts(graph: Graph, expectedNodes: number, expectedEdges: number): void {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    expect(nodes).toHaveLength(expectedNodes);
    expect(edges).toHaveLength(expectedEdges);
  }

  /**
   * Assert that a graph contains specific cells by ID
   */
  static assertGraphContainsCells(
    graph: Graph,
    expectedNodeIds: string[],
    expectedEdgeIds: string[],
  ): void {
    const nodes = graph.getNodes();
    const edges = graph.getEdges();

    const actualNodeIds = nodes.map(node => node.id);
    const actualEdgeIds = edges.map(edge => edge.id);

    expectedNodeIds.forEach(id => {
      expect(actualNodeIds).toContain(id);
    });

    expectedEdgeIds.forEach(id => {
      expect(actualEdgeIds).toContain(id);
    });
  }

  /**
   * Assert that a cell has the expected z-index
   */
  static assertCellZIndex(cell: Node | Edge, expectedZIndex: number): void {
    const serialized = cell.isNode()
      ? CellSerializationUtil.serializeNode(cell)
      : CellSerializationUtil.serializeEdge(cell);

    expect(serialized.zIndex).toBe(expectedZIndex);
  }

  /**
   * Assert that a cell is visible
   */
  static assertCellVisibility(cell: Node | Edge, expectedVisible: boolean = true): void {
    const serialized = cell.isNode()
      ? CellSerializationUtil.serializeNode(cell)
      : CellSerializationUtil.serializeEdge(cell);

    expect(serialized.visible).toBe(expectedVisible);
  }

  /**
   * Assert that a node has security boundary styling (lower z-index)
   */
  static assertSecurityBoundaryStyling(node: Node): void {
    const serialized = CellSerializationUtil.serializeNode(node);
    const bodyAttrs = serialized.attrs.body || {};

    expect(bodyAttrs.strokeDasharray).toBeDefined();
    expect(bodyAttrs.fill).toBe('transparent');
    expect(serialized.zIndex).toBeLessThan(1); // Security boundaries should have lower z-index
  }

  /**
   * Assert that nodes have progressive bluish tints based on embedding depth
   */
  static assertEmbeddedNodeColorProgression(nodes: Node[]): void {
    const nodesByDepth = new Map<number, Node[]>();

    // Group nodes by embedding depth
    nodes.forEach(node => {
      const serialized = CellSerializationUtil.serializeNode(node);
      const depth = CellSerializationUtil.getEmbeddingDepth(serialized);

      if (!nodesByDepth.has(depth)) {
        nodesByDepth.set(depth, []);
      }
      nodesByDepth.get(depth)!.push(node);
    });

    // Verify color progression
    nodesByDepth.forEach((nodesAtDepth, depth) => {
      nodesAtDepth.forEach(node => {
        this.assertNodeEmbedding(node, depth);
      });
    });
  }

  /**
   * Assert that an edge connects to the expected ports
   */
  static assertEdgePortConnections(
    edge: Edge,
    expectedSourcePort?: string,
    expectedTargetPort?: string,
  ): void {
    const serialized = CellSerializationUtil.serializeEdge(edge);
    const source = serialized.source as { cell: string; port?: string };
    const target = serialized.target as { cell: string; port?: string };

    if (expectedSourcePort) {
      expect(source.port).toBe(expectedSourcePort);
    }

    if (expectedTargetPort) {
      expect(target.port).toBe(expectedTargetPort);
    }
  }

  /**
   * Create a custom matcher for Jest/Vitest that validates complete node state
   */
  static createNodeStateMatcher(expected: Partial<NodeSerializedState>): object {
    return {
      asymmetricMatch: (actual: Node) => {
        const serialized = CellSerializationUtil.serializeNode(actual);
        return CellSerializationUtil.compareNodeStates(serialized, expected);
      },
      toString: () => `Expected node to match state: ${JSON.stringify(expected, null, 2)}`,
    };
  }

  /**
   * Create a custom matcher for Jest/Vitest that validates complete edge state
   */
  static createEdgeStateMatcher(expected: Partial<EdgeSerializedState>): object {
    return {
      asymmetricMatch: (actual: Edge) => {
        const serialized = CellSerializationUtil.serializeEdge(actual);
        return CellSerializationUtil.compareEdgeStates(serialized, expected);
      },
      toString: () => `Expected edge to match state: ${JSON.stringify(expected, null, 2)}`,
    };
  }
}

/**
 * Custom matcher types for Vitest
 */
export interface CustomMatchers<R = unknown> {
  toHaveNodeState(expected: Partial<NodeSerializedState>): R;
  toHaveEdgeState(expected: Partial<EdgeSerializedState>): R;
  toBeValidNode(nodeType: NodeType): R;
  toBeValidEdge(): R;
  toHaveCorrectPorts(): R;
  toHaveDualPathMarkup(): R;
}

/**
 * Setup custom matchers for Vitest testing framework
 */
export function setupCustomMatchers(): void {
  expect.extend({
    toHaveNodeState(received: Node, expected: Partial<NodeSerializedState>) {
      const serialized = CellSerializationUtil.serializeNode(received);
      const pass = CellSerializationUtil.compareNodeStates(serialized, expected);

      return {
        message: () =>
          pass
            ? `Expected node not to match state`
            : `Expected node to match state.\nReceived: ${JSON.stringify(serialized, null, 2)}\nExpected: ${JSON.stringify(expected, null, 2)}`,
        pass,
      };
    },

    toHaveEdgeState(received: Edge, expected: Partial<EdgeSerializedState>) {
      const serialized = CellSerializationUtil.serializeEdge(received);
      const pass = CellSerializationUtil.compareEdgeStates(serialized, expected);

      return {
        message: () =>
          pass
            ? `Expected edge not to match state`
            : `Expected edge to match state.\nReceived: ${JSON.stringify(serialized, null, 2)}\nExpected: ${JSON.stringify(expected, null, 2)}`,
        pass,
      };
    },

    toBeValidNode(received: Node, nodeType: NodeType) {
      const serialized = CellSerializationUtil.serializeNode(received);
      const hasValidShape = CellSerializationUtil.validateNodeShape(serialized, serialized.shape);
      const hasValidPorts = CellSerializationUtil.validateNodePorts(serialized);

      const pass = hasValidShape && hasValidPorts;

      return {
        message: () =>
          pass
            ? `Expected node not to be valid ${nodeType}`
            : `Expected node to be valid ${nodeType}. Shape valid: ${hasValidShape}, Ports valid: ${hasValidPorts}`,
        pass,
      };
    },

    toBeValidEdge(received: Edge) {
      const serialized = CellSerializationUtil.serializeEdge(received);
      const hasDualPath = CellSerializationUtil.validateEdgeDualPath(serialized);

      return {
        message: () =>
          hasDualPath
            ? `Expected edge not to be valid`
            : `Expected edge to be valid. Dual path markup: ${hasDualPath}`,
        pass: hasDualPath,
      };
    },

    toHaveCorrectPorts(received: Node) {
      const serialized = CellSerializationUtil.serializeNode(received);
      const pass = CellSerializationUtil.validateNodePorts(serialized);

      return {
        message: () =>
          pass
            ? `Expected node not to have correct ports`
            : `Expected node to have correct ports (top, right, bottom, left)`,
        pass,
      };
    },

    toHaveDualPathMarkup(received: Edge) {
      const serialized = CellSerializationUtil.serializeEdge(received);
      const pass = CellSerializationUtil.validateEdgeDualPath(serialized);

      return {
        message: () =>
          pass
            ? `Expected edge not to have dual path markup`
            : `Expected edge to have dual path markup (line and wrap paths)`,
        pass,
      };
    },
  });
}
