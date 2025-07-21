import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Export } from '@antv/x6-plugin-export';
import { Selection } from '@antv/x6-plugin-selection';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import { History } from '@antv/x6-plugin-history';
import { v4 as uuidv4 } from 'uuid';

import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { DFD_STYLING } from '../../constants/styling-constants';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';
import { LoggerService } from '../../../../core/services/logger.service';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { EdgeQueryService } from '../services/edge-query.service';
import { NodeConfigurationService } from '../services/node-configuration.service';
import { EmbeddingService } from '../services/embedding.service';
import { PortStateManagerService } from '../services/port-state-manager.service';
import { X6KeyboardHandler } from './x6-keyboard-handler';
import { X6ZOrderAdapter } from './x6-z-order.adapter';
import { X6EmbeddingAdapter } from './x6-embedding.adapter';
import { X6HistoryManager } from './x6-history-manager';
import { X6SelectionAdapter } from './x6-selection.adapter';
import { X6EventLoggerService } from './x6-event-logger.service';
import { DfdEdgeService } from '../../services/dfd-edge.service';
import {
  GraphHistoryCoordinator,
  HISTORY_OPERATION_TYPES,
} from '../../services/graph-history-coordinator.service';

// Import the extracted shape definitions
import { registerCustomShapes } from './x6-shape-definitions';

/**
 * X6 Graph Adapter that provides abstraction over X6 Graph operations
 * while maintaining direct access to X6's native capabilities.
 */
@Injectable()
export class X6GraphAdapter implements IGraphAdapter {
  /**
   * Standard tool configurations for consistent behavior
   */

  private _graph: Graph | null = null;
  private readonly _destroy$ = new Subject<void>();
  private _isConnecting = false;
  private _currentEditor: HTMLInputElement | HTMLTextAreaElement | null = null;

  // Operation-aware event coordination (replaces timer-based debouncing)
  private readonly _dragCompleted$ = new Subject<{
    nodeId: string;
    initialPosition: Point;
    finalPosition: Point;
    dragDuration: number;
    dragId: string;
  }>();

