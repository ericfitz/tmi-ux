import { Node, Edge } from '@antv/x6';
import { Point } from '../../domain/value-objects/point';

/**
 * Serialized state interfaces for type-safe testing
 */
export interface NodeSerializedState {
  id: string;
  shape: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  angle?: number;
  attrs: {
    body?: {
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
      rx?: number;
      ry?: number;
      strokeDasharray?: string;
    };
    label?: {
      text?: string;
      fontSize?: number;
      fontFamily?: string;
      fill?: string;
      textAnchor?: string;
      textVerticalAnchor?: string;
    };
  };
  ports?: {
    groups?: Record<string, unknown>;
    items?: Array<{ id: string; group: string }>;
  };
  zIndex?: number;
  visible?: boolean;
  data?: Record<string, unknown>;
}

export interface EdgeSerializedState {
  id: string;
  shape: string;
  source: { cell: string; port?: string } | { x: number; y: number };
  target: { cell: string; port?: string } | { x: number; y: number };
  attrs: {
    line?: {
      stroke?: string;
      strokeWidth?: number;
      targetMarker?: {
        name: string;
        width?: number;
        height?: number;
        fill?: string;
        stroke?: string;
      };
    };
    wrap?: {
      connection?: boolean;
      strokeWidth?: number;
    };
  };
  labels?: Array<{
    attrs: { text: { text: string } };
    position?: { distance: number };
  }>;
  vertices?: Array<{ x: number; y: number }>;
  connector?: { name: string; args?: Record<string, unknown> };
  router?: { name: string; args?: Record<string, unknown> };
  zIndex?: number;
  visible?: boolean;
  data?: Record<string, unknown>;
}

export interface NodeProperties {
  id: string;
  type: string;
  position: Point;
  size: { width: number; height: number };
  label: string;
  styling: {
    stroke: string;
    strokeWidth: number;
    fill: string;
  };
  ports: Array<{ id: string; group: string }>;
  zIndex: number;
}

export interface EdgeProperties {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourcePortId?: string;
  targetPortId?: string;
  label: string;
  styling: {
    stroke: string;
    strokeWidth: number;
    targetMarker: string;
  };
  vertices: Point[];
  connector: string;
  router: string;
  zIndex: number;
}

/**
 * Utility class for serializing and comparing X6 cell states
 */
export class CellSerializationUtil {
  /**
   * Serialize a node to a standardized format for testing
   */
  static serializeNode(node: Node): NodeSerializedState {
    const json = node.toJSON();
    return {
      id: json.id || '',
      shape: json.shape || 'rect',
      position: json.position || { x: 0, y: 0 },
      size: json.size || { width: 120, height: 80 },
      angle: json.angle,
      attrs: json.attrs || {},
      ports: json.ports as {
        groups?: Record<string, unknown>;
        items?: Array<{ id: string; group: string }>;
      },
      zIndex: json.zIndex,
      visible: json.visible,
      data: json.data,
    };
  }

  /**
   * Serialize an edge to a standardized format for testing
   */
  static serializeEdge(edge: Edge): EdgeSerializedState {
    const json = edge.toJSON();
    return {
      id: json.id || '',
      shape: json.shape || 'edge',
      source: json['source'],
      target: json['target'],
      attrs: json.attrs || {},
      labels: json['labels'],
      vertices: json['vertices'],
      connector: json['connector'],
      router: json['router'],
      zIndex: json.zIndex,
      visible: json.visible,
      data: json.data,
    };
  }

  /**
   * Compare two node states for equality
   */
  static compareNodeStates(
    actual: NodeSerializedState,
    expected: Partial<NodeSerializedState>,
  ): boolean {
    return this._deepCompare(actual, expected);
  }

  /**
   * Compare two edge states for equality
   */
  static compareEdgeStates(
    actual: EdgeSerializedState,
    expected: Partial<EdgeSerializedState>,
  ): boolean {
    return this._deepCompare(actual, expected);
  }

  /**
   * Extract essential node properties for simplified testing
   */
  static extractNodeProperties(serialized: NodeSerializedState): NodeProperties {
    const bodyAttrs = serialized.attrs.body || {};
    const labelAttrs = serialized.attrs.label || {};
    const ports = serialized.ports?.items || [];

    return {
      id: serialized.id,
      type: serialized.shape,
      position: new Point(serialized.position.x, serialized.position.y),
      size: serialized.size,
      label: labelAttrs.text || '',
      styling: {
        stroke: bodyAttrs.stroke || '#000',
        strokeWidth: bodyAttrs.strokeWidth || 2,
        fill: bodyAttrs.fill || '#fff',
      },
      ports: ports.map(port => ({ id: port.id, group: port.group })),
      zIndex: serialized.zIndex || 0,
    };
  }

