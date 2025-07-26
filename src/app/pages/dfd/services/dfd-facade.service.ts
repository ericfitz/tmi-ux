/**
 * DFD Facade Service
 * 
 * This service provides a unified interface for DFD component operations by coordinating
 * multiple specialized services. It implements the Facade pattern to simplify component dependencies.
 * 
 * Key functionality:
 * - Coordinates node operations (creation, deletion, manipulation) via DfdNodeService
 * - Manages edge operations (connection validation, creation, vertices) via DfdEdgeService
 * - Handles event processing (keyboard, mouse, context menu) via DfdEventHandlersService
 * - Provides diagram export capabilities via DfdExportService
 * - Manages diagram loading and data operations via DfdDiagramService
 * - Simplifies component architecture by reducing direct service dependencies
 * - Provides consistent API for all DFD operations from a single entry point
 * - Coordinates cross-service operations that require multiple service interactions
 * - Maintains separation of concerns while providing unified functionality
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Edge, Node, Graph } from '@antv/x6';
import { ConnectionValidationArgs, MagnetValidationArgs } from './dfd-edge.service';
import { NodeType } from '../domain/value-objects/node-info';
import { DfdNodeService } from './dfd-node.service';
import { DfdEdgeService } from './dfd-edge.service';
import { DfdEventHandlersService } from './dfd-event-handlers.service';
import { DfdExportService } from './dfd-export.service';
import { DfdDiagramService } from './dfd-diagram.service';

/**
 * Facade service that simplifies DFD component dependencies by providing
 * a single entry point for common operations across multiple services.
 * 
 * This reduces the number of direct service dependencies in the component
 * and provides a cleaner API for coordinating operations.
 */
@Injectable()
export class DfdFacadeService {

  constructor(
    private nodeService: DfdNodeService,
    private edgeService: DfdEdgeService,
    private eventHandlersService: DfdEventHandlersService,
    private exportService: DfdExportService,
    private diagramService: DfdDiagramService,
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
    isInitialized: boolean
  ): Observable<any> {
    return this.nodeService.addGraphNode(shapeType, containerWidth, containerHeight, diagramId, isInitialized);
  }

  // ===============================
  // Edge Operations  
  // ===============================

  /**
   * Handle edge added events
   */
  handleEdgeAdded(edge: Edge, graph: Graph, diagramId: string, isInitialized: boolean): Observable<any> {
    return this.edgeService.handleEdgeAdded(edge, graph, diagramId, isInitialized);
  }

  /**
   * Handle edge vertices changes
   */
  handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
    graph: Graph,
    diagramId: string,
    isInitialized: boolean
  ): Observable<any> {
    return this.edgeService.handleEdgeVerticesChanged(edgeId, vertices, graph, diagramId, isInitialized);
  }

  /**
   * Add an inverse connection for an edge
   */
  addInverseConnection(originalEdge: Edge, graph: Graph, diagramId: string): Observable<any> {
    return this.edgeService.addInverseConnection(originalEdge, graph, diagramId);
  }

  // ===============================
  // Event Handler Operations
  // ===============================

  /**
   * Initialize event handlers
   */
  initializeEventHandlers(x6GraphAdapter: any): void {
    this.eventHandlersService.initialize(x6GraphAdapter);
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
   * Handle window resize
   */
  onWindowResize(graphContainer: any, resizeTimeout: number | null, x6GraphAdapter: any): number | null {
    return this.eventHandlersService.onWindowResize(graphContainer, resizeTimeout, x6GraphAdapter);
  }

  /**
   * Handle key down events
   */
  onKeyDown(event: KeyboardEvent, diagramId: string, isInitialized: boolean, x6GraphAdapter: any): void {
    this.eventHandlersService.onKeyDown(event, diagramId, isInitialized, x6GraphAdapter);
  }

  /**
   * Delete selected cells
   */
  onDeleteSelected(isInitialized: boolean, x6GraphAdapter: any): void {
    this.eventHandlersService.onDeleteSelected(isInitialized, x6GraphAdapter);
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
  openThreatEditor(threatModelId: string | null, dfdId: string | null): void {
    this.eventHandlersService.openThreatEditor(threatModelId, dfdId);
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
  moveForward(x6GraphAdapter: any): void {
    this.eventHandlersService.moveForward(x6GraphAdapter);
  }

  moveBackward(x6GraphAdapter: any): void {
    this.eventHandlersService.moveBackward(x6GraphAdapter);
  }

  moveToFront(x6GraphAdapter: any): void {
    this.eventHandlersService.moveToFront(x6GraphAdapter);
  }

  moveToBack(x6GraphAdapter: any): void {
    this.eventHandlersService.moveToBack(x6GraphAdapter);
  }

  /**
   * Edit cell text
   */
  editCellText(x6GraphAdapter: any): void {
    this.eventHandlersService.editCellText(x6GraphAdapter);
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
  undo(isInitialized: boolean, x6GraphAdapter: any): void {
    this.eventHandlersService.undo(isInitialized, x6GraphAdapter);
  }

  redo(isInitialized: boolean, x6GraphAdapter: any): void {
    this.eventHandlersService.redo(isInitialized, x6GraphAdapter);
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
  exportDiagram(format: 'png' | 'jpeg' | 'svg', threatModelName?: string, diagramName?: string): void {
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
    return this.edgeService.isMagnetValid(args);
  }

  /**
   * Check if a connection can be made between two ports
   */
  isConnectionValid(args: ConnectionValidationArgs): boolean {
    return this.edgeService.isConnectionValid(args);
  }

  /**
   * Check if a connection can be made between two nodes based on DFD rules
   */
  isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean {
    return this.edgeService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Validate node shape type
   */
  validateNodeShape(nodeType: string, nodeId: string): void {
    this.edgeService.validateNodeShape(nodeType, nodeId);
  }

  /**
   * Validate that an X6 node was created with the correct shape property
   */
  validateX6NodeShape(x6Node: Node): void {
    this.edgeService.validateX6NodeShape(x6Node);
  }

  /**
   * Get valid connection targets for a given source shape
   */
  getValidConnectionTargets(sourceShape: string): string[] {
    return this.edgeService.getValidConnectionTargets(sourceShape);
  }

  /**
   * Get all valid node shape types
   */
  getValidNodeShapes(): string[] {
    return this.edgeService.getValidNodeShapes();
  }

  /**
   * Check if two shapes can be connected according to DFD rules
   */
  canShapesConnect(sourceShape: string, targetShape: string): boolean {
    return this.edgeService.canShapesConnect(sourceShape, targetShape);
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
    nodeConfigurationService: any
  ): void {
    this.diagramService.loadDiagramCellsBatch(cells, graph, diagramId, nodeConfigurationService);
  }
}