import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Graph, Node, Edge, Cell, Shape } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Selection } from '@antv/x6-plugin-selection';
import { Snapline } from '@antv/x6-plugin-snapline';

import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';

// Register custom store shape with only top and bottom borders
Shape.Rect.define({
  shape: 'store-shape',
  markup: [
    {
      tagName: 'rect',
      selector: 'body',
    },
    {
      tagName: 'path',
      selector: 'topBorder',
    },
    {
      tagName: 'path',
      selector: 'bottomBorder',
    },
    {
      tagName: 'text',
      selector: 'text',
    },
  ],
  attrs: {
    body: {
      refWidth: '100%',
      refHeight: '100%',
      fill: '#FFFFFF',
      stroke: 'none',
      strokeWidth: 0,
    },
    topBorder: {
      refD: 'M 0 0 L 100% 0',
      stroke: '#000000',
      strokeWidth: 2,
      fill: 'none',
    },
    bottomBorder: {
      refD: 'M 0 100% L 100% 100%',
      stroke: '#000000',
      strokeWidth: 2,
      fill: 'none',
    },
    text: {
      refX: '50%',
      refY: '50%',
      textAnchor: 'middle',
      textVerticalAnchor: 'middle',
      fontFamily: '"Roboto Condensed", Arial, sans-serif',
      fontSize: 12,
      fill: '#000000',
    },
  },
});

/**
 * X6 Graph Adapter that provides abstraction over X6 Graph operations
 * while maintaining direct access to X6's native capabilities.
 */
@Injectable()
export class X6GraphAdapter implements IGraphAdapter {
  private _graph: Graph | null = null;
  private readonly _destroy$ = new Subject<void>();
  private _isConnecting = false;

  // Event subjects
  private readonly _nodeAdded$ = new Subject<Node>();
  private readonly _nodeRemoved$ = new Subject<{ nodeId: string; node: Node }>();
  private readonly _nodeMoved$ = new Subject<{
    nodeId: string;
    position: Point;
    previous: Point;
  }>();
  private readonly _edgeAdded$ = new Subject<Edge>();
  private readonly _edgeRemoved$ = new Subject<{ edgeId: string; edge: Edge }>();
  private readonly _selectionChanged$ = new Subject<{ selected: string[]; deselected: string[] }>();

  /**
   * Observable for node addition events
   */
  get nodeAdded$(): Observable<Node> {
    return this._nodeAdded$.asObservable();
  }

  /**
   * Observable for node removal events
   */
  get nodeRemoved$(): Observable<{ nodeId: string; node: Node }> {
    return this._nodeRemoved$.asObservable();
  }

  /**
   * Observable for node movement events
   */
  get nodeMoved$(): Observable<{ nodeId: string; position: Point; previous: Point }> {
    return this._nodeMoved$.asObservable();
  }

  /**
   * Observable for edge addition events
   */
  get edgeAdded$(): Observable<Edge> {
    return this._edgeAdded$.asObservable();
  }

  /**
   * Observable for edge removal events
   */
  get edgeRemoved$(): Observable<{ edgeId: string; edge: Edge }> {
    return this._edgeRemoved$.asObservable();
  }

  /**
   * Observable for selection changes
   */
  get selectionChanged$(): Observable<{ selected: string[]; deselected: string[] }> {
    return this._selectionChanged$.asObservable();
  }

