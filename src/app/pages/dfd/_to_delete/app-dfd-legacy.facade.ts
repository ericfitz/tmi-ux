/**
 * DFD Facade Service
 *
 * This service provides a unified interface for DFD component operations by coordinating
 * multiple specialized services. It implements the Facade pattern to simplify component dependencies.
 *
 * Key functionality:
 * - Coordinates node operations (creation, deletion, manipulation) via InfraNodeService
 * - Manages edge operations (connection validation, creation, vertices) via AppEdgeService
 * - Handles event processing (keyboard, mouse, context menu) via AppEventHandlersService
 * - Provides diagram export capabilities via AppExportService
 * - Manages diagram loading and data operations via AppDiagramService
 * - Simplifies component architecture by reducing direct service dependencies
 * - Provides consistent API for all DFD operations from a single entry point
 * - Coordinates cross-service operations that require multiple service interactions
 * - Maintains separation of concerns while providing unified functionality
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Edge, Node, Graph } from '@antv/x6';
import { ConnectionValidationArgs, MagnetValidationArgs } from '../services/app-edge.service';
import { NodeType } from '../../domain/value-objects/node-info';
import { InfraNodeService } from '../../infrastructure/services/infra-node.service';
import { AppEdgeService } from '../services/app-edge.service';
import { AppEventHandlersService } from '../services/app-event-handlers.service';
import { AppExportService } from '../services/app-export.service';
import { AppDiagramService } from '../services/app-diagram.service';

/**
 * Facade service that simplifies DFD component dependencies by providing
 * a single entry point for common operations across multiple services.
 *
 * This reduces the number of direct service dependencies in the component
 * and provides a cleaner API for coordinating operations.
 */
@Injectable()
export class AppDfdLegacyFacade {
  constructor(
    private infraNodeService: InfraNodeService,
    private appEdgeService: AppEdgeService,
    private eventHandlersService: AppEventHandlersService,
    private exportService: AppExportService,
    private diagramService: AppDiagramService,
  ) {}

  // ===============================
  // Node Operations
  // ===============================

