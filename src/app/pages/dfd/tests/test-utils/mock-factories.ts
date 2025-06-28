import { Node, Edge } from '@antv/x6';
import { NodeData, NodeType } from '../../domain/value-objects/node-data';
import { EdgeData } from '../../domain/value-objects/edge-data';
import { Point } from '../../domain/value-objects/point';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';

/**
 * Options for creating mock nodes
 */
export interface NodeOptions {
  label?: string;
  width?: number;
  height?: number;
  zIndex?: number;
  metadata?: Record<string, unknown>;
  ports?: Array<{ id: string; group: string }>;
}

/**
 * Options for creating mock edges
 */
export interface EdgeOptions {
  label?: string;
  sourcePort?: string;
  targetPort?: string;
  vertices?: Point[];
  connector?: string;
  router?: string;
  zIndex?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Test scenario types for common testing patterns
 */
export type TestScenarioType =
  | 'simple-flow'
  | 'complex-network'
  | 'embedded-nodes'
  | 'multi-level-embedding'
  | 'edge-with-vertices'
  | 'all-node-types';

/**
 * Test scenario data structure
 */
export interface TestScenario {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  description: string;
}

/**
 * Factory class for creating mock data for testing
 */
export class MockFactories {
  private static _nodeCounter = 0;
  private static _edgeCounter = 0;

  /**
   * Reset counters for consistent test IDs
   */
  static resetCounters(): void {
    this._nodeCounter = 0;
    this._edgeCounter = 0;
  }

  /**
   * Generate a unique node ID
   */
  static generateNodeId(): string {
    return `test-node-${++this._nodeCounter}`;
  }

  /**
   * Generate a unique edge ID
   */
  static generateEdgeId(): string {
    return `test-edge-${++this._edgeCounter}`;
  }

  /**
   * Create a mock node with the specified type and position
   */
  static createMockNode(type: NodeType, position: Point, options: NodeOptions = {}): DiagramNode {
    const nodeId = this.generateNodeId();
    const defaultLabels: Record<NodeType, string> = {
      actor: 'Test Actor',
      process: 'Test Process',
      store: 'Test Store',
      'security-boundary': 'Test Security Boundary',
      textbox: 'Test Textbox',
    };

    const nodeData = new NodeData(
      nodeId,
      type,
      options.label || defaultLabels[type],
      position,
      options.width || 120,
      options.height || 80,
      (options.metadata as Record<string, string>) || {},
    );

    return new DiagramNode(nodeData);
  }

  /**
   * Create a mock edge between two nodes
   */
  static createMockEdge(
    sourceNodeId: string,
    targetNodeId: string,
    options: EdgeOptions = {},
  ): DiagramEdge {
    const edgeId = this.generateEdgeId();

    const edgeData = new EdgeData(
      edgeId,
      sourceNodeId,
      targetNodeId,
      options.sourcePort,
      options.targetPort,
      options.label || 'Test Flow',
      options.vertices || [],
      (options.metadata as Record<string, string>) || {},
    );

    return new DiagramEdge(edgeData);
  }

  /**
   * Create a mock X6 node for direct X6 testing
   */
  static createMockX6Node(type: NodeType, position: Point, options: NodeOptions = {}): Node {
    const nodeId = this.generateNodeId();
    const shapes: Record<NodeType, string> = {
      actor: 'rect',
      process: 'ellipse',
      store: 'custom-store',
      'security-boundary': 'rect',
      textbox: 'rect',
    };

    const defaultAttrs = this.getDefaultNodeAttrs(type);

    return new Node({
      id: nodeId,
      shape: shapes[type],
      x: position.x,
      y: position.y,
      width: options.width || 120,
      height: options.height || 80,
      label: options.label || `Test ${type}`,
      attrs: defaultAttrs as any,
      ports: this.getDefaultPorts(),
      zIndex: options.zIndex || 0,
      data: (options.metadata as Record<string, string>) || {},
    });
  }

  /**
   * Create a mock X6 edge for direct X6 testing
   */
  static createMockX6Edge(
    sourceNodeId: string,
    targetNodeId: string,
    options: EdgeOptions = {},
  ): Edge {
    const edgeId = this.generateEdgeId();

    return new Edge({
      id: edgeId,
      source: { cell: sourceNodeId, port: options.sourcePort || 'right' },
      target: { cell: targetNodeId, port: options.targetPort || 'left' },
      attrs: this.getDefaultEdgeAttrs() as any,
      labels: [
        {
          attrs: { text: { text: options.label || 'Test Flow' } },
          position: { distance: 0.5 },
        },
      ],
      vertices: options.vertices?.map(v => ({ x: v.x, y: v.y })) || [],
      connector: { name: options.connector || 'smooth' },
      router: { name: options.router || 'normal' },
      zIndex: options.zIndex || 0,
      data: options.metadata || {},
    });
  }