  /**
   * Extract essential edge properties for simplified testing
   */
  static extractEdgeProperties(serialized: EdgeSerializedState): EdgeProperties {
    const lineAttrs = serialized.attrs.line || {};
    const targetMarker = lineAttrs.targetMarker || {};
    const vertices = serialized.vertices || [];
    const labels = serialized.labels || [];
    const connector = serialized.connector || { name: 'normal' };
    const router = serialized.router || { name: 'normal' };

    // Extract source and target node IDs
    const source = serialized.source as { cell: string; port?: string };
    const target = serialized.target as { cell: string; port?: string };

    return {
      id: serialized.id,
      sourceNodeId: source.cell,
      targetNodeId: target.cell,
      sourcePortId: source.port,
      targetPortId: target.port,
      label: labels.length > 0 ? labels[0].attrs.text.text : '',
      styling: {
        stroke: lineAttrs.stroke || '#000',
        strokeWidth: lineAttrs.strokeWidth || 2,
        targetMarker: (targetMarker as { name?: string }).name || 'block',
      },
      vertices: vertices.map(v => new Point(v.x, v.y)),
      connector: connector.name,
      router: router.name,
      zIndex: serialized.zIndex || 0,
    };
  }

  /**
   * Validate that a node has the expected shape-specific properties
   */
  static validateNodeShape(serialized: NodeSerializedState, expectedShape: string): boolean {
    if (serialized.shape !== expectedShape) {
      return false;
    }

    const bodyAttrs = serialized.attrs.body || {};

    switch (expectedShape) {
      case 'rect': // Actor
        return bodyAttrs.rx !== undefined && bodyAttrs.ry !== undefined;
      case 'ellipse': // Process
        return true; // Ellipse doesn't need special validation
      case 'custom-store': // Store
        return true; // Custom store shape validation would go here
      case 'security-boundary': // Security Boundary (dashed rect)
        return bodyAttrs.strokeDasharray !== undefined;
      case 'textbox': // Textbox (transparent rect)
        return bodyAttrs.fill === 'transparent' || bodyAttrs.fill === 'none';
      default:
        return false;
    }
  }

  /**
   * Validate that an edge has the expected dual-path markup
   */
  static validateEdgeDualPath(serialized: EdgeSerializedState): boolean {
    const attrs = serialized.attrs;
    return !!(attrs.line && attrs.wrap);
  }

  /**
   * Validate port configuration for a node
   */
  static validateNodePorts(serialized: NodeSerializedState): boolean {
    const ports = serialized.ports?.items || [];
    const expectedGroups = ['top', 'right', 'bottom', 'left'];

    if (ports.length !== 4) {
      return false;
    }

    const groups = ports.map(port => port.group);
    return expectedGroups.every(group => groups.includes(group));
  }

  /**
   * Check if a node is embedded (has parent-child relationship indicators)
   */
  static isNodeEmbedded(serialized: NodeSerializedState): boolean {
    const data = serialized.data || {};
    return 'parent' in data || 'embeddingDepth' in data;
  }

  /**
   * Get embedding depth from node data
   */
  static getEmbeddingDepth(serialized: NodeSerializedState): number {
    const data = serialized.data || {};
    return (data['embeddingDepth'] as number) || 0;
  }

  /**
   * Validate that embedded nodes have appropriate fill color based on depth
   */
  static validateEmbeddedNodeStyling(serialized: NodeSerializedState, depth: number): boolean {
    const bodyAttrs = serialized.attrs.body || {};
    const fill = bodyAttrs.fill || '#fff';

    if (depth === 0) {
      return fill === '#fff' || fill === 'white';
    }

    // Embedded nodes should have bluish tints that get darker with depth
    return fill.includes('blue') || (fill.includes('#') && fill !== '#fff');
  }

  /**
   * Deep comparison utility for objects
   */
  private static _deepCompare(actual: unknown, expected: unknown): boolean {
    if (actual === expected) {
      return true;
    }

    if (actual == null || expected == null) {
      return actual === expected;
    }

    if (typeof actual !== typeof expected) {
      return false;
    }

    if (typeof actual !== 'object') {
      return actual === expected;
    }

    const actualObj = actual as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    const expectedKeys = Object.keys(expectedObj);
    for (const key of expectedKeys) {
      if (!(key in actualObj)) {
        return false;
      }

      if (!this._deepCompare(actualObj[key], expectedObj[key])) {
        return false;
      }
    }

    return true;
  }
}
