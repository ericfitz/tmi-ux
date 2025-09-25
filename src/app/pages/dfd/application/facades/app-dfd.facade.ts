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
import { LoggerService } from '../../../core/services/logger.service';
import { NodeType } from '../domain/value-objects/node-info';

// Infrastructure services
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { X6ZOrderAdapter } from '../infrastructure/adapters/x6-z-order.adapter';
import { DfdNodeService } from '../infrastructure/services/node.service';
import { DfdEdgeService } from './dfd-edge.service';
import { NodeConfigurationService } from '../infrastructure/services/node-configuration.service';
import { VisualEffectsService } from '../infrastructure/services/visual-effects.service';
import { X6CoreOperationsService } from '../infrastructure/services/x6-core-operations.service';
import { GraphHistoryCoordinator } from './graph-history-coordinator.service';

/**
 * Facade for DFD infrastructure services
 * Provides simplified, high-level operations while managing complex dependencies internally
 */
@Injectable({
  providedIn: 'root',
})
export class DfdInfrastructureFacade {
  constructor(
    private readonly logger: LoggerService,
    private readonly x6GraphAdapter: X6GraphAdapter,
    private readonly x6ZOrderAdapter: X6ZOrderAdapter,
    private readonly dfdNodeService: DfdNodeService,
    private readonly dfdEdgeService: DfdEdgeService,
    private readonly nodeConfigurationService: NodeConfigurationService,
    private readonly visualEffectsService: VisualEffectsService,
    private readonly x6CoreOperationsService: X6CoreOperationsService,
    private readonly historyCoordinator: GraphHistoryCoordinator,
  ) {
    this.logger.debug('DfdInfrastructureFacade initialized');
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
    return this.dfdNodeService.addGraphNode(
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
    // Use the DfdNodeService's createNode method directly
    return (this.dfdNodeService as any).createNode(nodeType, position);
  }

  // ========================================
  // Edge Operations
  // ========================================

  /**
   * Handle edge added to the graph (validation and setup)
   */
  handleEdgeAdded(edge: any, diagramId: string, isInitialized: boolean): Observable<void> {
    const graph = this.x6GraphAdapter.getGraph();
    return this.dfdEdgeService.handleEdgeAdded(edge, graph, diagramId, isInitialized);
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
    const graph = this.x6GraphAdapter.getGraph();
    return this.dfdEdgeService.handleEdgeVerticesChanged(
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
    const graph = this.x6GraphAdapter.getGraph();
    return this.dfdEdgeService.addInverseConnection(edge, graph, diagramId);
  }

  /**
   * Validate if a connection is allowed between nodes
   */
  validateConnection(sourceNode: any, targetNode: any): boolean {
    return this.dfdEdgeService.validateConnection(sourceNode, targetNode);
  }

  /**
   * Check if a magnet is valid for connections
   */
  isMagnetValid(magnet: Element): boolean {
    return this.dfdEdgeService.isMagnetValid({ magnet });
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
    return this.dfdEdgeService.isConnectionValid({
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
    return this.dfdEdgeService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Update edge label
   */
  updateEdgeLabel(edge: any, label: string): void {
    this.dfdEdgeService.updateEdgeLabel(edge, label);
  }

  /**
   * Remove edge label
   */
  removeEdgeLabel(edge: any): void {
    this.dfdEdgeService.removeEdgeLabel(edge);
  }

  /**
   * Check if edge is connected to a specific node
   */
  isEdgeConnectedToNode(edge: any, nodeId: string): boolean {
    return this.dfdEdgeService.isEdgeConnectedToNode(edge, nodeId);
  }

  /**
   * Remove all edges connected to a node
   */
  removeNodeEdges(nodeId: string): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.dfdEdgeService.removeNodeEdges(graph, nodeId);
  }

  /**
   * Delete selected cells from the graph
   */
  deleteSelectedCells(): Observable<{ success: boolean; deletedCount: number }> {
    try {
      const graph = this.x6GraphAdapter.getGraph();
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
          this.x6CoreOperationsService.removeNode(graph, cell.id, {
            suppressErrors: false,
            logOperation: true,
          });
        } else if (cell.isEdge()) {
          this.x6CoreOperationsService.removeEdge(graph, cell.id, {
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
    const graph = this.x6GraphAdapter.getGraph();
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
    return this.x6GraphAdapter.getGraph();
  }

  // ========================================
  // History Operations
  // ========================================

  /**
   * Check if undo is available
   */
  canUndo(): boolean {
    const graph = this.x6GraphAdapter.getGraph();
    const history = (graph as any).history;
    return history && typeof history.canUndo === 'function' ? history.canUndo() : false;
  }

  /**
   * Check if redo is available
   */
  canRedo(): boolean {
    const graph = this.x6GraphAdapter.getGraph();
    const history = (graph as any).history;
    return history && typeof history.canRedo === 'function' ? history.canRedo() : false;
  }

  /**
   * Perform undo operation
   */
  undo(): void {
    const graph = this.x6GraphAdapter.getGraph();
    const history = (graph as any).history;
    if (history && typeof history.undo === 'function') {
      history.undo();
    }
  }

  /**
   * Perform redo operation
   */
  redo(): void {
    const graph = this.x6GraphAdapter.getGraph();
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
    const graph = this.x6GraphAdapter.getGraph();
    this.x6ZOrderAdapter.moveSelectedCellsForward(graph);
  }

  /**
   * Move selected cell backward in z-order
   */
  moveSelectedBackward(): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.x6ZOrderAdapter.moveSelectedCellsBackward(graph);
  }

  /**
   * Move selected cell to front
   */
  moveSelectedToFront(): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.x6ZOrderAdapter.moveSelectedCellsToFront(graph);
  }

  /**
   * Move selected cell to back
   */
  moveSelectedToBack(): void {
    const graph = this.x6GraphAdapter.getGraph();
    this.x6ZOrderAdapter.moveSelectedCellsToBack(graph);
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
    this.x6GraphAdapter.initialize(containerElement);
  }

  /**
   * Dispose of facade resources
   */
  dispose(): void {
    this.logger.debug('DfdInfrastructureFacade disposing resources');
    // The individual services will handle their own cleanup
    // This facade doesn't maintain any additional state that needs cleanup
  }
}
