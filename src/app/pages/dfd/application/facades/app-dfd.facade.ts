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
import { Observable } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { NodeType } from '../../domain/value-objects/node-info';

// Infrastructure services
import { InfraX6GraphAdapter } from '../../infrastructure/adapters/infra-x6-graph.adapter';
import { InfraX6ZOrderAdapter } from '../../infrastructure/adapters/infra-x6-z-order.adapter';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { AppEdgeService } from '../services/app-edge.service';
import { InfraNodeConfigurationService } from '../../infrastructure/services/infra-node-configuration.service';
import { InfraVisualEffectsService } from '../../infrastructure/services/infra-visual-effects.service';
import { InfraX6CoreOperationsService } from '../../infrastructure/services/infra-x6-core-operations.service';
import { GraphHistoryCoordinator } from '../../services/graph-history-coordinator.service';

/**
 * Facade for DFD infrastructure services
 * Provides simplified, high-level operations while managing complex dependencies internally
 */
@Injectable({
  providedIn: 'root',
})
export class AppDfdFacade {
  constructor(
    private readonly logger: LoggerService,
    private readonly infraX6GraphAdapter: InfraX6GraphAdapter,
    private readonly infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private readonly infraNodeService: InfraNodeService,
    private readonly appEdgeService: AppEdgeService,
    private readonly infraNodeConfigurationService: InfraNodeConfigurationService,
    private readonly infraVisualEffectsService: InfraVisualEffectsService,
    private readonly infraX6CoreOperationsService: InfraX6CoreOperationsService,
    private readonly historyCoordinator: GraphHistoryCoordinator,
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
  }

  // ========================================
  // Node Operations
  // ========================================

  /**
   * Create a node using intelligent positioning algorithm
   */
  createNodeWithIntelligentPositioning(
    nodeType: NodeType,
    containerWidth: number,
    containerHeight: number,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    return this.infraNodeService.addGraphNode(
      nodeType,
      containerWidth,
      containerHeight,
      diagramId,
      isInitialized,
    );
  }

  /**
   * Create a node at a specific position
   */
  createNodeAtPosition(nodeType: NodeType, position: { x: number; y: number }): Observable<void> {
    // Use the InfraNodeService's createNode method directly
    return (this.infraNodeService as any).createNode(nodeType, position);
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
   * Delete selected cells from the graph
   */
  deleteSelectedCells(): Observable<{ success: boolean; deletedCount: number }> {
    try {
      const graph = this.infraX6GraphAdapter.getGraph();
      const selectedCells = graph.getSelectedCells();

      if (selectedCells.length === 0) {
        return new Observable(observer => {
          observer.next({ success: true, deletedCount: 0 });
          observer.complete();
        });
      }

      // Delete each selected cell
      selectedCells.forEach(cell => {
        if (cell.isNode()) {
          this.infraX6CoreOperationsService.removeNode(graph, cell.id, {
            suppressErrors: false,
            logOperation: true,
          });
        } else if (cell.isEdge()) {
          this.infraX6CoreOperationsService.removeEdge(graph, cell.id, {
            suppressErrors: false,
            logOperation: true,
          });
        }
      });

      this.logger.debug('Deleted selected cells via facade', {
        deletedCount: selectedCells.length,
      });

      return new Observable(observer => {
        observer.next({ success: true, deletedCount: selectedCells.length });
        observer.complete();
      });
    } catch (error) {
      this.logger.error('Error deleting selected cells via facade', { error });
      return new Observable(observer => {
        observer.next({ success: false, deletedCount: 0 });
        observer.complete();
      });
    }
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

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    const graph = this.infraX6GraphAdapter.getGraph();
    const history = (graph as any).history;
    return history && typeof history.canUndo === 'function' ? history.canUndo() : false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    const graph = this.infraX6GraphAdapter.getGraph();
    const history = (graph as any).history;
    return history && typeof history.canRedo === 'function' ? history.canRedo() : false;
  }

  /**
   * Perform undo operation
   */
  undo(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    const history = (graph as any).history;
    if (history && typeof history.undo === 'function') {
      history.undo();
    }
  }

  /**
   * Perform redo operation
   */
  redo(): void {
    const graph = this.infraX6GraphAdapter.getGraph();
    const history = (graph as any).history;
    if (history && typeof history.redo === 'function') {
      history.redo();
    }
  }

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
   * Dispose of facade resources
   */
  dispose(): void {
    this.logger.debug('AppDfdFacade disposing resources');
    // The individual services will handle their own cleanup
    // This facade doesn't maintain any additional state that needs cleanup
  }
}
