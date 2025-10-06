/**
 * X6 Graph Adapter
 *
 * This adapter provides the main interface between the DFD application and the AntV X6 graph library.
 * It handles graph initialization, configuration, and core graph operations.
 *
 * Key functionality:
 * - Initializes and configures the X6 graph with all necessary plugins and settings
 * - Provides graph lifecycle management (creation, disposal, cleanup)
 * - Coordinates with specialized adapters for embedding, z-order, history, and selection
 * - Manages graph events and provides reactive observables for component integration
 * - Handles node and edge creation with proper validation and configuration
 * - Implements port state management and visual feedback systems
 * - Provides export functionality for multiple formats via X6 export plugin
 * - Manages graph resizing and responsive layout adjustments
 * - Coordinates with domain services for business logic integration
 * - Provides cell manipulation methods with proper error handling
 * - Implements clipboard operations and keyboard shortcut handling
 * - Manages graph plugins (snapline, transform, history, export)
 */

import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Export } from '@antv/x6-plugin-export';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import { History } from '@antv/x6-plugin-history';

import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { DFD_STYLING } from '../../constants/styling-constants';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';
import { LoggerService } from '../../../../core/services/logger.service';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { InfraEdgeQueryService } from '../services/infra-edge-query.service';
import { InfraNodeConfigurationService } from '../services/infra-node-configuration.service';
import { InfraEmbeddingService } from '../services/infra-embedding.service';
import { InfraPortStateService } from '../services/infra-port-state.service';
import { InfraX6KeyboardAdapter } from './infra-x6-keyboard.adapter';
import { InfraX6ZOrderAdapter } from './infra-x6-z-order.adapter';
import { InfraX6EmbeddingAdapter } from './infra-x6-embedding.adapter';
import { InfraX6HistoryAdapter } from './infra-x6-history.adapter';
import { InfraX6SelectionAdapter } from './infra-x6-selection.adapter';
import { InfraX6EventLoggerAdapter } from './infra-x6-event-logger.adapter';
import { AppEdgeService } from '../../application/services/app-edge.service';
import {
  AppGraphHistoryCoordinator,
  HISTORY_OPERATION_TYPES,
} from '../../application/services/app-graph-history-coordinator.service';
import { AppDiagramOperationBroadcaster } from '../../application/services/app-diagram-operation-broadcaster.service';
import { InfraX6CoreOperationsService } from '../services/infra-x6-core-operations.service';

// Import the extracted shape definitions
import { registerCustomShapes } from './infra-x6-shape-definitions';

/**
 * X6 Graph Adapter that provides abstraction over X6 Graph operations
 * while maintaining direct access to X6's native capabilities.
 */