  /**
   * Create a test scenario with predefined node and edge configurations
   */
  static createTestScenario(scenario: TestScenarioType): TestScenario {
    this.resetCounters();

    switch (scenario) {
      case 'simple-flow':
        return this.createSimpleFlowScenario();
      case 'complex-network':
        return this.createComplexNetworkScenario();
      case 'embedded-nodes':
        return this.createEmbeddedNodesScenario();
      case 'multi-level-embedding':
        return this.createMultiLevelEmbeddingScenario();
      case 'edge-with-vertices':
        return this.createEdgeWithVerticesScenario();
      case 'all-node-types':
        return this.createAllNodeTypesScenario();
      default:
        throw new Error(`Unknown test scenario: ${scenario as string}`);
    }
  }

  /**
   * Get default attributes for a node type
   */
  private static getDefaultNodeAttrs(type: NodeType): Record<string, unknown> {
    const baseAttrs = {
      body: {
        stroke: '#000',
        strokeWidth: 2,
        fill: '#fff',
      },
      label: {
        fontSize: 12,
        fontFamily: 'Roboto Condensed',
        fill: '#333',
        textAnchor: 'middle',
        textVerticalAnchor: 'middle',
      },
    };

    switch (type) {
      case 'actor':
        return {
          ...baseAttrs,
          body: { ...baseAttrs.body, rx: 6, ry: 6 },
        };
      case 'process':
        return baseAttrs;
      case 'store':
        return {
          ...baseAttrs,
          body: { ...baseAttrs.body, strokeDasharray: '0' },
        };
      case 'security-boundary':
        return {
          ...baseAttrs,
          body: { ...baseAttrs.body, strokeDasharray: '5,5', fill: 'transparent' },
        };
      case 'textbox':
        return {
          ...baseAttrs,
          body: { ...baseAttrs.body, fill: 'transparent', stroke: 'transparent' },
        };
      default:
        return baseAttrs;
    }
  }

  /**
   * Get default attributes for edges
   */
  private static getDefaultEdgeAttrs(): Record<string, unknown> {
    return {
      line: {
        stroke: '#000',
        strokeWidth: 2,
        targetMarker: {
          name: 'block',
          width: 12,
          height: 8,
          fill: '#000',
          stroke: '#000',
        },
      },
      wrap: {
        connection: true,
        strokeWidth: 10,
        stroke: 'transparent',
      },
    };
  }