  /**
   * Initialize the graph with the given container element
   */
  initialize(container: HTMLElement): void {
    if (this._graph) {
      this.dispose();
    }

    this._graph = new Graph({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      grid: {
        size: 10,
        visible: true,
      },
      panning: {
        enabled: true,
      },
      mousewheel: {
        enabled: true,
        modifiers: 'ctrl',
        factor: 1.1,
        maxScale: 1.5,
        minScale: 0.5,
      },
      connecting: {
        router: 'orth',
        connector: {
          name: 'smooth',
        },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        allowNode: true,
        allowPort: true,
        snap: {
          radius: 20,
        },
        highlight: true,
        createEdge() {
          return new Edge({
            attrs: {
              line: {
                stroke: '#A2B1C3',
                strokeWidth: 2,
                targetMarker: {
                  name: 'block',
                  width: 12,
                  height: 8,
                },
              },
            },
            zIndex: 0,
          });
        },
        validateConnection({ targetMagnet }) {
          return !!targetMagnet;
        },
      },
      highlighting: {
        magnetAdsorbed: {
          name: 'stroke',
          args: {
            padding: 4,
            attrs: {
              strokeWidth: 4,
              stroke: '#5F95FF',
            },
          },
        },
        magnetAvailable: {
          name: 'stroke',
          args: {
            padding: 2,
            attrs: {
              strokeWidth: 2,
              stroke: '#31d0c6',
            },
          },
        },
        nodeAvailable: {
          name: 'className',
          args: {
            className: 'available',
          },
        },
      },
    });

    // Enable plugins
    this._setupPlugins();
    this._setupEventListeners();
    this._setupPortVisibility();
  }

  /**
   * Get the underlying X6 Graph instance for direct access when needed
   */
  getGraph(): Graph {
    if (!this._graph) {
      throw new Error('Graph not initialized. Call initialize() first.');
    }
    return this._graph;
  }

  /**
   * Add a node to the graph
   */
  addNode(node: DiagramNode): Node {
    const graph = this.getGraph();

    const x6Node = graph.addNode({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.data.width || 120,
      height: node.data.height || 60,
      shape: this._getX6ShapeForNodeType(node.data.type as string),
      label: node.data.label,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      attrs: this._getNodeAttrs(node.data.type as string),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      ports: this._getNodePorts(node.data.type as string),
      data: {
        ...node.data,
        domainNodeId: node.id,
      },
    });

    return x6Node;
  }

  /**
   * Remove a node from the graph
   */
  removeNode(nodeId: string): void {
    const graph = this.getGraph();
    const node = graph.getCellById(nodeId) as Node;

    if (node && node.isNode()) {
      graph.removeNode(node);
    }
  }

  /**
   * Move a node to a new position
   */
  moveNode(nodeId: string, position: Point): void {
    const graph = this.getGraph();
    const node = graph.getCellById(nodeId) as Node;

    if (node && node.isNode()) {
      node.setPosition(position.x, position.y);
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: DiagramEdge): Edge {
    const graph = this.getGraph();

    const x6Edge = graph.addEdge({
      id: edge.id,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      label: edge.data.label as string,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      attrs: this._getEdgeAttrs('data-flow'),
      data: {
        ...edge.data,
        domainEdgeId: edge.id,
      },
    });

    return x6Edge;
  }

  /**
   * Remove an edge from the graph
   */
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    const edge = graph.getCellById(edgeId) as Edge;

    if (edge && edge.isEdge()) {
      graph.removeEdge(edge);
    }
  }

  /**
   * Get all nodes in the graph
   */
  getNodes(): Node[] {
    const graph = this.getGraph();
    return graph.getNodes();
  }

  /**
   * Get all edges in the graph
   */
  getEdges(): Edge[] {
    const graph = this.getGraph();
    return graph.getEdges();
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): Node | null {
    const graph = this.getGraph();
    const cell = graph.getCellById(nodeId);
    return cell && cell.isNode() ? cell : null;
  }

