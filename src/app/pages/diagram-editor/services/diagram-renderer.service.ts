import { Injectable, NgZone } from '@angular/core';
import { Observable } from '../../../core/rxjs-imports';

import { LoggerService } from '../../../core/services/logger.service';
import { DiagramService } from './diagram.service';
import {
  IDiagramRendererService,
  CellClickData,
  CellSelectionData,
  VertexCreationResult,
  EdgeCreationResult,
} from './interfaces/diagram-renderer.interface';
import { CellDeleteInfo } from './utils/cell-delete-info.model';

// Import specialized services
import { GraphInitializationService } from './graph/graph-initialization.service';
import { MxGraphPatchingService } from './graph/mx-graph-patching.service';
import { GraphEventHandlingService } from './graph/graph-event-handling.service';
import { GraphUtilsService } from './graph/graph-utils.service';
import { VertexManagementService } from './components/vertex-management.service';
import { EdgeManagementService } from './components/edge-management.service';
import { AnchorPointService } from './components/anchor-point.service';
import { DiagramComponentMapperService } from './components/diagram-component-mapper.service';

// Import new services for state management and registry
import { StateManagerService } from './state/state-manager.service';
import { EditorState } from './state/editor-state.enum';
import { DiagramElementRegistryService } from './registry/diagram-element-registry.service';