  /**
   * Get default port configuration
   */
  private static getDefaultPorts(): Record<string, unknown> {
    return {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              stroke: '#000',
              strokeWidth: 2,
              fill: '#fff',
            },
          },
        },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'right', group: 'right' },
        { id: 'bottom', group: 'bottom' },
        { id: 'left', group: 'left' },
      ],
    };
  }

  /**
   * Create a simple flow scenario: Actor -> Process -> Store
   */
  private static createSimpleFlowScenario(): TestScenario {
    const actor = this.createMockNode('actor', new Point(100, 100));
    const process = this.createMockNode('process', new Point(300, 100));
    const store = this.createMockNode('store', new Point(500, 100));

    const edge1 = this.createMockEdge(actor.id, process.id, { label: 'User Input' });
    const edge2 = this.createMockEdge(process.id, store.id, { label: 'Store Data' });

    return {
      nodes: [actor, process, store],
      edges: [edge1, edge2],
      description: 'Simple linear flow from actor through process to store',
    };
  }

  /**
   * Create a complex network scenario with multiple connections
   */
  private static createComplexNetworkScenario(): TestScenario {
    const nodes = [
      this.createMockNode('actor', new Point(100, 100), { label: 'User' }),
      this.createMockNode('process', new Point(300, 100), { label: 'Auth Process' }),
      this.createMockNode('process', new Point(500, 100), { label: 'Main Process' }),
      this.createMockNode('store', new Point(300, 250), { label: 'User DB' }),
      this.createMockNode('store', new Point(500, 250), { label: 'Data DB' }),
      this.createMockNode('actor', new Point(700, 100), { label: 'Admin' }),
    ];

    const edges = [
      this.createMockEdge(nodes[0].id, nodes[1].id, { label: 'Login Request' }),
      this.createMockEdge(nodes[1].id, nodes[3].id, { label: 'Verify User' }),
      this.createMockEdge(nodes[1].id, nodes[2].id, { label: 'Authenticated' }),
      this.createMockEdge(nodes[2].id, nodes[4].id, { label: 'Process Data' }),
      this.createMockEdge(nodes[5].id, nodes[2].id, { label: 'Admin Action' }),
      this.createMockEdge(nodes[2].id, nodes[0].id, { label: 'Response' }),
    ];

    return {
      nodes,
      edges,
      description: 'Complex network with multiple processes and data stores',
    };
  }

  /**
   * Create an embedded nodes scenario
   */
  private static createEmbeddedNodesScenario(): TestScenario {
    const boundary = this.createMockNode('security-boundary', new Point(50, 50), {
      label: 'Secure Zone',
      width: 400,
      height: 300,
    });

    const process1 = this.createMockNode('process', new Point(150, 150), {
      label: 'Internal Process 1',
    });

    const process2 = this.createMockNode('process', new Point(250, 150), {
      label: 'Internal Process 2',
    });

    const externalActor = this.createMockNode('actor', new Point(500, 150), {
      label: 'External User',
    });

    const edge1 = this.createMockEdge(process1.id, process2.id, { label: 'Internal Flow' });
    const edge2 = this.createMockEdge(externalActor.id, process1.id, { label: 'External Input' });

    return {
      nodes: [boundary, process1, process2, externalActor],
      edges: [edge1, edge2],
      description: 'Nodes embedded within a security boundary',
    };
  }

  /**
   * Create a multi-level embedding scenario
   */
  private static createMultiLevelEmbeddingScenario(): TestScenario {
    const outerBoundary = this.createMockNode('security-boundary', new Point(25, 25), {
      label: 'Outer Security Zone',
      width: 450,
      height: 350,
    });

    const innerBoundary = this.createMockNode('security-boundary', new Point(75, 75), {
      label: 'Inner Security Zone',
      width: 300,
      height: 200,
    });

    const coreProcess = this.createMockNode('process', new Point(200, 150), {
      label: 'Core Process',
    });

    const middleProcess = this.createMockNode('process', new Point(350, 150), {
      label: 'Middle Process',
    });

    const externalActor = this.createMockNode('actor', new Point(500, 150), {
      label: 'External User',
    });

    const edges = [
      this.createMockEdge(coreProcess.id, middleProcess.id, { label: 'Core to Middle' }),
      this.createMockEdge(middleProcess.id, externalActor.id, { label: 'Middle to External' }),
    ];

    return {
      nodes: [outerBoundary, innerBoundary, coreProcess, middleProcess, externalActor],
      edges,
      description: 'Multi-level embedding with nested security boundaries',
    };
  }

  /**
   * Create an edge with vertices scenario
   */
  private static createEdgeWithVerticesScenario(): TestScenario {
    const source = this.createMockNode('actor', new Point(100, 100));
    const target = this.createMockNode('store', new Point(400, 300));

    const edgeWithVertices = this.createMockEdge(source.id, target.id, {
      label: 'Complex Route',
      vertices: [new Point(200, 150), new Point(300, 200), new Point(350, 250)],
    });

    return {
      nodes: [source, target],
      edges: [edgeWithVertices],
      description: 'Edge with multiple vertices for complex routing',
    };
  }

  /**
   * Create a scenario with all node types
   */
  private static createAllNodeTypesScenario(): TestScenario {
    const nodes = [
      this.createMockNode('actor', new Point(100, 100), { label: 'Actor Node' }),
      this.createMockNode('process', new Point(250, 100), { label: 'Process Node' }),
      this.createMockNode('store', new Point(400, 100), { label: 'Store Node' }),
      this.createMockNode('security-boundary', new Point(50, 200), {
        label: 'Security Boundary',
        width: 300,
        height: 150,
      }),
      this.createMockNode('textbox', new Point(450, 200), { label: 'Text Note' }),
    ];

    const edges = [
      this.createMockEdge(nodes[0].id, nodes[1].id, { label: 'Actor to Process' }),
      this.createMockEdge(nodes[1].id, nodes[2].id, { label: 'Process to Store' }),
    ];

    return {
      nodes,
      edges,
      description: 'Showcase of all available node types',
    };
  }
}