  /**
   * Get an edge by ID
   */
  getEdge(edgeId: string): Edge | null {
    const graph = this.getGraph();
    const cell = graph.getCellById(edgeId);
    return cell && cell.isEdge() ? cell : null;
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void {
    const graph = this.getGraph();
    graph.clearCells();
  }

  /**
   * Fit the graph to the viewport
   */
  fitToContent(): void {
    const graph = this.getGraph();
    graph.zoomToFit({ padding: 20 });
  }

  /**
   * Center the graph in the viewport
   */
  centerContent(): void {
    const graph = this.getGraph();
    graph.centerContent();
  }

  /**
   * Dispose of the graph and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();

    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }
  }

  /**
   * Setup event listeners for X6 graph events
   */
  private _setupEventListeners(): void {
    if (!this._graph) return;

    // Node events
    this._graph.on('node:added', ({ node }: { node: Node }) => {
      this._nodeAdded$.next(node);
    });

    this._graph.on('node:removed', ({ node }: { node: Node }) => {
      this._nodeRemoved$.next({ nodeId: node.id, node });
    });

    this._graph.on(
      'node:change:position',
      ({
        node,
        current,
        previous,
      }: {
        node: Node;
        current?: { x: number; y: number };
        previous?: { x: number; y: number };
      }) => {
        if (current && previous) {
          const currentPos = new Point(current.x, current.y);
          const previousPos = new Point(previous.x, previous.y);

          this._nodeMoved$.next({
            nodeId: node.id,
            position: currentPos,
            previous: previousPos,
          });
        }
      },
    );

    // Edge events
    this._graph.on('edge:added', ({ edge }: { edge: Edge }) => {
      this._edgeAdded$.next(edge);
    });

    this._graph.on('edge:removed', ({ edge }: { edge: Edge }) => {
      this._edgeRemoved$.next({ edgeId: edge.id, edge });
    });

    // Selection events
    this._graph.on(
      'selection:changed',
      ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
        const selected = added.map((cell: Cell) => cell.id);
        const deselected = removed.map((cell: Cell) => cell.id);

        this._selectionChanged$.next({ selected, deselected });
      },
    );
  }

  /**
   * Get X6 shape name for domain node type
   */
  private _getX6ShapeForNodeType(nodeType: string): string {
    switch (nodeType) {
      case 'process':
        return 'ellipse';
      case 'store':
        return 'store-shape'; // Use custom shape for store
      case 'actor':
        return 'rect';
      case 'security-boundary':
        return 'rect';
      case 'textbox':
        return 'rect';
      default:
        return 'rect';
    }
  }

