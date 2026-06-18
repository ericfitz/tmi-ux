/**
 * DFD Infrastructure Facade
 *
 * This facade encapsulates all the infrastructure services and adapters needed
 * for DFD operations, providing a simplified interface for high-level components.
 *
 * Key benefits:
 * - Hides complex infrastructure dependencies from components
 * - Provides a single point of access for DFD operations
 * - Simplifies dependency injection and testing
 * - Encapsulates the orchestration between different infrastructure layers
 *
 * This facade manages:
 * - Node creation, deletion, and manipulation operations
 * - X6 graph adapter and core operations
 * - Visual effects and z-order management
 * - History coordination and collaborative broadcasting
 * - Port configuration and embedding services
 */

import { Injectable } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { Cell } from '@antv/x6';
import { tap, map } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { NodeType } from '../../domain/value-objects/node-info';

// Infrastructure services
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { InfraX6ZOrderAdapter } from '../../infrastructure/adapters/infra-x6-z-order.adapter';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { AppEdgeService } from '../services/app-edge.service';
import { AppExportService } from '../services/app-export.service';
import { AppStateService } from '../services/app-state.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraVisualEffectsService } from '../../infrastructure/services/infra-visual-effects.service';
import { InfraX6CoreOperationsService } from '../../infrastructure/services/infra-x6-core-operations.service';
import { AppOperationStateManager } from '../services/app-operation-state-manager.service';
import { InfraEmbeddingService } from '../../infrastructure/services/infra-embedding.service';
import { AppGraphOperationManager } from '../services/app-graph-operation-manager.service';
import {
  CreateNodeOperation,
  DeleteEdgeOperation,
  OperationContext,
  NodeData,
} from '../../types/graph-operation.types';

/**
 * Facade for DFD infrastructure services
 * Provides simplified, high-level operations while managing complex dependencies internally
 */
@Injectable()
// SEM@e7dd6955882ba4be469447e879cf0576655cd710: coordinate DFD graph operations by delegating to domain services and adapters (mutates shared state)
export class AppDfdFacade {
  // SEM@b9478a782fe203a4c5d4c0b9c744a0fb140c1b68: inject all collaborating services required by the DFD facade (mutates shared state)
  constructor(
    private readonly logger: LoggerService,
    private readonly infraX6GraphAdapter: InfraX6GraphAdapter,
    private readonly infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private readonly infraNodeService: InfraNodeService,
    private readonly appEdgeService: AppEdgeService,
    private readonly appExportService: AppExportService,
    private readonly infraNodeConfigurationService: InfraNodeConfigurationService,
    private readonly infraVisualEffectsService: InfraVisualEffectsService,
    private readonly infraX6CoreOperationsService: InfraX6CoreOperationsService,
    private readonly historyCoordinator: AppOperationStateManager,
    private readonly infraEmbeddingService: InfraEmbeddingService,
    private readonly graphOperationManager: AppGraphOperationManager,
    private readonly appStateService: AppStateService,
  ) {
    // this.logger.debugComponent('AppDfdFacade', 'AppDfdFacade initialized');
  }

  // ========================================
  // Infrastructure Management
  // ========================================

  /**
   * Initialize the graph adapter with the provided graph instance
   * This must be called before any graph operations can be performed
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: initialize the graph adapter with a container element before any graph operations (mutates shared state)
  initializeGraphAdapter(containerElement: HTMLElement): void {
    this.logger.debugComponent('AppDfdFacade', 'Initializing graph adapter');
    this.infraX6GraphAdapter.initialize(containerElement);

    // Inject node service into selection adapter to avoid circular dependency
    this.infraX6GraphAdapter.injectNodeService(this.infraNodeService);
  }

  /**
   * Set the graph instance on the adapter (for orchestrator-created graphs)
   * This allows the orchestrator to create the graph and pass it to the infrastructure
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: assign an externally created graph instance to the infrastructure adapter (mutates shared state)
  setGraphOnAdapter(graph: any): void {
    this.logger.debugComponent('AppDfdFacade', 'Setting graph instance on adapter');
    this.infraX6GraphAdapter.setGraph(graph);
  }

  // ========================================
  // Node Operations
  // ========================================

  /**
   * Create a node using intelligent positioning algorithm
   */
  // SEM@45bebd666a6507589bf129e5a99c6d8232350abd: add a graph node using auto-positioning and return its id and instance (mutates shared state)
  createNodeWithIntelligentPositioning(
    nodeType: NodeType,
    isInitialized: boolean,
  ): Observable<{ nodeId: string; node: any }> {
    return this.infraNodeService.addGraphNode(nodeType, isInitialized);
  }

