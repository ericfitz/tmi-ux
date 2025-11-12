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
import { tap, map } from 'rxjs/operators';
import { LoggerService } from '../../../../core/services/logger.service';
import { NodeType } from '../../domain/value-objects/node-info';

// Infrastructure services
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { InfraX6ZOrderAdapter } from '../../infrastructure/adapters/infra-x6-z-order.adapter';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { AppEdgeService } from '../services/app-edge.service';
import { AppExportService } from '../services/app-export.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraVisualEffectsService} from '../../infrastructure/services/infra-visual-effects.service';
import { InfraX6CoreOperationsService } from '../../infrastructure/services/infra-x6-core-operations.service';
import { AppOperationStateManager } from '../services/app-operation-state-manager.service';
import { InfraEmbeddingService } from '../../infrastructure/services/infra-embedding.service';
import { AppGraphOperationManager } from '../services/app-graph-operation-manager.service';
import {
  CreateNodeOperation,
  DeleteNodeOperation,
  DeleteEdgeOperation,
  OperationContext,
  NodeData,
} from '../../types/graph-operation.types';

/**
 * Facade for DFD infrastructure services
 * Provides simplified, high-level operations while managing complex dependencies internally
 */
@Injectable()
export class AppDfdFacade {
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
  ) {
    this.logger.debug('AppDfdFacade initialized');
  }

  // ========================================
  // Infrastructure Management
  // ========================================

  /**
   * Initialize the graph adapter with the provided graph instance
   * This must be called before any graph operations can be performed
   */
  initializeGraphAdapter(containerElement: HTMLElement): void {
    this.logger.debug('AppDfdFacade: Initializing graph adapter');
    this.infraX6GraphAdapter.initialize(containerElement);

    // Inject node service into selection adapter to avoid circular dependency
    this.infraX6GraphAdapter.injectNodeService(this.infraNodeService);
  }

  /**
   * Set the graph instance on the adapter (for orchestrator-created graphs)
   * This allows the orchestrator to create the graph and pass it to the infrastructure
   */
  setGraphOnAdapter(graph: any): void {
    this.logger.debug('AppDfdFacade: Setting graph instance on adapter');
    this.infraX6GraphAdapter.setGraph(graph);
  }

  // ========================================
  // Node Operations
  // ========================================

  /**
   * Create a node using intelligent positioning algorithm
   */
  createNodeWithIntelligentPositioning(
    nodeType: NodeType,
    isInitialized: boolean,
  ): Observable<void> {
    return this.infraNodeService.addGraphNode(nodeType, isInitialized);
  }

  /**
   * Create a node at a specific position
   */
  createNodeAtPosition(nodeType: NodeType, position: { x: number; y: number }): Observable<void> {
    // Use the InfraNodeService's createNode method directly
    return (this.infraNodeService as any).createNode(nodeType, position);
  }

  /**
   * Handle drag completion for node movement or resizing
   * Creates UpdateNodeOperation to record final state in history
   */
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

    if (!cell || !cell.isNode()) {
      // Skip non-node cells (edges handled separately)
      return of(undefined);
    }

    if (dragType === 'move') {
      return this._handleNodeMove(cell, initialState, graph, diagramId);
    } else if (dragType === 'resize') {
      return this._handleNodeResize(cell, initialState, graph, diagramId);
    }

    return of(undefined);
  }

  /**
   * Handle node movement completion
   */
  private _handleNodeMove(node: any, initialState: any, graph: any, diagramId: string): Observable<void> {
    const finalPosition = node.getPosition();
    const initialPosition = initialState?.position;

    // Skip if position hasn't actually changed
    if (
      initialPosition &&
      initialPosition.x === finalPosition.x &&
      initialPosition.y === finalPosition.y
    ) {
      this.logger.debug('Skipping node move - no position change', { nodeId: node.id });
      return of(undefined);
    }

    this.logger.debug('Creating UpdateNodeOperation for node move', {
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
      userId: '',
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
          this.logger.debug('Node move recorded in history', { nodeId: node.id });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle node resize completion
   */
  private _handleNodeResize(node: any, initialState: any, graph: any, diagramId: string): Observable<void> {
    const finalSize = node.getSize();
    const initialSize = initialState?.size;

    // Skip if size hasn't actually changed
    if (
      initialSize &&
      initialSize.width === finalSize.width &&
      initialSize.height === finalSize.height
    ) {
      this.logger.debug('Skipping node resize - no size change', { nodeId: node.id });
      return of(undefined);
    }

    this.logger.debug('Creating UpdateNodeOperation for node resize', {
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
      userId: '',
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
          this.logger.debug('Node resize recorded in history', { nodeId: node.id });
        }
      }),
      map(() => undefined),
    );
  }

  /**
   * Handle node added to the graph (validation and history tracking)
   * Similar pattern to edge creation - creates retroactive GraphOperation
   */
  handleNodeAdded(node: any, diagramId: string, isInitialized: boolean): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle node added: Graph is not initialized');
      throw new Error('Graph is not initialized');
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
        metadata: node.getData()?._metadata || [],
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
      metadata: {
        retroactive: true, // Flag to indicate node already exists
      },
    };

    // Create minimal operation context with required fields
    const context: OperationContext = {
      graph,
      diagramId,
      threatModelId: '', // Will be populated by persistence layer if needed
      userId: '', // Will be populated by auth service if needed
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
          this.logger.debug('Node creation recorded in history', {
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
  handleEdgeAdded(edge: any, diagramId: string, isInitialized: boolean): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    return this.appEdgeService.handleEdgeAdded(edge, graph, diagramId, isInitialized);
  }

  /**
   * Handle edge vertices changed
   */
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
  addInverseConnection(edge: any, diagramId: string): Observable<void> {
    const graph = this.infraX6GraphAdapter.getGraph();
    return this.appEdgeService.addInverseConnection(edge, graph, diagramId);
  }

  /**
   * Validate if a connection is allowed between nodes
   */
  validateConnection(sourceNode: any, targetNode: any): boolean {
    return this.appEdgeService.validateConnection(sourceNode, targetNode);
  }

  /**
   * Check if a magnet is valid for connections
   */
  isMagnetValid(magnet: Element): boolean {
    return this.appEdgeService.isMagnetValid({ magnet });
  }

  /**
   * Check if a connection between ports is valid
   */
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
  isNodeConnectionValid(sourceNode: any, targetNode: any): boolean {
    return this.appEdgeService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Validate embedding operation based on DFD rules
   */
  validateEmbedding(parent: any, child: any): boolean {
    const result = this.infraEmbeddingService.validateEmbedding(parent, child);
    return result.isValid;
  }

  /**
   * Update edge label
   */
  updateEdgeLabel(edge: any, label: string): void {
    this.appEdgeService.updateEdgeLabel(edge, label);
  }

  /**
   * Remove edge label
   */
  removeEdgeLabel(edge: any): void {
    this.appEdgeService.removeEdgeLabel(edge);
  }

  /**
   * Check if edge is connected to a specific node
   */
  isEdgeConnectedToNode(edge: any, nodeId: string): boolean {
    return this.appEdgeService.isEdgeConnectedToNode(edge, nodeId);
  }

  /**
   * Remove all edges connected to a node
   */
  removeNodeEdges(nodeId: string): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.appEdgeService.removeNodeEdges(graph, nodeId);
  }

  /**
   * Delete selected cells from the graph via GraphOperations for history tracking
   * Creates DeleteNodeOperation or DeleteEdgeOperation for each cell
   */
  deleteSelectedCells(): Observable<{ success: boolean; deletedCount: number }> {
    try {
      const graph = this.infraX6GraphAdapter.getGraph();
      const selectedCells = graph.getSelectedCells();

      if (selectedCells.length === 0) {
        return of({ success: true, deletedCount: 0 });
      }

      this.logger.debug('Deleting selected cells via GraphOperations', {
        cellCount: selectedCells.length,
      });

      // Create delete operations for each cell
      const deleteOperations: Observable<any>[] = [];

      selectedCells.forEach((cell: any) => {
        if (cell.isNode()) {
          deleteOperations.push(this._createDeleteNodeOperation(cell, graph));
        } else if (cell.isEdge()) {
          deleteOperations.push(this._createDeleteEdgeOperation(cell, graph));
        }
      });

      // Execute all delete operations in parallel
      return forkJoin(deleteOperations).pipe(
        map(results => {
          const successCount = results.filter(r => r.success).length;
          const allSuccess = successCount === results.length;

          this.logger.debug('Delete operations completed', {
            total: results.length,
            successful: successCount,
          });

          return {
            success: allSuccess,
            deletedCount: successCount,
          };
        }),
      );
    } catch (error) {
      this.logger.error('Error deleting selected cells via facade', { error });
      return of({ success: false, deletedCount: 0 });
    }
  }

  /**
   * Create and execute a DeleteNodeOperation
   */
  private _createDeleteNodeOperation(node: any, graph: any): Observable<any> {
    const nodeId = node.id;

    this.logger.debug('Creating DeleteNodeOperation', { nodeId });

    const operation: DeleteNodeOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete-node',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      nodeId,
    };

    const context: OperationContext = {
      graph,
      diagramId: '', // Will be set by caller if needed
      threatModelId: '',
      userId: '',
      isCollaborating: false,
      permissions: [],
    };

    return this.graphOperationManager.execute(operation, context).pipe(
      tap(result => {
        if (!result.success) {
          this.logger.error('Failed to delete node', {
            nodeId,
            error: result.error,
          });
        } else {
          this.logger.debug('Node deleted successfully', { nodeId });
        }
      }),
    );
  }

  /**
   * Create and execute a DeleteEdgeOperation
   */
  private _createDeleteEdgeOperation(edge: any, graph: any): Observable<any> {
    const edgeId = edge.id;

    this.logger.debug('Creating DeleteEdgeOperation', { edgeId });

    const operation: DeleteEdgeOperation = {
      id: `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'delete-edge',
      source: 'user-interaction',
      timestamp: Date.now(),
      priority: 'normal',
      edgeId,
    };

    const context: OperationContext = {
      graph,
      diagramId: '', // Will be set by caller if needed
      threatModelId: '',
      userId: '',
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
          this.logger.debug('Edge deleted successfully', { edgeId });
        }
      }),
    );
  }

  // ========================================
  // Graph State Operations
  // ========================================

  /**
   * Get current selected cells
   */
  getSelectedCells(): any[] {
    const graph = this.infraX6GraphAdapter.getGraph();
    return graph.getSelectedCells();
  }

  /**
   * Check if there are selected cells
   */
  hasSelectedCells(): boolean {
    return this.getSelectedCells().length > 0;
  }

  /**
   * Check if exactly one cell is selected
   */
  hasExactlyOneSelectedCell(): boolean {
    return this.getSelectedCells().length === 1;
  }

  /**
   * Get the current graph instance
   */
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
  moveSelectedForward(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsForward(graph);
  }

  /**
   * Move selected cell backward in z-order
   */
  moveSelectedBackward(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsBackward(graph);
  }

  /**
   * Move selected cell to front
   */
  moveSelectedToFront(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    this.infraX6ZOrderAdapter.moveSelectedCellsToFront(graph);
  }

  /**
   * Move selected cell to back
   */
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

  // ========================================
  // Utility Operations
  // ========================================

  /**
   * Check if the selected cell is a text box
   */
  isSelectedCellTextBox(): boolean {
    const selectedCells = this.getSelectedCells();
    if (selectedCells.length !== 1) return false;

    const cell = selectedCells[0];
    return cell.isNode() && (cell.shape === 'text-box' || cell.getData()?.nodeType === 'text-box');
  }

  /**
   * Check if the selected cell is a security boundary
   */
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
  isRightClickedCellEdge(rightClickedCell?: any): boolean {
    if (!rightClickedCell) return false;
    return rightClickedCell.isEdge && rightClickedCell.isEdge();
  }

  /**
   * Initialize graph with container element
   */
  initializeGraph(containerElement: HTMLElement): void {
    this.infraX6GraphAdapter.initialize(containerElement);
  }

  /**
   * Set read-only mode for the graph
   */
  setReadOnlyMode(readOnly: boolean): void {
    this.infraX6GraphAdapter.setReadOnlyMode(readOnly);
  }

  /**
   * Dispose of facade resources
   */
  dispose(): void {
    this.logger.debug('AppDfdFacade disposing resources');
    // The individual services will handle their own cleanup
    // This facade doesn't maintain any additional state that needs cleanup
  }
}