@Injectable()
export class InfraX6GraphAdapter implements IGraphAdapter {
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
    private readonly _edgeQueryService: InfraEdgeQueryService,
    private readonly _nodeConfigurationService: InfraNodeConfigurationService,
    private readonly _embeddingService: InfraEmbeddingService,
    private readonly _portStateManager: InfraPortStateService,
    private readonly _keyboardHandler: InfraX6KeyboardAdapter,
    private readonly _zOrderAdapter: InfraX6ZOrderAdapter,
    private readonly _embeddingAdapter: InfraX6EmbeddingAdapter,
    private readonly _historyManager: InfraX6HistoryAdapter,
    private readonly _selectionAdapter: InfraX6SelectionAdapter,
    private readonly _x6EventLogger: InfraX6EventLoggerAdapter,
    private readonly _edgeService: AppEdgeService,
    private readonly _historyCoordinator: AppGraphHistoryCoordinator,
    private readonly _diagramOperationBroadcaster: AppDiagramOperationBroadcaster,
    private readonly _x6CoreOps: InfraX6CoreOperationsService,
  ) {
    // Initialize X6 cell extensions once when the adapter is created
    initializeX6CellExtensions();

    // Register custom shapes for DFD diagrams
    registerCustomShapes();

    // Note: Label service events are now handled directly by the DFD component
    // to avoid circular dependency between InfraX6GraphAdapter and AppEventHandlersService
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
   * Observable for when history is actually modified (for auto-save)
   * Emits the history index and whether the change was from undo/redo
   */
  get historyModified$(): Observable<{
    historyIndex: number;
    isUndo: boolean;
    isRedo: boolean;
  }> {
    return this._historyManager.historyModified$;
  }

  /**
   * Initialize the graph with the given container element
   */
  initialize(container: HTMLElement): void {
    if (this._graph) {
      this.dispose();
    }

    this.logger.info('[DFD] Initializing X6 graph adapter');

    // Create a new graph instance with proper connecting configuration for flow creation
    this._graph = new Graph({
      container,
      width: container.clientWidth,
      height: container.clientHeight,
      // Enable grid for visual guidance
      grid: {
        size: DFD_STYLING.GRID.SIZE,
        visible: DFD_STYLING.GRID.VISIBLE,
        type: 'dot',
        args: [
          { color: DFD_STYLING.GRID.PRIMARY_COLOR, thickness: 1 }, // Primary grid
          { color: DFD_STYLING.GRID.SECONDARY_COLOR, thickness: 1, factor: 4 }, // Secondary grid
        ],
      },
      // Enable panning by dragging background (only with shift key held)
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown'], // Only left mouse drag, not mousewheel
        modifiers: ['shift'], // Require shift key for panning
      },
      // Enable zooming with mouse wheel (with shift key)
      mousewheel: {
        enabled: true,
        modifiers: ['shift'], // Zoom with Shift + Wheel
        factor: 1.1,
        maxScale: 3,
        minScale: 0.2,
      },
      // Enable basic interactions
      interacting: {
        nodeMovable: true,
        edgeMovable: true,
        edgeLabelMovable: true,
        arrowheadMovable: true,
        vertexMovable: true,
        vertexAddable: true,
        vertexDeletable: true,
        magnetConnectable: true, // Essential for edge creation
      },
      // Enable embedding for drag-and-drop node nesting
      embedding: {
        enabled: true,
        findParent: 'bbox', // Find parent based on bounding box overlap
      },
      // Enable interactive edge creation with proper port visibility
      connecting: {
        allowNode: false, // Force connections to use ports only
        allowPort: true, // Enable port-to-port connections
        allowBlank: false, // Don't allow starting edge from blank area
        allowLoop: true, // Allow self-loops between different ports
        allowMulti: true, // Allow multiple edges between same nodes
        allowEdge: false, // Don't allow connecting to edges
        snap: { radius: 20 }, // Snap to ports within 20px
        highlight: true, // Highlight available connection points
        // Validate magnets (ports) during connection
        validateMagnet: ({ magnet }) => {
          return this._edgeService?.isMagnetValid({ magnet }) ?? true;
        },
        // Validate connections between nodes
        validateConnection: ({ sourceView, targetView, sourceMagnet, targetMagnet }) => {
          if (!sourceView || !targetView || !sourceMagnet || !targetMagnet) {
            return false;
          }

          const sourceNode = sourceView.cell;
          const targetNode = targetView.cell;

          if (!sourceNode.isNode() || !targetNode.isNode()) {
            return false;
          }

          return (
            this._edgeService?.isConnectionValid({
              sourceView,
              targetView,
              sourceMagnet,
              targetMagnet,
            }) ?? true
          );
        },
        // Create edges with proper styling and attributes
        createEdge: () => {
          const defaultLabel = this._edgeService.getLocalizedFlowLabel();
          return this._graph!.createEdge({
            shape: 'edge', // Use standard X6 edge shape
            connector: DFD_STYLING.EDGES.CONNECTOR,
            router: DFD_STYLING.EDGES.ROUTER,
            attrs: {
              line: {
                stroke: DFD_STYLING.EDGES.DEFAULT_STROKE,
                strokeWidth: DFD_STYLING.EDGES.DEFAULT_STROKE_WIDTH,
                targetMarker: 'block',
              },
            },
            labels: [
              {
                position: 0.5,
                attrs: {
                  text: {
                    text: defaultLabel,
                    fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
                    fill: DFD_STYLING.EDGES.LABEL_TEXT_COLOR,
                    fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
                    textAnchor: 'middle',
                    textVerticalAnchor: 'middle',
                  },
                },
              },
            ],
            zIndex: DFD_STYLING.Z_INDEX.EDGE_DEFAULT,
          });
        },
      },
    });

    // Enable plugins and setup services that depend on the graph instance
    this._setupPlugins();
    this._setupEventListeners();

    // Initialize X6 event logging (if service is available)
    if (this._x6EventLogger) {
      this._x6EventLogger.initializeEventLogging(this._graph);
    }

    // Setup keyboard handling using dedicated handler
    this._keyboardHandler.setupKeyboardHandling(this._graph);

    // Initialize embedding functionality using dedicated adapter
    this._embeddingAdapter.initializeEmbedding(this._graph);

    // Note: DiagramOperationBroadcaster initialization removed - now handled by
    // WebSocketPersistenceStrategy via auto-save (single unified system)

    // Trigger an initial resize to ensure the graph fits the container properly
    this._scheduleInitialResize(container);

    this.logger.debug('[DFD] X6 graph adapter initialized with minimal configuration');
  }

  /**
   * Set the graph instance and initialize adapters (for orchestrator-created graphs)
   */
  setGraph(graph: Graph): void {
    if (this._graph) {
      this.dispose();
    }

    this.logger.info('[DFD] Setting graph instance from orchestrator');
    this._graph = graph;

    // No need to setup plugins since orchestrator already did this
    this._setupEventListeners();

    // Setup selection events (crucial for port visibility and visual effects)
    this._setupSelectionEvents();

    // Setup history event handlers
    this._historyManager.setupHistoryEvents(this._graph);

    // Subscribe to history state changes from history manager
    this._historyManager.historyChanged$
      .pipe(takeUntil(this._destroy$))
      .subscribe(({ canUndo, canRedo }) => {
        this._historyChanged$.next({ canUndo, canRedo });
      });

    // Initialize X6 event logging (if service is available)
    if (this._x6EventLogger) {
      this._x6EventLogger.initializeEventLogging(this._graph);
    }

    // Setup keyboard handling using dedicated handler
    this._keyboardHandler.setupKeyboardHandling(this._graph);

    // Initialize embedding functionality using dedicated adapter
    this._embeddingAdapter.initializeEmbedding(this._graph);

    this.logger.debug('[DFD] X6 graph adapter configured with orchestrator graph');
  }

  /**
   * Check if the graph has been initialized
   */
  isInitialized(): boolean {
    return this._graph !== null;
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
   * Get the X6 History Manager for direct access to history operations
   */
  getHistoryManager(): InfraX6HistoryAdapter {
    return this._historyManager;
  }

  /**
   * Get the Diagram Operation Broadcaster for access to collaborative broadcasting
   */
  getDiagramOperationBroadcaster(): AppDiagramOperationBroadcaster {
    return this._diagramOperationBroadcaster;
  }

  /**
   * Add a node to the graph
   */
  addNode(node: DiagramNode): Node {
    const graph = this.getGraph();
    const nodeType = node.type;

    // Validate that shape property is set correctly
    this._edgeService.validateNodeShape(nodeType, node.id);

    // Use InfraNodeConfigurationService for node configuration (except z-index)
    const nodeAttrs = this._nodeConfigurationService.getNodeAttrs(nodeType);
    const nodePorts = this._nodeConfigurationService.getNodePorts(nodeType);
    const nodeShape = this._nodeConfigurationService.getNodeShape(nodeType);

    // Use centralized history coordinator for consistent filtering and atomic batching
    const x6Node = this._historyCoordinator.executeAtomicOperation(graph, () => {
      const createdNode = this._x6CoreOps.addNode(graph, {
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

      if (!createdNode) {
        throw new Error(`Failed to create node with ID: ${node.id}`);
      }

      // Validate that the X6 node was created with the correct shape
      this._edgeService.validateX6NodeShape(createdNode);

      // Apply proper z-index using ZOrderService after node creation
      this._zOrderAdapter.applyNodeCreationZIndex(graph, createdNode);

      return createdNode;
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
      this._x6CoreOps.removeCellObject(graph, node);
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
    const x6Edge = this._historyCoordinator.executeAtomicOperation(graph, () => {
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

      const createdEdge = this._x6CoreOps.addEdge(graph, edgeParams);

      if (!createdEdge) {
        throw new Error(`Failed to create edge with ID: ${edgeData.id}`);
      }

      // Set metadata using X6 cell extensions
      if (edgeData.data && (createdEdge as any).setApplicationMetadata) {
        const metadata = (edgeData.data as { _metadata?: { key: string; value: unknown }[] })
          ._metadata;
        if (Array.isArray(metadata)) {
          metadata.forEach((entry: { key: string; value: unknown }) => {
            (createdEdge as any).setApplicationMetadata(entry.key, entry.value);
          });
        }
      }

      // Update port visibility after edge creation
      this._updatePortVisibilityAfterEdgeCreation(createdEdge);

      return createdEdge;
    });

    return x6Edge;
  }

  /**
   * Remove an edge from the graph using X6's native operations
   */
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    const edge = graph.getCellById(edgeId) as Edge;

    if (edge && edge.isEdge()) {
      // Remove the edge - port visibility will be updated by the InfraEdgeService
      this._x6CoreOps.removeCellObject(graph, edge);
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
   * Undo the last action using X6 history plugin - delegates to InfraX6HistoryAdapter
   */
  undo(): void {
    this._historyManager.undo(this._graph!);
  }

  /**
   * Redo the last undone action using X6 history plugin - delegates to InfraX6HistoryAdapter
   */
  redo(): void {
    this._historyManager.redo(this._graph!);
  }

  /**
   * Check if undo is available - delegates to InfraX6HistoryAdapter
   */
  canUndo(): boolean {
    return this._historyManager.canUndo(this._graph!);
  }

  /**
   * Check if redo is available - delegates to InfraX6HistoryAdapter
   */
  canRedo(): boolean {
    return this._historyManager.canRedo(this._graph!);
  }

  /**
   * Clear the history stack - delegates to InfraX6HistoryAdapter
   */
  clearHistory(): void {
    this._historyManager.clearHistory(this._graph!);
  }

  /**
   * Enable or disable history tracking based on collaboration state
   * When in collaboration, history is managed by the server
   */
  setHistoryEnabled(enabled: boolean): void {
    if (!this._graph) {
      this.logger.warn('Cannot set history enabled state - graph not initialized');
      return;
    }

    if (enabled) {
      this._historyManager.enable(this._graph);
      this.logger.info('History tracking enabled (solo editing mode)');
    } else {
      this._historyManager.disable(this._graph);
      this.logger.info('History tracking disabled (collaborative mode - server manages history)');
    }
  }

  /**
   * Update embedding appearances for all nodes in the graph
   * Applies proper fill/shading to embedded nodes based on their embedding depth
   */
  updateAllEmbeddingAppearances(): void {
    if (!this._graph) {
      this.logger.warn('Cannot update embedding appearances - graph not initialized');
      return;
    }

    this._embeddingAdapter.updateAllEmbeddingAppearances(this._graph);
    this.logger.debugComponent('X6Graph', 'Updated embedding appearances for all nodes in graph');
  }

  /**
   * Debug method to manually inspect edge rendering
   * Call this from browser console: adapter.debugEdgeRendering()
   */
  debugEdgeRendering(): void {
    if (!this._graph) {
      this.logger.debugComponent('X6Graph', 'No graph instance');
      return;
    }

    const edges = this._graph.getEdges();
    this.logger.debugComponent('X6Graph', `[Edge Debug] Found ${edges.length} edges`);

    edges.forEach((edge, index) => {
      this.logger.debugComponent('X6Graph', `[Edge Debug] Edge ${index + 1}:`, {
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

    // Clean up history coordinator
    if (this._historyCoordinator) {
      this._historyCoordinator.dispose();
    }

    // Clean up diagram operation broadcaster
    this._diagramOperationBroadcaster.dispose();

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

    // Subscribe to drag completion events for final-state history recording
    this._historyCoordinator.dragCompletions$
      .pipe(takeUntil(this._destroy$))
      .subscribe(completion => {
        this._handleDragCompletion(completion);
      });

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
        this.logger.debugComponent('X6Graph', 'node:moved event fired', {
          nodeId: node.id,
          current: current,
          previous: previous,
        });
        if (current && previous) {
          const currentPos = new Point(current.x, current.y);
          const previousPos = new Point(previous.x, previous.y);

          // Check if this is a drag operation or a programmatic move
          if (this._historyCoordinator.isDragInProgress(node.id)) {
            // This is part of a drag operation - update tracking but don't emit final event yet
            this._historyCoordinator.updateDragTracking(node.id);
            this.logger.debugComponent('X6Graph', 'Updated drag tracking for node move', {
              nodeId: node.id,
              position: currentPos,
            });
          } else {
            // This might be the start of a drag or a programmatic move
            // Start tracking in case this becomes a drag operation
            this._historyCoordinator.startDragTracking(node.id, 'move', {
              position: previous,
            });
          }

          // Always emit immediate event for UI responsiveness
          this._nodeMoved$.next({
            nodeId: node.id,
            position: currentPos,
            previous: previousPos,
          });
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
          // Check if this is a resize drag operation
          if (this._historyCoordinator.isDragInProgress(node.id)) {
            // This is part of a resize operation - update tracking
            this._historyCoordinator.updateDragTracking(node.id);
            this.logger.debugComponent('X6Graph', 'Updated drag tracking for node resize', {
              nodeId: node.id,
              size: current,
            });
          } else {
            // This might be the start of a resize or a programmatic size change
            // Start tracking in case this becomes a resize operation
            this._historyCoordinator.startDragTracking(node.id, 'resize', {
              size: previous,
            });
          }

          // Always emit immediate event for UI responsiveness
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
    // Note: X6 doesn't fire 'edge:connecting' reliably, so we handle it in edge:added when target is incomplete

    this._graph.on('edge:connected', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('X6Graph', 'edge:connected event', {
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

          // Emit the edge added event first so label can be set
          this.logger.debugComponent('X6Graph', 'Emitting edge added event');
          this._edgeAdded$.next(edge);

          // Then set edge z-order and update port visibility (all excluded from history as visual effects)
          this._historyCoordinator.executeVisualEffect(this._graph!, () => {
            // Set edge z-order to the higher of source or target node z-orders
            this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

            // Update port visibility after connection
            this._portStateManager.hideUnconnectedPorts(this._graph!);
            this._portStateManager.ensureConnectedPortsVisible(this._graph!, edge);
          });
        }, 50); // Small delay to ensure connection is fully established
      } else {
        this.logger.debugComponent('X6Graph', 'Invalid edge, removing', {
          hasSource: !!sourceId,
          hasTarget: !!targetId,
        });
        // Remove invalid edges
        setTimeout(() => {
          if (this._graph && this._graph.getCellById(edge.id)) {
            this._x6CoreOps.removeCellObject(this._graph, edge);
          }
        }, 0);
      }
    });

    this._graph.on('edge:disconnected', ({ edge }: { edge: Edge }) => {
      this.logger.debugComponent('X6Graph', 'edge:disconnected event', {
        edgeId: edge.id,
      });

      // Reset connecting state and update port visibility using port manager (with history suppression)
      this._isConnecting = false;
      this._historyCoordinator.executeVisualEffect(this._graph!, () => {
        this._portStateManager.hideUnconnectedPorts(this._graph!);
      });
    });

    // The embedding adapter handles: node:embedding, node:embedded, node:change:parent, node:moved (embedding-related)

    // Edge events - handle addition and removal
    this._graph.on('edge:added', ({ edge }: { edge: Edge }) => {
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      this.logger.debugComponent('X6Graph', 'edge:added event', {
        edgeId: edge.id,
        sourceId,
        targetId,
        attrs: edge.attr(),
        lineAttrs: edge.attr('line'),
      });

      // If edge is being created (has source but no target yet), show all ports for connection
      if (sourceId && !targetId) {
        this.logger.debugComponent('X6Graph', 'Edge creation started - showing all ports');
        this._isConnecting = true;
        this._historyCoordinator.executeVisualEffect(this._graph!, () => {
          this._portStateManager.showAllPorts(this._graph!);
        });
      }
    });

    this._graph.on('edge:removed', ({ edge }: { edge: Edge }) => {
      this._edgeRemoved$.next({ edgeId: edge.id, edge });

      // Port visibility is now handled by the InfraEdgeService or other calling services
      // to avoid duplicate updates and ensure proper history suppression
    });

    // Selection events - emit observable for coordination with selection adapter
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
      this.logger.debugComponent('X6Graph', 'Cell context menu triggered', { cellId: cell.id });

      // Emit context menu event for the DFD component to handle
      this._cellContextMenu$.next({
        cell,
        x: e.clientX,
        y: e.clientY,
      });
    });

    // Double-click events for label editing
    this._graph.on('cell:dblclick', ({ cell, e }: { cell: Cell; e: MouseEvent }) => {
      this.logger.debugComponent('X6Graph', 'Cell double-click triggered', { cellId: cell.id });

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

    // Mouse events to detect drag completion
    this._graph.on('node:mouseup', ({ node }: { node: Node }) => {
      // Finalize any ongoing drag operation for this node
      if (this._historyCoordinator.isDragInProgress(node.id)) {
        const finalState = this._getCellState(node);
        this._historyCoordinator.finalizeDragTracking(node.id, finalState);
      }
    });

    this._graph.on('edge:mouseup', ({ edge }: { edge: Edge }) => {
      // Finalize any ongoing drag operation for this edge (vertex dragging)
      if (this._historyCoordinator.isDragInProgress(edge.id)) {
        const finalState = this._getCellState(edge);
        this._historyCoordinator.finalizeDragTracking(edge.id, finalState);
      }
    });

    // Global mouse up to catch any drag operations that might not have fired cell-specific events
    this._graph.on('blank:mouseup', () => {
      // Check if there are any drag operations in progress and finalize them
      // This is a safety net for edge cases
      if (this._historyCoordinator.isAnyDragInProgress()) {
        this.logger.debugComponent(
          'X6Graph',
          'Blank mouseup detected during drag - safety finalization',
        );
        // We can't easily determine the final state here, so let the timeout handle it
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
      this.logger.debugComponent('X6Graph', 'CSS rules affecting edges:', edgeRules);
    }

    // Also check inline styles on the graph container
    const graphContainer = this._graph.container;
    const svgElement = graphContainer.querySelector('svg');
    if (svgElement) {
      this.logger.debugComponent('X6Graph', 'SVG element styles:', {
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
      // Selection plugin is initialized by InfraX6SelectionAdapter to avoid duplication

      // Enable snapline plugin with red color
      this._graph.use(
        new Snapline({
          enabled: true,
          sharp: true,
          className: 'dfd-snapline-red',
        }),
      );

      // Enable history plugin with centralized filtering via AppGraphHistoryCoordinator
      // History is always enabled - filtering happens via beforeAddCommand
      this._graph.use(
        new History({
          stackSize: 10,
          enabled: true, // Always enabled - filtering handled by AppGraphHistoryCoordinator
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
   * Inject node service into selection adapter (called externally to avoid circular dependency)
   */
  injectNodeService(nodeService: any): void {
    this._selectionAdapter.setNodeService(nodeService);
  }

  /**
   * Setup selection event handlers - delegates to InfraX6SelectionAdapter
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
    this._historyManager.setPortStateManager(this._portStateManager);

    // Set up history coordinator for port state manager to suppress port visibility from history
    this._portStateManager.setHistoryCoordinator(this._historyCoordinator);

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

  // - _getEmbeddingDepth() → InfraEmbeddingService.calculateEmbeddingDepth()
  // - _getEmbeddingFillColor() → InfraEmbeddingService.calculateEmbeddingFillColor()
  // - _updateEmbeddedNodeColor() → InfraX6EmbeddingAdapter.updateEmbeddingAppearance()

  /**
   * Centralized cell deletion handler - uses history coordinator for proper atomic deletion
   * with correct port visibility updates
   */
  private _handleCellDeletion(cell: Cell): void {
    const cellType = cell.isNode() ? 'node' : 'edge';
    this.logger.info(`[DFD] Delete tool clicked for ${cellType}`, { cellId: cell.id });

    // Use history coordinator for atomic deletion with port visibility suppression
    if (this._graph) {
      // For edges, capture the source and target nodes before deletion for port visibility update
      let sourceNodeId: string | undefined;
      let targetNodeId: string | undefined;

      if (cell.isEdge()) {
        sourceNodeId = (cell).getSourceCellId();
        targetNodeId = (cell).getTargetCellId();
      }

      // Delete the cell atomically
      this._historyCoordinator.executeAtomicOperation(this._graph, () => {
        this._x6CoreOps.removeCellObject(this._graph!, cell);
      });

      // Update port visibility for affected nodes (edges only)
      if (cell.isEdge() && (sourceNodeId || targetNodeId)) {
        // Use executeVisualEffect to suppress port visibility changes from history
        this._historyCoordinator.executeVisualEffect(this._graph, () => {
          if (sourceNodeId) {
            const sourceNode = this._graph!.getCellById(sourceNodeId);
            if (sourceNode && sourceNode.isNode()) {
              this._portStateManager.updateNodePortVisibility(this._graph!, sourceNode);
            }
          }
          if (targetNodeId) {
            const targetNode = this._graph!.getCellById(targetNodeId);
            if (targetNode && targetNode.isNode()) {
              this._portStateManager.updateNodePortVisibility(this._graph!, targetNode);
            }
          }
        });
      }

      this.logger.info(`[DFD] ${cellType} removed via atomic operation with port visibility`, {
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

        // Check if this is a vertex drag operation
        if (this._historyCoordinator.isDragInProgress(edge.id)) {
          // This is part of a vertex drag operation - update tracking
          this._historyCoordinator.updateDragTracking(edge.id);
          this.logger.debugComponent('X6Graph', 'Updated drag tracking for edge vertices', {
            edgeId: edge.id,
            vertexCount: vertices.length,
          });
        } else {
          // This might be the start of a vertex drag or a programmatic change
          // Start tracking in case this becomes a drag operation
          this._historyCoordinator.startDragTracking(edge.id, 'vertex', {
            vertices: vertices.slice(), // Copy of current vertices as initial state
          });
        }

        // Update the edge metadata with new vertices
        if ((edge as any).setApplicationMetadata) {
          (edge as any).setApplicationMetadata(
            'vertices',
            JSON.stringify(vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y }))),
          );
        }

        // Always emit immediate vertex change event for UI responsiveness
        this._edgeVerticesChanged$.next({
          edgeId: edge.id,
          vertices: vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
        });
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
      this.logger.debugComponent('X6Graph', 'Could not find cell view for editor', {
        cellId: cell.id,
      });
      return;
    }

    // Get appropriate position based on cell type
    let centerPoint: { x: number; y: number };

    if (isNode) {
      // For nodes, use center of bounding box
      const cellBBox = cell.getBBox();
      centerPoint = { x: cellBBox.x + cellBBox.width / 2, y: cellBBox.y + cellBBox.height / 2 };
    } else {
      // For edges, calculate midpoint from source and target positions
      const edge = cell as any;

      try {
        // Try to get the edge path and find midpoint
        const sourcePoint = edge.getSourcePoint();
        const targetPoint = edge.getTargetPoint();

        if (sourcePoint && targetPoint) {
          // Calculate midpoint between source and target
          centerPoint = {
            x: (sourcePoint.x + targetPoint.x) / 2,
            y: (sourcePoint.y + targetPoint.y) / 2,
          };
        } else {
          // Fallback: use edge bounding box center
          const edgeBBox = edge.getBBox();
          centerPoint = {
            x: edgeBBox.x + edgeBBox.width / 2,
            y: edgeBBox.y + edgeBBox.height / 2,
          };
        }
      } catch (error) {
        // Final fallback: use edge bounding box center
        this.logger.warn('Could not calculate edge midpoint, using bounding box', {
          edgeId: edge.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        const edgeBBox = edge.getBBox();
        centerPoint = {
          x: edgeBBox.x + edgeBBox.width / 2,
          y: edgeBBox.y + edgeBBox.height / 2,
        };
      }
    }

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
        this.logger.debugComponent('X6Graph', 'Label updated via custom editor', {
          cellId: cell.id,
          newText,
        });
      }
      this._removeExistingEditor();
    };

    const cancelEdit = (): void => {
      this.logger.debugComponent('X6Graph', 'Label edit canceled', { cellId: cell.id });
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

    this.logger.debugComponent('X6Graph', 'Custom label editor created and focused', {
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

    // Set edge z-order and update port visibility (all excluded from history as visual effects)
    this._historyCoordinator.executeVisualEffect(this._graph!, () => {
      // Set edge z-order to the higher of source or target node z-orders
      this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

      // Update port visibility for the edge and its connected nodes
      this._portStateManager.ensureConnectedPortsVisible(graph, edge);

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
    });
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
      this.logger.debugComponent('X6Graph', 'History state changed', { canUndo, canRedo });
    } else {
      this.logger.debugComponent('X6Graph', 'History state changed', { canUndo, canRedo });

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
        this.logger.info('[InfraX6GraphAdapter] Initial graph resize completed', { width, height });
      }
    }, 0);
  }

  /**
   * Handle drag completion events by recording final state in history
   */
  private _handleDragCompletion(completion: any): void {
    if (!this._graph) return;

    const { cellId, dragType } = completion;
    const cell = this._graph.getCellById(cellId);

    if (!cell) {
      this.logger.warn('Drag completion for non-existent cell', { cellId });
      return;
    }

    this.logger.debugComponent('X6Graph', 'Handling drag completion', {
      cellId,
      dragType,
      duration: completion.duration,
    });

    // Record the final state change in history as an atomic operation
    let operationType: string;
    switch (dragType) {
      case 'move':
        operationType = HISTORY_OPERATION_TYPES.NODE_MOVE_FINAL;
        break;
      case 'resize':
        operationType = HISTORY_OPERATION_TYPES.NODE_RESIZE_FINAL;
        break;
      case 'vertex':
        operationType = HISTORY_OPERATION_TYPES.EDGE_VERTEX_CHANGE_FINAL;
        break;
      default:
        operationType = 'drag-completion';
    }

    // Execute the final state recording as an atomic operation
    this._historyCoordinator.executeFinalizeDragOperation(
      this._graph,
      () => {
        // Get current state from the cell
        const currentState = this._getCellState(cell);

        // Force a state change to trigger history recording
        // This is a bit of a hack but ensures the final state is recorded
        if (dragType === 'move' && cell.isNode()) {
          const node = cell;
          const position = node.getPosition();
          // Force position update to trigger history
          node.setPosition(position.x, position.y);
        } else if (dragType === 'resize' && cell.isNode()) {
          const node = cell;
          const size = node.getSize();
          // Force size update to trigger history
          node.setSize(size.width, size.height);
        } else if (dragType === 'vertex' && cell.isEdge()) {
          const edge = cell;
          const vertices = edge.getVertices();
          // Force vertex update to trigger history
          edge.setVertices(vertices);
        }

        return currentState;
      },
      operationType,
    );
  }

  /**
   * Get current state of a cell for history recording
   */
  private _getCellState(cell: any): any {
    if (cell.isNode()) {
      const node = cell as Node;
      return {
        position: node.getPosition(),
        size: node.getSize(),
      };
    } else if (cell.isEdge()) {
      const edge = cell as Edge;
      return {
        vertices: edge.getVertices(),
      };
    }
    return {};
  }

  /**
   * Centralized history filtering logic using AppGraphHistoryCoordinator
   */
  private _shouldIncludeInHistory(event: string, args: any): boolean {
    const result = this._shouldIncludeInHistoryInternal(event, args);

    // Log when events are being included to help debug unwanted history entries
    // Exclude position changes from logging as they're very noisy during drags
    if (result && args.key !== 'position') {
      this.logger.info('INCLUDING event in history', {
        event,
        cellId: args.cell?.id,
        key: args.key,
        options: args.options,
      });
    }

    return result;
  }

  private _shouldIncludeInHistoryInternal(event: string, args: any): boolean {
    // Priority 1: Exclude during diagram loading
    if (this._historyCoordinator.isDiagramLoading()) {
      this.logger.debugComponent('X6Graph', 'Excluding event during diagram loading', {
        event,
        cellId: args.cell?.id,
      });
      return false;
    }

    // Priority 2: Exclude based on current operation type
    const currentOperationType = this._historyCoordinator.getCurrentOperationType();
    if (
      currentOperationType &&
      this._historyCoordinator.shouldExcludeOperationType(currentOperationType)
    ) {
      this.logger.debugComponent('X6Graph', 'Excluding event for excluded operation type', {
        event,
        operationType: currentOperationType,
      });
      return false;
    }

    // Priority 3: If any cell involved is currently being dragged, exclude from history
    // This prevents interim drag states from cluttering history
    if (args.cell && this._historyCoordinator.isDragInProgress(args.cell.id)) {
      this.logger.debugComponent('X6Graph', 'Excluding event during drag operation', {
        event,
        cellId: args.cell.id,
      });
      return false;
    }

    // Also check for multi-cell operations where some cells might be dragging
    if (args.added && Array.isArray(args.added)) {
      const anyDragging = args.added.some(
        (cell: any) => cell.id && this._historyCoordinator.isDragInProgress(cell.id),
      );
      if (anyDragging) {
        this.logger.debugComponent('X6Graph', 'Excluding multi-cell event during drag');
        return false;
      }
    }

    // Priority 4: Completely exclude tools from history
    if (event === 'cell:change:tools') {
      // this.logger.debugComponent('X6Graph', 'Excluding tools event');
      return false;
    }

    // Handle cell:change:* events (which is what X6 actually fires)
    if (event === 'cell:change:*' && args.key) {
      // Handle different types of changes based on the key

      // Exclude tool changes
      if (args.key === 'tools') {
        // this.logger.debugComponent('X6Graph', 'Excluding tools key change');
        return false;
      }

      // Exclude zIndex changes (usually for visual layering)
      if (args.key === 'zIndex') {
        // this.logger.debugComponent('X6Graph', 'Excluding zIndex change');
        return false;
      }

      // Handle attribute changes
      if (args.key === 'attrs' && args.current && args.previous) {
        // Instead of checking all current attributes, check what actually changed
        const actualChanges = this._findActualAttributeChanges(args.current, args.previous);

        // Check if all actual changes are visual-only
        const isOnlyVisualAttributes = actualChanges.every(changePath => {
          const isExcluded = this._historyCoordinator.shouldExcludeAttribute(changePath);
          // this.logger.debugComponent('X6Graph', `Checking ${changePath}: excluded=${isExcluded}`);
          return isExcluded;
        });

        if (isOnlyVisualAttributes) {
          // this.logger.debugComponent('X6Graph', 'Excluding visual-only attribute changes');
          return false; // Don't add to history
        }

        // Only log when we have non-visual changes
        this.logger.debugComponent('X6Graph', 'Actual attribute changes detected:', actualChanges);
        // this.logger.debugComponent('X6Graph', 'Including attribute changes - not all visual');
      }

      // Handle port changes - check if they're only visibility changes
      if (args.key === 'ports' && args.options && args.options.propertyPath) {
        const isPortVisibilityOnly = this._historyCoordinator.shouldExcludeAttribute(
          undefined,
          args.options.propertyPath,
        );

        if (isPortVisibilityOnly) {
          /* this.logger.debugComponent(
            'X6Graph',
            'Excluding port visibility change:',
            args.options.propertyPath,
          ); */
          return false; // Don't add to history
        }
        /* this.logger.debugComponent(
          'X6Graph',
          'Including port change - not visibility only:',
          args.options.propertyPath,
        ); */
      }

      // For other cell:change:* events, allow them unless they're specifically excluded
      // this.logger.debugComponent('X6Graph', 'Including cell:change:* event with key:', args.key);
      return true;
    }

    // Allow all other changes (position, size, labels, structure)
    // this.logger.debugComponent('X6Graph', 'Including other event type:', event);
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

  /**
   * Set graph to read-only mode for users without edit permissions
   */
  setReadOnlyMode(readOnly: boolean): void {
    const graph = this.getGraph();
    if (!graph) {
      this.logger.warn('Cannot set read-only mode: graph not initialized');
      return;
    }

    if (readOnly) {
      // Disable selection via the selection adapter
      this._selectionAdapter.disableSelection(graph);

      // Disable keyboard handling
      this._keyboardHandler.cleanup();

      // Make all cells non-interactive
      graph.getCells().forEach(cell => {
        cell.prop('movable', false);
        cell.prop('resizable', false);
        cell.prop('rotatable', false);
        cell.removeTool('*'); // Remove all editing tools
      });

      this.logger.info('Graph set to read-only mode');
    } else {
      // Re-enable selection via the selection adapter
      this._selectionAdapter.enableSelection(graph);

      // Re-enable keyboard handling
      this._keyboardHandler.setupKeyboardHandling(graph);

      // Make cells interactive again
      graph.getCells().forEach(cell => {
        cell.prop('movable', true);
        cell.prop('resizable', true);
        cell.prop('rotatable', true);
      });

      this.logger.info('Graph set to edit mode');
    }
  }
}