  /**
   * Add a new node to the diagram
   */
  addGraphNode(
    shapeType: NodeType,
    containerWidth: number,
    containerHeight: number,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<any> {
    return this.infraNodeService.addGraphNode(
      shapeType,
      containerWidth,
      containerHeight,
      diagramId,
      isInitialized,
    );
  }

  // ===============================
  // Edge Operations
  // ===============================

  /**
   * Handle edge added events
   */
  handleEdgeAdded(
    edge: Edge,
    graph: Graph,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<any> {
    return this.appEdgeService.handleEdgeAdded(edge, graph, diagramId, isInitialized);
  }

  /**
   * Handle edge vertices changes
   */
  handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
    graph: Graph,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<any> {
    return this.appEdgeService.handleEdgeVerticesChanged(
      edgeId,
      vertices,
      graph,
      diagramId,
      isInitialized,
    );
  }

  /**
   * Add an inverse connection for an edge
   */
  addInverseConnection(originalEdge: Edge, graph: Graph, diagramId: string): Observable<any> {
    return this.appEdgeService.addInverseConnection(originalEdge, graph, diagramId);
  }

  // ===============================
  // Event Handler Operations
  // ===============================

  /**
   * Initialize event handlers
   */
  initializeEventHandlers(infraX6GraphAdapter: any): void {
    this.eventHandlersService.initialize(infraX6GraphAdapter);
  }

  /**
   * Get context menu position
   */
  get contextMenuPosition(): { x: string; y: string } {
    return this.eventHandlersService.contextMenuPosition;
  }

  /**
   * Get selected cells observable
   */
  get selectedCells$(): Observable<any[]> {
    return this.eventHandlersService.selectedCells$;
  }

  /**
   * Get threat change observable
   */
  get threatChanged$(): Observable<any> {
    return this.eventHandlersService.threatChanged$;
  }

  /**
   * Handle window resize
   */
  onWindowResize(
    graphContainer: any,
    resizeTimeout: number | null,
    infraX6GraphAdapter: any,
  ): number | null {
    return this.eventHandlersService.onWindowResize(
      graphContainer,
      resizeTimeout,
      infraX6GraphAdapter,
    );
  }

  /**
   * Handle key down events
   */
  onKeyDown(
    event: KeyboardEvent,
    diagramId: string,
    isInitialized: boolean,
    infraX6GraphAdapter: any,
  ): void {
    this.eventHandlersService.onKeyDown(event, diagramId, isInitialized, infraX6GraphAdapter);
  }

  /**
   * Delete selected cells
   */
  onDeleteSelected(isInitialized: boolean, infraX6GraphAdapter: any): void {
    this.eventHandlersService.onDeleteSelected(isInitialized, infraX6GraphAdapter);
  }

  /**
   * Show cell properties dialog
   */
  showCellProperties(): void {
    this.eventHandlersService.showCellProperties();
  }

  /**
   * Open threat editor dialog
   */
  openThreatEditor(
    threatModelId: string | null,
    dfdId: string | null,
    diagramName?: string | null,
  ): void {
    this.eventHandlersService.openThreatEditor(threatModelId, dfdId, diagramName);
  }

  /**
   * Close diagram
   */
  closeDiagram(threatModelId: string | null, dfdId: string | null): void {
    this.eventHandlersService.closeDiagram(threatModelId, dfdId);
  }

  /**
   * Z-order operations
   */
  moveForward(infraX6GraphAdapter: any): void {
    this.eventHandlersService.moveForward(infraX6GraphAdapter);
  }

  moveBackward(infraX6GraphAdapter: any): void {
    this.eventHandlersService.moveBackward(infraX6GraphAdapter);
  }

  moveToFront(infraX6GraphAdapter: any): void {
    this.eventHandlersService.moveToFront(infraX6GraphAdapter);
  }

  moveToBack(infraX6GraphAdapter: any): void {
    this.eventHandlersService.moveToBack(infraX6GraphAdapter);
  }

  /**
   * Edit cell text
   */
  editCellText(infraX6GraphAdapter: any): void {
    this.eventHandlersService.editCellText(infraX6GraphAdapter);
  }

  /**
   * Check if right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this.eventHandlersService.isRightClickedCellEdge();
  }

  /**
   * Get right-clicked cell
   */
  getRightClickedCell(): any {
    return this.eventHandlersService.getRightClickedCell();
  }

  /**
   * Open cell context menu
   */
  openCellContextMenu(cell: any, x: number, y: number, contextMenuTrigger?: any, cdr?: any): void {
    this.eventHandlersService.openCellContextMenu(cell, x, y, contextMenuTrigger, cdr);
  }

  /**
   * Undo/redo operations
   */
  undo(isInitialized: boolean, infraX6GraphAdapter: any): void {
    this.eventHandlersService.undo(isInitialized, infraX6GraphAdapter);
  }

  redo(isInitialized: boolean, infraX6GraphAdapter: any): void {
    this.eventHandlersService.redo(isInitialized, infraX6GraphAdapter);
  }

  /**
   * Dispose event handlers
   */
  disposeEventHandlers(): void {
    this.eventHandlersService.dispose();
  }

  // ===============================
  // Export Operations
  // ===============================

  /**
   * Export diagram to specified format
   */
  exportDiagram(
    format: 'png' | 'jpeg' | 'svg',
    threatModelName?: string,
    diagramName?: string,
  ): void {
    this.exportService.exportDiagram(format, threatModelName, diagramName);
  }

  // ===============================
  // Diagram Operations
  // ===============================

  /**
   * Load diagram data
   */
  loadDiagram(diagramId: string, threatModelId?: string): Observable<any> {
    return this.diagramService.loadDiagram(diagramId, threatModelId);
  }

  // ===============================
  // Connection Validation Operations
  // ===============================

  /**
   * Check if a magnet (port) is valid for connection
   */
  isMagnetValid(args: MagnetValidationArgs): boolean {
    return this.appEdgeService.isMagnetValid(args);
  }

  /**
   * Check if a connection can be made between two ports
   */
  isConnectionValid(args: ConnectionValidationArgs): boolean {
    return this.appEdgeService.isConnectionValid(args);
  }

  /**
   * Check if a connection can be made between two nodes based on DFD rules
   */
  isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean {
    return this.appEdgeService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Validate node shape type
   */
  validateNodeShape(nodeType: string, nodeId: string): void {
    this.appEdgeService.validateNodeShape(nodeType, nodeId);
  }

  /**
   * Validate that an X6 node was created with the correct shape property
   */
  validateX6NodeShape(x6Node: Node): void {
    this.appEdgeService.validateX6NodeShape(x6Node);
  }

  /**
   * Get valid connection targets for a given source shape
   */
  getValidConnectionTargets(sourceShape: string): string[] {
    return this.appEdgeService.getValidConnectionTargets(sourceShape);
  }

  /**
   * Get all valid node shape types
   */
  getValidNodeShapes(): string[] {
    return this.appEdgeService.getValidNodeShapes();
  }

  /**
   * Check if two shapes can be connected according to DFD rules
   */
  canShapesConnect(sourceShape: string, targetShape: string): boolean {
    return this.appEdgeService.canShapesConnect(sourceShape, targetShape);
  }

  // ===============================
  // Diagram Loading Operations
  // ===============================

  /**
   * Load multiple diagram cells with proper history suppression and port visibility management
   */
  loadDiagramCellsBatch(
    cells: any[],
    graph: Graph,
    diagramId: string,
    infraNodeConfigurationService: any,
  ): void {
    this.diagramService.loadDiagramCellsBatch(
      cells,
      graph,
      diagramId,
      infraNodeConfigurationService,
    );
  }

  /**
   * Save diagram changes back to the threat model
   */
  saveDiagramChanges(graph: Graph, diagramId: string, threatModelId: string): Observable<boolean> {
    return this.diagramService.saveDiagramChanges(graph, diagramId, threatModelId);
  }

  /**
   * Save diagram changes with image data back to the threat model
   */
  saveDiagramChangesWithImage(
    graph: Graph,
    diagramId: string,
    threatModelId: string,
    imageData: { svg?: string; update_vector?: number },
  ): Observable<boolean> {
    return this.diagramService.saveDiagramChangesWithImage(
      graph,
      diagramId,
      threatModelId,
      imageData,
    );
  }

  // ===============================
  // Remote Operation Methods for WebSocket Integration
  // ===============================

  /**
   * Create node from remote WebSocket operation
   */
  createNodeFromRemoteOperation(graph: Graph, cellData: any, options: any): void {
    // Use existing node service with remote operation options
    this.infraNodeService.createNodeFromRemoteOperation(graph, cellData, options);
  }

  /**
   * Create edge from remote WebSocket operation
   */
  createEdgeFromRemoteOperation(graph: Graph, cellData: any, options: any): void {
    // Use existing edge service with remote operation options
    this.appEdgeService.createEdgeFromRemoteOperation(graph, cellData, options);
  }

  /**
   * Remove node from remote WebSocket operation
   */
  removeNodeFromRemoteOperation(graph: Graph, cellId: string, options: any): void {
    // Use existing node service with remote operation options
    this.infraNodeService.removeNodeFromRemoteOperation(graph, cellId, options);
  }

  /**
   * Remove edge from remote WebSocket operation
   */
  removeEdgeFromRemoteOperation(graph: Graph, cellId: string, options: any): void {
    // Use existing edge service with remote operation options
    this.appEdgeService.removeEdgeFromRemoteOperation(graph, cellId, options);
  }
}