  // Event subjects
  private readonly _nodeAdded$ = new Subject<Node>();
  private readonly _nodeRemoved$ = new Subject<{ nodeId: string; node: Node }>();
  private readonly _nodeMoved$ = new Subject<{
    nodeId: string;
    position: Point;
    previous: Point;
  }>();
  private readonly _nodeResized$ = new Subject<{
    nodeId: string;
    width: number;
    height: number;
    oldWidth: number;
    oldHeight: number;
  }>();
  private readonly _nodeInfoChanged$ = new Subject<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }>();
  private readonly _edgeAdded$ = new Subject<Edge>();
  private readonly _edgeRemoved$ = new Subject<{ edgeId: string; edge: Edge }>();
  private readonly _selectionChanged$ = new Subject<{ selected: string[]; deselected: string[] }>();
  private readonly _cellContextMenu$ = new Subject<{ cell: Cell; x: number; y: number }>();
  private readonly _edgeVerticesChanged$ = new Subject<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }>();
  private readonly _historyChanged$ = new Subject<{ canUndo: boolean; canRedo: boolean }>();

  // Private properties to track previous undo/redo states
  private _previousCanUndo = false;
  private _previousCanRedo = false;

  constructor(
    private logger: LoggerService,
    private readonly _edgeQueryService: EdgeQueryService,
    private readonly _nodeConfigurationService: NodeConfigurationService,
    private readonly _embeddingService: EmbeddingService,
    private readonly _portStateManager: PortStateManagerService,
    private readonly _keyboardHandler: X6KeyboardHandler,
    private readonly _zOrderAdapter: X6ZOrderAdapter,
    private readonly _embeddingAdapter: X6EmbeddingAdapter,
    private readonly _historyManager: X6HistoryManager,
    private readonly _selectionAdapter: X6SelectionAdapter,
    private readonly _x6EventLogger: X6EventLoggerService,
    private readonly _edgeService: DfdEdgeService,
    private readonly _historyCoordinator: GraphHistoryCoordinator,
  ) {
    // Initialize X6 cell extensions once when the adapter is created
    initializeX6CellExtensions();

    // Register custom shapes for DFD diagrams
    registerCustomShapes();

    // Note: Label service events are now handled directly by the DFD component
    // to avoid circular dependency between X6GraphAdapter and DfdEventHandlersService
  }

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
   * Observable for node movement events (immediate, non-debounced)
   */
  get nodeMoved$(): Observable<{ nodeId: string; position: Point; previous: Point }> {
    return this._nodeMoved$.asObservable();
  }

  /**
   * Observable for drag completion events (for clean history recording)
   */
  get dragCompleted$(): Observable<{
    nodeId: string;
    initialPosition: Point;
    finalPosition: Point;
    dragDuration: number;
    dragId: string;
  }> {
    return this._dragCompleted$.asObservable();
  }

  /**
   * Observable for node resize events (immediate, non-debounced)
   */
  get nodeResized$(): Observable<{
    nodeId: string;
    width: number;
    height: number;
    oldWidth: number;
    oldHeight: number;
  }> {
    return this._nodeResized$.asObservable();
  }

  /**
   * Observable for node data change events (immediate, non-debounced)
   */
  get nodeInfoChanged$(): Observable<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }> {
    return this._nodeInfoChanged$.asObservable();
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
   * Observable for edge vertex changes (immediate, non-debounced)
   */
  get edgeVerticesChanged$(): Observable<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }> {
    return this._edgeVerticesChanged$.asObservable();
  }

  /**
   * Observable for history state changes (undo/redo availability)
   */
  get historyChanged$(): Observable<{ canUndo: boolean; canRedo: boolean }> {
    return this._historyChanged$.asObservable();
  }

  /**
   * Initialize the graph with the given container element
   */
  initialize(container: HTMLElement): void {
    if (this._graph) {
      this.dispose();
    }

    this.logger.info('[DFD] Initializing X6 graph');

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
          // Use EmbeddingService for validation logic
          const validation = this._embeddingService.validateEmbedding(args.parent, args.child);
          return validation.isValid;
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
          // Delegate to validation service
          return this._edgeService.isMagnetValid(args);
        },
        validateConnection: args => {
          // Ensure all required properties exist before delegating to validation service
          if (!args.sourceView || !args.targetView || !args.sourceMagnet || !args.targetMagnet) {
            return false;
          }

          // Delegate to validation service with properly typed args
          return this._edgeService.isConnectionValid({
            sourceView: args.sourceView,
            targetView: args.targetView,
            sourceMagnet: args.sourceMagnet,
            targetMagnet: args.targetMagnet,
          });
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
                stroke: DFD_STYLING.EDGES.DEFAULT_STROKE,
                strokeWidth: DFD_STYLING.DEFAULT_STROKE_WIDTH,
                fill: 'none',
                targetMarker: {
                  name: 'classic',
                  size: 8,
                  fill: DFD_STYLING.EDGES.DEFAULT_STROKE,
                  stroke: DFD_STYLING.EDGES.DEFAULT_STROKE,
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
                    text: DFD_STYLING.EDGES.DEFAULT_LABEL,
                    fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
                    fill: DFD_STYLING.EDGES.DEFAULT_STROKE,
                    fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
                    textAnchor: 'middle',
                    dominantBaseline: 'middle',
                  },
                  rect: {
                    fill: DFD_STYLING.DEFAULT_FILL,
                    stroke: 'none',
                  },
                },
              },
            ],
            zIndex: 1, // Temporary z-index, will be set properly when connected
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

    // Initialize X6 event logging (if service is available)
    if (this._x6EventLogger) {
      this._x6EventLogger.initializeEventLogging(this._graph);
    }

    // This prevents separate history entries for port visibility and highlights
    this._portStateManager.setupPortVisibility(this._graph);

    // Setup keyboard handling using dedicated handler
    this._keyboardHandler.setupKeyboardHandling(this._graph);

    // Initialize embedding functionality using dedicated adapter
    this._embeddingAdapter.initializeEmbedding(this._graph);

    // Trigger an initial resize to ensure the graph fits the container properly
    this._scheduleInitialResize(container);
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
    const nodeType = node.type;

    // Validate that shape property is set correctly
    this._edgeService.validateNodeShape(nodeType, node.id);

    // Use NodeConfigurationService for node configuration (except z-index)
    const nodeAttrs = this._nodeConfigurationService.getNodeAttrs(nodeType);
    const nodePorts = this._nodeConfigurationService.getNodePorts(nodeType);
    const nodeShape = this._nodeConfigurationService.getNodeShape(nodeType);

    // Use centralized history coordinator for consistent filtering and atomic batching
    const x6Node = this._historyCoordinator.executeAtomicOperation(
      graph,
      HISTORY_OPERATION_TYPES.NODE_CREATION_DOMAIN,
      () => {
        const createdNode = graph.addNode({
          id: node.id,
          x: node.position.x,
          y: node.position.y,
          width: node.width || 120,
          height: node.height || 60,
          label: node.label || '', // Use proper DiagramNode label getter
          shape: nodeShape,
          attrs: {
            ...(nodeAttrs as any),
            text: {
              ...((nodeAttrs['text'] as Record<string, unknown>) || {}),
              text: node.label || '', // Use proper DiagramNode label getter
            },
          },
          ports: nodePorts as any,
          zIndex: 1, // Temporary z-index, will be set properly below
        });

        // Validate that the X6 node was created with the correct shape
        this._edgeService.validateX6NodeShape(createdNode);

        // Apply proper z-index using ZOrderService after node creation
        this._zOrderAdapter.applyNodeCreationZIndex(graph, createdNode);

        return createdNode;
      },
      // Use default options for domain node creation (excludes visual effects)
      this._historyCoordinator.getDefaultOptionsForOperation(
        HISTORY_OPERATION_TYPES.NODE_CREATION_DOMAIN,
      ),
    );

    // DEBUG: Write actual default styling values to file for constants verification (DISABLED)
    // this._debugWriteActualDefaults(x6Node, nodeType);

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
   * Add an edge to the graph from a DiagramEdge
   * Uses atomic operation for proper history management
   */
  addEdge(diagramEdge: DiagramEdge): Edge {
    const graph = this.getGraph();
    const edgeData = diagramEdge.data;

    // Use centralized history coordinator for consistent filtering and atomic batching
    const x6Edge = this._historyCoordinator.executeAtomicOperation(
      graph,
      HISTORY_OPERATION_TYPES.EDGE_CREATION,
      () => {
        const edgeParams = {
          id: edgeData.id,
          source: edgeData.source,
          target: edgeData.target,
          shape: edgeData.shape,
          markup: this._getEdgeMarkup(),
          attrs: edgeData.attrs,
          labels: edgeData.labels,
          vertices: edgeData.vertices,
          zIndex: edgeData.zIndex,
          visible: edgeData.visible,
        };

        const createdEdge = graph.addEdge(edgeParams);

        // Set metadata using X6 cell extensions
        if (edgeData.data && (createdEdge as any).setApplicationMetadata) {
          edgeData.data.forEach((entry: any) => {
            (createdEdge as any).setApplicationMetadata(entry.key, entry.value);
          });
        }

        // Update port visibility after edge creation
        this._updatePortVisibilityAfterEdgeCreation(createdEdge);

        // DEBUG: Write actual default styling values to file for constants verification (DISABLED)
        // this._debugWriteActualDefaultsEdge(createdEdge);

        return createdEdge;
      },
      // Use default options for edge creation (excludes visual effects)
      this._historyCoordinator.getDefaultOptionsForOperation(HISTORY_OPERATION_TYPES.EDGE_CREATION),
    );

    return x6Edge;
  }

  /**
   * Remove an edge from the graph using X6's native operations
   */
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    const edge = graph.getCellById(edgeId) as Edge;

    if (edge && edge.isEdge()) {
      // Update port visibility before removing edge using port manager
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();

      // Remove the edge first
      graph.removeEdge(edge);

      // Then update port visibility for affected nodes (with history disabled)
      this._historyManager.disable(this._graph!);
      try {
        if (sourceNodeId) {
          const sourceNode = graph.getCellById(sourceNodeId) as Node;
          if (sourceNode && sourceNode.isNode()) {
            this._portStateManager.updateNodePortVisibility(graph, sourceNode);
          }
        }

        if (targetNodeId) {
          const targetNode = graph.getCellById(targetNodeId) as Node;
          if (targetNode && targetNode.isNode()) {
            this._portStateManager.updateNodePortVisibility(graph, targetNode);
          }
        }
      } finally {
        this._historyManager.enable(this._graph!);
      }
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
   * Get all edges in the graph using X6's native operations
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
   * Get an edge by ID using X6's native operations
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
   * Undo the last action using X6 history plugin - delegates to X6HistoryManager
   */
  undo(): void {
    this._historyManager.undo(this._graph!);
  }

  /**
   * Redo the last undone action using X6 history plugin - delegates to X6HistoryManager
   */
  redo(): void {
    this._historyManager.redo(this._graph!);
  }

  /**
   * Check if undo is available - delegates to X6HistoryManager
   */
  canUndo(): boolean {
    return this._historyManager.canUndo(this._graph!);
  }

  /**
   * Check if redo is available - delegates to X6HistoryManager
   */
  canRedo(): boolean {
    return this._historyManager.canRedo(this._graph!);
  }

  /**
   * Clear the history stack - delegates to X6HistoryManager
   */
  clearHistory(): void {
    this._historyManager.clearHistory(this._graph!);
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
      this.logger.debugComponent('DFD', `[Edge Debug] Edge ${index + 1}:`, {
        id: edge.id,
        shape: edge.shape,
        source: edge.getSourceCellId(),
        target: edge.getTargetCellId(),
        visible: edge.isVisible(),
      });
    });
  }

  /**
   * Dispose of the graph and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();

    // Clean up any existing editor
    this._removeExistingEditor();

    // Clean up keyboard handler
    this._keyboardHandler.cleanup();

    // Clean up X6 event logger (if service is available)
    if (this._x6EventLogger) {
      this._x6EventLogger.dispose();
    }

    // Clean up history manager
    if (this._historyManager) {
      this._historyManager.dispose();
    }

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
    this._zOrderAdapter.moveSelectedCellsForward(graph);
  }

  /**
   * Move selected cells backward in z-order (decrease z-index to move below next nearest unselected cell)
   */
  moveSelectedCellsBackward(): void {
    const graph = this.getGraph();
    this._zOrderAdapter.moveSelectedCellsBackward(graph);
  }

  /**
   * Move selected cells to front (highest z-index among cells of the same type)
   */
  moveSelectedCellsToFront(): void {
    const graph = this.getGraph();
    this._zOrderAdapter.moveSelectedCellsToFront(graph);
  }

  /**
   * Move selected cells to back (lowest z-index among cells of the same type)
   */
  moveSelectedCellsToBack(): void {
    const graph = this.getGraph();
    this._zOrderAdapter.moveSelectedCellsToBack(graph);
  }

  /**
   * Get the standardized label text from a cell
   */
  getCellLabel(cell: Cell): string {
    // Use X6 cell extensions for unified label handling
    return (cell as any).getLabel ? (cell as any).getLabel() : '';
  }

  /**
   * Set the standardized label text for a cell
   */
  setCellLabel(cell: Cell, text: string): void {
    if (!this._graph) {
      this.logger.warn('Cannot set cell label: Graph is not initialized');
      return;
    }

    // Batch all label changes into a single history command
    // This ensures multiple attribute changes are grouped as one undoable operation
    this._graph.batchUpdate(() => {
      // Apply the label change using X6 cell extensions
      if ((cell as any).setLabel) {
        (cell as any).setLabel(text);
      } else {
        this.logger.warn('Cell does not support setLabel method', {
          cellId: cell.id,
          cellType: cell.isNode() ? 'node' : 'edge',
        });
      }
    });
  }

  /**
   * Start label editing for a cell (public method to access private _addLabelEditor)
   */
  startLabelEditing(cell: Cell, event: MouseEvent): void {
    this._addLabelEditor(cell, event);
  }

  /**
   * Get the initial position of a node when drag started (for history tracking)
   */
  getInitialNodePosition(nodeId: string): Point | null {
    return this._keyboardHandler.getInitialNodePosition(nodeId);
  }

  /**
   * Public method to validate and correct z-order - can be called externally
   */
  validateAndCorrectZOrder(): void {
    const graph = this.getGraph();
    this._zOrderAdapter.validateAndCorrectZOrder(graph);
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

    // Node position changes
    this._graph.on(
      'node:moved',
      ({
        node,
        current,
        previous,
      }: {
        node: Node;
        current?: { x: number; y: number };
        previous?: { x: number; y: number };
      }) => {
        this.logger.debugComponent('DFD', 'node:moved event fired', {
          nodeId: node.id,
          current: current,
          previous: previous,
        });
        if (current && previous) {
          const currentPos = new Point(current.x, current.y);
          const previousPos = new Point(previous.x, previous.y);

          // Using simpler approach with initial positions

          // Emit immediate event for UI responsiveness
          this._nodeMoved$.next({
            nodeId: node.id,
            position: currentPos,
            previous: previousPos,
          });

          // Note: Drag completion provides superior tracking
        }
      },
    );

    // Node size changes (for resizing)
    this._graph.on(
      'node:change:size',
      ({
        node,
        current,
        previous,
      }: {
        node: Node;
        current?: { width: number; height: number };
        previous?: { width: number; height: number };
      }) => {
        if (current && previous) {
          // Emit immediate event for UI responsiveness
          this._nodeResized$.next({
            nodeId: node.id,
            width: current.width,
            height: current.height,
            oldWidth: previous.width,
            oldHeight: previous.height,
          });
        }
      },
    );

    // Node data changes (for label edits, etc.)
    this._graph.on(
      'cell:change:data',
      ({
        cell,
        current,
        previous,
      }: {
        cell: Cell;
        current?: Record<string, unknown>;
        previous?: Record<string, unknown>;
      }) => {
        if (cell.isNode() && current && previous) {
          // Emit immediate event for UI responsiveness
          this._nodeInfoChanged$.next({
            nodeId: cell.id,
            newData: current,
            oldData: previous,
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

      // Set connecting state and show all ports using port manager (with history disabled)
      this._isConnecting = true;
      this._historyManager.disable(this._graph!);
      try {
        this._portStateManager.showAllPorts(this._graph!);
      } finally {
        this._historyManager.enable(this._graph!);
      }
    });

    this._graph.on('edge:connected', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:connected event', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
        source: edge.getSource(),
        target: edge.getTarget(),
      });

      // Reset connecting state and update port visibility (consolidated from port visibility setup)
      this._isConnecting = false;

      // Only emit for edges with valid source and target
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      if (sourceId && targetId) {
        // CRITICAL FIX: Add a small delay to ensure X6 has fully established the connection
        // before capturing the port information and setting zIndex - may need to revisit this implementation for reliability
        setTimeout(() => {
          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Delayed port capture and zIndex setting after connection',
            {
              edgeId: edge.id,
              sourcePortId: edge.getSourcePortId(),
              targetPortId: edge.getTargetPortId(),
              source: edge.getSource(),
              target: edge.getTarget(),
            },
          );

          // FIXED: Set edge z-order to the higher of source or target node z-orders AFTER connection is established
          this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

          // Update port visibility after connection using port manager (with history disabled)
          this._historyManager.disable(this._graph!);
          try {
            this._portStateManager.hideUnconnectedPorts(this._graph!);
            this._portStateManager.ensureConnectedPortsVisible(this._graph!, edge);
          } finally {
            this._historyManager.enable(this._graph!);
          }

          // Simplified flow without command bus - just emit the edge added event
          this.logger.debugComponent('DFD', '[Edge Creation] Emitting edge added event');
          this._edgeAdded$.next(edge);
        }, 50); // Small delay to ensure connection is fully established
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

      // Reset connecting state and update port visibility using port manager (with history disabled)
      this._isConnecting = false;
      this._historyManager.disable(this._graph!);
      try {
        this._portStateManager.hideUnconnectedPorts(this._graph!);
      } finally {
        this._historyManager.enable(this._graph!);
      }
    });

    // The embedding adapter handles: node:embedding, node:embedded, node:change:parent, node:moved (embedding-related)

    // Edge events - handle addition and removal
    this._graph.on('edge:added', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('DFD', '[Edge Creation] edge:added event', {
        edgeId: edge.id,
        sourceId: edge.getSourceCellId(),
        targetId: edge.getTargetCellId(),
        attrs: edge.attr(),
        lineAttrs: edge.attr('line'),
      });
    });

    this._graph.on('edge:removed', ({ edge }: { edge: Edge }) => {
      this._edgeRemoved$.next({ edgeId: edge.id, edge });

      // Update port visibility for the source and target nodes using port manager (with history disabled)
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();

      this._historyManager.disable(this._graph!);
      try {
        if (sourceCellId) {
          const sourceNode = this._graph!.getCellById(sourceCellId) as Node;
          if (sourceNode && sourceNode.isNode()) {
            this._portStateManager.updateNodePortVisibility(this._graph!, sourceNode);
          }
        }

        if (targetCellId) {
          const targetNode = this._graph!.getCellById(targetCellId) as Node;
          if (targetNode && targetNode.isNode()) {
            this._portStateManager.updateNodePortVisibility(this._graph!, targetNode);
          }
        }
      } finally {
        this._historyManager.enable(this._graph!);
      }
    });

    // Selection events - TEMPORARILY COMMENTED OUT TO TEST HISTORY FILTERING
    // this._graph.on(
    //   'selection:changed',
    //   ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
    //     const selected = added.map((cell: Cell) => cell.id);
    //     const deselected = removed.map((cell: Cell) => cell.id);

    //     // Batch all selection visual effects to prevent multiple history disable/enable calls
    //     if (this._graph) {
    //       this._graph.batchUpdate(() => {
    //         // Apply glow effects and tools to newly selected cells
    //         added.forEach((cell: Cell) => {
    //           this._selectedCells.add(cell.id);

    //           if (cell.isNode()) {
    //             const nodeType = (cell as any).getNodeTypeInfo
    //               ? (cell as any).getNodeTypeInfo().type
    //               : 'unknown';
    //             if (nodeType === 'text-box') {
    //               // For text-box shapes, apply glow to text element since body is transparent
    //               cell.attr('text/filter', DFD_STYLING_HELPERS.getSelectionFilter(nodeType));
    //             } else {
    //               // For all other node types, apply glow to body element
    //               cell.attr('body/filter', DFD_STYLING_HELPERS.getSelectionFilter(nodeType));
    //               cell.attr('body/strokeWidth', DFD_STYLING.SELECTION.STROKE_WIDTH);
    //             }
    //           } else if (cell.isEdge()) {
    //             cell.attr('line/filter', DFD_STYLING_HELPERS.getSelectionFilter('edge'));
    //             cell.attr('line/strokeWidth', DFD_STYLING.SELECTION.STROKE_WIDTH);
    //           }

    //           // Add tools for selected cells (tools can be tracked in history)
    //           if (cell.isNode()) {
    //             this._addNodeTools(cell);
    //           } else if (cell.isEdge()) {
    //             this._addEdgeTools(cell);
    //           }
    //         });

    //         // Remove glow effects and tools from deselected cells
    //         removed.forEach((cell: Cell) => {
    //           this._selectedCells.delete(cell.id);

    //           if (cell.isNode()) {
    //             const nodeType = (cell as any).getNodeTypeInfo
    //               ? (cell as any).getNodeTypeInfo().type
    //               : 'unknown';
    //             if (nodeType === 'text-box') {
    //               // For text-box shapes, remove glow from text element
    //               cell.attr('text/filter', 'none');
    //             } else {
    //               // For all other node types, remove glow from body element
    //               cell.attr('body/filter', 'none');
    //               // Restore shape-specific default stroke width
    //               const defaultStrokeWidth = DFD_STYLING_HELPERS.getDefaultStrokeWidth(nodeType as any);
    //               cell.attr('body/strokeWidth', defaultStrokeWidth);
    //             }
    //           } else if (cell.isEdge()) {
    //             cell.attr('line/filter', 'none');
    //             cell.attr('line/strokeWidth', DFD_STYLING.DEFAULT_STROKE_WIDTH);
    //           }

    //           // Remove tools from deselected cells (tools can be tracked in history)
    //           cell.removeTools();
    //         });
    //       });
    //     }

    //     this._selectionChanged$.next({ selected, deselected });
    //   },
    // );

    // For testing - just emit the event for observability
    this._graph.on(
      'selection:changed',
      ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
        const selected = added.map((cell: Cell) => cell.id);
        const deselected = removed.map((cell: Cell) => cell.id);
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
      // Selection plugin is initialized by X6SelectionAdapter to avoid duplication
      
      // Enable snapline plugin with red color
      this._graph.use(
        new Snapline({
          enabled: true,
          sharp: true,
          className: 'dfd-snapline-red',
        }),
      );

      // Enable history plugin with centralized filtering via GraphHistoryCoordinator
      this._graph.use(
        new History({
          stackSize: 10,
          beforeAddCommand: (event: string, args: any) => {
            // Delegate filtering to the centralized history coordinator
            return this._shouldIncludeInHistory(event, args);
          },
        }),
      );

      // Enable transform plugin for resizing
      this._graph.use(
        new Transform({
          resizing: {
            enabled: true,
            minWidth: 40,
            minHeight: 30,
            maxWidth: Number.MAX_SAFE_INTEGER,
            maxHeight: Number.MAX_SAFE_INTEGER,
            orthogonal: false,
            restrict: false,
            preserveAspectRatio: false,
          },
          rotating: false,
        }),
      );

      // Enable export plugin for diagram export functionality
      this._graph.use(new Export());
    }

    // Setup selection event handlers
    this._setupSelectionEvents();

    // Setup history event handlers
    this._historyManager.setupHistoryEvents(this._graph);

    // Subscribe to history state changes from history manager
    this._historyManager.historyChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(({ canUndo, canRedo }) => {
        this._historyChanged$.next({ canUndo, canRedo });
      });
  }

  /**
   * Setup selection event handlers - delegates to X6SelectionAdapter
   */
  private _setupSelectionEvents(): void {
    if (!this._graph) return;

    // Initialize selection plugins
    this._selectionAdapter.initializePlugins(this._graph);

    // Setup history controller for selection adapter
    this._selectionAdapter.setHistoryController({
      disable: () => this._historyManager.disable(this._graph!),
      enable: () => this._historyManager.enable(this._graph!),
    });

    // Set up port state manager for coordinated hover effects
    this._selectionAdapter.setPortStateManager(this._portStateManager);

    // Setup all selection events including hover, selection, and tools
    this._selectionAdapter.setupSelectionEvents(this._graph, (cell: Cell) => {
      this._handleCellDeletion(cell);
    });
  }

  /**
   * Helper function to safely extract node type from node data
   */
  private _getNodeType(node: Node | null | undefined): string | undefined {
    if (!node) return undefined;

    // Use getNodeTypeInfo for reliable node type detection
    const nodeTypeInfo = (node as any).getNodeTypeInfo();
    return nodeTypeInfo?.type || 'unknown';
  }

  // - _getEmbeddingDepth() → EmbeddingService.calculateEmbeddingDepth()
  // - _getEmbeddingFillColor() → EmbeddingService.calculateEmbeddingFillColor()
  // - _updateEmbeddedNodeColor() → X6EmbeddingAdapter.updateEmbeddingAppearance()

  /**
   * Centralized cell deletion handler - simplified without command pattern
   */
  private _handleCellDeletion(cell: Cell): void {
    const cellType = cell.isNode() ? 'node' : 'edge';
    this.logger.info(`[DFD] Delete tool clicked for ${cellType}`, { cellId: cell.id });

    // Direct removal without command pattern
    if (this._graph) {
      this._graph.removeCell(cell);
      this.logger.info(`[DFD] ${cellType} removed directly from graph`, {
        cellId: cell.id,
      });
    }
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
        this.logger.info('[DFD] Edge vertices changed', {
          edgeId: edge.id,
          vertexCount: vertices.length,
          vertices,
        });

        // Update the edge metadata with new vertices
        if ((edge as any).setApplicationMetadata) {
          (edge as any).setApplicationMetadata(
            'vertices',
            JSON.stringify(vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y }))),
          );
        }

        // Emit immediate vertex change event for UI responsiveness
        this._edgeVerticesChanged$.next({
          edgeId: edge.id,
          vertices: vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
        });

        // Vertex changes are drag operations - emit immediate event for UI responsiveness
        // History tracking will be handled by drag completion events
        // TODO: Implement proper vertex drag completion tracking
      }
    };

    // Add the event listener
    this._graph.on('edge:change:vertices', vertexChangeHandler);

    // No need to store handler references in metadata
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
        this.logger.info('[DFD] Edge source changed', {
          edgeId: edge.id,
          newSourceId: sourceId,
          newSourcePortId: sourcePortId,
        });

        // Update port visibility for old and new source nodes using port manager (with history disabled)
        this._historyManager.disable(this._graph!);
        try {
          this._portStateManager.onConnectionChange(this._graph!);
        } finally {
          this._historyManager.enable(this._graph!);
        }
      }
    };

    // Listen for target changes on this specific edge
    const targetChangeHandler = ({ edge: changedEdge }: { edge: Edge }): void => {
      if (changedEdge.id === edge.id) {
        const targetId = changedEdge.getTargetCellId();
        const targetPortId = changedEdge.getTargetPortId();
        this.logger.info('[DFD] Edge target changed', {
          edgeId: edge.id,
          newTargetId: targetId,
          newTargetPortId: targetPortId,
        });

        // Update port visibility for old and new target nodes using port manager (with history disabled)
        this._historyManager.disable(this._graph!);
        try {
          this._portStateManager.onConnectionChange(this._graph!);
        } finally {
          this._historyManager.enable(this._graph!);
        }
      }
    };

    // Add the event listeners
    this._graph.on('edge:change:source', sourceChangeHandler);
    this._graph.on('edge:change:target', targetChangeHandler);

    // No need to store handler references in metadata
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

    // Use X6's native coordinate transformation methods
    const cellView = this._graph.findViewByCell(cell);
    if (!cellView) {
      this.logger.debugComponent('DFD', 'Could not find cell view for editor', { cellId: cell.id });
      return;
    }

    // Get cell center using X6's native methods
    const cellBBox = cell.getBBox();
    const centerPoint = { x: cellBBox.x + cellBBox.width / 2, y: cellBBox.y + cellBBox.height / 2 };

    // Transform to client coordinates using X6's coordinate system
    const clientPoint = this._graph.localToClient(centerPoint);
    const editorX = clientPoint.x;
    const editorY = clientPoint.y;

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
      font-family: ${DFD_STYLING.TEXT_FONT_FAMILY};
      font-size: ${DFD_STYLING.DEFAULT_FONT_SIZE}px;
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
   * Update port visibility for connected nodes after edge creation
   */
  private _updatePortVisibilityAfterEdgeCreation(edge: Edge): void {
    const graph = this.getGraph();

    // FIXED: Set edge z-order to the higher of source or target node z-orders
    // This ensures programmatically added edges also get correct zIndex
    this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

    // Use port manager for port visibility updates (with history disabled)
    this._historyManager.disable(this._graph!);
    try {
      this._portStateManager.ensureConnectedPortsVisible(graph, edge);

      // Update port visibility for connected nodes using port manager
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();

      if (sourceNodeId) {
        const sourceNode = graph.getCellById(sourceNodeId);
        if (sourceNode && sourceNode.isNode()) {
          this._portStateManager.updateNodePortVisibility(graph, sourceNode);
        }
      }

      if (targetNodeId) {
        const targetNode = graph.getCellById(targetNodeId);
        if (targetNode && targetNode.isNode()) {
          this._portStateManager.updateNodePortVisibility(graph, targetNode);
        }
      }
    } finally {
      this._historyManager.enable(this._graph!);
    }
  }

  /**
   * Get standard edge markup for consistent rendering
   */
  private _getEdgeMarkup(): any[] {
    return [
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
    ];
  }

  /**
   * Check if port data changes are only visibility-related (should be excluded from history)
   */
  private _isOnlyPortVisibilityChanges(portData: any): boolean {
    // Navigate through the nested structure: attrs -> circle -> style -> visibility
    if (portData.attrs && typeof portData.attrs === 'object') {
      const attrsKeys = Object.keys(portData.attrs);
      return attrsKeys.every(attrKey => {
        if (
          attrKey === 'circle' &&
          portData.attrs[attrKey] &&
          typeof portData.attrs[attrKey] === 'object'
        ) {
          const circleData = portData.attrs[attrKey];
          const circleKeys = Object.keys(circleData);
          return circleKeys.every(circleKey => {
            if (
              circleKey === 'style' &&
              circleData[circleKey] &&
              typeof circleData[circleKey] === 'object'
            ) {
              const styleData = circleData[circleKey];
              const styleKeys = Object.keys(styleData);
              // Only allow visibility changes
              return styleKeys.every(styleKey => styleKey === 'visibility');
            }
            return false; // Other circle attributes are not allowed
          });
        }
        return false; // Other attrs are not allowed
      });
    }
    // If no attrs, check if there are any other properties that would make this non-visual
    const portKeys = Object.keys(portData);
    return portKeys.length === 0 || portKeys.every(key => key === 'attrs');
  }

  /**
   * Emit history state change event
   */
  private _emitHistoryStateChange(): void {
    const canUndo = this.canUndo();
    const canRedo = this.canRedo();

    // Only emit and log if the state has actually changed
    if (canUndo !== this._previousCanUndo || canRedo !== this._previousCanRedo) {
      this._historyChanged$.next({ canUndo, canRedo });
      this.logger.debugComponent('DFD', 'History state changed', { canUndo, canRedo });
    } else {
      this.logger.debugComponent('DFD', 'History state changed', { canUndo, canRedo });

      // Update previous state tracking
      this._previousCanUndo = canUndo;
      this._previousCanRedo = canRedo;
    }
  }

  /**
   * Schedule initial resize to ensure graph fits container properly
   */
  private _scheduleInitialResize(container: HTMLElement): void {
    setTimeout(() => {
      if (this._graph) {
        const width = container.clientWidth;
        const height = container.clientHeight;
        this._graph.resize(width, height);
        this.logger.info('[X6GraphAdapter] Initial graph resize completed', { width, height });
      }
    }, 0);
  }

  /**
   * Centralized history filtering logic using GraphHistoryCoordinator
   */
  private _shouldIncludeInHistory(event: string, args: any): boolean {
    // DEBUG: Log all history events to understand what's happening
    this.logger.debug('History event:', { event, args });

    // Completely exclude tools from history
    if (event === 'cell:change:tools') {
      this.logger.debug('Excluding tools event');
      return false;
    }

    // Handle cell:change:* events (which is what X6 actually fires)
    if (event === 'cell:change:*' && args.key) {
      // Handle different types of changes based on the key

      // Exclude tool changes
      if (args.key === 'tools') {
        this.logger.debug('Excluding tools key change');
        return false;
      }

      // Exclude zIndex changes (usually for visual layering)
      if (args.key === 'zIndex') {
        this.logger.debug('Excluding zIndex change');
        return false;
      }

      // Handle attribute changes
      if (args.key === 'attrs' && args.current && args.previous) {
        // Instead of checking all current attributes, check what actually changed
        const actualChanges = this._findActualAttributeChanges(args.current, args.previous);
        this.logger.debug('Actual attribute changes detected:', actualChanges);

        // Check if all actual changes are visual-only
        const isOnlyVisualAttributes = actualChanges.every(changePath => {
          const isExcluded = this._historyCoordinator.shouldExcludeAttribute(changePath);
          this.logger.debug(`Checking ${changePath}: excluded=${isExcluded}`);
          return isExcluded;
        });

        if (isOnlyVisualAttributes) {
          this.logger.debug('Excluding visual-only attribute changes');
          return false; // Don't add to history
        }
        this.logger.debug('Including attribute changes - not all visual');
      }

      // For other cell:change:* events, allow them unless they're specifically excluded
      this.logger.debug('Including cell:change:* event with key:', args.key);
      return true;
    }

    // Handle legacy cell:change:attrs events (in case any still exist)
    if (event === 'cell:change:attrs' && args.current) {
      const changedAttrs = Object.keys(args.current);

      // Check if this change only affects excluded visual/tool attributes
      const isOnlyVisualAttributes = changedAttrs.every(attrGroup => {
        // First check if the top-level attribute is excluded
        if (this._historyCoordinator.shouldExcludeAttribute(attrGroup)) {
          return true;
        }

        // Then check nested attributes (e.g., body/filter, line/strokeWidth)
        const groupData = args.current[attrGroup];
        if (!groupData || typeof groupData !== 'object') {
          // If it's not an object and not in excluded list, it's not visual-only
          return false;
        }

        const groupKeys = Object.keys(groupData);
        // Check if all changes in this group are visual-only
        return groupKeys.every(key => {
          const attrPath = `${attrGroup}/${key}`;
          return this._historyCoordinator.shouldExcludeAttribute(attrPath);
        });
      });

      if (isOnlyVisualAttributes) {
        return false; // Don't add to history
      }
    }

    // Allow all other changes (position, size, labels, structure)
    this.logger.debug('Including other event type:', event);
    return true;
  }

  /**
   * Find the actual paths of attributes that changed between current and previous
   */
  private _findActualAttributeChanges(current: any, previous: any): string[] {
    const changes: string[] = [];

    const findChangesInObject = (curr: any, prev: any, path = '') => {
      if (!curr || !prev || typeof curr !== 'object' || typeof prev !== 'object') {
        // If either is not an object, compare directly
        if (curr !== prev) {
          changes.push(path || 'root');
        }
        return;
      }

      // Check all keys in current object
      for (const key of Object.keys(curr)) {
        const currentPath = path ? `${path}/${key}` : key;
        const currentValue = curr[key];
        const previousValue = prev[key];

        if (
          typeof currentValue === 'object' &&
          currentValue !== null &&
          typeof previousValue === 'object' &&
          previousValue !== null
        ) {
          // Recurse into nested objects
          findChangesInObject(currentValue, previousValue, currentPath);
        } else if (currentValue !== previousValue) {
          // Value changed
          changes.push(currentPath);
        }
      }

      // Check for keys that were removed (exist in previous but not current)
      for (const key of Object.keys(prev)) {
        if (!(key in curr)) {
          const currentPath = path ? `${path}/${key}` : key;
          changes.push(currentPath);
        }
      }
    };

    findChangesInObject(current, previous);
    return changes;
  }
}
