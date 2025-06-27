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
import { LoggerService } from '../../../../core/services/logger.service';

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
  private _selectedCells = new Set<string>();

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

  constructor(private logger: LoggerService) {}

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
        snap: true,
        allowBlank: false,
        allowLoop: true,
        allowNode: false,
        allowEdge: false,
        allowPort: true,
        allowMulti: true,
        highlight: true,
        router: {
          name: 'normal',
        },
        connector: {
          name: 'smooth',
        },
        validateMagnet: args => {
          this.logger.debugComponent('DFD', '[Edge Creation] validateMagnet called', {
            magnet: args.magnet,
            magnetAttribute: args.magnet?.getAttribute('magnet'),
            portGroup: args.magnet?.getAttribute('port-group'),
          });

          const magnet = args.magnet;
          if (!magnet) {
            this.logger.debugComponent('DFD', '[Edge Creation] validateMagnet: no magnet found');
            return false;
          }

          const isValid = magnet.getAttribute('magnet') === 'active';
          this.logger.debugComponent('DFD', '[Edge Creation] validateMagnet result:', { isValid });
          return isValid;
        },
        validateConnection: args => {
          this.logger.debugComponent('DFD', '[Edge Creation] validateConnection called', {
            sourceView: args.sourceView?.cell?.id,
            targetView: args.targetView?.cell?.id,
            sourceMagnet: args.sourceMagnet?.getAttribute('port-group'),
            targetMagnet: args.targetMagnet?.getAttribute('port-group'),
          });

          const { sourceView, targetView, sourceMagnet, targetMagnet } = args;

          // Prevent creating an edge if source and target are the same
          if (sourceView === targetView && sourceMagnet === targetMagnet) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: same source and target',
            );
            return false;
          }

          if (!targetMagnet || !sourceMagnet) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: missing magnet',
              {
                hasSourceMagnet: !!sourceMagnet,
                hasTargetMagnet: !!targetMagnet,
              },
            );
            return false;
          }

          // Allow connections to any port
          const sourcePortGroup = sourceMagnet.getAttribute('port-group');
          const targetPortGroup = targetMagnet.getAttribute('port-group');

          if (!sourcePortGroup || !targetPortGroup) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: missing port groups',
              {
                sourcePortGroup,
                targetPortGroup,
              },
            );
            return false;
          }

          // Get the source and target cells
          const sourceCell = sourceView?.cell;
          const targetCell = targetView?.cell;

          // Prevent connecting to self
          if (sourceCell === targetCell) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: self-connection not allowed',
            );
            return false;
          }

          this.logger.debugComponent('DFD', '[Edge Creation] validateConnection: connection valid');
          return true;
        },
        createEdge: () => {
          this.logger.debugComponent('DFD', '[Edge Creation] createEdge called');

          // Create edge with explicit markup to control both path elements
          const edge = new Edge({
            shape: 'edge',
            markup: [
              {
                tagName: 'path',
                selector: 'wrap',
                attrs: {
                  fill: 'none',
                  cursor: 'pointer',
                  stroke: 'transparent',
                  strokeLinecap: 'round',
                },
              },
              {
                tagName: 'path',
                selector: 'line',
                attrs: {
                  fill: 'none',
                  pointerEvents: 'none',
                },
              },
            ],
            attrs: {
              wrap: {
                connection: true,
                strokeWidth: 10,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                stroke: 'transparent',
                fill: 'none',
              },
              line: {
                connection: true,
                stroke: '#000000',
                strokeWidth: 2,
                fill: 'none',
                targetMarker: {
                  name: 'block',
                  width: 12,
                  height: 8,
                  fill: '#000000',
                  stroke: '#000000',
                },
              },
            },
            // Add default vertices for better routing
            vertices: [
              // Default vertices will be adjusted by the router
            ],
            labels: [
              {
                position: 0.5,
                attrs: {
                  text: {
                    text: 'Flow',
                    fontSize: 12,
                    fill: '#333',
                    textAnchor: 'middle',
                    dominantBaseline: 'middle',
                  },
                  rect: {
                    fill: '#ffffff',
                    stroke: 'none',
                  },
                },
              },
            ],
            data: {
              label: 'Flow',
            },
            zIndex: 1,
          });

          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Edge created with explicit dual-path markup',
          );
          return edge;
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
   * Debug method to manually inspect edge rendering
   * Call this from browser console: adapter.debugEdgeRendering()
   */
  debugEdgeRendering(): void {
    if (!this._graph) {
      this.logger.debugComponent('DFD', '[Edge Debug] No graph instance');
      return;
    }

    const edges = this._graph.getEdges();
    this.logger.debugComponent('DFD', `[Edge Debug] Found ${edges.length} edges`);

    edges.forEach((edge, index) => {
      const edgeView = this._graph!.findViewByCell(edge);
      const lineAttrs = edge.attr('line');
      const allAttrs = edge.attr();

      this.logger.debugComponent('DFD', `[Edge Debug] Edge ${index + 1}:`, {
        id: edge.id,
        shape: edge.shape,
        source: edge.getSourceCellId(),
        target: edge.getTargetCellId(),
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
        markup: edge.markup,
        attrs: allAttrs,
        lineAttrs: lineAttrs
          ? {
              stroke: (lineAttrs as Record<string, unknown>)['stroke'],
              strokeWidth: (lineAttrs as Record<string, unknown>)['strokeWidth'],
              fill: (lineAttrs as Record<string, unknown>)['fill'],
              targetMarker: (lineAttrs as Record<string, unknown>)['targetMarker'],
            }
          : null,
        zIndex: edge.getZIndex(),
        visible: edge.isVisible(),
      });

      // Try to find the SVG element
      if (edgeView && 'container' in edgeView) {
        const container = (edgeView as unknown as Record<string, unknown>)[
          'container'
        ] as HTMLElement;
        const pathElements = container?.querySelectorAll('path');

        this.logger.debugComponent('DFD', `[Edge Debug] Edge ${index + 1} DOM structure:`, {
          containerHTML: container?.outerHTML?.substring(0, 500) + '...',
          pathCount: pathElements?.length || 0,
        });

        if (pathElements && pathElements.length > 0) {
          pathElements.forEach((path, pathIndex) => {
            const computedStyle = window.getComputedStyle(path);
            this.logger.debugComponent(
              'DFD',
              `[Edge Debug] Edge ${index + 1} Path ${pathIndex + 1}:`,
              {
                // Direct attributes
                stroke: path.getAttribute('stroke'),
                strokeWidth: path.getAttribute('stroke-width'),
                fill: path.getAttribute('fill'),
                d: path.getAttribute('d'),
                className: path.getAttribute('class'),
                style: path.getAttribute('style'),
                markerEnd: path.getAttribute('marker-end'),
                // Computed styles
                computedStroke: computedStyle.stroke,
                computedStrokeWidth: computedStyle.strokeWidth,
                computedOpacity: computedStyle.opacity,
                computedVisibility: computedStyle.visibility,
                computedDisplay: computedStyle.display,
                computedFill: computedStyle.fill,
                // Validation checks
                hasValidStroke:
                  computedStyle.stroke !== 'none' && computedStyle.stroke !== 'transparent',
                hasValidWidth: parseFloat(computedStyle.strokeWidth) > 0,
                isVisible:
                  computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none',
                hasPath: !!path.getAttribute('d'),
              },
            );
          });
        } else {
          this.logger.debugComponent(
            'DFD',
            `[Edge Debug] Edge ${index + 1}: No path elements found`,
          );
        }
      } else {
        this.logger.debugComponent(
          'DFD',
          `[Edge Debug] Edge ${index + 1}: No view or container found`,
        );
      }
    });

    // Check CSS rules
    this._debugEdgeStyles();
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

    // Edge lifecycle events for proper edge creation handling
    this._graph.on('edge:connecting', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:connecting event', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        attrs: edge.attr(),
        lineAttrs: edge.attr('line'),
      });
    });

    this._graph.on('edge:connected', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:connected event', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
      });

      // Only emit for edges with valid source and target
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      if (sourceId && targetId) {
        this.logger.debugComponent(
          'DFD',
          '[Edge Creation] Valid edge created, emitting edgeAdded$',
        );
        this._edgeAdded$.next(edge);
      } else {
        this.logger.debugComponent('DFD', '[Edge Creation] Invalid edge, removing', {
          hasSource: !!sourceId,
          hasTarget: !!targetId,
        });
        // Remove invalid edges
        setTimeout(() => {
          if (this._graph && this._graph.getCellById(edge.id)) {
            this._graph.removeCell(edge);
          }
        }, 0);
      }
    });

    this._graph.on('edge:disconnected', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:disconnected event', {
        edgeId: edge.id,
      });
    });

    // Edge events - handle addition and removal
    this._graph.on('edge:added', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:added event', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        attrs: edge.attr(),
        lineAttrs: edge.attr('line'),
      });

      // Debug: Inspect the actual SVG element (only in non-test environment)
      if (this._graph && typeof this._graph.findViewByCell === 'function') {
        setTimeout(() => {
          // Get the edge element from the graph
          const edgeElement = this._graph?.getCellById(edge.id);
          if (edgeElement && edgeElement.isEdge()) {
            const edgeView = this._graph?.findViewByCell(edgeElement);
            if (edgeView && 'container' in edgeView) {
              const container = (edgeView as unknown as Record<string, unknown>)[
                'container'
              ] as HTMLElement;
              const svgPath = container?.querySelector('path.x6-edge-line');
              if (svgPath) {
                this.logger.debugComponent('DFD', '[Edge Creation] SVG path element inspection:', {
                  stroke: svgPath.getAttribute('stroke'),
                  strokeWidth: svgPath.getAttribute('stroke-width'),
                  fill: svgPath.getAttribute('fill'),
                  d: svgPath.getAttribute('d'),
                  className: svgPath.getAttribute('class'),
                  style: svgPath.getAttribute('style'),
                  computedStyle: window.getComputedStyle(svgPath).stroke,
                });
              } else {
                this.logger.debugComponent('DFD', '[Edge Creation] No SVG path element found');
              }
            }
          }
        }, 100);
      }

      // Note: We handle edge creation in edge:connected event instead
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
            targetMarker: {
              ...baseAttrs.line.targetMarker,
              fill: '#722ED1',
              stroke: '#722ED1',
            },
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
              r: 5,
              magnet: 'active',
              'port-group': 'top',
              stroke: '#000',
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
              r: 5,
              magnet: 'active',
              'port-group': 'right',
              stroke: '#000',
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
              r: 5,
              magnet: 'active',
              'port-group': 'bottom',
              stroke: '#000',
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
              r: 5,
              magnet: 'active',
              'port-group': 'left',
              stroke: '#000',
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

    // Hide ports on node leave (unless connecting or connected)
    this._graph.on('node:mouseleave', ({ node }) => {
      if (!this._isConnecting) {
        const ports = node.getPorts();
        ports.forEach(port => {
          // Only hide ports that are not connected
          if (!this._isPortConnected(node, port.id!)) {
            node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
          }
        });
      }
    });

    // Show all ports when starting to connect
    this._graph.on('edge:connecting', () => {
      this._isConnecting = true;
      this._showAllPorts();
    });

    // Also listen for mouse down on magnets to show ports
    this._graph.on('node:magnet:mousedown', () => {
      this._isConnecting = true;
      this._showAllPorts();
    });

    // Hide ports when connection is complete or cancelled, but keep connected ports visible
    this._graph.on('edge:connected', ({ edge }) => {
      this._isConnecting = false;
      // Add a small delay to ensure the edge connection is fully established
      // before updating port visibility
      setTimeout(() => {
        this._hideUnconnectedPorts();
        // Ensure the newly connected ports remain visible
        this._ensureConnectedPortsVisible(edge);
      }, 10);
    });

    this._graph.on('edge:disconnected', () => {
      this._isConnecting = false;
      this._hideUnconnectedPorts();
    });

    // Handle mouse up to stop connecting if no valid connection was made
    this._graph.on('blank:mouseup', () => {
      if (this._isConnecting) {
        this._isConnecting = false;
        this._hideUnconnectedPorts();
      }
    });

    // Handle node mouse up during edge creation to prevent port hiding
    this._graph.on('node:mouseup', () => {
      // If we just finished connecting, ensure connected ports stay visible
      if (!this._isConnecting) {
        setTimeout(() => {
          this._hideUnconnectedPorts();
        }, 50);
      }
    });
  }

  /**
   * Show all ports on all nodes
   */
  private _showAllPorts(): void {
    if (!this._graph) return;

    this._graph.getNodes().forEach(node => {
      const ports = node.getPorts();
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      });
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
   * Hide only unconnected ports on all nodes
   */
  private _hideUnconnectedPorts(): void {
    if (!this._graph) return;

    this._graph.getNodes().forEach(node => {
      const ports = node.getPorts();
      ports.forEach(port => {
        // Only hide ports that are not connected
        if (!this._isPortConnected(node, port.id!)) {
          node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
        }
      });
    });
  }

  /**
   * Check if a specific port is connected to any edge
   */
  private _isPortConnected(node: Node, portId: string): boolean {
    if (!this._graph) return false;

    const edges = this._graph.getEdges();
    return edges.some(edge => {
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();
      const sourcePortId = edge.getSourcePortId();
      const targetPortId = edge.getTargetPortId();

      // Check if this edge connects to the specific port on this node
      return (
        (sourceCellId === node.id && sourcePortId === portId) ||
        (targetCellId === node.id && targetPortId === portId)
      );
    });
  }

  /**
   * Ensure that the ports connected by a specific edge remain visible
   */
  private _ensureConnectedPortsVisible(edge: Edge): void {
    if (!this._graph) return;

    const sourceCellId = edge.getSourceCellId();
    const targetCellId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    // Make sure source port is visible
    if (sourceCellId && sourcePortId) {
      const sourceNode = this._graph.getCellById(sourceCellId) as Node;
      if (sourceNode && sourceNode.isNode()) {
        sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
      }
    }

    // Make sure target port is visible
    if (targetCellId && targetPortId) {
      const targetNode = this._graph.getCellById(targetCellId) as Node;
      if (targetNode && targetNode.isNode()) {
        targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
      }
    }
  }

  /**
   * Debug method to check CSS rules affecting edges
   */
  private _debugEdgeStyles(): void {
    if (!this._graph) return;

    // Check for any CSS rules that might affect edges
    const styleSheets = Array.from(document.styleSheets);
    const edgeRules: string[] = [];

    styleSheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
          if (rule instanceof CSSStyleRule) {
            const selector = rule.selectorText;
            // Check for rules that might affect edges
            if (
              selector.includes('edge') ||
              selector.includes('line') ||
              selector.includes('path') ||
              selector.includes('x6-edge') ||
              selector.includes('svg')
            ) {
              const style = rule.style;
              if (
                style.stroke !== '' ||
                style.strokeWidth !== '' ||
                style.opacity !== '' ||
                style.visibility !== '' ||
                style.display !== ''
              ) {
                edgeRules.push(`${selector}: ${rule.cssText}`);
              }
            }
          }
        });
      } catch {
        // Ignore cross-origin stylesheets
      }
    });

    if (edgeRules.length > 0) {
      this.logger.debugComponent('DFD', '[Edge Debug] CSS rules affecting edges:', edgeRules);
    }

    // Also check inline styles on the graph container
    const graphContainer = this._graph.container;
    const svgElement = graphContainer.querySelector('svg');
    if (svgElement) {
      this.logger.debugComponent('DFD', '[Edge Debug] SVG element styles:', {
        style: svgElement.getAttribute('style'),
        className: svgElement.getAttribute('class'),
      });
    }
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
      this._selectedCells.add(cell.id);

      if (cell.isNode()) {
        cell.attr('body/stroke', '#1890ff');
        cell.attr('body/strokeWidth', 3);
      } else if (cell.isEdge()) {
        // Enhanced edge selection styling
        cell.attr('line/stroke', '#1890ff');
        cell.attr('line/strokeWidth', 3);
        cell.attr('line/targetMarker/fill', '#1890ff');
        cell.attr('line/targetMarker/stroke', '#1890ff');
        // Add selection glow effect
        cell.attr('line/filter', 'drop-shadow(0 0 4px rgba(24, 144, 255, 0.6))');
      }
    });

    this._graph.on('cell:unselected', ({ cell }: { cell: Cell }) => {
      this._selectedCells.delete(cell.id);

      if (cell.isNode()) {
        // Reset to original node styling
        cell.attr('body/stroke', '#000000');
        cell.attr('body/strokeWidth', 2);
      } else if (cell.isEdge()) {
        // Reset to original edge styling
        cell.attr('line/stroke', '#000000');
        cell.attr('line/strokeWidth', 2);
        cell.attr('line/targetMarker/fill', '#000000');
        cell.attr('line/targetMarker/stroke', '#000000');
        cell.attr('line/filter', 'none');
      }
    });

    // Add hover effects for edges
    this._graph.on('cell:mouseenter', ({ cell }: { cell: Cell }) => {
      if (cell.isEdge() && !this._selectedCells.has(cell.id)) {
        cell.attr('line/stroke', '#1890ff');
        cell.attr('line/strokeWidth', 3);
        cell.attr('line/targetMarker/fill', '#1890ff');
        cell.attr('line/targetMarker/stroke', '#1890ff');
      }
    });

    this._graph.on('cell:mouseleave', ({ cell }: { cell: Cell }) => {
      if (cell.isEdge() && !this._selectedCells.has(cell.id)) {
        cell.attr('line/stroke', '#000000');
        cell.attr('line/strokeWidth', 2);
        cell.attr('line/targetMarker/fill', '#000000');
        cell.attr('line/targetMarker/stroke', '#000000');
      }
    });
  }
}