  /**
   * Create a node at a specific position
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: add a graph node at an explicit position (mutates shared state)
  createNodeAtPosition(nodeType: NodeType, position: { x: number; y: number }): Observable<void> {
    // Use the InfraNodeService's createNode method directly
    return (this.infraNodeService as any).createNode(nodeType, position);
  }

  /**
   * Handle drag completion for node movement, resizing, or edge vertices
   * Creates UpdateNodeOperation or UpdateEdgeOperation to record final state in history
   */
  // SEM@0c87215b5a30edd1c4d7c3f00e626588ff9ef4a1: dispatch move, resize, or vertex drag completion to the appropriate history operation (mutates shared state)
  handleDragCompletion(
    completion: {
      cellId: string;
      dragType: 'move' | 'resize' | 'vertex';
      initialState: any;
      finalState: any;
    },
    diagramId: string,
  ): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    const { cellId, dragType, initialState } = completion;
    const cell = graph.getCellById(cellId);

    if (!cell) {
      this.logger.warn('Drag completion for non-existent cell', { cellId });
      return of(undefined);
    }

    // Handle node operations
    if (cell.isNode()) {
      if (dragType === 'move') {
        return this._handleNodeMove(cell, initialState, graph, diagramId);
      } else if (dragType === 'resize') {
        return this._handleNodeResize(cell, initialState, graph, diagramId);
      }
    }

    // Handle edge operations
    if (cell.isEdge()) {
      if (dragType === 'vertex') {
        return this._handleEdgeVerticesDrag(cell, initialState, graph, diagramId);
      }
    }

