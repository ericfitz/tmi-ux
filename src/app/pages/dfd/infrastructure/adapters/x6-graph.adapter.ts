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
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { ICommandBus } from '../../application/interfaces/command-bus.interface';
import { OperationStateTracker } from '../services/operation-state-tracker.service';
import { OperationType } from '../../domain/history/history.types';
import { X6NodeSnapshot, X6EdgeSnapshot } from '../../types/x6-cell.types';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { DragStateManagerService } from '../services/drag-state-manager.service';
import { EdgeService } from '../services/edge.service';
import { EdgeQueryService } from '../services/edge-query.service';
import { NodeConfigurationService } from '../services/node-configuration.service';
import { PortStateManagerService } from '../services/port-state-manager.service';

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

  // Context for command pattern operations
  private _diagramId: string | null = null;
  private _userId: string | null = null;
  private _commandBus: ICommandBus | null = null;
  private _operationStateTracker: OperationStateTracker | null = null;

  // Cell caching for undo/server operations
  private _nodeSnapshots = new Map<string, X6NodeSnapshot>();
  private _edgeSnapshots = new Map<string, X6EdgeSnapshot>();

  // Shift key and drag state tracking for snap to grid control
  private _isShiftPressed = false;
  private _isDragging = false;
  private _originalGridSize = 10;

  // Store initial position of node when drag starts
  private _initialNodePositions = new Map<string, Point>();

  // Debouncing for history service integration
  private readonly _dragCompleted$ = new Subject<{
    nodeId: string;
    initialPosition: Point;
    finalPosition: Point;
    dragDuration: number;
    dragId: string;
  }>();
  private readonly _debouncedNodeResized$ = new Subject<{
    nodeId: string;
    width: number;
    height: number;
    oldWidth: number;
    oldHeight: number;
  }>();
  private readonly _debouncedNodeDataChanged$ = new Subject<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }>();
  private readonly _debouncedEdgeVerticesChanged$ = new Subject<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }>();
  private _nodeResizeTimers = new Map<string, number>();
  private _nodeDataChangeTimers = new Map<string, number>();
  private _edgeVertexTimers = new Map<string, number>();
  private readonly _debounceDelay = 200; // 200ms debounce delay

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
  private readonly _nodeDataChanged$ = new Subject<{
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

  constructor(
    private logger: LoggerService,
    private readonly _dragStateManager: DragStateManagerService,
    private readonly _edgeService: EdgeService,
    private readonly _edgeQueryService: EdgeQueryService,
    private readonly _nodeConfigurationService: NodeConfigurationService,
    private readonly _portStateManager: PortStateManagerService,
  ) {
    // Initialize X6 cell extensions once when the adapter is created
    initializeX6CellExtensions();
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
   * Observable for debounced node resize events (for history service)
   */
  get debouncedNodeResized$(): Observable<{
    nodeId: string;
    width: number;
    height: number;
    oldWidth: number;
    oldHeight: number;
  }> {
    return this._debouncedNodeResized$.asObservable();
  }

  /**
   * Observable for node data change events (immediate, non-debounced)
   */
  get nodeDataChanged$(): Observable<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }> {
    return this._nodeDataChanged$.asObservable();
  }

  /**
   * Observable for debounced node data change events (for history service)
   */
  get debouncedNodeDataChanged$(): Observable<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }> {
    return this._debouncedNodeDataChanged$.asObservable();
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
   * Observable for debounced edge vertex changes (for history service)
   */
  get debouncedEdgeVerticesChanged$(): Observable<{
    edgeId: string;
    vertices: Array<{ x: number; y: number }>;
  }> {
    return this._debouncedEdgeVerticesChanged$.asObservable();
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
          const parentType = (args.parent as any).getNodeTypeInfo
            ? (args.parent as any).getNodeTypeInfo().type
            : 'process';
          const childType = (args.child as any).getNodeTypeInfo
            ? (args.child as any).getNodeTypeInfo().type
            : 'process';

          // Textbox shapes cannot be embedded into other shapes
          if (childType === 'textbox') {
            return false;
          }

          // Other shapes cannot be embedded into textbox shapes
          if (parentType === 'textbox') {
            return false;
          }

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
                  name: 'classic',
                  size: 8,
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
    this._setupShiftKeyHandling();
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

    // Use NodeConfigurationService for all node configuration
    const nodeAttrs = this._nodeConfigurationService.getNodeAttrs(nodeType);
    const nodePorts = this._nodeConfigurationService.getNodePorts(nodeType);
    const nodeShape = this._nodeConfigurationService.getNodeShape(nodeType);
    const zIndex = this._nodeConfigurationService.getNodeZIndex(nodeType);

    const x6Node = graph.addNode({
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: node.data.width || 120,
      height: node.data.height || 60,
      label: node.data.label || '', // Add label for mock compatibility
      shape: nodeShape,
      attrs: {
        ...(nodeAttrs as any),
        text: {
          ...((nodeAttrs['text'] as Record<string, unknown>) || {}),
          text: node.data.label || '',
        },
      },
      ports: nodePorts as any,
      zIndex,
    });

    // Set metadata using X6 cell extensions
    (x6Node as any).setApplicationMetadata('type', nodeType);
    (x6Node as any).setApplicationMetadata('domainNodeId', node.id);
    (x6Node as any).setApplicationMetadata('width', String(node.data.width || 120));
    (x6Node as any).setApplicationMetadata('height', String(node.data.height || 60));
    (x6Node as any).setApplicationMetadata('label', node.data.label || '');

    // Cache node snapshot for undo/server operations
    this._cacheNodeSnapshot(x6Node);

    return x6Node;
  }

  /**
   * Add a node to the graph from a complete X6 snapshot (preserves exact port structure)
   */
  addNodeFromSnapshot(snapshot: X6NodeSnapshot): Node {
    const graph = this.getGraph();

    this.logger.info('Starting node restoration from snapshot', {
      nodeId: snapshot.id,
      shape: snapshot.shape,
      position: snapshot.position,
      size: snapshot.size,
      hasSnapshotGroups: !!(snapshot.ports as any)?.groups,
      hasSnapshotItems: !!(snapshot.ports as any)?.items,
      portCount: (snapshot.ports as any)?.items?.length || 0,
      portIds: (snapshot.ports as any)?.items?.map((item: any) => item.id) || [],
      fullSnapshotPorts: snapshot.ports,
    });

    // CRITICAL FIX: The snapshot ports need to be in the correct format for X6
    // X6 expects either a port configuration object with groups/items OR just the items array
    let portsForX6;

    if ((snapshot.ports as any)?.groups && (snapshot.ports as any)?.items) {
      // If snapshot has the complete structure, use it directly
      portsForX6 = snapshot.ports;
      this.logger.info(' Using complete port structure from snapshot', {
        nodeId: snapshot.id,
        hasGroups: true,
        hasItems: true,
        groupKeys: Object.keys((snapshot.ports as any).groups),
        itemCount: (snapshot.ports as any).items.length,
      });
    } else if (Array.isArray(snapshot.ports)) {
      // If snapshot ports is an array (legacy format), reconstruct the complete structure
      const nodeType = snapshot.metadata?.find((m: any) => m.key === 'type')?.value || 'process';
      const basePortConfig = this._nodeConfigurationService.getNodePorts(nodeType);

      portsForX6 = {
        groups: (basePortConfig as any).groups || {},
        items: snapshot.ports, // Use the snapshot port items to preserve IDs
      };

      this.logger.info(' FIXED - Reconstructed port structure from array format', {
        nodeId: snapshot.id,
        nodeType,
        originalFormat: 'array',
        reconstructedHasGroups: !!(basePortConfig as any).groups,
        reconstructedItemCount: (snapshot.ports as any).length,
        reconstructedPortIds: (snapshot.ports as any).map((item: any) => item.id),
      });
    } else {
      // Fallback: create from base configuration
      const nodeType = snapshot.metadata?.find((m: any) => m.key === 'type')?.value || 'process';
      portsForX6 = this._nodeConfigurationService.getNodePorts(nodeType);

      this.logger.warn(' Fallback - Using base port configuration', {
        nodeId: snapshot.id,
        nodeType,
        snapshotPortsType: typeof snapshot.ports,
        snapshotPorts: snapshot.ports,
      });
    }

    //  Detailed analysis of the port configuration being used
    this.logger.info(' Final port configuration for X6 restoration', {
      nodeId: snapshot.id,
      portsForX6,
      hasGroups: !!(portsForX6 as any)?.groups,
      hasItems: !!(portsForX6 as any)?.items,
      groupKeys: Object.keys((portsForX6 as any)?.groups || {}),
      itemCount: (portsForX6 as any)?.items?.length || 0,
      portDetails:
        (portsForX6 as any)?.items?.map((item: any) => ({
          id: item.id,
          group: item.group,
          hasAttrs: !!item.attrs,
          visibility: item.attrs?.circle?.style?.visibility,
        })) || [],
    });

    //  Log the exact parameters being passed to addNode
    const nodeParams = {
      id: snapshot.id,
      x: snapshot.position.x,
      y: snapshot.position.y,
      width: snapshot.size.width,
      height: snapshot.size.height,
      shape: snapshot.shape,
      attrs: snapshot.attrs,
      ports: portsForX6 as any, // Use properly formatted port configuration
      zIndex: snapshot.zIndex,
      visible: snapshot.visible,
    };

    this.logger.info(' Parameters being passed to graph.addNode()', {
      nodeId: snapshot.id,
      nodeParams,
      portsParam: nodeParams.ports,
    });

    const x6Node = graph.addNode(nodeParams);

    //  Verify the node was created with correct port configuration
    const restoredPorts = x6Node.getPorts();
    this.logger.info(' Node restored - verifying port configuration', {
      nodeId: snapshot.id,
      restoredPortCount: restoredPorts.length,
      restoredPortIds: restoredPorts.map((item: any) => item.id),
      restoredPortDetails: restoredPorts.map((item: any) => ({
        id: item.id,
        group: item.group,
        hasAttrs: !!item.attrs,
        visibility: item.attrs?.circle?.style?.visibility,
      })),
      originalPortIds: (snapshot.ports as any)?.items?.map((item: any) => item.id) || [],
      portIdsMatch:
        JSON.stringify(restoredPorts.map((item: any) => item.id).sort()) ===
        JSON.stringify(((snapshot.ports as any)?.items?.map((item: any) => item.id) || []).sort()),
    });

    // Set metadata using X6 cell extensions
    if (snapshot.metadata) {
      snapshot.metadata.forEach((entry: any) => {
        if ((x6Node as any).setApplicationMetadata) {
          (x6Node as any).setApplicationMetadata(entry.key, entry.value);
        }
      });
    }

    // Cache the original snapshot instead of re-caching the node
    // This preserves the original port configuration in the cache
    this._nodeSnapshots.set(snapshot.id, snapshot);

    //  Log final restoration status
    this.logger.info(' Node restoration completed', {
      nodeId: snapshot.id,
      nodeCreated: !!x6Node,
      metadataSet: !!(snapshot.metadata && (x6Node as any).setApplicationMetadata),
      snapshotCached: this._nodeSnapshots.has(snapshot.id),
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
   * Add an edge to the graph from either a DiagramEdge or X6EdgeSnapshot
   * CONSOLIDATED: Now uses EdgeService for unified edge operations
   */
  addEdge(edgeInput: DiagramEdge | X6EdgeSnapshot): Edge {
    const graph = this.getGraph();

    // Determine if input is EdgeData or X6EdgeSnapshot
    const isSnapshot = 'source' in edgeInput && typeof edgeInput.source === 'object';

    if (isSnapshot) {
      // Handle X6EdgeSnapshot input
      return this._edgeService.createEdge(graph, edgeInput, {
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });
    } else {
      // Handle DiagramEdge input - convert to EdgeData
      const edge = edgeInput as DiagramEdge;
      return this._edgeService.createEdge(graph, edge.data, {
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });
    }
  }

  /**
   * Remove an edge from the graph
   * CONSOLIDATED: Now uses EdgeService for unified edge operations
   */
  removeEdge(edgeId: string): void {
    const graph = this.getGraph();
    this._edgeService.removeEdge(graph, edgeId);
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
   * CONSOLIDATED: Now uses EdgeService for unified edge operations
   */
  getEdges(): Edge[] {
    const graph = this.getGraph();
    return this._edgeService.getEdges(graph);
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
   * CONSOLIDATED: Now uses EdgeService for unified edge operations
   */
  getEdge(edgeId: string): Edge | null {
    const graph = this.getGraph();
    return this._edgeService.getEdge(graph, edgeId);
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

    // Clean up shift key event listeners
    this._cleanupShiftKeyHandling();

    // Clean up debouncing timers
    this._cleanupDebouncingTimers();

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
    // Use X6 cell extensions for unified label handling
    return (cell as any).getUnifiedLabel ? (cell as any).getUnifiedLabel() : '';
  }

  /**
   * Set the standardized label text for a cell
   */
  setCellLabel(cell: Cell, text: string): void {
    const oldLabel = this.getCellLabel(cell);
    this.logger.debugComponent('DFD', '[Set Cell Label] Attempting to set label', {
      cellId: cell.id,
      isNode: cell.isNode(),
      currentLabel: oldLabel,
      newText: text,
    });

    // Only proceed if the label actually changed
    if (oldLabel === text) {
      this.logger.debugComponent('DFD', '[Set Cell Label] Label unchanged, skipping update', {
        cellId: cell.id,
        label: text,
      });
      return;
    }

    // CRITICAL FIX: Cache the snapshot BEFORE making changes for history
    // This preserves the original state for undo operations
    if (cell.isNode()) {
      this._cacheNodeSnapshot(cell);
    } else {
      this._cacheEdgeSnapshot(cell as Edge);
    }

    //  Log label change for history debugging
    this.logger.info(' Label change detected', {
      cellId: cell.id,
      cellType: cell.isNode() ? 'node' : 'edge',
      oldLabel,
      newLabel: text,
      willTriggerDataChange: true,
    });

    // Use X6 cell extensions for unified label handling
    if ((cell as any).setUnifiedLabel) {
      (cell as any).setUnifiedLabel(text);
    }

    // Update metadata
    // @deprecated Storing labels in metadata is deprecated. Use proper attrs or labels properties instead.
    if ((cell as any).setApplicationMetadata) {
      (cell as any).setApplicationMetadata('label', text);
    }

    // CRITICAL FIX: Trigger cell:change:data event for history integration
    // This ensures that label changes flow through the normal event chain
    // and are captured by the history system via debouncedNodeDataChanged$
    if (cell.isNode()) {
      // For nodes, trigger the data change event that the history system monitors
      const oldData = { label: oldLabel };
      const newData = { label: text };

      this.logger.info('FIXED: Triggering cell:change:data event for label change', {
        cellId: cell.id,
        oldData,
        newData,
        eventType: 'cell:change:data',
      });

      // CRITICAL FIX: Emit immediate event for text changes since text editing
      // only updates when editing is complete - no need for debouncing
      this._nodeDataChanged$.next({
        nodeId: cell.id,
        newData,
        oldData,
      });
    }

    // Note: We don't update cache here anymore since we cached before the change
    // The cache now contains the original state needed for undo operations
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
    return this._initialNodePositions.get(nodeId) || null;
  }

  /**
   * Set the context for command pattern operations (diagram ID, user ID, command bus, and operation state tracker)
   */
  setCommandContext(
    diagramId: string,
    userId: string,
    commandBus: ICommandBus,
    operationStateTracker?: OperationStateTracker,
  ): void {
    this._diagramId = diagramId;
    this._userId = userId;
    this._commandBus = commandBus;
    this._operationStateTracker = operationStateTracker || null;
    this.logger.info('Command context set for X6 adapter', {
      diagramId,
      userId,
      hasOperationTracker: !!operationStateTracker,
    });
  }

  /**
   * Get cached node snapshot
   */
  getNodeSnapshot(nodeId: string): X6NodeSnapshot | undefined {
    return this._nodeSnapshots.get(nodeId);
  }

  /**
   * Get cached edge snapshot
   */
  getEdgeSnapshot(edgeId: string): X6EdgeSnapshot | undefined {
    return this._edgeSnapshots.get(edgeId);
  }

  /**
   * Clear cached snapshots
   */
  clearSnapshots(): void {
    this._nodeSnapshots.clear();
    this._edgeSnapshots.clear();
  }

  /**
   * Cancel pending debounced timers for a specific node (used during undo/redo to prevent unwanted history entries)
   */
  cancelPendingNodeTimers(nodeId: string): void {
    // Cancel node resize timer
    const resizeTimer = this._nodeResizeTimers.get(nodeId);
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      this._nodeResizeTimers.delete(nodeId);
      this.logger.debug('Canceled pending node resize timer during undo/redo', { nodeId });
    }

    // Cancel node data change timer
    const dataChangeTimer = this._nodeDataChangeTimers.get(nodeId);
    if (dataChangeTimer) {
      clearTimeout(dataChangeTimer);
      this._nodeDataChangeTimers.delete(nodeId);
      this.logger.debug('Canceled pending node data change timer during undo/redo', { nodeId });
    }
  }

  /**
   * Cancel all pending debounced timers (used during undo/redo to prevent unwanted history entries)
   */
  cancelAllPendingTimers(): void {
    // Cancel all node resize timers
    this._nodeResizeTimers.forEach((timer, nodeId) => {
      clearTimeout(timer);
      this.logger.debug('Canceled pending node resize timer during undo/redo', { nodeId });
    });
    this._nodeResizeTimers.clear();

    // Cancel all node data change timers
    this._nodeDataChangeTimers.forEach((timer, nodeId) => {
      clearTimeout(timer);
      this.logger.debug('Canceled pending node data change timer during undo/redo', { nodeId });
    });
    this._nodeDataChangeTimers.clear();

    // Cancel all edge vertex timers
    this._edgeVertexTimers.forEach((timer, edgeId) => {
      clearTimeout(timer);
      this.logger.debug('Canceled pending edge vertex timer during undo/redo', { edgeId });
    });
    this._edgeVertexTimers.clear();

    this.logger.info('Canceled all pending debounced timers during undo/redo operation');
  }

  /**
   * Cache a node snapshot for undo/server operations
   */
  private _cacheNodeSnapshot(node: Node): void {
    const position = node.position();
    const size = node.size();
    const nodeType = (node as any).getApplicationMetadata
      ? (node as any).getApplicationMetadata('type')
      : 'process';

    // Convert application metadata back to array format for snapshot compatibility
    const metadataRecord = (node as any).getApplicationMetadata
      ? (node as any).getApplicationMetadata()
      : {};
    const metadata = Object.entries(metadataRecord).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    //  Log initial node state before caching
    this.logger.info(' Starting node snapshot caching', {
      nodeId: node.id,
      nodeType,
      position: { x: position.x, y: position.y },
      size: { width: size.width, height: size.height },
    });

    // CRITICAL FIX: Get the complete port configuration directly from the node
    // This preserves both the group definitions AND the current port state (IDs, visibility, etc.)
    // CRITICAL FIX: Get the complete port configuration from the node's properties
    // X6 stores the complete port config in the node's properties under 'ports'
    //  Log the raw port config from toJSON for debugging
    if (typeof node.toJSON === 'function') {
      const nodeProps = node.toJSON();
      const nodePortConfig = nodeProps.ports;

      this.logger.info(' Port config from node.toJSON()', {
        nodeId: node.id,
        hasPortConfig: !!nodePortConfig,
        portConfigType: typeof nodePortConfig,
        hasGroups: !!(nodePortConfig as any)?.groups,
        hasItems: !!(nodePortConfig as any)?.items,
        rawPortConfig: nodePortConfig,
      });
    } else {
      // Fallback for test environment - node doesn't have toJSON method
      this.logger.warn(' Node does not have toJSON method', { nodeId: node.id });
    }

    // Get current port items for comparison
    const currentPortItems = node.getPorts() || [];
    this.logger.info(' Current port items from node.getPorts()', {
      nodeId: node.id,
      itemCount: currentPortItems.length,
      portItems: currentPortItems.map((item: any) => ({
        id: item.id,
        group: item.group,
        hasAttrs: !!item.attrs,
      })),
    });

    // CRITICAL FIX: Always reconstruct the complete port configuration
    // The issue was that node.toJSON() doesn't always return the complete port structure
    // We need to ensure we have both groups AND items with the correct structure
    const basePortConfig = this._nodeConfigurationService.getNodePorts(nodeType);

    const completePortConfig = {
      groups: (basePortConfig as any).groups || {}, // Get groups from base config
      items: currentPortItems, // Use current port items to preserve IDs and state
    };

    this.logger.info(' FIXED - Always using reconstructed complete port config', {
      nodeId: node.id,
      nodeType,
      hasBaseGroups: !!(basePortConfig as any).groups,
      currentItemCount: currentPortItems.length,
      basePortConfig,
      reconstructedConfig: completePortConfig,
      fixApplied: 'Always reconstruct to ensure groups + items structure',
    });

    //  Log final port configuration being cached
    this.logger.info(' Final port configuration being cached', {
      nodeId: node.id,
      nodeType,
      hasGroups:
        !!(completePortConfig as any).groups &&
        Object.keys((completePortConfig as any).groups).length > 0,
      hasItems: !!(completePortConfig as any).items && (completePortConfig as any).items.length > 0,
      groupKeys: Object.keys((completePortConfig as any).groups || {}),
      itemCount: (completePortConfig as any).items?.length || 0,
      portIds: (completePortConfig as any).items?.map((item: any) => item.id) || [],
      finalPortConfig: completePortConfig,
    });

    const snapshot: X6NodeSnapshot = {
      id: node.id,
      position: { x: position.x, y: position.y },
      size: { width: size.width, height: size.height },
      shape: node.shape,
      attrs: node.getAttrs(),
      ports: completePortConfig, // Use complete port config with both groups and items
      zIndex: node.getZIndex() || 1,
      visible: node.isVisible(),
      type: nodeType,
      metadata,
    };
    this._nodeSnapshots.set(node.id, snapshot);

    //  Log the final cached snapshot
    this.logger.info(' Node snapshot cached successfully', {
      nodeId: node.id,
      snapshotPortConfig: snapshot.ports,
      cacheSize: this._nodeSnapshots.size,
    });
  }

  /**
   * Cache an edge snapshot for undo/server operations
   */
  private _cacheEdgeSnapshot(edge: Edge): void {
    const metadataRecord = (edge as any).getApplicationMetadata
      ? (edge as any).getApplicationMetadata()
      : {};
    const metadata = Object.entries(metadataRecord).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    const snapshot: X6EdgeSnapshot = {
      id: edge.id,
      source: edge.getSource(),
      target: edge.getTarget(),
      shape: edge.shape,
      attrs: edge.getAttrs(),
      vertices: edge.getVertices(),
      labels: edge.getLabels(),
      zIndex: edge.getZIndex() || 1,
      visible: edge.isVisible(),
      metadata,
    };
    this._edgeSnapshots.set(edge.id, snapshot);
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

          // Update drag state if node is being dragged
          if (this._dragStateManager.isDragging(node.id)) {
            this._dragStateManager.updateDragPosition(node.id, currentPos);
            // Reduce logging during drag - only log significant position changes
            const dragState = this._dragStateManager.getDragState(node.id);
            if (dragState) {
              const deltaFromStart = Math.sqrt(
                Math.pow(currentPos.x - dragState.initialPosition.x, 2) +
                  Math.pow(currentPos.y - dragState.initialPosition.y, 2),
              );
              // Only log every 50 pixels of movement to reduce noise
              if (
                deltaFromStart > 0 &&
                Math.floor(deltaFromStart / 50) >
                  Math.floor(
                    dragState.currentPosition
                      ? Math.sqrt(
                          Math.pow(dragState.currentPosition.x - dragState.initialPosition.x, 2) +
                            Math.pow(dragState.currentPosition.y - dragState.initialPosition.y, 2),
                        ) / 50
                      : 0,
                  )
              ) {
                this.logger.debug('DRAG_PROGRESS', {
                  nodeId: node.id,
                  dragId: dragState.dragId,
                  currentPosition: { x: currentPos.x, y: currentPos.y },
                  deltaFromStart: Math.round(deltaFromStart),
                });
              }
            }
          }

          // Emit immediate event for UI responsiveness
          this._nodeMoved$.next({
            nodeId: node.id,
            position: currentPos,
            previous: previousPos,
          });

          // Note: Debounced node movement removed - drag completion provides superior tracking
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

          // Handle debounced event for history service
          this._handleDebouncedNodeResize(
            node.id,
            current.width,
            current.height,
            previous.width,
            previous.height,
          );
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
          this._nodeDataChanged$.next({
            nodeId: cell.id,
            newData: current,
            oldData: previous,
          });

          // Handle debounced event for history service
          this._handleDebouncedNodeDataChange(cell.id, current, previous);
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
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
        source: edge.getSource(),
        target: edge.getTarget(),
      });

      // Only emit for edges with valid source and target
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      if (sourceId && targetId) {
        // Set edge z-order to the higher of source or target node z-orders
        this._setEdgeZOrderFromConnectedNodes(edge);

        // CRITICAL FIX: Add a small delay to ensure X6 has fully established the connection
        // before capturing the port information
        setTimeout(() => {
          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Delayed port capture after connection',
            {
              edgeId: edge.id,
              sourcePortId: edge.getSourcePortId(),
              targetPortId: edge.getTargetPortId(),
              source: edge.getSource(),
              target: edge.getTarget(),
            },
          );

          // CRITICAL FIX: Use composite command for edge creation to capture port state
          // But only if we have the necessary context - otherwise fall back to normal flow
          if (this._diagramId && this._userId && this._commandBus) {
            this._handleEdgeCreationWithPortState(edge, sourceId, targetId);
            // Don't emit edgeAdded$ here - the composite command will handle the domain model update
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] Using composite command, skipping normal edge emission',
            );
          } else {
            // Fallback to normal flow when context is not available
            this.logger.debugComponent(
              'DFD',
              '[Edge Creation] No command context, using normal edge emission',
            );
            this._edgeAdded$.next(edge);
          }
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
    });

    // Node embedding events
    this._graph.on('node:embedding', ({ node }: { node: Node }) => {
      // Store the original z-index before temporarily changing it using metadata
      const originalZIndex = node.getZIndex();
      if ((node as any).setApplicationMetadata) {
        (node as any).setApplicationMetadata('_originalZIndex', String(originalZIndex));
      }

      // When a node is being embedded, ensure it appears in front temporarily
      // But respect the node type - security boundaries should stay behind regular nodes
      const nodeType = (node as any).getNodeTypeInfo
        ? (node as any).getNodeTypeInfo().type
        : 'process';
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
          // If embedding was cancelled, restore original z-index from metadata
          const originalZIndexValue = (node as any).getApplicationMetadata
            ? (node as any).getApplicationMetadata('_originalZIndex')
            : '';
          const originalZIndex = originalZIndexValue ? Number(originalZIndexValue) : null;
          if (typeof originalZIndex === 'number' && !isNaN(originalZIndex)) {
            node.setZIndex(originalZIndex);
            // Also restore z-order for connected edges
            this._updateConnectedEdgesZOrder(node, originalZIndex);
          }
          return;
        }

        // After embedding, adjust z-indices
        const parentType = (currentParent as any).getNodeTypeInfo
          ? (currentParent as any).getNodeTypeInfo().type
          : 'process';
        const childType = (node as any).getNodeTypeInfo
          ? (node as any).getNodeTypeInfo().type
          : 'process';

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

        // Clean up the temporary metadata
        if ((node as any).setApplicationMetadata) {
          (node as any).setApplicationMetadata('_originalZIndex', '');
        }
      },
    );

    this._graph.on('node:change:parent', ({ node, current }: { node: Node; current?: string }) => {
      // When a node is removed from its parent (unembedded)
      if (!current) {
        const nodeType = (node as any).getNodeTypeInfo
          ? (node as any).getNodeTypeInfo().type
          : 'process';

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
    // We'll use a more reliable approach by listening to the node:moved event
    // which fires after the drag operation is complete
    this._graph.on('node:moved', ({ node }: { node: Node }) => {
      // Check if this node has a stored original z-index from embedding attempt
      // Safety check for test environment where getData might not exist
      if (typeof node.getData !== 'function') {
        return;
      }
      const originalZIndexValue = (node as any).getApplicationMetadata
        ? (node as any).getApplicationMetadata('_originalZIndex')
        : '';
      const originalZIndex = originalZIndexValue ? Number(originalZIndexValue) : null;
      // If we have an original z-index stored and the node is not currently embedded,
      // restore the original z-index (this handles the case where dragging was just for movement)
      if (typeof originalZIndex === 'number' && !isNaN(originalZIndex) && !node.getParent()) {
        // Use a longer timeout to ensure this runs after all embedding events have completed
        setTimeout(() => {
          // Double-check that the node still doesn't have a parent and still has the stored z-index
          if (!node.getParent() && (node as any).getApplicationMetadata) {
            const stillHasOriginalZIndex = (node as any).getApplicationMetadata('_originalZIndex');

            // Only restore if we still have the original z-index stored (not cleaned up by embedding)
            if (stillHasOriginalZIndex) {
              node.setZIndex(originalZIndex);
              // Update z-order for connected edges to match the restored node z-order
              this._updateConnectedEdgesZOrder(node, originalZIndex);
              // Clean up the temporary metadata
              if ((node as any).setApplicationMetadata) {
                (node as any).setApplicationMetadata('_originalZIndex', '');
              }

              this.logger.info('Restored original z-index after drag without embedding', {
                nodeId: node.id,
                restoredZIndex: originalZIndex,
              });
            }
          }
        }, 100);
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
          this._portStateManager.updateNodePortVisibility(this._graph!, sourceNode);
        }
      }

      if (targetCellId) {
        const targetNode = this._graph!.getCellById(targetCellId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._portStateManager.updateNodePortVisibility(this._graph!, targetNode);
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
            const nodeType = (cell as any).getNodeTypeInfo
              ? (cell as any).getNodeTypeInfo().type
              : 'process';
            if (nodeType === 'textbox') {
              // For textbox shapes, apply glow to text element since body is transparent
              cell.attr('text/filter', 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
            } else {
              // For all other node types, apply glow to body element
              cell.attr('body/filter', 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
              cell.attr('body/strokeWidth', 3);
            }
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
            const nodeType = (cell as any).getNodeTypeInfo
              ? (cell as any).getNodeTypeInfo().type
              : 'process';
            if (nodeType === 'textbox') {
              // For textbox shapes, remove glow from text element
              cell.attr('text/filter', 'none');
            } else {
              // For all other node types, remove glow from body element
              cell.attr('body/filter', 'none');
              cell.attr('body/strokeWidth', 2);
            }
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
   * Get X6 edge attributes for domain edge type
   */
  private _getEdgeAttrs(edgeType: string): Record<string, unknown> {
    const baseAttrs = {
      line: {
        stroke: '#000000',
        strokeWidth: 2,
        targetMarker: {
          name: 'classic',
          size: 8,
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
          if (!this._portStateManager.isPortConnected(this._graph!, node.id, port.id!)) {
            node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'hidden');
          }
        });
      }
    });

    // Show all ports when starting to connect
    this._graph.on('edge:connecting', () => {
      this._isConnecting = true;
      this._portStateManager.showAllPorts(this._graph!);
    });

    // Also listen for mouse down on magnets to show ports
    this._graph.on('node:magnet:mousedown', () => {
      this._isConnecting = true;
      this._portStateManager.showAllPorts(this._graph!);
    });

    // Hide ports when connection is complete or cancelled, but keep connected ports visible
    this._graph.on('edge:connected', ({ edge }) => {
      this._isConnecting = false;
      // Add a small delay to ensure the edge connection is fully established
      // before updating port visibility
      setTimeout(() => {
        this._portStateManager.hideUnconnectedPorts(this._graph!);
        // Ensure the newly connected ports remain visible
        this._portStateManager.ensureConnectedPortsVisible(this._graph!, edge);
      }, 10);
    });

    this._graph.on('edge:disconnected', () => {
      this._isConnecting = false;
      this._portStateManager.hideUnconnectedPorts(this._graph!);
    });

    // Handle mouse up to stop connecting if no valid connection was made
    this._graph.on('blank:mouseup', () => {
      if (this._isConnecting) {
        this._isConnecting = false;
        this._portStateManager.hideUnconnectedPorts(this._graph!);
      }
    });

    // Handle node mouse up during edge creation to prevent port hiding
    this._graph.on('node:mouseup', () => {
      // If we just finished connecting, ensure connected ports stay visible
      if (!this._isConnecting) {
        setTimeout(() => {
          this._portStateManager.hideUnconnectedPorts(this._graph!);
        }, 50);
      }
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
   * Ensure that the ports connected by a specific edge remain visible
   * CRITICAL FIX: Enhanced for undo/redo operations to properly restore port visibility
   */
  private _ensureConnectedPortsVisible(edge: Edge): void {
    if (!this._graph) return;

    const sourceCellId = edge.getSourceCellId();
    const targetCellId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    this.logger.info('FIXED: Ensuring connected ports are visible for edge', {
      edgeId: edge.id,
      sourceCellId,
      targetCellId,
      sourcePortId,
      targetPortId,
    });

    // Make sure source port is visible
    if (sourceCellId && sourcePortId) {
      const sourceNode = this._graph.getCellById(sourceCellId) as Node;
      if (sourceNode && sourceNode.isNode()) {
        // CRITICAL FIX: Verify port exists before setting visibility
        const ports = sourceNode.getPorts();
        const portExists = ports.some(port => port.id === sourcePortId);

        if (portExists) {
          sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
          this.logger.info('FIXED: Made source port visible', {
            edgeId: edge.id,
            sourceNodeId: sourceCellId,
            sourcePortId,
            portExists: true,
          });
        } else {
          this.logger.warn('FIXED: Source port does not exist on node', {
            edgeId: edge.id,
            sourceNodeId: sourceCellId,
            sourcePortId,
            availablePorts: ports.map(p => p.id),
          });
        }
      }
    }

    // Make sure target port is visible
    if (targetCellId && targetPortId) {
      const targetNode = this._graph.getCellById(targetCellId) as Node;
      if (targetNode && targetNode.isNode()) {
        // CRITICAL FIX: Verify port exists before setting visibility
        const ports = targetNode.getPorts();
        const portExists = ports.some(port => port.id === targetPortId);

        if (portExists) {
          targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
          this.logger.info('FIXED: Made target port visible', {
            edgeId: edge.id,
            targetNodeId: targetCellId,
            targetPortId,
            portExists: true,
          });
        } else {
          this.logger.warn('FIXED: Target port does not exist on node', {
            edgeId: edge.id,
            targetNodeId: targetCellId,
            targetPortId,
            availablePorts: ports.map(p => p.id),
          });
        }
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
            maxWidth: Number.MAX_SAFE_INTEGER,
            maxHeight: Number.MAX_SAFE_INTEGER,
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

    // Add hover effects with subtle red glow
    this._graph.on('cell:mouseenter', ({ cell }: { cell: Cell }) => {
      if (!this._selectedCells.has(cell.id)) {
        if (cell.isNode()) {
          const nodeType = (cell as any).getNodeTypeInfo
            ? (cell as any).getNodeTypeInfo().type
            : 'process';
          if (nodeType === 'textbox') {
            // For textbox shapes, apply hover glow to text element since body is transparent
            cell.attr('text/filter', 'drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
          } else {
            // For all other node types, apply hover glow to body element
            cell.attr('body/filter', 'drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
          }
        } else if (cell.isEdge()) {
          // Add subtle red glow for edge hover
          cell.attr('line/filter', 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.6))');
        }
      }
    });

    this._graph.on('cell:mouseleave', ({ cell }: { cell: Cell }) => {
      if (!this._selectedCells.has(cell.id)) {
        if (cell.isNode()) {
          const nodeType = (cell as any).getNodeTypeInfo
            ? (cell as any).getNodeTypeInfo().type
            : 'process';
          if (nodeType === 'textbox') {
            // For textbox shapes, remove hover glow from text element
            cell.attr('text/filter', 'none');
          } else {
            // For all other node types, remove hover glow from body element
            cell.attr('body/filter', 'none');
          }
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

    // Use X6 cell extensions to get metadata
    const nodeType = (node as any).getApplicationMetadata
      ? (node as any).getApplicationMetadata('type')
      : '';
    return nodeType || 'process';
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
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

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

            // FIX: Use command pattern for delete operations to enable history tracking
            if (this._diagramId && this._userId && this._commandBus) {
              this.logger.info('FIXED: Using command pattern for node deletion', {
                cellId: cell.id,
                cellType: 'node',
                diagramId: this._diagramId,
                userId: this._userId,
              });

              // CRITICAL FIX: Start operation tracking for delete operations
              const operationId = `delete_node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

              if (this._operationStateTracker) {
                this._operationStateTracker.startOperation(operationId, OperationType.DELETE, {
                  entityId: cell.id,
                  entityType: 'node',
                  metadata: { operationType: 'DELETE_NODE' },
                });

                this.logger.info(' Started operation tracking for delete', {
                  operationId,
                  nodeId: cell.id,
                });
              }

              const command = DiagramCommandFactory.removeNode(
                this._diagramId,
                this._userId,
                cell.id,
                true, // isLocalUserInitiated = true for history recording
              );

              // Attach operation ID to command for history middleware
              const commandWithOperationId = command as unknown as Record<string, unknown>;
              commandWithOperationId['operationId'] = operationId;

              this._commandBus.execute(command).subscribe({
                next: () => {
                  this.logger.info('Node deletion command executed successfully', {
                    nodeId: cell.id,
                    operationId,
                  });

                  // CRITICAL FIX: Complete operation tracking
                  if (this._operationStateTracker) {
                    this._operationStateTracker.completeOperation(operationId);
                    this.logger.info(' Completed operation tracking for delete', {
                      operationId,
                      nodeId: cell.id,
                    });
                  }
                },
                error: (error: unknown) => {
                  this.logger.error('Failed to execute node deletion command', {
                    nodeId: cell.id,
                    error,
                    operationId,
                  });

                  // Cancel operation tracking on error
                  if (this._operationStateTracker) {
                    this._operationStateTracker.cancelOperation(operationId);
                  }

                  // Fallback to direct removal if command fails
                  if (this._graph) {
                    this._graph.removeCell(cell);
                  }
                },
              });
            } else {
              this.logger.warn('Command context not set, falling back to direct removal', {
                cellId: cell.id,
                hasContext: {
                  diagramId: !!this._diagramId,
                  userId: !!this._userId,
                  commandBus: !!this._commandBus,
                },
              });
              // Fallback to direct removal if context is not set
              if (this._graph) {
                this._graph.removeCell(cell);
              }
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

            // FIX: Use command pattern for delete operations to enable history tracking
            if (this._diagramId && this._userId && this._commandBus) {
              this.logger.info('FIXED: Using command pattern for edge deletion', {
                cellId: cell.id,
                cellType: 'edge',
                diagramId: this._diagramId,
                userId: this._userId,
              });

              const command = DiagramCommandFactory.removeEdge(
                this._diagramId,
                this._userId,
                cell.id,
                true, // isLocalUserInitiated = true for history recording
              );

              this._commandBus.execute(command).subscribe({
                next: () => {
                  this.logger.info('Edge deletion command executed successfully', {
                    edgeId: cell.id,
                  });
                },
                error: (error: unknown) => {
                  this.logger.error('Failed to execute edge deletion command', {
                    edgeId: cell.id,
                    error,
                  });
                  // Fallback to direct removal if command fails
                  if (this._graph) {
                    this._graph.removeCell(cell);
                  }
                },
              });
            } else {
              this.logger.warn('Command context not set, falling back to direct removal', {
                cellId: cell.id,
                hasContext: {
                  diagramId: !!this._diagramId,
                  userId: !!this._userId,
                  commandBus: !!this._commandBus,
                },
              });
              // Fallback to direct removal if context is not set
              if (this._graph) {
                this._graph.removeCell(cell);
              }
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

        // Update the edge metadata with new vertices
        // @deprecated Storing vertices in metadata is deprecated. Use the dedicated vertices property instead.
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

        // Handle debounced event for history service
        this._handleDebouncedEdgeVertexChange(
          edge.id,
          vertices.map((v: { x: number; y: number }) => ({ x: v.x, y: v.y })),
        );
      }
    };

    // Add the event listener
    this._graph.on('edge:change:vertices', vertexChangeHandler);

    // Note: Event handlers are managed by X6 graph event system
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
        this.logger.info('Edge source changed', {
          edgeId: edge.id,
          newSourceId: sourceId,
          newSourcePortId: sourcePortId,
        });

        // Update port visibility for old and new source nodes
        this._portStateManager.onConnectionChange(this._graph!);
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
        this._portStateManager.onConnectionChange(this._graph!);
      }
    };

    // Add the event listeners
    this._graph.on('edge:change:source', sourceChangeHandler);
    this._graph.on('edge:change:target', targetChangeHandler);

    // Note: Event handlers are managed by X6 graph event system
    // No need to store handler references in metadata
  }

  /**
   * Update port visibility for all nodes after a connection change
   */
  private _updatePortVisibilityAfterConnectionChange(): void {
    if (!this._graph) return;

    // Update port visibility for all nodes to reflect new connection states
    this._graph.getNodes().forEach(node => {
      this._portStateManager.updateNodePortVisibility(this._graph!, node);
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
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
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

  /**
   * Setup shift key handling for temporary snap to grid disable
   */
  private _setupShiftKeyHandling(): void {
    if (!this._graph) return;

    // Listen for shift key events on the document
    document.addEventListener('keydown', this._handleKeyDown);
    document.addEventListener('keyup', this._handleKeyUp);

    // Listen for drag start/end events on nodes
    this._graph.on('node:mousedown', this._handleNodeMouseDown);
    this._graph.on('node:mousemove', this._handleNodeMouseMove);
    this._graph.on('node:mouseup', this._handleNodeMouseUp);

    // Also listen for global mouse up to handle cases where mouse is released outside the graph
    document.addEventListener('mouseup', this._handleDocumentMouseUp);

    // Handle window blur to reset state if user switches windows while dragging
    window.addEventListener('blur', this._handleWindowBlur);

    this.logger.info('Shift key handling for snap to grid control initialized');
  }

  /**
   * Clean up shift key event listeners
   */
  private _cleanupShiftKeyHandling(): void {
    document.removeEventListener('keydown', this._handleKeyDown);
    document.removeEventListener('keyup', this._handleKeyUp);
    document.removeEventListener('mouseup', this._handleDocumentMouseUp);
    window.removeEventListener('blur', this._handleWindowBlur);
  }

  /**
   * Handle keydown events to track shift key state
   */
  private _handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Shift' && !this._isShiftPressed) {
      this._isShiftPressed = true;
      this._updateSnapToGrid();
    }
  };

  /**
   * Handle keyup events to track shift key state
   */
  private _handleKeyUp = (event: KeyboardEvent): void => {
    if (event.key === 'Shift' && this._isShiftPressed) {
      this._isShiftPressed = false;
      this._updateSnapToGrid();
    }
  };

  /**
   * Handle node mouse down to track drag start and store initial position
   */
  private _handleNodeMouseDown = ({ node }: { node: Node }): void => {
    this._isDragging = true;
    this._updateSnapToGrid();

    // Get the initial position of the node when the drag starts
    const initialPosition = new Point(node.position().x, node.position().y);

    // Start drag tracking with the drag state manager
    const dragId = this._dragStateManager.startDrag(node.id, initialPosition);

    // Store the initial position for backward compatibility
    this._initialNodePositions.set(node.id, initialPosition);

    this.logger.debug('Node drag started', {
      nodeId: node.id,
      dragId,
      initialPosition: { x: initialPosition.x, y: initialPosition.y },
    });
  };

  /**
   * Handle node mouse move during drag
   */
  private _handleNodeMouseMove = (): void => {
    // Update snap to grid in case shift state changed during drag
    if (this._isDragging) {
      this._updateSnapToGrid();
    }
  };

  /**
   * Handle node mouse up to track drag end
   */
  private _handleNodeMouseUp = ({ node }: { node: Node }): void => {
    if (this._isDragging) {
      this._isDragging = false;
      this._updateSnapToGrid();

      // Complete drag tracking with the drag state manager
      const finalPosition = new Point(node.position().x, node.position().y);
      const dragState = this._dragStateManager.completeDrag(node.id, finalPosition);

      if (dragState) {
        // Emit drag completion event for history service
        this._dragCompleted$.next({
          nodeId: node.id,
          initialPosition: dragState.initialPosition,
          finalPosition,
          dragDuration: Date.now() - dragState.dragStartTime,
          dragId: dragState.dragId,
        });
      }

      // Clear the initial position for backward compatibility
      this._initialNodePositions.delete(node.id);
    }
  };

  /**
   * Handle document mouse up to ensure drag state is reset
   */
  private _handleDocumentMouseUp = (): void => {
    if (this._isDragging) {
      this._isDragging = false;
      this._updateSnapToGrid();
      // Clear all initial positions if mouse up happens outside a node
      this._initialNodePositions.clear();
    }
  };

  /**
   * Handle window blur to reset state
   */
  private _handleWindowBlur = (): void => {
    this._isShiftPressed = false;
    this._isDragging = false;
    this._updateSnapToGrid();
    this._initialNodePositions.clear();
  };

  /**
   * Update snap to grid based on current shift and drag state
   */
  private _updateSnapToGrid(): void {
    if (!this._graph) return;

    // Disable snap to grid (set to 1) if shift is pressed during drag
    const shouldDisableSnap = this._isShiftPressed && this._isDragging;
    const newGridSize = shouldDisableSnap ? 1 : this._originalGridSize;

    // Update the grid size by modifying the graph options
    // We need to access the internal grid configuration and update it

    const graphOptions = (this._graph as any).options as {
      grid?: { size: number; visible: boolean };
    };
    if (graphOptions?.grid) {
      graphOptions.grid.size = newGridSize;
      // Redraw the grid with the new size
      this._graph.drawGrid();
    }
  }

  /**
   * Handle debounced node resize for history service integration
   */
  private _handleDebouncedNodeResize(
    nodeId: string,
    width: number,
    height: number,
    oldWidth: number,
    oldHeight: number,
  ): void {
    // Clear existing timer for this node
    const existingTimer = this._nodeResizeTimers.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.logger.debugComponent('DFD', '[Debounced] Node resize finalized', {
        nodeId,
        width,
        height,
        oldWidth,
        oldHeight,
        debounceDelay: this._debounceDelay,
      });

      // Emit debounced event for history service
      this._debouncedNodeResized$.next({
        nodeId,
        width,
        height,
        oldWidth,
        oldHeight,
      });

      // Clean up timer
      this._nodeResizeTimers.delete(nodeId);
    }, this._debounceDelay) as unknown as number;

    this._nodeResizeTimers.set(nodeId, timer);
  }

  /**
   * Handle debounced node data change for history service integration
   */
  private _handleDebouncedNodeDataChange(
    nodeId: string,
    newData: Record<string, unknown>,
    oldData: Record<string, unknown>,
  ): void {
    // Clear existing timer for this node
    const existingTimer = this._nodeDataChangeTimers.get(nodeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      //  Log timing information for undo/redo debugging
      this.logger.info(' Debounced node data change timer fired', {
        nodeId,
        newData,
        oldData,
        debounceDelay: this._debounceDelay,
        timerFiredAt: new Date().toISOString(),
        willTriggerHistoryIntegration: true,
      });

      this.logger.debugComponent('DFD', '[Debounced] Node data change finalized', {
        nodeId,
        newData,
        oldData,
        debounceDelay: this._debounceDelay,
      });

      // Emit debounced event for history service
      this._debouncedNodeDataChanged$.next({
        nodeId,
        newData,
        oldData,
      });

      // Clean up timer
      this._nodeDataChangeTimers.delete(nodeId);
    }, this._debounceDelay) as unknown as number;

    this._nodeDataChangeTimers.set(nodeId, timer);
  }

  /**
   * Handle debounced edge vertex changes for history service integration
   */
  private _handleDebouncedEdgeVertexChange(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
  ): void {
    // Clear existing timer for this edge
    const existingTimer = this._edgeVertexTimers.get(edgeId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.logger.debugComponent('DFD', '[Debounced] Edge vertex change finalized', {
        edgeId,
        vertexCount: vertices.length,
        vertices,
        debounceDelay: this._debounceDelay,
      });

      // Emit debounced event for history service
      this._debouncedEdgeVerticesChanged$.next({
        edgeId,
        vertices,
      });

      // Clean up timer
      this._edgeVertexTimers.delete(edgeId);
    }, this._debounceDelay) as unknown as number;

    this._edgeVertexTimers.set(edgeId, timer);
  }

  /**
   * Clean up all debouncing timers
   */
  private _cleanupDebouncingTimers(): void {
    // Clear all node resize timers
    this._nodeResizeTimers.forEach(timer => clearTimeout(timer));
    this._nodeResizeTimers.clear();

    // Clear all node data change timers
    this._nodeDataChangeTimers.forEach(timer => clearTimeout(timer));
    this._nodeDataChangeTimers.clear();

    // Clear all edge vertex timers
    this._edgeVertexTimers.forEach(timer => clearTimeout(timer));
    this._edgeVertexTimers.clear();

    this.logger.debugComponent('DFD', '[Debouncing] All timers cleaned up');
  }

  /**
   * Verify that source and target nodes exist for edge creation
   * CONSOLIDATED: This functionality is now handled by EdgeService
   * @deprecated Use EdgeService.createEdge() which includes verification
   */
  private _verifyEdgeNodes(_snapshot: X6EdgeSnapshot): void {
    // This method is deprecated - EdgeService now handles verification
    // Keeping for backward compatibility during transition
    this.logger.debug('_verifyEdgeNodes is deprecated - use EdgeService.createEdge()');
  }

  /**
   * Handle edge creation with port state preservation using composite commands
   * CRITICAL FIX: This ensures that port visibility changes are captured in history
   */
  private _handleEdgeCreationWithPortState(edge: Edge, sourceId: string, targetId: string): void {
    // Only handle user-initiated edge creation (not programmatic restoration)
    if (!this._diagramId || !this._userId || !this._commandBus) {
      this.logger.info('FIXED: Skipping composite command - missing context', {
        edgeId: edge.id,
        hasContext: {
          diagramId: !!this._diagramId,
          userId: !!this._userId,
          commandBus: !!this._commandBus,
        },
      });
      return;
    }

    const sourceNode = this._graph?.getCellById(sourceId) as Node;
    const targetNode = this._graph?.getCellById(targetId) as Node;

    if (!sourceNode?.isNode() || !targetNode?.isNode()) {
      this.logger.warn('FIXED: Cannot create composite command - invalid nodes', {
        edgeId: edge.id,
        sourceId,
        targetId,
        sourceIsNode: sourceNode?.isNode(),
        targetIsNode: targetNode?.isNode(),
      });
      return;
    }

    try {
      // Capture node snapshots before and after edge creation
      const sourceSnapshotBefore = this._nodeSnapshots.get(sourceId);
      const targetSnapshotBefore = this._nodeSnapshots.get(targetId);

      if (!sourceSnapshotBefore || !targetSnapshotBefore) {
        this.logger.warn('FIXED: Missing node snapshots for composite command', {
          edgeId: edge.id,
          sourceId,
          targetId,
          hasSourceSnapshot: !!sourceSnapshotBefore,
          hasTargetSnapshot: !!targetSnapshotBefore,
        });
        return;
      }

      // Cache current node states (after edge creation)
      this._cacheNodeSnapshot(sourceNode);
      this._cacheNodeSnapshot(targetNode);

      const sourceSnapshotAfter = this._nodeSnapshots.get(sourceId);
      const targetSnapshotAfter = this._nodeSnapshots.get(targetId);

      if (!sourceSnapshotAfter || !targetSnapshotAfter) {
        this.logger.error('FIXED: Failed to cache node snapshots after edge creation', {
          edgeId: edge.id,
          sourceId,
          targetId,
        });
        return;
      }

      // CRITICAL FIX: Create edge snapshot directly from X6 edge to capture port information
      // This ensures we get the actual port connections that were just established
      const edgeSnapshot = this._edgeService.createEdgeSnapshot(edge);

      this.logger.info('FIXED: Creating composite command for edge creation with port state', {
        edgeId: edge.id,
        sourceId,
        targetId,
        hasAllSnapshots: true,
        edgeSource: edgeSnapshot.source,
        edgeTarget: edgeSnapshot.target,
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
      });

      // Create composite command that captures port state changes
      const compositeCommand = DiagramCommandFactory.addEdgeWithPortState(
        this._diagramId,
        this._userId,
        edge.id,
        sourceId,
        targetId,
        edgeSnapshot,
        sourceSnapshotBefore,
        targetSnapshotBefore,
        sourceSnapshotAfter,
        targetSnapshotAfter,
        true, // isLocalUserInitiated = true for user-created edges
      );

      // Execute the composite command
      this._commandBus.execute(compositeCommand).subscribe({
        next: () => {
          this.logger.info('FIXED: Composite edge creation command executed successfully', {
            edgeId: edge.id,
            compositeCommandId: compositeCommand.commandId,
          });

          // CRITICAL FIX: Do NOT emit edgeAdded$ here - the composite command already handles
          // the domain model update. Emitting here would cause duplicate edge creation.
          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Composite command completed - domain model already updated',
          );
        },
        error: (error: unknown) => {
          this.logger.error('FIXED: Failed to execute composite edge creation command', {
            edgeId: edge.id,
            error,
          });

          // CRITICAL FIX: On composite command failure, remove the edge from X6 graph
          // since the domain model update failed
          this.logger.warn('FIXED: Removing edge from X6 graph due to composite command failure');
          if (this._graph && this._graph.getCellById(edge.id)) {
            this._graph.removeCell(edge);
          }
        },
      });
    } catch (error) {
      this.logger.error('FIXED: Error creating composite command for edge creation', {
        edgeId: edge.id,
        sourceId,
        targetId,
        error,
      });
    }
  }

  /**
   * Update port visibility for connected nodes after edge creation
   * @deprecated This functionality is now handled by EdgeService.createEdge()
   */
  private _updatePortVisibilityAfterEdgeCreation(edge: Edge): void {
    const graph = this.getGraph();

    // Cache edge snapshot for undo/server operations
    this._cacheEdgeSnapshot(edge);

    // Set edge z-order to the higher of source or target node z-orders
    this._setEdgeZOrderFromConnectedNodes(edge);

    // CRITICAL FIX: Ensure connected ports are visible after edge restoration
    // This is essential for undo/redo operations where edges are restored from snapshots
    this._portStateManager.ensureConnectedPortsVisible(this._graph!, edge);

    // Update port visibility for connected nodes
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (sourceNodeId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        this._portStateManager.updateNodePortVisibility(this._graph!, sourceNode);
        this.logger.info('Updated source node port visibility after edge creation', {
          edgeId: edge.id,
          sourceNodeId,
          sourcePortId: edge.getSourcePortId(),
        });
      }
    }

    if (targetNodeId) {
      const targetNode = graph.getCellById(targetNodeId);
      if (targetNode && targetNode.isNode()) {
        this._portStateManager.updateNodePortVisibility(this._graph!, targetNode);
        this.logger.info('Updated target node port visibility after edge creation', {
          edgeId: edge.id,
          targetNodeId,
          targetPortId: edge.getTargetPortId(),
        });
      }
    }

    // CRITICAL FIX: Double-check that the specific ports connected by this edge are visible
    // This ensures that undo/redo operations properly restore port visibility
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (sourceNodeId && sourcePortId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        sourceNode.setPortProp(sourcePortId, 'attrs/circle/style/visibility', 'visible');
        this.logger.info('FIXED: Ensured source port visibility after edge restoration', {
          edgeId: edge.id,
          sourceNodeId,
          sourcePortId,
        });
      }
    }

    if (targetNodeId && targetPortId) {
      const targetNode = graph.getCellById(targetNodeId);
      if (targetNode && targetNode.isNode()) {
        targetNode.setPortProp(targetPortId, 'attrs/circle/style/visibility', 'visible');
        this.logger.info('FIXED: Ensured target port visibility after edge restoration', {
          edgeId: edge.id,
          targetNodeId,
          targetPortId,
        });
      }
    }
  }

  /**
   * Create edge snapshot directly from X6 edge to capture port information
   * CRITICAL FIX: This ensures we capture the actual port connections from the X6 edge
   * @deprecated Use EdgeService.createEdgeSnapshot() instead
   */
  private _createEdgeSnapshotFromX6Edge(edge: Edge): X6EdgeSnapshot {
    const metadata = (edge as any).getMetadata ? (edge as any).getApplicationMetadata() : [];

    // CRITICAL FIX: Get source and target with port information directly from X6 edge
    const source = edge.getSource();
    const target = edge.getTarget();

    this.logger.info('FIXED: Creating edge snapshot from X6 edge with port information', {
      edgeId: edge.id,
      source,
      target,
      sourcePortId: edge.getSourcePortId(),
      targetPortId: edge.getTargetPortId(),
      hasSourcePort: !!(source as any)?.port,
      hasTargetPort: !!(target as any)?.port,
    });

    const snapshot: X6EdgeSnapshot = {
      id: edge.id,
      source,
      target,
      shape: edge.shape,
      attrs: edge.getAttrs(),
      vertices: edge.getVertices(),
      labels: edge.getLabels(),
      zIndex: edge.getZIndex() || 1,
      visible: edge.isVisible(),
      metadata,
    };

    // Cache the snapshot for future use
    this._edgeSnapshots.set(edge.id, snapshot);

    return snapshot;
  }

  /**
   * Ensure edge has proper attrs structure for visual rendering
   * CRITICAL FIX: EdgeData from domain model may have empty attrs, but X6 needs proper styling
   * @deprecated Use EdgeService.createEdge() which handles attrs properly
   */
  private _ensureEdgeAttrs(attrs: Edge.Properties['attrs']): Edge.Properties['attrs'] {
    // If attrs is empty or missing critical styling, provide defaults
    const hasWrapAttrs = attrs?.['wrap'] && typeof attrs['wrap'] === 'object';
    const hasLineAttrs = attrs?.['line'] && typeof attrs['line'] === 'object';

    if (!hasWrapAttrs || !hasLineAttrs) {
      this.logger.debugComponent('DFD', 'FIXED: Adding missing edge attrs for visual rendering', {
        hasWrapAttrs,
        hasLineAttrs,
        originalAttrs: attrs,
      });

      return {
        ...attrs,
        wrap: {
          connection: true,
          strokeWidth: 10,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          stroke: 'transparent',
          fill: 'none',
          ...(attrs?.['wrap'] || {}),
        },
        line: {
          connection: true,
          stroke: '#000000',
          strokeWidth: 2,
          fill: 'none',
          targetMarker: {
            name: 'classic',
            size: 8,
            fill: '#000000',
            stroke: '#000000',
          },
          ...(attrs?.['line'] || {}),
        },
      };
    }

    return attrs;
  }
}
