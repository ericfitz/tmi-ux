import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import '@antv/x6-plugin-export';
import { Selection } from '@antv/x6-plugin-selection';
import { Snapline } from '@antv/x6-plugin-snapline';
import { Transform } from '@antv/x6-plugin-transform';
import { History } from '@antv/x6-plugin-history';
import { v4 as uuidv4 } from 'uuid';

import { IGraphAdapter } from '../interfaces/graph-adapter.interface';
import { DiagramNode } from '../../domain/value-objects/diagram-node';
import { DiagramEdge } from '../../domain/value-objects/diagram-edge';
import { Point } from '../../domain/value-objects/point';
import { LoggerService } from '../../../../core/services/logger.service';
import { X6NodeSnapshot, X6EdgeSnapshot } from '../../types/x6-cell.types';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { EdgeQueryService } from '../services/edge-query.service';
import { NodeConfigurationService } from '../services/node-configuration.service';
import { EmbeddingService } from '../services/embedding.service';
import { PortStateManagerService } from '../services/port-state-manager.service';
import { X6KeyboardHandler } from './x6-keyboard-handler';
import { X6ZOrderAdapter } from './x6-z-order.adapter';
import { X6EmbeddingAdapter } from './x6-embedding.adapter';
import { X6PortManager } from './x6-port-manager';

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
  private static readonly NODE_TOOLS = [
    {
      name: 'button-remove',
      args: {
        x: '100%',
        y: 0,
        offset: { x: -10, y: 10 },
      },
    },
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

  private static readonly EDGE_TOOLS = [
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
        addable: true,
        removable: true,
        snapRadius: 10,
        threshold: 40,
        stopPropagation: false,
        useCellGeometry: true,
      },
    },
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
        tagName: 'circle',
        stopPropagation: false,
      },
    },
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
        tagName: 'circle',
        stopPropagation: false,
      },
    },
    {
      name: 'button-remove',
      args: {
        distance: 0.5,
        offset: { x: 10, y: -10 },
      },
    },
  ];

  private _graph: Graph | null = null;
  private readonly _destroy$ = new Subject<void>();
  private _isConnecting = false;
  private _selectedCells = new Set<string>();
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
    private readonly _portManager: X6PortManager,
  ) {
    // Initialize X6 cell extensions once when the adapter is created
    initializeX6CellExtensions();

    // Register custom shapes for DFD diagrams
    registerCustomShapes();
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
  get nodeDataChanged$(): Observable<{
    nodeId: string;
    newData: Record<string, unknown>;
    oldData: Record<string, unknown>;
  }> {
    return this._nodeDataChanged$.asObservable();
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

          // FIXED: Check for magnet="true" instead of magnet="active" to match port configuration
          const magnetAttr = magnet.getAttribute('magnet');
          const isValid = magnetAttr === 'true' || magnetAttr === 'active';
          this.logger.debugComponent('DFD', '[Edge Creation] validateMagnet result:', {
            magnetAttr,
            isValid,
          });
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
                    fontFamily: '"Roboto Condensed", Arial, sans-serif',
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

    // Setup port visibility using dedicated port manager
    this._portManager.setupPortVisibility(this._graph);
    this._portManager.setupPortTooltips(this._graph);

    // Setup keyboard handling using dedicated handler
    this._keyboardHandler.setupKeyboardHandling(this._graph);

    // Initialize embedding functionality using dedicated adapter
    this._embeddingAdapter.initializeEmbedding(this._graph);
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
    const nodeType = node.data.shape;

    // Validate that shape property is set correctly
    this._validateNodeShape(nodeType, node.id);

    // Use NodeConfigurationService for node configuration (except z-index)
    const nodeAttrs = this._nodeConfigurationService.getNodeAttrs(nodeType);
    const nodePorts = this._nodeConfigurationService.getNodePorts(nodeType);
    const nodeShape = this._nodeConfigurationService.getNodeShape(nodeType);

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
      zIndex: 1, // Temporary z-index, will be set properly below
    });

    // Validate that the X6 node was created with the correct shape
    this._validateX6NodeShape(x6Node);

    // Set metadata using X6 cell extensions
    (x6Node as any).setApplicationMetadata('type', nodeType);
    (x6Node as any).setApplicationMetadata('domainNodeId', node.id);
    (x6Node as any).setApplicationMetadata('width', String(node.data.width || 120));
    (x6Node as any).setApplicationMetadata('height', String(node.data.height || 60));
    (x6Node as any).setApplicationMetadata('label', node.data.label || '');

    // Apply proper z-index using ZOrderService after node creation
    this._zOrderAdapter.applyNodeCreationZIndex(graph, x6Node);

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
      // If snapshot ports is an array, reconstruct the complete structure
      const nodeType = snapshot.data?.find((m: any) => m.key === 'type')?.value || 'process';
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
      const nodeType = snapshot.data?.find((m: any) => m.key === 'type')?.value || 'process';
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
    if (snapshot.data) {
      snapshot.data.forEach((entry: any) => {
        if ((x6Node as any).setApplicationMetadata) {
          (x6Node as any).setApplicationMetadata(entry.key, entry.value);
        }
      });
    }

    //  Log final restoration status
    this.logger.info(' Node restoration completed', {
      nodeId: snapshot.id,
      nodeCreated: !!x6Node,
      metadataSet: !!(snapshot.data && (x6Node as any).setApplicationMetadata),
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
   * Uses X6's native edge operations directly
   */
  addEdge(edgeInput: DiagramEdge | X6EdgeSnapshot): Edge {
    const graph = this.getGraph();

    // Determine if input is EdgeData or X6EdgeSnapshot
    const isSnapshot = 'source' in edgeInput && typeof edgeInput.source === 'object';
    const snapshot = isSnapshot ? edgeInput : (edgeInput as DiagramEdge).data.toX6Snapshot();

    const edgeParams = {
      id: snapshot.id,
      source: snapshot.source,
      target: snapshot.target,
      shape: snapshot.shape,
      markup: this._getEdgeMarkup(),
      attrs: snapshot.attrs,
      labels: snapshot.labels,
      vertices: snapshot.vertices,
      zIndex: snapshot.zIndex,
      visible: snapshot.visible,
    };

    const x6Edge = graph.addEdge(edgeParams);

    // Set metadata using X6 cell extensions
    if (snapshot.data && (x6Edge as any).setApplicationMetadata) {
      snapshot.data.forEach((entry: any) => {
        (x6Edge as any).setApplicationMetadata(entry.key, entry.value);
      });
    }

    // Update port visibility after edge creation
    this._updatePortVisibilityAfterEdgeCreation(x6Edge);

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

      // Then update port visibility for affected nodes
      if (sourceNodeId) {
        const sourceNode = graph.getCellById(sourceNodeId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          this._portManager.updateNodePortVisibility(graph, sourceNode);
        }
      }

      if (targetNodeId) {
        const targetNode = graph.getCellById(targetNodeId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._portManager.updateNodePortVisibility(graph, targetNode);
        }
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
   * Undo the last action using X6 history plugin
   */
  undo(): void {
    const graph = this.getGraph();
    if (graph && typeof graph.undo === 'function') {
      graph.undo();
      this.logger.info('Undo action performed');
      this._emitHistoryStateChange();
    } else {
      this.logger.warn('Undo not available - history plugin may not be enabled');
    }
  }

  /**
   * Redo the last undone action using X6 history plugin
   */
  redo(): void {
    const graph = this.getGraph();
    if (graph && typeof graph.redo === 'function') {
      graph.redo();
      this.logger.info('Redo action performed');
      this._emitHistoryStateChange();
    } else {
      this.logger.warn('Redo not available - history plugin may not be enabled');
    }
  }

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    const graph = this.getGraph();
    if (graph && typeof graph.canUndo === 'function') {
      return graph.canUndo();
    }
    return false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    const graph = this.getGraph();
    if (graph && typeof graph.canRedo === 'function') {
      return graph.canRedo();
    }
    return false;
  }

  /**
   * Clear the history stack
   */
  clearHistory(): void {
    const graph = this.getGraph();
    if (graph && typeof graph.cleanHistory === 'function') {
      graph.cleanHistory();
      this.logger.info('History cleared');
      this._emitHistoryStateChange();
    } else {
      this.logger.warn('Clear history not available - history plugin may not be enabled');
    }
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

    // Use X6 cell extensions for unified label handling
    if ((cell as any).setUnifiedLabel) {
      (cell as any).setUnifiedLabel(text);
    }

    // Trigger cell:change:data event for history integration
    // This ensures that label changes flow through the normal event chain
    // and are captured by the history system via nodeDataChanged$
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

      // Emit immediate event for text changes since text editing
      // only updates when editing is complete - no need for debouncing
      this._nodeDataChanged$.next({
        nodeId: cell.id,
        newData,
        oldData,
      });
    }
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
        this.logger.debug('node:change:position event fired (raw)', {
          nodeId: node.id,
          current,
          previous,
        }); // Raw log
        this.logger.debugComponent('DFD', 'node:change:position event fired', {
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
          this._nodeDataChanged$.next({
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

      // Set connecting state and show all ports using port manager
      this._isConnecting = true;
      this._portManager.showAllPorts(this._graph!);
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
        // Set edge z-order to the higher of source or target node z-orders
        this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

        // CRITICAL FIX: Add a small delay to ensure X6 has fully established the connection
        // before capturing the port information - may need to revisit this implementation for reliability
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

          // Update port visibility after connection using port manager
          this._portManager.hideUnconnectedPorts(this._graph!);
          this._portManager.ensureConnectedPortsVisible(this._graph!, edge);

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

      // Reset connecting state and update port visibility using port manager
      this._isConnecting = false;
      this._portManager.hideUnconnectedPorts(this._graph!);
    });

    // Note: Embedding event handlers are now managed by X6EmbeddingAdapter
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

      // Update port visibility for the source and target nodes using port manager
      const sourceCellId = edge.getSourceCellId();
      const targetCellId = edge.getTargetCellId();

      if (sourceCellId) {
        const sourceNode = this._graph!.getCellById(sourceCellId) as Node;
        if (sourceNode && sourceNode.isNode()) {
          this._portManager.updateNodePortVisibility(this._graph!, sourceNode);
        }
      }

      if (targetCellId) {
        const targetNode = this._graph!.getCellById(targetCellId) as Node;
        if (targetNode && targetNode.isNode()) {
          this._portManager.updateNodePortVisibility(this._graph!, targetNode);
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
            if (nodeType === 'text-box') {
              // For text-box shapes, apply glow to text element since body is transparent
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
            if (nodeType === 'text-box') {
              // For text-box shapes, remove glow from text element
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

      // Enable history plugin
      this._graph.use(
        new History({
          stackSize: 10,
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
          if (nodeType === 'text-box') {
            // For text-box shapes, apply hover glow to text element since body is transparent
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
          if (nodeType === 'text-box') {
            // For text-box shapes, remove hover glow from text element
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

  // Note: Embedding helper methods have been migrated to EmbeddingService and X6EmbeddingAdapter
  // - _getEmbeddingDepth() → EmbeddingService.calculateEmbeddingDepth()
  // - _getEmbeddingFillColor() → EmbeddingService.calculateEmbeddingFillColor()
  // - _updateEmbeddedNodeColor() → X6EmbeddingAdapter.updateEmbeddingAppearance()

  /**
   * Add tools to a selected node using X6's native tool system
   */
  private _addNodeTools(node: Node): void {
    if (!this._graph) return;

    // Clone tools and add delete handler to button-remove
    const tools = X6GraphAdapter.NODE_TOOLS.map(tool => {
      if (tool.name === 'button-remove') {
        return {
          ...tool,
          args: {
            ...tool.args,
            onClick: ({ cell }: { cell: Cell }) => this._handleCellDeletion(cell),
          },
        };
      }
      return tool;
    });

    node.addTools(tools);
  }

  /**
   * Add tools to a selected edge using X6's native tool system
   */
  private _addEdgeTools(edge: Edge): void {
    if (!this._graph) return;

    // Clone tools and add delete handler to button-remove
    const tools = X6GraphAdapter.EDGE_TOOLS.map(tool => {
      if (tool.name === 'button-remove') {
        return {
          ...tool,
          args: {
            ...tool.args,
            onClick: ({ cell }: { cell: Cell }) => this._handleCellDeletion(cell),
          },
        };
      }
      return tool;
    });

    edge.addTools(tools);

    // Set up change tracking for domain model updates
    this._setupVertexChangeTracking(edge);
    this._setupEdgeConnectionChangeTracking(edge);
  }

  /**
   * Centralized cell deletion handler - simplified without command pattern
   */
  private _handleCellDeletion(cell: Cell): void {
    const cellType = cell.isNode() ? 'node' : 'edge';
    this.logger.info(`Delete tool clicked for ${cellType}`, { cellId: cell.id });

    // Direct removal without command pattern
    if (this._graph) {
      this._graph.removeCell(cell);
      this.logger.info(`${cellType} removed directly from graph`, {
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
        this.logger.info('Edge vertices changed', {
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

        // Update port visibility for old and new source nodes using port manager
        this._portManager.onConnectionChange(this._graph!);
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

        // Update port visibility for old and new target nodes using port manager
        this._portManager.onConnectionChange(this._graph!);
      }
    };

    // Add the event listeners
    this._graph.on('edge:change:source', sourceChangeHandler);
    this._graph.on('edge:change:target', targetChangeHandler);

    // Note: Event handlers are managed by X6 graph event system
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
   * Update port visibility for connected nodes after edge creation
   */
  private _updatePortVisibilityAfterEdgeCreation(edge: Edge): void {
    const graph = this.getGraph();

    // Set edge z-order to the higher of source or target node z-orders
    this._zOrderAdapter.setEdgeZOrderFromConnectedNodes(this._graph!, edge);

    // Use port manager for port visibility updates
    this._portManager.ensureConnectedPortsVisible(graph, edge);

    // Update port visibility for connected nodes using port manager
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (sourceNodeId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        this._portManager.updateNodePortVisibility(graph, sourceNode);
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
        this._portManager.updateNodePortVisibility(graph, targetNode);
        this.logger.info('Updated target node port visibility after edge creation', {
          edgeId: edge.id,
          targetNodeId,
          targetPortId: edge.getTargetPortId(),
        });
      }
    }
  }

  /**
   * Emit history state change event
   */
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
   * Create edge snapshot from X6 edge with proper port information
   */
  private _createEdgeSnapshot(edge: Edge): X6EdgeSnapshot {
    // Get metadata using X6 cell extensions
    const metadata = (edge as any).getApplicationMetadata
      ? (edge as any).getApplicationMetadata()
      : {};
    const metadataArray = Object.entries(metadata).map(([key, value]) => ({
      key,
      value: String(value),
    }));

    return {
      id: edge.id,
      source: edge.getSource(),
      target: edge.getTarget(),
      shape: edge.shape,
      attrs: edge.getAttrs(),
      vertices: edge.getVertices(),
      labels: edge.getLabels(),
      zIndex: edge.getZIndex() || 1,
      visible: edge.isVisible(),
      data: metadataArray,
    };
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
      this.logger.debug('History state changed', { canUndo, canRedo });

      // Update previous state tracking
      this._previousCanUndo = canUndo;
      this._previousCanRedo = canRedo;
    }
  }

  /**
   * Validate that a node shape is properly set and is a valid shape type
   */
  private _validateNodeShape(nodeType: string, nodeId: string): void {
    if (!nodeType || typeof nodeType !== 'string') {
      const error = `Invalid node shape: shape property must be a non-empty string. Node ID: ${nodeId}, shape: ${nodeType}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Validate against known shape types
    const validShapes = ['process', 'store', 'external-entity', 'text-box'];
    if (!validShapes.includes(nodeType)) {
      const error = `Invalid node shape: '${nodeType}' is not a recognized shape type. Valid shapes: ${validShapes.join(', ')}. Node ID: ${nodeId}`;
      this.logger.error(error);
      throw new Error(error);
    }

    this.logger.debugComponent('DFD', 'Node shape validation passed', {
      nodeId,
      nodeType,
      validShapes,
    });
  }

  /**
   * Validate that an X6 node was created with the correct shape property
   */
  private _validateX6NodeShape(x6Node: Node): void {
    const nodeShape = x6Node.shape;
    const nodeId = x6Node.id;

    if (!nodeShape || typeof nodeShape !== 'string') {
      const error = `X6 node created without valid shape property. Node ID: ${nodeId}, shape: ${nodeShape}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Ensure the shape property matches what we expect
    const validShapes = ['process', 'store', 'external-entity', 'text-box'];
    if (!validShapes.includes(nodeShape)) {
      const error = `X6 node created with invalid shape: '${nodeShape}'. Valid shapes: ${validShapes.join(', ')}. Node ID: ${nodeId}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Verify that no data.type property exists (should only use shape)
    const nodeData = x6Node.getData();
    if (nodeData && 'type' in nodeData) {
      const warning = `X6 node has data.type property. Only shape property should be used for type determination. Node ID: ${nodeId}, data.type: ${nodeData.type}, shape: ${nodeShape}`;
      this.logger.warn(warning);
      // Don't throw error, just warn since this might be from existing data
    }

    this.logger.debugComponent('DFD', 'X6 node shape validation passed', {
      nodeId,
      nodeShape,
      hasDataType: nodeData && 'type' in nodeData,
    });
  }
}