    return of(undefined);
  }

  /**
   * Handle node movement completion
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: record a node position change as an update operation in history, skip if unchanged (mutates shared state)
  private _handleNodeMove(
    node: any,
    initialState: any,
    graph: any,
    diagramId: string,
  ): Observable<void> {
    const finalPosition = node.getPosition();
    const initialPosition = initialState?.position;

    // Skip if position hasn't actually changed
    if (
      initialPosition &&
      initialPosition.x === finalPosition.x &&
      initialPosition.y === finalPosition.y
    ) {
      this.logger.debugComponent('AppDfdFacade', 'Skipping node move - no position change', {
        nodeId: node.id,
      });
      return of(undefined);
    }

    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateNodeOperation for node move', {
      nodeId: node.id,
      initialPosition,
      finalPosition,
    });

    // Create UpdateNodeOperation for position change
    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeId: node.id,
      updates: {
        position: { x: finalPosition.x, y: finalPosition.y },
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record node move in history', {
            nodeId: node.id,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Node move recorded in history', {
            nodeId: node.id,
          });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle node resize completion
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: record a node size change as an update operation in history, skip if unchanged (mutates shared state)
  private _handleNodeResize(
    node: any,
    initialState: any,
    graph: any,
    diagramId: string,
  ): Observable<void> {
    const finalSize = node.getSize();
    const initialSize = initialState?.size;

    // Skip if size hasn't actually changed
    if (
      initialSize &&
      initialSize.width === finalSize.width &&
      initialSize.height === finalSize.height
    ) {
      this.logger.debugComponent('AppDfdFacade', 'Skipping node resize - no size change', {
        nodeId: node.id,
      });
      return of(undefined);
    }

    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateNodeOperation for node resize', {
      nodeId: node.id,
      initialSize,
      finalSize,
    });

    // Create UpdateNodeOperation for size change
    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeId: node.id,
      updates: {
        size: { width: finalSize.width, height: finalSize.height },
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record node resize in history', {
            nodeId: node.id,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Node resize recorded in history', {
            nodeId: node.id,
          });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle edge vertices drag completion
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: record an edge vertices change as an update operation in history, skip if unchanged (mutates shared state)
  private _handleEdgeVerticesDrag(
    edge: any,
    initialState: any,
    graph: any,
    diagramId: string,
  ): Observable<void> {
    const finalVertices = edge.getVertices();
    const initialVertices = initialState?.vertices;

    // Skip if vertices haven't actually changed
    if (initialVertices && this._verticesEqual(initialVertices, finalVertices)) {
      this.logger.debugComponent(
        'AppDfdFacade',
        'Skipping edge vertices drag - no vertices change',
        { edgeId: edge.id },
      );
      return of(undefined);
    }

    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateEdgeOperation for vertices drag', {
      edgeId: edge.id,
      initialVertices,
      finalVertices,
    });

    // Create UpdateEdgeOperation for vertices change
    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId: edge.id,
      updates: {
        vertices: finalVertices,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record edge vertices drag in history', {
            edgeId: edge.id,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Edge vertices drag recorded in history', {
            edgeId: edge.id,
          });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Helper to compare vertices arrays for equality
   */
  // SEM@141c5177a23d03d5e9457daee40e8526092d1e5f: compare two vertex arrays for positional equality (pure)
  private _verticesEqual(
    v1: Array<{ x: number; y: number }>,
    v2: Array<{ x: number; y: number }>,
  ): boolean {
    if (!v1 || !v2 || v1.length !== v2.length) {
      return false;
    }
    return v1.every((vertex, index) => {
      const v2Vertex = v2[index];
      return vertex.x === v2Vertex.x && vertex.y === v2Vertex.y;
    });
  }

  /**
   * Handle node added to the graph (validation and history tracking)
   * Similar pattern to edge creation - creates retroactive GraphOperation
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: retroactively register a newly added node in operation history, skipping undo/redo or remote sync (mutates shared state)
  handleNodeAdded(node: any, diagramId: string, isInitialized: boolean): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle node added: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Skip if we're applying undo/redo - the operation is already in history
    const state = this.appStateService.getCurrentState();
    if (state.isApplyingUndoRedo) {
      this.logger.debugComponent('AppDfdFacade', 'Skipping handleNodeAdded - applying undo/redo', {
        nodeId: node.id,
      });
      return of(undefined);
    }

    // Skip if we're applying remote changes (diagram sync/load) - don't create history
    if (state.isApplyingRemoteChange) {
      this.logger.debugComponent(
        'AppDfdFacade',
        'Skipping handleNodeAdded - applying remote change',
        {
          nodeId: node.id,
        },
      );
      return of(undefined);
    }

    const graph = this.infraX6GraphAdapter.getGraph();
    const nodeId = node.id;

    this.logger.info('Node validated successfully, creating GraphOperation for history', {
      nodeId,
      shape: node.shape,
      position: node.getPosition(),
    });

    // Create NodeData from the existing node for the operation
    const position = node.getPosition();
    const size = node.getSize();
    const nodeData: NodeData = {
      id: nodeId,
      nodeType: node.shape as string,
      position: { x: position.x, y: position.y },
      size: { width: size.width, height: size.height },
      label: node.getAttrByPath('label/text') || '',
      style: node.getAttrs(),
      properties: {
        zIndex: node.getZIndex(),
        _metadata: node.getData()?._metadata || [],
        parent: node.getParent()?.id,
      },
    };

    // Create a CreateNodeOperation to record in history
    const operation: CreateNodeOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'create-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeData,
      includeInHistory: true,
      metadata: {
        retroactive: true, // Flag to indicate node already exists
      },
    };

    // Create minimal operation context with required fields
    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '', // Will be populated by persistence layer if needed
      providerId: '', // Will be populated by auth service if needed
      isCollaborating: false,
      permissions: [],
    };

    // Execute the operation to record in history
    // The executor will detect the node already exists and just capture state
    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record node creation in history', {
            nodeId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Node creation recorded in history', {
            nodeId,
          });
        }
      }),
      // Map to void to match return type
      map(() => undefined),
    );
  }

  // ========================================
  // Edge Operations
  // ========================================

  /**
   * Handle edge added to the graph (validation and setup)
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: delegate edge-added validation and setup to the edge service (mutates shared state)
  handleEdgeAdded(edge: any, diagramId: string, isInitialized: boolean): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    return this.appEdgeService.handleEdgeAdded(edge, graph, diagramId, isInitialized);
  }

  /**
   * Handle edge vertices changed
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: delegate edge vertex change recording to the edge service (mutates shared state)
  handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    return this.appEdgeService.handleEdgeVerticesChanged(
      edgeId,
      vertices,
      graph,
      diagramId,
      isInitialized,
    );
  }

  /**
   * Add an inverse connection for the specified edge
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: register a reverse edge for an existing diagram connection (mutates shared state)
  addInverseConnection(edge: any, diagramId: string): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    return this.appEdgeService.addInverseConnection(edge, graph, diagramId);
  }

  /**
   * Validate if a connection is allowed between nodes
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: validate whether a connection between two nodes is permitted (pure)
  validateConnection(sourceNode: any, targetNode: any): boolean {
    return this.appEdgeService.validateConnection(sourceNode, targetNode);
  }

  /**
   * Check if a magnet is valid for connections
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: validate whether a port magnet may accept a new connection (pure)
  isMagnetValid(magnet: Element): boolean {
    return this.appEdgeService.isMagnetValid({ magnet });
  }

  /**
   * Check if a connection between ports is valid
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: validate whether a port-to-port edge connection is permitted by DFD rules (pure)
  isConnectionValid(
    sourceView: any,
    targetView: any,
    sourceMagnet: Element,
    targetMagnet: Element,
  ): boolean {
    return this.appEdgeService.isConnectionValid({
      sourceView,
      targetView,
      sourceMagnet,
      targetMagnet,
    });
  }

  /**
   * Check if node connection is valid based on DFD rules
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: validate whether a node-to-node edge is allowed by DFD rules (pure)
  isNodeConnectionValid(sourceNode: any, targetNode: any): boolean {
    return this.appEdgeService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Validate embedding operation based on DFD rules
   */
  // SEM@a5ca78d7784b249979df24c1ed89b792ca838765: validate whether a child node may be embedded in a parent node (pure)
  validateEmbedding(parent: any, child: any): boolean {
    const result = this.infraEmbeddingService.validateEmbedding(parent, child);
    return result.isValid;
  }

  /**
   * Update edge label
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: update the text label on a diagram edge (mutates shared state)
  updateEdgeLabel(edge: any, label: string): void {
    this.appEdgeService.updateEdgeLabel(edge, label);
  }

  /**
   * Remove edge label
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: delete the text label from a diagram edge (mutates shared state)
  removeEdgeLabel(edge: any): void {
    this.appEdgeService.removeEdgeLabel(edge);
  }

  /**
   * Check if edge is connected to a specific node
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: check whether an edge has the given node as either endpoint (pure)
  isEdgeConnectedToNode(edge: any, nodeId: string): boolean {
    return this.appEdgeService.isEdgeConnectedToNode(edge, nodeId);
  }

  /**
   * Remove all edges connected to a node
   */
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: delete all edges connected to a node from the graph (mutates shared state)
  removeNodeEdges(nodeId: string): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.appEdgeService.removeNodeEdges(graph, nodeId);
  }

  /**
   * Observable for cell deletion requests from the button-remove tool.
   * The presentation layer subscribes to gate deletion with confirmation dialogs.
   */
  get cellDeletionRequested$(): Observable<Cell> {
    return this.infraX6GraphAdapter.cellDeletionRequested$;
  }

  /**
   * Execute a direct cell deletion (called after any confirmation has been obtained).
   * Delegates to the graph adapter for proper history and port visibility handling.
   */
  // SEM@122e52ca325567fc2739e6fd80b2bb4f4ad97c25: delete a confirmed cell immediately via the graph adapter (mutates shared state)
  executeDirectCellDeletion(cell: Cell): void {
    this.infraX6GraphAdapter.executeCellDeletion(cell);
  }

  /**
   * Delete selected cells from the graph.
   * Nodes are deleted via InfraNodeService.removeNode() which handles embedding
   * cleanup, edge removal, port visibility, and z-order updates.
   * Edges are deleted via the operation manager.
   */
  // SEM@ffa374dd1c9de88fc1c583a4695e280597118d74: delete all selected nodes and edges, returning success and count
  deleteSelectedCells(): Observable<{ success: boolean; deletedCount: number }> {
    try {
      const graph = this.infraX6GraphAdapter.getGraph();
      const selectedCells = graph.getSelectedCells();

      if (selectedCells.length === 0) {
        return of({ success: true, deletedCount: 0 });
      }

      this.logger.debugComponent('AppDfdFacade', 'Deleting selected cells', {
        cellCount: selectedCells.length,
      });

      // Separate nodes and edges
      const nodes = selectedCells.filter((cell: any) => cell.isNode?.());
      const edges = selectedCells.filter((cell: any) => cell.isEdge?.());

      // Sort nodes deepest-first so children are deleted before parents
      // when both are selected
      nodes.sort((a: any, b: any) => {
        const depthA = this.infraEmbeddingService.calculateEmbeddingDepth(a);
        const depthB = this.infraEmbeddingService.calculateEmbeddingDepth(b);
        return depthB - depthA;
      });

      // Delete nodes via InfraNodeService (handles embedding, edges, z-order)
      let nodeSuccessCount = 0;
      nodes.forEach((node: any) => {
        const success = this.infraNodeService.removeNode(graph, node.id);
        if (success) {
          nodeSuccessCount++;
        } else {
          this.logger.error('Failed to delete node', { nodeId: node.id });
        }
      });

      // Delete edges via operation manager
      const edgeOperations: Observable<any>[] = edges.map((edge: any) =>
        this._createDeleteEdgeOperation(edge, graph),
      );

      if (edgeOperations.length === 0) {
        return of({
          success: nodeSuccessCount === nodes.length,
          deletedCount: nodeSuccessCount,
        });
      }

      return forkJoin(edgeOperations).pipe(
        map(results => {
          const edgeSuccessCount = results.filter(r => r.success).length;
          const totalSuccess = nodeSuccessCount + edgeSuccessCount;
          const totalCount = nodes.length + edges.length;

          this.logger.debugComponent('AppDfdFacade', 'Delete operations completed', {
            total: totalCount,
            successful: totalSuccess,
          });

          return {
            success: totalSuccess === totalCount,
            deletedCount: totalSuccess,
          };
        }),
      );
    } catch (error) {
      this.logger.error('Error deleting selected cells via facade', { error });
      return of({ success: false, deletedCount: 0 });
    }
  }

  /**
   * Create and execute a DeleteEdgeOperation
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: build and execute a tracked delete-edge operation via the operation manager
  private _createDeleteEdgeOperation(edge: any, graph: any): Observable<any> {
    const edgeId = edge.id;

    this.logger.debugComponent('AppDfdFacade', 'Creating DeleteEdgeOperation', { edgeId });

    const operation: DeleteEdgeOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId,
      includeInHistory: true,
    };

    const context: OperationContext = {
      graph,
      diagramId: '', // Will be set by caller if needed
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to delete edge', {
            edgeId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Edge deleted successfully', { edgeId });
        }
      }),
    );
  }

  // ========================================
  // Clipboard Operations
  // ========================================

  /**
   * Cut selected cells to clipboard with history tracking
   * Copies cells to clipboard then deletes them via GraphOperations
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: copy selected cells to clipboard then delete them with history tracking
  cut(): Observable<{ success: boolean; cutCount: number }> {
    try {
      const graph = this.infraX6GraphAdapter.getGraph();
      const selectedCells = graph.getSelectedCells();

      if (selectedCells.length === 0) {
        return of({ success: true, cutCount: 0 });
      }

      this.logger.debugComponent(
        'AppDfdFacade',
        'Cutting cells to clipboard with history tracking',
        {
          cellCount: selectedCells.length,
        },
      );

      // First, copy to clipboard using X6's clipboard
      graph.cut(selectedCells);

      // Then delete the cells via GraphOperations for history tracking
      return this.deleteSelectedCells().pipe(
        map(result => ({
          success: result.success,
          cutCount: result.deletedCount,
        })),
        tap(result => {
          if (result.success) {
            this.logger.debugComponent('AppDfdFacade', 'Cut operation completed successfully', {
              cutCount: result.cutCount,
            });
          } else {
            this.logger.error('Cut operation failed', { result });
          }
        }),
      );
    } catch (error) {
      this.logger.error('Error during cut operation', { error });
      return of({ success: false, cutCount: 0 });
    }
  }

  /**
   * Copy selected cells to clipboard
   * Does not modify the diagram, so no history tracking needed
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: copy selected diagram cells to the clipboard without modifying the diagram (mutates shared state)
  copy(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    const selectedCells = graph.getSelectedCells();

    if (selectedCells.length === 0) {
      this.logger.debugComponent('AppDfdFacade', 'No cells selected for copy operation');
      return;
    }

    graph.copy(selectedCells);
    this.logger.debugComponent('AppDfdFacade', 'Copied cells to clipboard', {
      count: selectedCells.length,
    });
  }

  /**
   * Paste cells from clipboard
   * Note: Pasted cells are created by X6, then captured by retroactive handlers
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: paste clipboard cells into the diagram if the clipboard is non-empty (mutates shared state)
  paste(): void {
    const graph = this.infraX6GraphAdapter.getGraph();

    if (!graph.isClipboardEmpty()) {
      graph.paste();
      this.logger.debugComponent(
        'AppDfdFacade',
        'Paste operation initiated - cells will be captured retroactively',
      );
    } else {
      this.logger.debugComponent('AppDfdFacade', 'Clipboard is empty, cannot paste');
    }
  }

  /**
   * Check if the clipboard is empty
   */
  // SEM@b71c37e6ebaadf734d302ac51ca182bd0b5482b8: check whether the diagram clipboard holds any copied cells (pure)
  isClipboardEmpty(): boolean {
    const graph = this.infraX6GraphAdapter.getGraph();
    return graph.isClipboardEmpty();
  }

  // ========================================
  // Graph State Operations
  // ========================================

  /**
   * Get current selected cells
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: fetch the list of currently selected diagram cells (pure)
  getSelectedCells(): any[] {
    const graph = this.infraX6GraphAdapter.getGraph();
    return graph.getSelectedCells();
  }

  /**
   * Check if there are selected cells
   */
  // SEM@26eb8c79253dd24d4fc29a99ffc46c417287dc3b: check whether any diagram cells are currently selected (pure)
  hasSelectedCells(): boolean {
    return this.getSelectedCells().length > 0;
  }

  /**
   * Check if exactly one cell is selected
   */
  // SEM@26eb8c79253dd24d4fc29a99ffc46c417287dc3b: check whether exactly one diagram cell is currently selected (pure)
  hasExactlyOneSelectedCell(): boolean {
    return this.getSelectedCells().length === 1;
  }

  /**
   * Get the current graph instance
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: fetch the underlying graph instance from the infrastructure adapter (pure)
  getGraph(): any {
    return this.infraX6GraphAdapter.getGraph();
  }

  // ========================================
  // History Operations
  // ========================================

  // ========================================
  // Visual Operations
  // ========================================

  /**
   * Move selected cell forward in z-order
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: raise selected cells one step forward in z-order (mutates shared state)
  moveSelectedForward(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsForward(graph);
  }

  /**
   * Move selected cell backward in z-order
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: lower selected cells one step backward in z-order (mutates shared state)
  moveSelectedBackward(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsBackward(graph);
  }

  /**
   * Move selected cell to front
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: raise selected cells to the topmost z-order position (mutates shared state)
  moveSelectedToFront(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsToFront(graph);
  }

  /**
   * Move selected cell to back
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: lower selected cells to the bottommost z-order position (mutates shared state)
  moveSelectedToBack(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsToBack(graph);
  }

  // ========================================
  // Infrastructure Access
  // ========================================

  /**
   * Get the infrastructure graph adapter for advanced operations
   * This should be used sparingly and only for operations that cannot be abstracted
   */
  get graphAdapter(): InfraX6GraphAdapter {
    return this.infraX6GraphAdapter;
  }

  /**
   * Observable that emits when selection changes
   */
  get selectionChanged$(): Observable<{ selected: string[]; deselected: string[] }> {
    return this.infraX6GraphAdapter.selectionChanged$;
  }

  /**
   * Get the export service for diagram export and thumbnail operations
   */
  get exportService(): AppExportService {
    return this.appExportService;
  }

  /**
   * Observable that emits when drag operations complete (for history tracking)
   */
  get dragCompletions$(): Observable<any> {
    return this.historyCoordinator.dragCompletions$;
  }

  /**
   * Observable that emits when cell labels change (for history tracking)
   */
  get cellLabelChanged$(): Observable<any> {
    return this.infraX6GraphAdapter.cellLabelChanged$;
  }

  /**
   * Observable that emits when edges are reconnected (for history tracking)
   */
  get edgeReconnected$(): Observable<any> {
    return this.infraX6GraphAdapter.edgeReconnected$;
  }

  /**
   * Observable that emits when node parent changes (embedding/unembedding for history tracking)
   */
  get nodeParentChanged$(): Observable<any> {
    return this.infraX6GraphAdapter.nodeParentChanged$;
  }

  /**
   * Handle cell label change (creates UpdateNodeOperation or UpdateEdgeOperation)
   */
  // SEM@f1a8439186f60fcf8608f7d2a53484dec27c1d1b: dispatch a label-change operation for a node or edge cell (mutates shared state)
  handleLabelChange(
    change: {
      cellId: string;
      cellType: 'node' | 'edge';
      oldLabel: string;
      newLabel: string;
      previousCellState?: any;
    },
    diagramId: string,
  ): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();

    if (change.cellType === 'node') {
      return this._handleNodeLabelChange(change, graph, diagramId);
    } else {
      return this._handleEdgeLabelChange(change, graph, diagramId);
    }
  }

  /**
   * Handle node label change
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: execute an update-node operation to record a node label change in history (mutates shared state)
  private _handleNodeLabelChange(
    change: { cellId: string; oldLabel: string; newLabel: string; previousCellState?: any },
    graph: any,
    diagramId: string,
  ): Observable<void> {
    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateNodeOperation for label change', {
      nodeId: change.cellId,
      oldLabel: change.oldLabel,
      newLabel: change.newLabel,
    });

    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeId: change.cellId,
      updates: {
        label: change.newLabel,
      },
      includeInHistory: true,
      metadata: {
        previousCellState: change.previousCellState,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record node label change in history', {
            nodeId: change.cellId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Node label change recorded in history', {
            nodeId: change.cellId,
          });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle edge label change
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: execute an update-edge operation to record an edge label change in history (mutates shared state)
  private _handleEdgeLabelChange(
    change: { cellId: string; oldLabel: string; newLabel: string; previousCellState?: any },
    graph: any,
    diagramId: string,
  ): Observable<void> {
    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateEdgeOperation for label change', {
      edgeId: change.cellId,
      oldLabel: change.oldLabel,
      newLabel: change.newLabel,
    });

    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId: change.cellId,
      updates: {
        label: change.newLabel,
      },
      includeInHistory: true,
      metadata: {
        previousCellState: change.previousCellState,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record edge label change in history', {
            edgeId: change.cellId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Edge label change recorded in history', {
            edgeId: change.cellId,
          });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle edge reconnection (creates UpdateEdgeOperation for source or target changes)
   */
  // SEM@f1a8439186f60fcf8608f7d2a53484dec27c1d1b: dispatch a source or target reconnection operation for a diagram edge (mutates shared state)
  handleEdgeReconnection(
    reconnection: {
      edgeId: string;
      changeType: 'source' | 'target';
      oldNodeId: string | undefined;
      oldPortId: string | undefined;
      newNodeId: string | undefined;
      newPortId: string | undefined;
      previousCellState?: any;
    },
    diagramId: string,
  ): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();

    if (reconnection.changeType === 'source') {
      return this._handleEdgeReconnectionSource(reconnection, graph, diagramId);
    } else {
      return this._handleEdgeReconnectionTarget(reconnection, graph, diagramId);
    }
  }

  /**
   * Handle edge source reconnection
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: execute an update-edge operation to record an edge source endpoint change in history (mutates shared state)
  private _handleEdgeReconnectionSource(
    reconnection: {
      edgeId: string;
      oldNodeId: string | undefined;
      oldPortId: string | undefined;
      newNodeId: string | undefined;
      newPortId: string | undefined;
      previousCellState?: any;
    },
    graph: any,
    diagramId: string,
  ): Observable<void> {
    this.logger.debugComponent(
      'AppDfdFacade',
      'Creating UpdateEdgeOperation for source reconnection',
      {
        edgeId: reconnection.edgeId,
        oldNodeId: reconnection.oldNodeId,
        oldPortId: reconnection.oldPortId,
        newNodeId: reconnection.newNodeId,
        newPortId: reconnection.newPortId,
      },
    );

    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId: reconnection.edgeId,
      updates: {
        source: {
          cell: reconnection.newNodeId,
          port: reconnection.newPortId,
        },
      },
      includeInHistory: true,
      metadata: {
        previousCellState: reconnection.previousCellState,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record edge source reconnection in history', {
            edgeId: reconnection.edgeId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent(
            'AppDfdFacade',
            'Edge source reconnection recorded in history',
            {
              edgeId: reconnection.edgeId,
            },
          );
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle edge target reconnection
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: execute an update-edge operation to record an edge target endpoint change in history (mutates shared state)
  private _handleEdgeReconnectionTarget(
    reconnection: {
      edgeId: string;
      oldNodeId: string | undefined;
      oldPortId: string | undefined;
      newNodeId: string | undefined;
      newPortId: string | undefined;
      previousCellState?: any;
    },
    graph: any,
    diagramId: string,
  ): Observable<void> {
    this.logger.debugComponent(
      'AppDfdFacade',
      'Creating UpdateEdgeOperation for target reconnection',
      {
        edgeId: reconnection.edgeId,
        oldNodeId: reconnection.oldNodeId,
        oldPortId: reconnection.oldPortId,
        newNodeId: reconnection.newNodeId,
        newPortId: reconnection.newPortId,
      },
    );

    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId: reconnection.edgeId,
      updates: {
        target: {
          cell: reconnection.newNodeId,
          port: reconnection.newPortId,
        },
      },
      includeInHistory: true,
      metadata: {
        previousCellState: reconnection.previousCellState,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record edge target reconnection in history', {
            edgeId: reconnection.edgeId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent(
            'AppDfdFacade',
            'Edge target reconnection recorded in history',
            {
              edgeId: reconnection.edgeId,
            },
          );
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle node parent change (embedding/unembedding)
   * Creates UpdateNodeOperation with parent change
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: execute an update-node operation to record a node embedding or un-embedding in history (mutates shared state)
  handleNodeParentChange(
    change: {
      nodeId: string;
      oldParentId: string | null;
      newParentId: string | null;
      previousCellState?: any;
    },
    diagramId: string,
  ): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();

    this.logger.debugComponent('AppDfdFacade', 'Creating UpdateNodeOperation for parent change', {
      nodeId: change.nodeId,
      oldParentId: change.oldParentId,
      newParentId: change.newParentId,
    });

    const operation: any = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'update-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeId: change.nodeId,
      updates: {
        parent: change.newParentId,
      },
      includeInHistory: true,
      metadata: {
        previousCellState: change.previousCellState,
      },
    };

    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '',
      providerId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to record node parent change in history', {
            nodeId: change.nodeId,
            error: result.error,
          });
        } else {
          this.logger.debugComponent('AppDfdFacade', 'Node parent change recorded in history', {
            nodeId: change.nodeId,
            oldParentId: change.oldParentId,
            newParentId: change.newParentId,
          });
        }
      }),
      map(() => undefined),
    );
  }

  // ========================================
  // Utility Operations
  // ========================================

  /**
   * Check if the selected cell is a text box
   */
  // SEM@528e7572ac1e2d99984ad20dd1d1e629cde6a570: validate that the sole selected cell is a text-box node (pure)
  isSelectedCellTextBox(): boolean {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length !== 1) return false;

    const cell = selectedCells[0];
    return cell.isNode() && (cell.shape === 'text-box' || cell.getData()?.nodeType === 'text-box');
  }

  /**
   * Check if the selected cell is a security boundary
   */
  // SEM@528e7572ac1e2d99984ad20dd1d1e629cde6a570: validate that the sole selected cell is a security-boundary node (pure)
  isSelectedCellSecurityBoundary(): boolean {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length !== 1) return false;

    const cell = selectedCells[0];
    return (
      cell.isNode() &&
      (cell.shape === 'security-boundary' || cell.getData()?.nodeType === 'security-boundary')
    );
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  // SEM@26eb8c79253dd24d4fc29a99ffc46c417287dc3b: validate that the right-clicked diagram cell is an edge (pure)
  isRightClickedCellEdge(rightClickedCell?: any): boolean {
    if (!rightClickedCell) return false;
    return rightClickedCell.isEdge && rightClickedCell.isEdge();
  }

  /**
   * Initialize graph with container element
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: initialize the graph renderer in a given DOM container element (mutates shared state)
  initializeGraph(containerElement: HTMLElement): void {
    this.infraX6GraphAdapter.initialize(containerElement);
  }

  /**
   * Set read-only mode for the graph
   */
  // SEM@accadabe6b8fd5d9b4d99f398db8781982b535c9: toggle read-only interaction mode on the graph adapter (mutates shared state)
  setReadOnlyMode(readOnly: boolean): void {
    this.infraX6GraphAdapter.setReadOnlyMode(readOnly);
  }

  /**
   * Dispose of facade resources
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: release facade resources and delegate cleanup to dependent services (mutates shared state)
  dispose(): void {
    this.logger.debugComponent('AppDfdFacade', 'Disposing resources');
    // The individual services will handle their own cleanup
    // This facade doesn't maintain any additional state that needs cleanup
  }
}
