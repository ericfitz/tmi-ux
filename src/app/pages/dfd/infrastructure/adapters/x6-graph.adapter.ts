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
import { DiagramCommandFactory } from '../../domain/commands/diagram-commands';
import { ICommandBus } from '../../application/interfaces/command-bus.interface';
import { X6NodeSnapshot, X6EdgeSnapshot } from '../../types/x6-cell.types';
import { initializeX6CellExtensions } from '../../utils/x6-cell-extensions';
import { EdgeQueryService } from '../services/edge-query.service';
import { NodeConfigurationService } from '../services/node-configuration.service';
import { X6KeyboardHandler } from './x6-keyboard-handler';

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

  // Context for command pattern operations
  private _diagramId: string | null = null;
  private _userId: string | null = null;
  private _commandBus: ICommandBus | null = null;

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
    private readonly _keyboardHandler: X6KeyboardHandler,
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

    // Setup keyboard handling using dedicated handler
    this._keyboardHandler.setupKeyboardHandling(this._graph);
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

    //  Log final restoration status
    this.logger.info(' Node restoration completed', {
      nodeId: snapshot.id,
      nodeCreated: !!x6Node,
      metadataSet: !!(snapshot.metadata && (x6Node as any).setApplicationMetadata),
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
    if (snapshot.metadata && (x6Edge as any).setApplicationMetadata) {
      snapshot.metadata.forEach((entry: any) => {
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
      // Update port visibility before removing edge
      this._updatePortVisibilityBeforeEdgeRemoval(edge);
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

    // Use X6 cell extensions for unified label handling
    if ((cell as any).setUnifiedLabel) {
      (cell as any).setUnifiedLabel(text);
    }

    // CRITICAL FIX: Trigger cell:change:data event for history integration
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

      // CRITICAL FIX: Emit immediate event for text changes since text editing
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
   * Set the context for command pattern operations (diagram ID, user ID, and command bus)
   */
  setCommandContext(diagramId: string, userId: string, commandBus: ICommandBus): void {
    this._diagramId = diagramId;
    this._userId = userId;
    this._commandBus = commandBus;
    this.logger.info('Command context set for X6 adapter', {
      diagramId,
      userId,
    });
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

          // Drag state tracking removed - using simpler approach with initial positions

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

      // Set connecting state and show all ports (consolidated from port visibility setup)
      this._isConnecting = true;
      this._showAllPorts();
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

          // Update port visibility after connection (consolidated functionality)
          this._hideUnconnectedPorts();
          this._ensureConnectedPortsVisible(edge);

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

      // Reset connecting state and update port visibility (consolidated from port visibility setup)
      this._isConnecting = false;
      this._hideUnconnectedPorts();
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

    // History events for undo/redo state tracking
    this._graph.on('history:undo', () => {
      this.logger.info('History undo event fired');
      this._emitHistoryStateChange();
    });

    this._graph.on('history:redo', () => {
      this.logger.info('History redo event fired');
      this._emitHistoryStateChange();
    });

    this._graph.on('history:change', () => {
      this.logger.debug('History change event fired');
      this._emitHistoryStateChange();
    });

    this._graph.on('history:clear', () => {
      this.logger.info('History clear event fired');
      this._emitHistoryStateChange();
    });
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

    // Also listen for mouse down on magnets to show ports
    this._graph.on('node:magnet:mousedown', () => {
      this._isConnecting = true;
      this._showAllPorts();
    });

    // Handle mouse up to stop connecting if no valid connection was made
    this._graph.on('blank:mouseup', () => {
      if (this._isConnecting) {
        this._isConnecting = false;
        this._hideUnconnectedPorts();
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
   * Centralized cell deletion handler using command pattern
   */
  private _handleCellDeletion(cell: Cell): void {
    const cellType = cell.isNode() ? 'node' : 'edge';
    this.logger.info(`Delete tool clicked for ${cellType}`, { cellId: cell.id });

    if (this._diagramId && this._userId && this._commandBus) {
      this.logger.info(`Using command pattern for ${cellType} deletion`, {
        cellId: cell.id,
        cellType,
        diagramId: this._diagramId,
        userId: this._userId,
      });

      const command = cell.isNode()
        ? DiagramCommandFactory.removeNode(this._diagramId, this._userId, cell.id, true)
        : DiagramCommandFactory.removeEdge(this._diagramId, this._userId, cell.id, true);

      this._commandBus.execute(command).subscribe({
        next: () => {
          this.logger.info(`${cellType} deletion command executed successfully`, {
            cellId: cell.id,
          });
        },
        error: (error: unknown) => {
          this.logger.error(`Failed to execute ${cellType} deletion command`, {
            cellId: cell.id,
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

        // Update port visibility for old and new source nodes
        this._updateAllNodePortVisibility();
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
        this._updateAllNodePortVisibility();
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
      // CRITICAL FIX: Create edge snapshot directly from X6 edge to capture port information
      // This ensures we get the actual port connections that were just established
      const edgeSnapshot = this._createEdgeSnapshot(edge);

      this.logger.info('FIXED: Creating simplified command for edge creation', {
        edgeId: edge.id,
        sourceId,
        targetId,
        edgeSource: edgeSnapshot.source,
        edgeTarget: edgeSnapshot.target,
        sourcePortId: edge.getSourcePortId(),
        targetPortId: edge.getTargetPortId(),
      });

      // Create simplified command that relies on X6's native history for undo/redo
      const command = DiagramCommandFactory.addEdge(
        this._diagramId,
        this._userId,
        edge.id,
        sourceId,
        targetId,
        edgeSnapshot,
        true, // isLocalUserInitiated = true for user-created edges
      );

      // Execute the command
      this._commandBus.execute(command).subscribe({
        next: () => {
          this.logger.info('FIXED: Edge creation command executed successfully', {
            edgeId: edge.id,
            commandId: command.commandId,
          });

          // CRITICAL FIX: Do NOT emit edgeAdded$ here - the command already handles
          // the domain model update. Emitting here would cause duplicate edge creation.
          this.logger.debugComponent(
            'DFD',
            '[Edge Creation] Command completed - domain model already updated',
          );
        },
        error: (error: unknown) => {
          this.logger.error('FIXED: Failed to execute edge creation command', {
            edgeId: edge.id,
            error,
          });

          // CRITICAL FIX: On command failure, remove the edge from X6 graph
          // since the domain model update failed
          this.logger.warn('FIXED: Removing edge from X6 graph due to command failure');
          if (this._graph && this._graph.getCellById(edge.id)) {
            this._graph.removeCell(edge);
          }
        },
      });
    } catch (error) {
      this.logger.error('FIXED: Error creating command for edge creation', {
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

    // Set edge z-order to the higher of source or target node z-orders
    this._setEdgeZOrderFromConnectedNodes(edge);

    // CRITICAL FIX: Ensure connected ports are visible after edge restoration
    // This is essential for undo/redo operations where edges are restored from snapshots
    this._ensureConnectedPortsVisible(edge);

    // Update port visibility for connected nodes
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (sourceNodeId) {
      const sourceNode = graph.getCellById(sourceNodeId);
      if (sourceNode && sourceNode.isNode()) {
        this._updateNodePortVisibility(sourceNode);
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
        this._updateNodePortVisibility(targetNode);
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
   * Update port visibility before edge removal
   */
  private _updatePortVisibilityBeforeEdgeRemoval(edge: Edge): void {
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    // Update port visibility for source and target nodes
    if (sourceNodeId && sourcePortId) {
      const sourceNode = this._graph!.getCellById(sourceNodeId) as Node;
      if (sourceNode && sourceNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(sourceNode, sourcePortId, edge);
      }
    }

    if (targetNodeId && targetPortId) {
      const targetNode = this._graph!.getCellById(targetNodeId) as Node;
      if (targetNode && targetNode.isNode()) {
        this._updateNodePortVisibilityAfterEdgeRemoval(targetNode, targetPortId, edge);
      }
    }
  }

  /**
   * Update port visibility for a specific node and port after edge removal
   */
  private _updateNodePortVisibilityAfterEdgeRemoval(
    node: Node,
    portId: string,
    edgeToRemove: Edge,
  ): void {
    // Check if this port will still be connected to any other edges after removing the specified edge
    const edges = this._graph!.getEdges();
    const willStillBeConnected = edges.some((edge: Edge) => {
      // Skip the edge we're about to remove
      if (edge.id === edgeToRemove.id) {
        return false;
      }

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

    // Set port visibility based on whether it will still be connected
    const visibility = willStillBeConnected ? 'visible' : 'hidden';
    node.setPortProp(portId, 'attrs/circle/style/visibility', visibility);
  }

  /**
   * Update port visibility for all nodes based on connection status
   */
  private _updateAllNodePortVisibility(): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    nodes.forEach(node => {
      this._updateNodePortVisibility(node);
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
   * Check if a specific port is connected to any edge
   */
  private _isPortConnected(node: Node, portId: string): boolean {
    if (!this._graph) return false;
    return this._edgeQueryService.isPortConnected(this._graph, node.id, portId);
  }

  /**
   * Show all ports on all nodes (used during edge creation)
   */
  private _showAllPorts(): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    nodes.forEach(node => {
      const ports = node.getPorts();
      ports.forEach(port => {
        node.setPortProp(port.id!, 'attrs/circle/style/visibility', 'visible');
      });
    });
  }

  /**
   * Hide only unconnected ports on all nodes
   */
  private _hideUnconnectedPorts(): void {
    if (!this._graph) return;

    const nodes = this._graph.getNodes();
    nodes.forEach(node => {
      this._updateNodePortVisibility(node);
    });
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
      metadata: metadataArray,
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
}