  /**
   * Get X6 node attributes for domain node type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _getNodeAttrs(nodeType: string): any {
    const baseAttrs = {
      body: {
        strokeWidth: 2,
        stroke: '#000000',
        fill: '#FFFFFF',
      },
      text: {
        fontFamily: '"Roboto Condensed", Arial, sans-serif',
        fontSize: 12,
        fill: '#000000',
      },
    };

    switch (nodeType) {
      case 'process':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            rx: 30,
            ry: 30,
          },
        };
      case 'store':
        return {
          body: {
            fill: '#FFFFFF',
            stroke: 'none',
            strokeWidth: 0,
          },
          topBorder: {
            stroke: '#000000',
            strokeWidth: 2,
            fill: 'none',
          },
          bottomBorder: {
            stroke: '#000000',
            strokeWidth: 2,
            fill: 'none',
          },
          text: {
            fontFamily: '"Roboto Condensed", Arial, sans-serif',
            fontSize: 12,
            fill: '#000000',
          },
        };
      case 'actor':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
          },
        };
      case 'security-boundary':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            strokeDasharray: '5 5',
            rx: 10,
            ry: 10,
          },
        };
      case 'textbox':
        return {
          ...baseAttrs,
          body: {
            ...baseAttrs.body,
            strokeWidth: 1,
          },
          text: {
            ...baseAttrs.text,
            fontSize: 11,
          },
        };
      default:
        return baseAttrs;
    }
  }

  /**
   * Get X6 edge attributes for domain edge type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _getEdgeAttrs(edgeType: string): any {
    const baseAttrs = {
      line: {
        stroke: '#A2B1C3',
        strokeWidth: 2,
        targetMarker: {
          name: 'block',
          width: 12,
          height: 8,
        },
      },
    };

    switch (edgeType) {
      case 'data-flow':
        return baseAttrs;
      case 'trust-boundary':
        return {
          ...baseAttrs,
          line: {
            ...baseAttrs.line,
            stroke: '#722ED1',
            strokeDasharray: '5 5',
          },
        };
      default:
        return baseAttrs;
    }
  }

  /**
   * Get X6 port configuration for domain node type
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _getNodePorts(_nodeType: string): any {
    const basePorts = {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 4,
              magnet: true,
              stroke: '#31d0c6',
              strokeWidth: 2,
              fill: '#fff',
              style: {
                visibility: 'hidden',
              },
            },
          },
        },
      },
      items: [{ group: 'top' }, { group: 'right' }, { group: 'bottom' }, { group: 'left' }],
    };

    // All node types get the same port configuration for now
    // Can be customized per node type if needed
    return basePorts;
  }

  /**
   * Setup port visibility behavior for connection interactions
   */
  private _setupPortVisibility(): void {
    if (!this._graph) return;

    // Show ports on node hover
    this._graph.on('node:mouseenter', ({ node }) => {
      const ports = node.getPorts();
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      });
    });

    // Hide ports on node leave (unless connecting)
    this._graph.on('node:mouseleave', ({ node }) => {
      if (!this._isConnecting) {
        const ports = node.getPorts();
        ports.forEach(port => {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
        });
      }
    });

    // Show all ports when starting to connect
    this._graph.on('edge:connecting', () => {
      this._isConnecting = true;
      this._graph?.getNodes().forEach(node => {
        const ports = node.getPorts();
        ports.forEach(port => {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
        });
      });
    });

    // Hide ports when connection is complete or cancelled
    this._graph.on('edge:connected', () => {
      this._isConnecting = false;
      this._hideAllPorts();
    });

    this._graph.on('edge:disconnected', () => {
      this._isConnecting = false;
      this._hideAllPorts();
    });
  }

  /**
   * Hide all ports on all nodes
   */
  private _hideAllPorts(): void {
    if (!this._graph) return;

    this._graph.getNodes().forEach(node => {
      const ports = node.getPorts();
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
      });
    });
  }

  /**
   * Setup X6 plugins for enhanced functionality
   */
  private _setupPlugins(): void {
    if (!this._graph) return;

    // Check if the graph has the use method (not available in test mocks)
    if (typeof this._graph.use === 'function') {
      // Enable selection plugin
      this._graph.use(
        new Selection({
          enabled: true,
          multiple: true,
          rubberband: true,
          movable: true,
          showNodeSelectionBox: true,
          showEdgeSelectionBox: true,
          modifiers: ['shift'] as ('alt' | 'ctrl' | 'meta' | 'shift')[],
          pointerEvents: 'none',
        }),
      );

      // Enable snapline plugin
      this._graph.use(
        new Snapline({
          enabled: true,
          sharp: true,
        }),
      );
    }

    // Setup selection event handlers
    this._setupSelectionEvents();
  }

  /**
   * Setup selection event handlers for visual feedback
   */
  private _setupSelectionEvents(): void {
    if (!this._graph) return;

    // Clear selection on blank click (only if method exists)
    this._graph.on('blank:click', () => {
      const graph = this._graph;
      if (graph && typeof graph.cleanSelection === 'function') {
        graph.cleanSelection();
      }
    });

    // Visual feedback for selected cells
    this._graph.on('cell:selected', ({ cell }: { cell: Cell }) => {
      if (cell.isNode()) {
        cell.attr('body/stroke', '#1890ff');
        cell.attr('body/strokeWidth', 3);
      } else if (cell.isEdge()) {
        cell.attr('line/stroke', '#1890ff');
        cell.attr('line/strokeWidth', 3);
      }
    });

    this._graph.on('cell:unselected', ({ cell }: { cell: Cell }) => {
      if (cell.isNode()) {
        // Reset to original node styling
        cell.attr('body/stroke', '#000000');
        cell.attr('body/strokeWidth', 2);
      } else if (cell.isEdge()) {
        // Reset to original edge styling
        cell.attr('line/stroke', '#A2B1C3');
        cell.attr('line/strokeWidth', 2);
      }
    });
  }
}