/**
 * Service for rendering diagrams using mxGraph
 * This is a facade that delegates to specialized services
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramRendererService implements IDiagramRendererService {
  constructor(
    private logger: LoggerService,
    private ngZone: NgZone,
    private diagramService: DiagramService,
    // Specialized services
    private graphInitService: GraphInitializationService,
    private patchingService: MxGraphPatchingService,
    private eventHandlingService: GraphEventHandlingService,
    private graphUtils: GraphUtilsService,
    private vertexService: VertexManagementService,
    private edgeService: EdgeManagementService,
    private anchorService: AnchorPointService,
    private componentMapper: DiagramComponentMapperService,
    // New services for state management and registry
    private stateManager: StateManagerService,
    private registry: DiagramElementRegistryService,
  ) {
    this.logger.info('DiagramRendererService initialized');
  }

  /**
   * Capture all information needed about a cell before deletion
   */
  private capturePreDeleteInfo(cellId: string): CellDeleteInfo | null {
    // Check if the cell exists in the registry
    if (!this.registry.hasCellId(cellId)) {
      this.logger.warn(`Cannot capture pre-delete info: Cell not registered: ${cellId}`);
      return null;
    }

    if (!this.isInitialized() || !cellId) {
      return null;
    }

    try {
      const cell = this.getCellById(cellId);
      if (!cell) {
        this.logger.warn(`Cannot capture pre-delete info: Cell not found in graph: ${cellId}`);
        return null;
      }

      // Get component ID from registry
      const componentId = this.registry.getComponentId(cellId);

      // Store registry entry for reference
      const registryEntry = componentId ? this.registry.getEntryByCellId(cellId) : null;

      // Determine cell type and use appropriate service
      if (this.graphUtils.isVertex(cell)) {
        const deleteInfo = this.vertexService.captureVertexDeleteInfo(cell);
        if (deleteInfo && componentId) {
          deleteInfo.componentId = componentId;
        }
        return deleteInfo;
      } else if (this.graphUtils.isEdge(cell)) {
        const deleteInfo = this.edgeService.captureEdgeDeleteInfo(cell);
        if (deleteInfo && componentId) {
          deleteInfo.componentId = componentId;
        }
        return deleteInfo;
      } else {
        this.logger.warn(`Unknown cell type for pre-delete info: ${cellId}`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Error capturing pre-delete info for cell: ${cellId}`, error);
      return null;
    }
  }

  // Event observables for component interaction
  public get cellClicked$(): Observable<CellClickData | null> {
    return this.eventHandlingService.cellClicked$;
  }

  public get cellSelected$(): Observable<CellSelectionData | null> {
    return this.eventHandlingService.cellSelected$;
  }

  /**
   * Initialize the renderer with a container element
   */
  initialize(container: HTMLElement): void {
    this.logger.info('Initializing renderer with container');

    // Get current state
    const currentState = this.stateManager.getCurrentState();

    // If we're already in INITIALIZING or beyond, just update the container
    if (currentState !== EditorState.UNINITIALIZED) {
      this.logger.warn(`Already initialized (state: ${currentState}), updating container only`);

      // Destroy existing graph if any
      if (this.graphInitService.isInitialized()) {
        this.graphInitService.destroy();
      }

      // Initialize with new container
      this.graphInitService.initialize(container);
      return;
    }

    // Transition to INITIALIZING state
    this.stateManager.transitionTo(EditorState.INITIALIZING);

    // Initialize the graph with the container
    this.graphInitService.initialize(container);
  }

  /**
   * Initialize the renderer
   */
  async initializeRenderer(): Promise<void> {
    this.logger.info('Initializing renderer');

    // Get current state
    const currentState = this.stateManager.getCurrentState();

    // If we're not in INITIALIZING state, try to transition to it
    if (currentState !== EditorState.INITIALIZING) {
      this.logger.warn(
        `Not in INITIALIZING state (current: ${currentState}), attempting to transition`,
      );

      // If we're in ERROR or READY state, we can try to reinitialize
      if (currentState === EditorState.ERROR || currentState === EditorState.READY) {
        this.stateManager.transitionTo(EditorState.INITIALIZING);
      } else if (currentState === EditorState.UNINITIALIZED) {
        // If we're in UNINITIALIZED state, we need to initialize first
        this.logger.warn('Cannot initialize renderer: Container not initialized');
        return Promise.reject(new Error('Container not initialized'));
      } else {
        // For other states, we'll try to continue but log a warning
        this.logger.warn(
          `Unusual state for initialization: ${currentState}, proceeding with caution`,
        );
      }
    }

    try {
      // Initialize graph
      await this.graphInitService.initializeRenderer();

      // Get graph instance
      const graph = this.graphInitService.getGraph();

      if (!graph) {
        throw new Error('Failed to get graph instance after initialization');
      }

      // Initialize all services with the graph instance
      this.eventHandlingService.setGraph(graph);
      this.graphUtils.setGraph(graph);
      this.vertexService.setGraph(graph);
      this.edgeService.setGraph(graph);
      this.anchorService.setGraph(graph);

      // Configure grid
      this.configureGrid(graph);

      // Initial diagram render
      this.updateDiagram();

      // Transition to READY state
      this.stateManager.transitionTo(EditorState.READY);
      this.logger.info('Renderer initialized successfully');
    } catch (error) {
      // Transition to ERROR state on failure, but only if we're not already in ERROR state
      if (this.stateManager.getCurrentState() !== EditorState.ERROR) {
        this.stateManager.transitionTo(EditorState.ERROR);
      }
      this.logger.error('Error initializing renderer', error);
      throw error;
    }
  }

  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    // Check if we're in the READY state
    return this.stateManager.getCurrentState() === EditorState.READY;
  }

  /**
   * Wait for graph stabilization
   */
  waitForStabilization(): Promise<void> {
    return this.graphInitService.waitForStabilization();
  }

  /**
   * Destroy the renderer and clean up resources
   */
  destroy(): void {
    this.logger.info('Destroying renderer');

    try {
      // Hide all anchor points
      this.anchorService.hideAllAnchorPoints();

      // Destroy graph
      this.graphInitService.destroy();

      // Reset state to UNINITIALIZED
      this.stateManager.reset();

      this.logger.info('Renderer destroyed successfully');
    } catch (error) {
      this.logger.error('Error destroying renderer', error);
      // Still reset state even if there was an error
      this.stateManager.reset();
    }
  }

  /**
   * Update the diagram based on the current state
   */
  updateDiagram(): void {
    // Use executeIfAllowed to check if the operation is allowed in the current state
    const result = this.stateManager.executeIfAllowed('updateDiagram', () => {
      if (!this.graphInitService.isInitialized()) {
        this.logger.error('Cannot update diagram: Graph not initialized');
        return false;
      }

      try {
        const diagram = this.diagramService.getCurrentDiagram();
        if (!diagram) {
          this.logger.warn('No diagram to render');
          return false;
        }

        this.logger.debug(
          `Rendering diagram: ${diagram.name} with ${diagram.graphData.length} cells`,
        );

        // Get graph and model
        const graph = this.graphInitService.getGraph();
        const model = graph.model;

        // Start batch update
        model.beginUpdate();

        try {
          // Clear existing elements
          const parent = graph.getDefaultParent();
          graph.removeCells(graph.getChildCells(parent));

          // Clear registry before rendering new components
          this.registry.clear();

          // Render cells
          this.renderDiagramCells(diagram.graphData);
        } finally {
          // End batch update
          model.endUpdate();
        }

        this.logger.debug('Diagram updated successfully');
        return true;
      } catch (error) {
        this.logger.error('Error updating diagram', error);
        return false;
      }
    });

    if (result === undefined) {
      this.logger.warn('Cannot update diagram: Operation not allowed in current state');
    }
  }

  /**
   * Render diagram cells
   */
  private renderDiagramCells(cells: any[]): void {
    if (!cells || cells.length === 0) {
      return;
    }

    try {
      // Create all vertices first
      const vertices = cells.filter(c => c.vertex);

      for (const vertex of vertices) {
        try {
          // Get geometry data
          const geometry = vertex.geometry || { x: 0, y: 0, width: 100, height: 60 };
          const label = vertex.value || '';
          const style = vertex.style || '';

          // Create vertex
          const cellId = this.vertexService.createVertex(
            geometry.x,
            geometry.y,
            label,
            geometry.width,
            geometry.height,
            style,
          );

          // Register the cell in the registry
          this.registry.register(cellId, vertex.id, 'vertex');
        } catch (error) {
          this.logger.error(`Error rendering vertex cell: ${vertex.id}`, error);
        }
      }

      // Then create edges
      const edges = cells.filter(c => c.edge);

      for (const edge of edges) {
        try {
          const sourceId = edge.source;
          const targetId = edge.target;
          const label = edge.value || '';
          const style = edge.style || '';

          // Find source and target cells
          const sourceCell = cells.find(c => c.id === sourceId);
          const targetCell = cells.find(c => c.id === targetId);

          if (!sourceCell || !targetCell) {
            this.logger.warn(
              `Cannot create edge: Source or target cell not found: ${sourceId} -> ${targetId}`,
            );
            continue;
          }

          // Create edge between source and target cells
          const edgeId = this.edgeService.createSingleEdgeWithVertices(
            sourceCell.id,
            targetCell.id,
            label,
            style,
            true,
            true,
          );

          // Register the cell in the registry
          this.registry.register(edgeId, edge.id, 'edge');
        } catch (error) {
          this.logger.error(`Error rendering edge cell: ${edge.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error rendering diagram cells', error);
    }
  }

  /**
   * Configure grid settings
   */
  private configureGrid(graph: any): void {
    if (!graph) {
      return;
    }

    // Set default grid settings
    graph.gridSize = 10;
    graph.setGridEnabled(true);
  }

  /**
   * Check if grid is enabled
   */
  isGridEnabled(): boolean {
    const graph = this.getGraph();
    return graph ? graph.isGridEnabled() : false;
  }

  /**
   * Toggle grid visibility
   */
  toggleGridVisibility(): boolean {
    const graph = this.getGraph();
    if (!graph) {
      return false;
    }

    const currentState = graph.isGridEnabled();
    graph.setGridEnabled(!currentState);
    return !currentState;
  }

  /**
   * Create a vertex at the specified coordinates
   */
  createVertex(
    x: number,
    y: number,
    label: string,
    width?: number,
    height?: number,
    style?: string,
  ): string {
    return this.vertexService.createVertex(x, y, label, width, height, style);
  }

  /**
   * Create a vertex with component integration
   */
  createVertexWithIds(
    x: number,
    y: number,
    label: string,
    width?: number,
    height?: number,
    style?: string,
  ): VertexCreationResult {
    return this.vertexService.createVertexWithIds(x, y, label, width, height, style);
  }

  /**
   * Create an edge between two components
   */
  createEdgeBetweenComponents(
    sourceComponentId: string,
    targetComponentId: string,
    label?: string,
    style?: string,
  ): EdgeCreationResult {
    return this.edgeService.createEdgeBetweenComponents(
      sourceComponentId,
      targetComponentId,
      label,
      style,
    );
  }

  /**
   * Create a single edge between vertices
   */
  createSingleEdgeWithVertices(
    sourceId: string,
    targetId: string,
    label?: string,
    style?: string,
    sourceIsCell?: boolean,
    targetIsCell?: boolean,
  ): string {
    return this.edgeService.createSingleEdgeWithVertices(
      sourceId,
      targetId,
      label,
      style,
      sourceIsCell,
      targetIsCell,
    );
  }

  /**
   * Highlight a cell
   */
  highlightCell(
    cellOrComponentId: string,
    highlight: boolean = true,
    isComponentId: boolean = true,
  ): void {
    if (!this.isInitialized()) {
      return;
    }

    try {
      // Get the cell ID
      let cellId = cellOrComponentId;

      // If it's a component ID, look up the cell ID
      if (isComponentId) {
        const component = this.componentMapper.findComponentById(cellOrComponentId);
        if (!component || !component.cellId) {
          this.logger.warn(
            `Cannot highlight: Component not found or has no cell ID: ${cellOrComponentId}`,
          );
          return;
        }
        cellId = component.cellId;
      }

      // Get the cell
      const cell = this.getCellById(cellId);
      if (!cell) {
        this.logger.warn(`Cannot highlight: Cell not found: ${cellId}`);
        return;
      }

      // Determine cell type and highlight accordingly
      if (this.graphUtils.isVertex(cell)) {
        this.vertexService.highlightVertex(cellId, highlight);
      } else if (this.graphUtils.isEdge(cell)) {
        this.edgeService.highlightEdge(cellId, highlight);
      }
    } catch (error) {
      this.logger.error('Error highlighting cell', error);
    }
  }

  /**
   * Delete a component
   */
  deleteComponent(componentId: string): void {
    // Use executeIfAllowed to check if the operation is allowed in the current state
    const result = this.stateManager.executeIfAllowed('deleteCell', () => {
      if (!this.isInitialized()) {
        this.logger.warn('Cannot delete: Renderer not initialized');
        return false;
      }

      try {
        // Transition to DELETING state
        if (!this.stateManager.transitionTo(EditorState.DELETING)) {
          this.logger.warn('Cannot transition to DELETING state');
          return false;
        }

        // First check if the component exists in the registry
        const cellId = this.registry.getCellId(componentId);

        // If not in registry, try the component mapper as fallback
        const component = cellId
          ? { id: componentId, cellId }
          : this.componentMapper.findComponentById(componentId);

        if (!component || !component.cellId) {
          this.logger.warn(`Cannot delete: Component not found or has no cell ID: ${componentId}`);
          // Still try to delete the component from the diagram model
          this.componentMapper.deleteComponent(componentId);

          // Transition back to READY state
          this.stateManager.transitionTo(EditorState.READY);
          return false;
        }

        const cellIdToDelete = component.cellId;

        // Capture all needed information BEFORE deletion
        const deleteInfo = this.capturePreDeleteInfo(cellIdToDelete);

        // Clean up anchor points
        this.anchorService.cleanupForDeletedCell(cellIdToDelete);

        // Unregister from registry
        this.registry.unregister(cellIdToDelete, componentId);

        // Delete component from model
        this.componentMapper.deleteComponent(componentId);

        // Now delete the cell using the pre-delete info
        if (deleteInfo) {
          // Determine cell type and use appropriate service
          if (deleteInfo.type === 'vertex') {
            this.vertexService.deleteVertexWithInfo(deleteInfo);
          } else if (deleteInfo.type === 'edge') {
            this.edgeService.deleteEdgeWithInfo(deleteInfo);
          }

          this.logger.debug(`Deleted ${deleteInfo.description || 'cell'}`);
        } else {
          // Fall back to direct deletion if we couldn't get pre-delete info
          this.logger.warn(
            `No pre-delete info available, using direct deletion for cell: ${cellIdToDelete}`,
          );
          const cell = this.getCellById(cellIdToDelete);
          if (cell) {
            if (this.graphUtils.isVertex(cell)) {
              this.vertexService.deleteVertexByCellId(cellIdToDelete);
            } else if (this.graphUtils.isEdge(cell)) {
              this.edgeService.deleteEdgeByCellId(cellIdToDelete);
            }
          }
        }

        // Transition back to READY state
        this.stateManager.transitionTo(EditorState.READY);
        return true;
      } catch (error) {
        this.logger.error(`Error deleting component: ${componentId}`, error);
        // Transition to ERROR state on failure
        this.stateManager.transitionTo(EditorState.ERROR);
        return false;
      }
    });

    if (result === undefined) {
      this.logger.warn('Cannot delete component: Operation not allowed in current state');
    }
  }

  /**
   * Delete a cell by ID
   */
  deleteCellById(cellId: string): void {
    // Use executeIfAllowed to check if the operation is allowed in the current state
    const result = this.stateManager.executeIfAllowed('deleteCell', () => {
      if (!this.isInitialized() || !cellId) {
        this.logger.warn('Cannot delete: Renderer not initialized or no cell ID provided');
        return false;
      }

      try {
        // Transition to DELETING state
        if (!this.stateManager.transitionTo(EditorState.DELETING)) {
          this.logger.warn('Cannot transition to DELETING state');
          return false;
        }

        // Capture all needed information BEFORE deletion
        const deleteInfo = this.capturePreDeleteInfo(cellId);

        if (!deleteInfo) {
          this.logger.warn(`Cannot delete: Unable to get info for cell: ${cellId}`);
          // Transition back to READY state
          this.stateManager.transitionTo(EditorState.READY);
          return false;
        }

        // Clean up anchor points
        this.anchorService.cleanupForDeletedCell(cellId);

        // Find component ID from registry
        const componentId = this.registry.getComponentId(cellId);

        // If not in registry, try the component mapper as fallback
        const component = componentId
          ? { id: componentId, cellId }
          : this.componentMapper.findComponentByCellId(cellId);

        if (component) {
          // Unregister from registry
          this.registry.unregister(cellId, component.id);

          // Delete component from model
          this.componentMapper.deleteComponent(component.id);
        }

        // Delete the cell using the pre-delete info
        if (deleteInfo.type === 'vertex') {
          this.vertexService.deleteVertexWithInfo(deleteInfo);
        } else if (deleteInfo.type === 'edge') {
          this.edgeService.deleteEdgeWithInfo(deleteInfo);
        }

        this.logger.debug(`Deleted ${deleteInfo.description || 'cell'}`);

        // Transition back to READY state
        this.stateManager.transitionTo(EditorState.READY);
        return true;
      } catch (error) {
        this.logger.error(`Error deleting cell: ${cellId}`, error);
        // Transition to ERROR state on failure
        this.stateManager.transitionTo(EditorState.ERROR);
        return false;
      }
    });

    if (result === undefined) {
      this.logger.warn('Cannot delete cell: Operation not allowed in current state');
    }
  }

  /**
   * Set edge creation mode
   */
  setEdgeCreationMode(enabled: boolean): void {
    this.edgeService.setEdgeCreationMode(enabled);
  }

  /**
   * Get a cell by ID
   */
  getCellById(id: string): any {
    return this.graphUtils.getCellById(id);
  }

  /**
   * Get the graph instance
   */
  getGraph(): any {
    return this.graphInitService.getGraph();
  }

  /**
   * Get the event handling service
   * This gives access to additional events and state
   */
  getEventHandlingService(): GraphEventHandlingService {
    return this.eventHandlingService;
  }
}
