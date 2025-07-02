import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Graph, Node, Edge, Cell, Shape } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Selection } from '@antv/x6-plugin-selection';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import { v4 as uuidv4 } from 'uuid';

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
      tagName: 'text',
      selector: 'text',
    },
    {
      tagName: 'path',
      selector: 'topLine',
    },
    {
      tagName: 'path',
      selector: 'bottomLine',
    },
  ],
  attrs: {
    topLine: {
      stroke: '#333333',
      strokeWidth: 2,
      refD: 'M 0 0 l 200 0',
    },
    bottomLine: {
      stroke: '#333333',
      strokeWidth: 2,
      refY: '100%',
      refD: 'M 0 0 l 200 0',
    },
    body: {
      fill: '#FFFFFF',
      stroke: 'transparent',
      strokeWidth: 0,
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
  private _currentEditor: HTMLInputElement | HTMLTextAreaElement | null = null;

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
  private readonly _cellContextMenu$ = new Subject<{ cell: Cell; x: number; y: number }>();
  private readonly _edgeVerticesChanged$ = new Subject<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }>();

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
   * Observable for cell context menu events
   */
  get cellContextMenu$(): Observable<{ cell: Cell; x: number; y: number }> {
    return this._cellContextMenu$.asObservable();
  }

  /**
   * Observable for edge vertex changes
   */
  get edgeVerticesChanged$(): Observable<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }> {
    return this._edgeVerticesChanged$.asObservable();
  }

  /**
   * Initialize the graph with the given container element
   */
  initialize(container: HTMLElement): void {
    if (this._graph) {
      this.dispose();
    }

    this.logger.info('[DFD Graph Init] Initializing X6 graph with embedding support');

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
        modifiers: ['shift'],
      },
      mousewheel: {
        enabled: true,
        modifiers: ['shift'],
        factor: 1.1,
        maxScale: 1.5,
        minScale: 0.5,
      },
      embedding: {
        enabled: true,
        findParent: 'bbox',
        validate: (args: { parent: Node; child: Node }) => {
          const parentType = this._getNodeType(args.parent);
          const childType = this._getNodeType(args.child);

          // Security boundaries can only be embedded into other security boundaries
          if (childType === 'security-boundary') {
            return parentType === 'security-boundary';
          }

          // All other node types can be embedded into any node type
          return true;
        },
      },
      interacting: {
        nodeMovable: true,
        edgeMovable: true,
        edgeLabelMovable: true,
        arrowheadMovable: true,
        vertexMovable: true,
        vertexAddable: true,
        vertexDeletable: true,
        magnetConnectable: true,
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

          // Prevent creating an edge if source and target are the same port on the same node
          if (sourceView === targetView && sourceMagnet === targetMagnet) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: same source and target port',
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

          // Allow self-connections (connecting a node to itself via different ports)
          if (sourceCell === targetCell) {
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] validateConnection: self-connection allowed between different ports',
              {
                sourcePort: sourcePortGroup,
                targetPort: targetPortGroup,
              },
            );
          }

          this.logger.debugComponent('DFD', '[Edge Creation] validateConnection: connection valid');
          return true;
        },
        createEdge: () => {
          this.logger.debugComponent('DFD', '[Edge Creation] createEdge called');

          // Generate UUID type 4 for UX-created edges
          const edgeId = uuidv4();

          // Create edge with explicit markup to control both path elements
          const edge = new Edge({
            id: edgeId, // Use UUID type 4 for UX-created edges
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
            // Enable vertices for edge manipulation
            vertices: [],
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

          this.logger.debugComponent('DFD', '[Edge Creation] createEdge - Initial labels config:', {
            labels: edge.labels,
          });
          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Edge created with UUID type 4 and explicit dual-path markup',
            { edgeId, labels: edge.getLabels() },
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
    const nodeType = node.data.type as string;

    // Set z-index based on node type
    let zIndex = 10; // Default z-index for regular nodes
    if (nodeType === 'security-boundary') {
      zIndex = 1; // Lower z-index for security boundaries to appear behind other nodes
    }

    const x6Node = graph.addNode({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.data.width || 120,
      height: node.data.height || 60,
      label: node.data.label || '', // Add label for mock compatibility
      shape: this._getX6ShapeForNodeType(nodeType),
      attrs: {
        ...this._getNodeAttrs(nodeType),
        text: {
          ...((this._getNodeAttrs(nodeType)['text'] as Record<string, unknown>) || {}),
          text: node.data.label || '',
        },
      },
      ports: this._getNodePorts(nodeType),
      data: {
        ...node.data,
        domainNodeId: node.id,
      },
      zIndex,
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
    this.logger.debugComponent('DFD', '[Edge Add] addEdge called', {
      diagramEdgeId: edge.id,
      diagramEdgeLabel: edge.data.label,
      diagramEdgeSourceNodeId: edge.sourceNodeId,
      diagramEdgeTargetNodeId: edge.targetNodeId,
      diagramEdgeSourcePortId: edge.data.sourcePortId,
      diagramEdgeTargetPortId: edge.data.targetPortId,
    });
    const graph = this.getGraph();

    // Prepare source and target with port information if available
    const sourceConfig = edge.data.sourcePortId
      ? { cell: edge.sourceNodeId, port: edge.data.sourcePortId }
      : edge.sourceNodeId;

    const targetConfig = edge.data.targetPortId
      ? { cell: edge.targetNodeId, port: edge.data.targetPortId }
      : edge.targetNodeId;

    const x6Edge = graph.addEdge({
      id: edge.id,
      source: sourceConfig,
      target: targetConfig,
      // Remove the 'label' property here, as the 'labels' array below already handles it.
      // This prevents duplicate labels when an edge is created via addEdge.
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
      // Add vertices if they exist in the edge data
      vertices: edge.data.vertices ? edge.data.vertices.map(v => ({ x: v.x, y: v.y })) : [],
      // Only add one label with the edge's label text
      labels: [
        {
          position: 0.5,
          attrs: {
            text: {
              text: (edge.data.label as string) || 'Flow',
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
        ...edge.data,
        domainEdgeId: edge.id,
      },
      zIndex: 1,
    });

    // Set edge z-order to the higher of source or target node z-orders
    this.logger.debugComponent('DFD', '[Edge Add] X6 Edge created', {
      x6EdgeId: x6Edge.id,
      x6EdgeLabel: x6Edge.getLabels(),
      x6EdgeDataLabel: (() => {
        const data: unknown = x6Edge.getData();
        if (data && typeof data === 'object' && 'label' in data) {
          return (data as Record<string, unknown>)['label'];
        }
        return undefined;
      })(),
      x6EdgeSource: x6Edge.getSource(),
      x6EdgeTarget: x6Edge.getTarget(),
    });

    // Set edge z-order to the higher of source or target node z-orders
    this._setEdgeZOrderFromConnectedNodes(x6Edge);

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
   * Get selected cells from the graph
   */
  getSelectedCells(): Cell[] {
    const graph = this.getGraph();
    if (graph && typeof graph.getSelectedCells === 'function') {
      return graph.getSelectedCells();
    }
    return [];
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

    // Clean up any existing editor
    this._removeExistingEditor();

    if (this._graph) {
      this._graph.dispose();
      this._graph = null;
    }
  }

  /**
   * Move selected cells forward in z-order (increase z-index to move above next nearest unselected cell)
   */
  moveSelectedCellsForward(): void {
    const graph = this.getGraph();
    const selectedCells = graph.getSelectedCells();

    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move forward operation');
      return;
    }

    this.logger.info('Moving selected cells forward', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this._moveCellForward(cell);
    });
  }

  /**
   * Move selected cells backward in z-order (decrease z-index to move below next nearest unselected cell)
   */
  moveSelectedCellsBackward(): void {
    const graph = this.getGraph();
    const selectedCells = graph.getSelectedCells();

    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move backward operation');
      return;
    }

    this.logger.info('Moving selected cells backward', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this._moveCellBackward(cell);
    });
  }

  /**
   * Move selected cells to front (highest z-index among cells of the same type)
   */
  moveSelectedCellsToFront(): void {
    const graph = this.getGraph();
    const selectedCells = graph.getSelectedCells();

    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to front operation');
      return;
    }

    this.logger.info('Moving selected cells to front', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this._moveCellToFront(cell);
    });
  }

  /**
   * Move selected cells to back (lowest z-index among cells of the same type)
   */
  moveSelectedCellsToBack(): void {
    const graph = this.getGraph();
    const selectedCells = graph.getSelectedCells();

    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to back operation');
      return;
    }

    this.logger.info('Moving selected cells to back', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this._moveCellToBack(cell);
    });
  }

  /**
   * Get the standardized label text from a cell
   */
  getCellLabel(cell: Cell): string {
    if (cell.isNode()) {
      const textAttr = cell.attr('text/text');
      return typeof textAttr === 'string' ? textAttr : '';
    } else {
      const edge = cell as Edge;
      const labels = edge.getLabels();
      if (labels.length > 0 && labels[0].attrs && labels[0].attrs['text']) {
        const textAttr = labels[0].attrs['text'] as Record<string, unknown>;
        const textValue = textAttr['text'];
        return typeof textValue === 'string' ? textValue : '';
      }
      return '';
    }
  }

  /**
   * Set the standardized label text for a cell
   */
  setCellLabel(cell: Cell, text: string): void {
    this.logger.debugComponent('DFD', '[Set Cell Label] Attempting to set label', {
      cellId: cell.id,
      isNode: cell.isNode(),
      currentLabel: this.getCellLabel(cell),
      newText: text,
      existingLabelsCount: (cell as Edge).getLabels ? (cell as Edge).getLabels().length : 0,
    });
    if (cell.isNode()) {
      cell.attr('text/text', text);
      // Also update the data for consistency
      const rawData: unknown = cell.getData();
      const currentData = (rawData && typeof rawData === 'object' ? rawData : {}) as Record<
        string,
        unknown
      >;
      cell.setData({ ...currentData, label: text });
    } else {
      const edge = cell as Edge;
      const labels = edge.getLabels();
      if (labels.length > 0) {
        const currentLabel = labels[0];
        const currentAttrs = currentLabel.attrs || {};
        const currentTextAttrs = (currentAttrs['text'] as Record<string, unknown>) || {};

        edge.setLabelAt(0, {
          ...currentLabel,
          attrs: {
            ...currentAttrs,
            text: {
              ...currentTextAttrs,
              text,
            },
          },
        });
        this.logger.debugComponent('DFD', '[Set Cell Label] Updated existing label', {
          cellId: cell.id,
          newText: text,
          labelsAfterUpdate: edge.getLabels().length,
        });
      } else {
        // Create a new label if none exists
        edge.appendLabel({
          position: 0.5,
          attrs: {
            text: {
              text,
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
        });
        this.logger.debugComponent('DFD', '[Set Cell Label] Appended new label', {
          cellId: cell.id,
          newText: text,
          labelsAfterAppend: edge.getLabels().length,
        });
      }
      // Also update the data for consistency
      const rawData: unknown = edge.getData();
      const currentData = (rawData && typeof rawData === 'object' ? rawData : {}) as Record<
        string,
        unknown
      >;
      edge.setData({ ...currentData, label: text });
    }
  }

  /**
   * Start label editing for a cell (public method to access private _addLabelEditor)
   */
  startLabelEditing(cell: Cell, event: MouseEvent): void {
    this._addLabelEditor(cell, event);
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
        // Set edge z-order to the higher of source or target node z-orders
        this._setEdgeZOrderFromConnectedNodes(edge);

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

    // Node embedding events
    this._graph.on('node:embedding', ({ node }: { node: Node }) => {
      // Store the original z-index before temporarily changing it
      const originalZIndex = node.getZIndex();
      node.setData({
        ...node.getData(),
        _originalZIndex: originalZIndex,
      });

      // When a node is being embedded, ensure it appears in front temporarily
      // But respect the node type - security boundaries should stay behind regular nodes
      const nodeType = this._getNodeType(node);
      if (nodeType === 'security-boundary') {
        // Security boundaries get a temporary higher z-index but still behind regular nodes
        node.setZIndex(5);
      } else {
        // Regular nodes get a higher temporary z-index
        node.setZIndex(20);
      }
    });

    this._graph.on(
      'node:embedded',
      ({ node, currentParent }: { node: Node; currentParent: Node }) => {
        // Only adjust z-indices if the node was actually embedded (has a parent)
        if (!currentParent) {
          // If embedding was cancelled, restore original z-index
          const rawNodeData: unknown = node.getData();
          const nodeData =
            rawNodeData && typeof rawNodeData === 'object'
              ? (rawNodeData as Record<string, unknown>)
              : {};
          const originalZIndex = nodeData['_originalZIndex'];
          if (typeof originalZIndex === 'number') {
            node.setZIndex(originalZIndex);
            // Also restore z-order for connected edges
            this._updateConnectedEdgesZOrder(node, originalZIndex);
          }
          return;
        }

        // After embedding, adjust z-indices
        const parentType = this._getNodeType(currentParent);
        const childType = this._getNodeType(node);

        // Parent keeps its base z-index (security boundaries stay behind)
        let parentZIndex: number;
        if (parentType === 'security-boundary') {
          parentZIndex = 1; // Security boundaries stay at the back
          currentParent.setZIndex(parentZIndex);
        } else {
          parentZIndex = 10;
          currentParent.setZIndex(parentZIndex);
        }

        // Child gets appropriate z-index based on type
        let childZIndex: number;
        if (childType === 'security-boundary') {
          // Security boundaries should always stay behind, even when embedded
          childZIndex = 2; // Slightly higher than non-embedded security boundaries but still behind regular nodes
          node.setZIndex(childZIndex);
        } else {
          childZIndex = 15; // Regular nodes appear in front when embedded
          node.setZIndex(childZIndex);
        }

        // Update z-order for edges connected to the child node to match the child's z-order
        this._updateConnectedEdgesZOrder(node, childZIndex);

        // Update fill color based on embedding depth
        this._updateEmbeddedNodeColor(node);

        // Clean up the temporary data
        const rawNodeData: unknown = node.getData();
        const nodeData =
          rawNodeData && typeof rawNodeData === 'object'
            ? (rawNodeData as Record<string, unknown>)
            : {};
        if (nodeData && '_originalZIndex' in nodeData) {
          delete nodeData['_originalZIndex'];
          node.setData(nodeData);
        }
      },
    );

    this._graph.on('node:change:parent', ({ node, current }: { node: Node; current?: string }) => {
      // When a node is removed from its parent (unembedded)
      if (!current) {
        const nodeType = this._getNodeType(node);

        // Reset to default z-index based on type
        let nodeZIndex: number;
        if (nodeType === 'security-boundary') {
          nodeZIndex = 1; // Security boundaries always stay at the back
          node.setZIndex(nodeZIndex);
        } else {
          nodeZIndex = 10;
          node.setZIndex(nodeZIndex);
        }

        // Update z-order for edges connected to the node to match the node's z-order
        this._updateConnectedEdgesZOrder(node, nodeZIndex);

        // Update fill color based on new embedding depth (or reset to white if fully unembedded)
        this._updateEmbeddedNodeColor(node);
      }
    });

    // Handle node movement without embedding - restore z-index when drag ends
    this._graph.on('node:change:position', ({ node }: { node: Node }) => {
      // Check if this node has a stored original z-index from embedding attempt
      // Safety check for test environment where getData might not exist
      if (typeof node.getData !== 'function') {
        return;
      }

      const rawNodeData: unknown = node.getData();
      const nodeData =
        rawNodeData && typeof rawNodeData === 'object'
          ? (rawNodeData as Record<string, unknown>)
          : {};
      const originalZIndex = nodeData['_originalZIndex'];

      // If we have an original z-index stored and the node is not currently embedded,
      // restore the original z-index (this handles the case where dragging was just for movement)
      if (typeof originalZIndex === 'number' && !node.getParent()) {
        // Use a small timeout to ensure this runs after any embedding events
        setTimeout(() => {
          // Double-check that the node still doesn't have a parent
          if (!node.getParent()) {
            node.setZIndex(originalZIndex);
            // Clean up the temporary data
            if (typeof node.getData === 'function') {
              const currentNodeData: unknown = node.getData();
              const safeNodeData =
                currentNodeData && typeof currentNodeData === 'object'
                  ? (currentNodeData as Record<string, unknown>)
                  : {};
              if (safeNodeData && '_originalZIndex' in safeNodeData) {
                delete safeNodeData['_originalZIndex'];
                node.setData(safeNodeData);
              }
            }
          }
        }, 50);
      }
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

      // Update port visibility for the source and target nodes
      // when an edge is removed
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();

      if (sourceCellId) {
        const sourceNode = this._graph!.getCellById(sourceCellId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          this._updateNodePortVisibility(sourceNode);
        }
      }

      if (targetCellId) {
        const targetNode = this._graph!.getCellById(targetCellId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._updateNodePortVisibility(targetNode);
        }
      }
    });

    // Selection events
    this._graph.on(
      'selection:changed',
      ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
        const selected = added.map((cell: Cell) => cell.id);
        const deselected = removed.map((cell: Cell) => cell.id);

        // Apply glow effects and tools to newly selected cells
        added.forEach((cell: Cell) => {
          this._selectedCells.add(cell.id);
          if (cell.isNode()) {
            cell.attr('body/filter', 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
            cell.attr('body/strokeWidth', 3);
            // Add tools for selected nodes
            this._addNodeTools(cell);
          } else if (cell.isEdge()) {
            cell.attr('line/filter', 'drop-shadow(0 0 6px rgba(255, 0, 0, 0.8))');
            cell.attr('line/strokeWidth', 3);
            // Add tools for selected edges
            this._addEdgeTools(cell);
          }
        });

        // Remove glow effects and tools from deselected cells
        removed.forEach((cell: Cell) => {
          this._selectedCells.delete(cell.id);
          if (cell.isNode()) {
            cell.attr('body/filter', 'none');
            cell.attr('body/strokeWidth', 2);
          } else if (cell.isEdge()) {
            cell.attr('line/filter', 'none');
            cell.attr('line/strokeWidth', 2);
          }
          // Remove tools from deselected cells
          cell.removeTools();
        });

        this._selectionChanged$.next({ selected, deselected });
      },
    );

    // Context menu events
    this._graph.on('cell:contextmenu', ({ cell, e }: { cell: Cell; e: MouseEvent }) => {
      e.preventDefault();
      this.logger.debugComponent('DFD', 'Cell context menu triggered', { cellId: cell.id });

      // Emit context menu event for the DFD component to handle
      this._cellContextMenu$.next({
        cell,
        x: e.clientX,
        y: e.clientY,
      });
    });

    // Double-click events for label editing
    this._graph.on('cell:dblclick', ({ cell, e }: { cell: Cell; e: MouseEvent }) => {
      this.logger.debugComponent('DFD', 'Cell double-click triggered', { cellId: cell.id });

      // Check if the double-click is on a tool element (like arrowhead)
      const target = e.target as HTMLElement;
      const isToolElement =
        target &&
        (target.classList.contains('x6-tool') ||
          target.closest('.x6-tool') ||
          target.getAttribute('data-tool-name') ||
          target.closest('[data-tool-name]'));

      // Only handle label editing if not clicking on a tool
      if (!isToolElement) {
        // Stop event propagation to prevent interference with tools
        e.stopPropagation();
        e.preventDefault();
        this._addLabelEditor(cell, e);
      }
    });
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
  private _getNodeAttrs(nodeType: string): Record<string, unknown> {
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
            stroke: 'transparent',
            strokeWidth: 0,
          },
          topLine: {
            stroke: '#333333',
            strokeWidth: 2,
          },
          bottomLine: {
            stroke: '#333333',
            strokeWidth: 2,
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
            stroke: 'none',
            strokeWidth: 0,
            fill: 'transparent',
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
  private _getEdgeAttrs(edgeType: string): Record<string, unknown> {
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
  private _getNodePorts(nodeType: string): Record<string, unknown> {
    // Textbox shapes should not have ports
    if (nodeType === 'textbox') {
      return {
        groups: {},
        items: [],
      };
    }

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

    // All other node types get the same port configuration
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
   * Update port visibility for a specific node based on connection status
   */
  private _updateNodePortVisibility(node: Node): void {
    if (!this._graph) return;

    const ports = node.getPorts();
    ports.forEach(port => {
      // Check if this port is connected to any edge
      if (this._isPortConnected(node, port.id!)) {
        // Keep connected ports visible
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      } else {
        // Hide unconnected ports
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
      }
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
      // Enable selection plugin with no selection box (we'll use custom styling)
      this._graph.use(
        new Selection({
          enabled: true,
          multiple: true,
          rubberband: true,
          movable: true,
          showNodeSelectionBox: false,
          showEdgeSelectionBox: false,
          modifiers: null, // Allow rubberband selection without modifiers
          pointerEvents: 'none',
        }),
      );

      // Enable snapline plugin with red color
      this._graph.use(
        new Snapline({
          enabled: true,
          sharp: true,
          className: 'dfd-snapline-red',
        }),
      );

      // Enable transform plugin for resizing
      this._graph.use(
        new Transform({
          resizing: {
            enabled: true,
            minWidth: 40,
            minHeight: 30,
            maxWidth: 400,
            maxHeight: 300,
            orthogonal: false,
            restrict: false,
            preserveAspectRatio: false,
          },
          rotating: false,
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

    // Add hover effects with subtle yellow glow
    this._graph.on('cell:mouseenter', ({ cell }: { cell: Cell }) => {
      if (!this._selectedCells.has(cell.id)) {
        if (cell.isNode()) {
          // Add subtle yellow glow for node hover
          cell.attr('body/filter', 'drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
        } else if (cell.isEdge()) {
          // Add subtle yellow glow for edge hover
          cell.attr('line/filter', 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.6))');
        }
      }
    });

    this._graph.on('cell:mouseleave', ({ cell }: { cell: Cell }) => {
      if (!this._selectedCells.has(cell.id)) {
        if (cell.isNode()) {
          // Remove hover glow
          cell.attr('body/filter', 'none');
        } else if (cell.isEdge()) {
          // Remove hover glow
          cell.attr('line/filter', 'none');
        }
      }
    });
  }

  /**
   * Helper function to safely extract node type from node data
   */
  private _getNodeType(node: Node | null | undefined): string | undefined {
    if (!node) return undefined;
    // Use unknown first to avoid direct any assignment
    const rawData: unknown = node.getData();
    // Type guard to check if it's an object with a type property
    if (rawData && typeof rawData === 'object' && 'type' in rawData) {
      const data = rawData as { type?: string };
      return data.type;
    }
    return undefined;
  }

  /**
   * Calculate the embedding depth of a node (how many levels deep it is embedded)
   */
  private _getEmbeddingDepth(node: Node): number {
    if (!this._graph) return 0;

    let depth = 0;
    let currentNode = node;

    // Traverse up the parent chain to count embedding levels
    while (currentNode.getParent()) {
      depth++;
      const parent = currentNode.getParent();
      if (!parent) break;

      // The parent is already a Cell object, not an ID
      if (!parent.isNode()) break;

      currentNode = parent;

      // Safety check to prevent infinite loops
      if (depth > 10) {
        this.logger.warn('Maximum embedding depth reached, breaking loop', { nodeId: node.id });
        break;
      }
    }

    return depth;
  }

  /**
   * Calculate the fill color based on embedding depth
   * Level 0 (not embedded): white (#FFFFFF)
   * Level 1: very light bluish white (#F8F9FF)
   * Level 2: slightly darker (#F0F2FF)
   * Level 3+: progressively darker bluish tints
   */
  private _getEmbeddingFillColor(depth: number): string {
    if (depth === 0) {
      return '#FFFFFF'; // Pure white for non-embedded nodes
    }

    // Base bluish white color components
    const baseRed = 240;
    const baseGreen = 250;

    // Calculate darker tint based on depth
    // Each level reduces the RGB values by 8 points to create a progressively darker tint
    const reduction = Math.min(depth * 10, 60); // Cap at 48 to avoid going too dark

    const red = Math.max(baseRed - reduction, 200);
    const green = Math.max(baseGreen - reduction, 200);
    const blue = 255; // Keep blue at maximum to maintain bluish tint

    return `rgb(${red}, ${green}, ${blue})`;
  }

  /**
   * Update the fill color of an embedded node based on its embedding depth
   */
  private _updateEmbeddedNodeColor(node: Node): void {
    if (!this._graph) return;

    const depth = this._getEmbeddingDepth(node);
    const fillColor = this._getEmbeddingFillColor(depth);
    const nodeType = this._getNodeType(node);

    this.logger.info('Updating embedded node color', {
      nodeId: node.id,
      nodeType,
      embeddingDepth: depth,
      fillColor,
    });

    // Update the fill color based on node type
    if (nodeType === 'store') {
      // For store nodes, update the body fill
      node.attr('body/fill', fillColor);
    } else {
      // For all other node types, update the body fill
      node.attr('body/fill', fillColor);
    }
  }

  /**
   * Add tools to a selected node
   */
  private _addNodeTools(node: Node): void {
    if (!this._graph) return;

    const tools = [
      // Use X6's native button-remove tool
      {
        name: 'button-remove',
        args: {
          x: '100%',
          y: 0,
          offset: { x: -10, y: 10 },
          onClick: ({ cell }: { cell: Cell }) => {
            this.logger.info('Delete tool clicked for node', { nodeId: cell.id });
            // Remove the cell directly using X6's native functionality
            if (this._graph) {
              this._graph.removeCell(cell);
            }
          },
        },
      },
      // Boundary tool to show selection
      {
        name: 'boundary',
        args: {
          padding: 5,
          attrs: {
            fill: 'none',
            stroke: '#fe854f',
            'stroke-width': 2,
            'stroke-dasharray': '5,5',
            'pointer-events': 'none',
          },
        },
      },
    ];

    node.addTools(tools);
  }

  /**
   * Add tools to a selected edge
   */
  private _addEdgeTools(edge: Edge): void {
    if (!this._graph) return;

    const tools = [
      // Use X6's native vertices tool for edge manipulation with enhanced functionality
      {
        name: 'vertices',
        args: {
          attrs: {
            body: {
              fill: '#fe854f',
              stroke: '#fe854f',
              'stroke-width': 2,
              r: 5,
              cursor: 'move',
            },
          },
          // Enable adding vertices by clicking on the edge stroke
          addable: true,
          // Enable removing vertices by double-clicking
          removable: true,
          // Snap vertices to grid
          snapRadius: 10,
          // Reduce threshold to make vertices less sensitive to clicks
          threshold: 40,
          // Configure vertex addition behavior - don't stop propagation to allow arrowhead tools to work
          stopPropagation: false,
          // Prevent interference with other tools
          useCellGeometry: true,
        },
      },
      // Source arrowhead tool for dragging source endpoint
      {
        name: 'source-arrowhead',
        args: {
          attrs: {
            fill: '#31d0c6',
            stroke: '#31d0c6',
            'stroke-width': 2,
            r: 6,
            cursor: 'move',
          },
          // Enable dragging to reconnect source
          tagName: 'circle',
          // Prevent interference with label editing
          stopPropagation: false,
        },
      },
      // Target arrowhead tool for dragging target endpoint
      {
        name: 'target-arrowhead',
        args: {
          attrs: {
            fill: '#fe854f',
            stroke: '#fe854f',
            'stroke-width': 2,
            r: 6,
            cursor: 'move',
          },
          // Enable dragging to reconnect target
          tagName: 'circle',
          // Prevent interference with label editing
          stopPropagation: false,
        },
      },
      // Use X6's native button-remove tool for edges
      {
        name: 'button-remove',
        args: {
          distance: 0.5, // Position at middle of edge
          offset: { x: 10, y: -10 },
          onClick: ({ cell }: { cell: Cell }) => {
            this.logger.info('Delete tool clicked for edge', { edgeId: cell.id });
            // Remove the cell directly using X6's native functionality
            if (this._graph) {
              this._graph.removeCell(cell);
            }
          },
        },
      },
    ];

    edge.addTools(tools);

    // Set up vertex change tracking for domain model updates
    this._setupVertexChangeTracking(edge);

    // Set up source/target change tracking for domain model updates
    this._setupEdgeConnectionChangeTracking(edge);
  }

  /**
   * Set up tracking for vertex changes on an edge
   */
  private _setupVertexChangeTracking(edge: Edge): void {
    if (!this._graph) return;

    // Listen for vertex changes on this specific edge
    const vertexChangeHandler = ({ edge: changedEdge }: { edge: Edge }): void => {
      if (changedEdge.id === edge.id) {
        const vertices = changedEdge.getVertices();
        this.logger.info('Edge vertices changed', {
          edgeId: edge.id,
          vertexCount: vertices.length,
          vertices,
        });

        // Update the edge data with new vertices
        const currentData: unknown = edge.getData();
        const safeCurrentData = currentData && typeof currentData === 'object' ? currentData : {};
        edge.setData({
          ...safeCurrentData,
          vertices: vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
        });

        // Emit vertex change event for domain model updates
        // This could be handled by the DFD component to update the domain model
        this._edgeVerticesChanged$.next({
          edgeId: edge.id,
          vertices: vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
        });
      }
    };

    // Add the event listener
    this._graph.on('edge:change:vertices', vertexChangeHandler);

    // Store the handler reference for cleanup
    if (!edge.getData()) {
      edge.setData({});
    }
    const edgeData: unknown = edge.getData();
    if (edgeData && typeof edgeData === 'object') {
      (edgeData as Record<string, unknown>)['_vertexChangeHandler'] = vertexChangeHandler;
    }
  }

  /**
   * Set up tracking for source/target connection changes on an edge
   */
  private _setupEdgeConnectionChangeTracking(edge: Edge): void {
    if (!this._graph) return;

    // Listen for source changes on this specific edge
    const sourceChangeHandler = ({ edge: changedEdge }: { edge: Edge }): void => {
      if (changedEdge.id === edge.id) {
        const sourceId = changedEdge.getSourceCellId();
        const sourcePortId = changedEdge.getSourcePortId();
        this.logger.info('Edge source changed', {
          edgeId: edge.id,
          newSourceId: sourceId,
          newSourcePortId: sourcePortId,
        });

        // Update port visibility for old and new source nodes
        this._updatePortVisibilityAfterConnectionChange();
      }
    };

    // Listen for target changes on this specific edge
    const targetChangeHandler = ({ edge: changedEdge }: { edge: Edge }): void => {
      if (changedEdge.id === edge.id) {
        const targetId = changedEdge.getTargetCellId();
        const targetPortId = changedEdge.getTargetPortId();
        this.logger.info('Edge target changed', {
          edgeId: edge.id,
          newTargetId: targetId,
          newTargetPortId: targetPortId,
        });

        // Update port visibility for old and new target nodes
        this._updatePortVisibilityAfterConnectionChange();
      }
    };

    // Add the event listeners
    this._graph.on('edge:change:source', sourceChangeHandler);
    this._graph.on('edge:change:target', targetChangeHandler);

    // Store the handler references for cleanup
    if (!edge.getData()) {
      edge.setData({});
    }
    const edgeData: unknown = edge.getData();
    if (edgeData && typeof edgeData === 'object') {
      (edgeData as Record<string, unknown>)['_sourceChangeHandler'] = sourceChangeHandler;
      (edgeData as Record<string, unknown>)['_targetChangeHandler'] = targetChangeHandler;
    }
  }

  /**
   * Update port visibility for all nodes after a connection change
   */
  private _updatePortVisibilityAfterConnectionChange(): void {
    if (!this._graph) return;

    // Update port visibility for all nodes to reflect new connection states
    this._graph.getNodes().forEach(node => {
      this._updateNodePortVisibility(node);
    });
  }

  /**
   * Move a single cell forward in z-order
   */
  private _moveCellForward(cell: Cell): void {
    const graph = this.getGraph();
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSecurityBoundary = this._isSecurityBoundaryCell(cell);

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryUnselectedCells = allCells.filter(
      c =>
        c.id !== cell.id &&
        !graph.isSelected(c) &&
        this._isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryUnselectedCells.length === 0) {
      this.logger.info('No other cells to move forward relative to', { cellId: cell.id });
      return;
    }

    const currentZIndex = cell.getZIndex() ?? 1;

    // Find the next higher z-index among unselected cells of the same category
    const higherZIndices = sameCategoryUnselectedCells
      .map(c => c.getZIndex() ?? 1)
      .filter(z => z > currentZIndex)
      .sort((a, b) => a - b);

    if (higherZIndices.length > 0) {
      const nextHigherZIndex = higherZIndices[0];
      cell.setZIndex(nextHigherZIndex + 1);
      this.logger.info('Moved cell forward', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex: nextHigherZIndex + 1,
      });
    } else {
      this.logger.info('Cell is already at the front among its category', { cellId: cell.id });
    }
  }

  /**
   * Move a single cell backward in z-order
   */
  private _moveCellBackward(cell: Cell): void {
    const graph = this.getGraph();
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSecurityBoundary = this._isSecurityBoundaryCell(cell);

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryUnselectedCells = allCells.filter(
      c =>
        c.id !== cell.id &&
        !graph.isSelected(c) &&
        this._isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryUnselectedCells.length === 0) {
      this.logger.info('No other cells to move backward relative to', { cellId: cell.id });
      return;
    }

    const currentZIndex = cell.getZIndex() ?? 1;

    // Find the next lower z-index among unselected cells of the same category
    const lowerZIndices = sameCategoryUnselectedCells
      .map(c => c.getZIndex() ?? 1)
      .filter(z => z < currentZIndex)
      .sort((a, b) => b - a);

    if (lowerZIndices.length > 0) {
      const nextLowerZIndex = lowerZIndices[0];
      cell.setZIndex(Math.max(nextLowerZIndex - 1, 1));
      this.logger.info('Moved cell backward', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex: Math.max(nextLowerZIndex - 1, 1),
      });
    } else {
      this.logger.info('Cell is already at the back among its category', { cellId: cell.id });
    }
  }

  /**
   * Move a single cell to the front (highest z-index among cells of the same type)
   */
  private _moveCellToFront(cell: Cell): void {
    const graph = this.getGraph();
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSecurityBoundary = this._isSecurityBoundaryCell(cell);

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryCells = allCells.filter(
      c => c.id !== cell.id && this._isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryCells.length === 0) {
      this.logger.info('No other cells to move to front relative to', { cellId: cell.id });
      return;
    }

    const currentZIndex = cell.getZIndex() ?? 1;
    const maxZIndex = Math.max(...sameCategoryCells.map(c => c.getZIndex() ?? 1));
    const newZIndex = maxZIndex + 1;

    if (newZIndex > currentZIndex) {
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell to front', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    } else {
      this.logger.info('Cell is already at the front among its category', { cellId: cell.id });
    }
  }

  /**
   * Move a single cell to the back (lowest z-index among cells of the same type)
   */
  private _moveCellToBack(cell: Cell): void {
    const graph = this.getGraph();
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSecurityBoundary = this._isSecurityBoundaryCell(cell);

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryCells = allCells.filter(
      c => c.id !== cell.id && this._isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryCells.length === 0) {
      this.logger.info('No other cells to move to back relative to', { cellId: cell.id });
      return;
    }

    const currentZIndex = cell.getZIndex() ?? 1;
    const minZIndex = Math.min(...sameCategoryCells.map(c => c.getZIndex() ?? 1));
    const newZIndex = Math.max(minZIndex - 1, 1);

    if (newZIndex < currentZIndex) {
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell to back', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    } else {
      this.logger.info('Cell is already at the back among its category', { cellId: cell.id });
    }
  }

  /**
   * Add custom label editor to a cell for inline editing
   */
  private _addLabelEditor(cell: Cell, _e: MouseEvent): void {
    if (!this._graph) return;

    const isNode = cell.isNode();
    this.logger.debugComponent(
      'DFD',
      `Starting custom label editor for ${isNode ? 'node' : 'edge'}`,
      {
        cellId: cell.id,
        currentLabel: this.getCellLabel(cell),
      },
    );

    // Remove any existing custom editors
    this._removeExistingEditor();

    // Get the cell's position in the viewport
    const cellView = this._graph.findViewByCell(cell);
    if (!cellView) {
      this.logger.debugComponent('DFD', 'Could not find cell view for editor', { cellId: cell.id });
      return;
    }

    // Get the cell's bounding box in screen coordinates
    const cellBBox = (
      cellView as unknown as { getBBox(): { x: number; y: number; width: number; height: number } }
    ).getBBox();
    const graphContainer = this._graph.container;
    const containerRect = graphContainer.getBoundingClientRect();

    // Calculate the position for the editor
    const editorX = containerRect.left + cellBBox.x + cellBBox.width / 2;
    const editorY = containerRect.top + cellBBox.y + cellBBox.height / 2;

    // Create a custom textarea element to support multiline text
    const textarea = document.createElement('textarea');
    textarea.value = this.getCellLabel(cell);
    textarea.className = 'x6-custom-label-editor';
    textarea.style.cssText = `
      position: fixed;
      left: ${editorX - 60}px;
      top: ${editorY - 25}px;
      width: 120px;
      min-height: 40px;
      max-height: 120px;
      padding: 4px 8px;
      border: 2px solid #007bff;
      border-radius: 4px;
      background: #fff;
      font-family: "Roboto Condensed", Arial, sans-serif;
      font-size: 12px;
      text-align: center;
      z-index: 10000;
      outline: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      resize: vertical;
      overflow-y: auto;
    `;

    // Add event handlers
    const commitEdit = (): void => {
      const newText = textarea.value.trim();
      if (newText !== this.getCellLabel(cell)) {
        this.setCellLabel(cell, newText);
        this.logger.debugComponent('DFD', 'Label updated via custom editor', {
          cellId: cell.id,
          newText,
        });
      }
      this._removeExistingEditor();
    };

    const cancelEdit = (): void => {
      this.logger.debugComponent('DFD', 'Label edit canceled', { cellId: cell.id });
      this._removeExistingEditor();
    };

    textarea.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        commitEdit();
      } else if (event.key === 'Enter' && event.shiftKey) {
        // Allow Shift+Enter for line breaks - don't prevent default
        // The textarea will handle the newline insertion naturally
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      }
    });

    textarea.addEventListener('blur', () => {
      // Small delay to allow for potential click events
      setTimeout(commitEdit, 100);
    });

    // Add to document and focus
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    // Store reference for cleanup
    this._currentEditor = textarea;

    this.logger.debugComponent('DFD', 'Custom label editor created and focused', {
      cellId: cell.id,
      editorPosition: { x: editorX, y: editorY },
    });
  }

  /**
   * Remove any existing custom editor
   */
  private _removeExistingEditor(): void {
    if (this._currentEditor && this._currentEditor.parentNode) {
      this._currentEditor.parentNode.removeChild(this._currentEditor);
      this._currentEditor = null;
    }
  }

  /**
   * Check if a cell is a security boundary
   */
  private _isSecurityBoundaryCell(cell: Cell): boolean {
    if (cell.isNode()) {
      const nodeType = this._getNodeType(cell);
      return nodeType === 'security-boundary';
    }
    return false;
  }

  /**
   * Update the z-order of all edges connected to a node to match the node's z-order
   */
  private _updateConnectedEdgesZOrder(node: Node, zIndex: number): void {
    if (!this._graph) return;

    const edges = this._graph.getConnectedEdges(node) || [];
    edges.forEach(edge => {
      edge.setZIndex(zIndex);
      this.logger.info('Updated connected edge z-order', {
        nodeId: node.id,
        edgeId: edge.id,
        newZIndex: zIndex,
      });
    });
  }

  /**
   * Set the z-order of an edge to the higher of its source or target node z-orders
   */
  private _setEdgeZOrderFromConnectedNodes(edge: Edge): void {
    if (!this._graph) return;

    const sourceId = edge.getSourceCellId();
    const targetId = edge.getTargetCellId();

    if (!sourceId || !targetId) {
      this.logger.warn('Cannot set edge z-order: missing source or target', {
        edgeId: edge.id,
        sourceId,
        targetId,
      });
      return;
    }

    const sourceNode = this._graph.getCellById(sourceId) as Node;
    const targetNode = this._graph.getCellById(targetId) as Node;

    if (!sourceNode?.isNode() || !targetNode?.isNode()) {
      this.logger.warn('Cannot set edge z-order: source or target is not a node', {
        edgeId: edge.id,
        sourceIsNode: sourceNode?.isNode(),
        targetIsNode: targetNode?.isNode(),
      });
      return;
    }

    // Safety check for test environment where getZIndex might not exist
    const sourceZIndex =
      typeof sourceNode.getZIndex === 'function' ? (sourceNode.getZIndex() ?? 1) : 1;
    const targetZIndex =
      typeof targetNode.getZIndex === 'function' ? (targetNode.getZIndex() ?? 1) : 1;
    const edgeZIndex = Math.max(sourceZIndex, targetZIndex);

    // Safety check for test environment where setZIndex might not exist
    if (typeof edge.setZIndex === 'function') {
      edge.setZIndex(edgeZIndex);
    }

    this.logger.info('Set edge z-order from connected nodes', {
      edgeId: edge.id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceZIndex,
      targetZIndex,
      edgeZIndex,
    });
  }
}
