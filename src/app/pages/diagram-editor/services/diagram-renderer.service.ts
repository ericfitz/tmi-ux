import { Injectable, NgZone } from '@angular/core';
import { Observable, Subscription } from '../../../core/rxjs-imports';
import { constants } from '@maxgraph/core';

import { LoggerService } from '../../../core/services/logger.service';
import { DiagramService } from './diagram.service';
import { DiagramThemeService } from './theming/diagram-theme.service';
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

// Import new services for state management
import { StateManagerService } from './state/state-manager.service';
import { EditorState } from './state/editor-state.enum';

/**
 * Service for rendering diagrams using mxGraph
 * This is a facade that delegates to specialized services
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramRendererService implements IDiagramRendererService {
  // Track theme change subscriptions
  private themeSubscription: Subscription | null = null;

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
    // New services for state management
    private stateManager: StateManagerService,
    // Theme service
    private themeService: DiagramThemeService,
  ) {
    this.logger.info('DiagramRendererService initialized');
  }

  /**
   * Capture all information needed about a cell before deletion
   */
  private capturePreDeleteInfo(cellId: string): CellDeleteInfo | null {
    if (!this.isInitialized() || !cellId) {
      return null;
    }

    try {
      const graphCell = this.getCellById(cellId);
      if (!graphCell) {
        this.logger.debug(`Cannot capture pre-delete info: Cell not found in graph: ${cellId}`);
        return null;
      }

      // Find cell by ID
      const modelCell = this.diagramService.findCellById(cellId);
      const componentId = modelCell?.id;

      // Create basic delete info
      if (this.graphUtils.isVertex(graphCell)) {
        const deleteInfo = this.vertexService.captureVertexDeleteInfo(graphCell);
        if (deleteInfo && componentId) {
          deleteInfo.componentId = componentId;
        }
        return deleteInfo;
      } else if (this.graphUtils.isEdge(graphCell)) {
        const deleteInfo = this.edgeService.captureEdgeDeleteInfo(graphCell);
        if (deleteInfo && componentId) {
          deleteInfo.componentId = componentId;
        }
        return deleteInfo;
      } else {
        this.logger.debug(`Unknown cell type for pre-delete info: ${cellId}`);
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

      // Apply the current theme
      this.applyCurrentTheme();

      // Subscribe to theme changes
      this.subscribeToThemeChanges();

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
   * Apply the current theme to the graph
   */
  private applyCurrentTheme(): void {
    const graph = this.getGraph();
    if (!graph) {
      this.logger.warn('Cannot apply theme: Graph not initialized');
      return;
    }

    try {
      // Apply the stylesheet to the graph
      // This will automatically refresh all cells with the new styles
      this.themeService.applyStylesheetToGraph(graph);

      this.logger.debug('Applied current theme to graph');
    } catch (error) {
      this.logger.error('Error applying theme to graph', error);
    }
  }

  /**
   * Subscribe to theme changes
   */
  private subscribeToThemeChanges(): void {
    // Clean up existing subscription if any
    if (this.themeSubscription) {
      this.themeSubscription.unsubscribe();
      this.themeSubscription = null;
    }

    // Subscribe to theme changes
    this.themeSubscription = this.themeService.themeChanged$.subscribe(themeName => {
      this.logger.debug(`Theme changed to: ${themeName}, updating graph`);
      this.applyCurrentTheme();
    });
  }

  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    // Get current state
    const currentState = this.stateManager.getCurrentState();

    // Consider these states as "initialized" states
    const initializedStates = [
      EditorState.READY,
      EditorState.DELETING,
      EditorState.EDITING_LABEL,
      EditorState.CREATING_EDGE,
      EditorState.SAVING,
    ];

    // Check if current state is in the list of initialized states
    return initializedStates.includes(currentState);
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
      // Clean up theme subscription
      if (this.themeSubscription) {
        this.themeSubscription.unsubscribe();
        this.themeSubscription = null;
      }

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

          // Render cells
          this.renderDiagramCells(diagram.graphData);

          // Apply the current theme to ensure all cells use the current theme
          this.applyCurrentTheme();
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

          // Determine the style name based on vertex type
          let styleName = 'process'; // Default to process style

          // Convert style string to a style name if possible
          const styleStr = vertex.style || '';

          // If the style contains shape=cylinder, use the cylinder style for store objects
          if (styleStr.includes('shape=cylinder')) {
            // Create a style object with explicit cylinder properties
            const style = {
              shape: 'cylinder',
              fillColor: '#ffffff',
              strokeColor: '#000000',
              strokeWidth: 2,
              fontColor: '#000000',
              gradientColor: '#aaaaaa',
              gradientDirection: 'north',
              cylinder3d: true,
              shadow: true,
            };

            this.logger.debug(
              `Creating store object with cylinder style: ${JSON.stringify(style)}`,
            );

            // Create vertex with cylinder style
            this.vertexService.createVertex(
              geometry.x,
              geometry.y,
              label,
              geometry.width,
              geometry.height,
              style,
            );

            // Skip the rest of the loop since we've already created the vertex
            continue;
          }
          // If the style contains shape=actor, use the actor style
          else if (styleStr.includes('shape=actor')) {
            styleName = 'actor';
          }
          // If it's a rounded rectangle, use the process style
          else if (styleStr.includes('rounded=1') || styleStr.includes('rounded=true')) {
            styleName = 'process';
          }

          // Create a style object with baseStyleNames for non-cylinder shapes
          const style = { baseStyleNames: [styleName] };

          // Create vertex
          this.vertexService.createVertex(
            geometry.x,
            geometry.y,
            label,
            geometry.width,
            geometry.height,
            style,
          );
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

          // Determine the style name based on edge type
          let styleName = 'flow'; // Default to flow style

          // Convert style string to a style name if possible
          const styleStr = edge.style || '';

          // If the style contains specific edge styles, use the appropriate named style
          if (styleStr.includes('dashed=1') || styleStr.includes('dashed=true')) {
            if (styleStr.includes('endArrow=none')) {
              styleName = 'association';
            } else if (styleStr.includes('endArrow=open')) {
              styleName = 'dependency';
            }
          }

          // Create a style object with baseStyleNames
          const style = { baseStyleNames: [styleName] };

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
          this.edgeService.createSingleEdgeWithVertices(
            sourceCell.id,
            targetCell.id,
            label,
            style,
            true,
            true,
          );
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
    style?: string | Record<string, any>,
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
    style?: string | Record<string, any>,
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
    style?: string | Record<string, any>,
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
    style?: string | Record<string, any>,
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
        // Find the cell in the diagram
        const cell = this.diagramService.findCellById(cellOrComponentId);
        if (!cell) {
          this.logger.warn(`Cannot highlight: Cell not found: ${cellOrComponentId}`);
          return;
        }
        // Use the cell's ID
        cellId = cell.id;
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
  deleteComponent(cellId: string): void {
    // Check if we're already in DELETING state
    const currentState = this.stateManager.getCurrentState();
    const isAlreadyDeleting = currentState === EditorState.DELETING;

    // If we're already in DELETING state, use confirmDeletion operation
    // Otherwise use deleteCell operation
    const operationToUse = isAlreadyDeleting ? 'confirmDeletion' : 'deleteCell';

    // Use executeIfAllowed to check if the operation is allowed in the current state
    const result = this.stateManager.executeIfAllowed(operationToUse, () => {
      if (!this.isInitialized()) {
        this.logger.warn('Cannot delete: Renderer not initialized');
        return false;
      }

      try {
        // Only transition to DELETING state if we're not already in it
        if (!isAlreadyDeleting && !this.stateManager.transitionTo(EditorState.DELETING)) {
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

        // Delete the cell from the diagram model
        this.diagramService.deleteCell(cellId);

        // Now delete the cell using the pre-delete info
        if (deleteInfo.type === 'vertex') {
          this.vertexService.deleteVertexWithInfo(deleteInfo);
        } else if (deleteInfo.type === 'edge') {
          this.edgeService.deleteEdgeWithInfo(deleteInfo);
        }

        this.logger.debug(`Deleted ${deleteInfo.description || 'cell'}`);

        // Only transition back to READY state if we initiated the DELETING state
        if (!isAlreadyDeleting) {
          this.stateManager.transitionTo(EditorState.READY);
        }
        return true;
      } catch (error) {
        this.logger.error(`Error deleting cell: ${cellId}`, error);
        // Transition to ERROR state on failure
        this.stateManager.transitionTo(EditorState.ERROR);
        return false;
      }
    });

    if (result === undefined) {
      this.logger.warn(
        `Cannot delete cell: Operation "${operationToUse}" not allowed in current state "${currentState}"`,
      );
    }
  }

  /**
   * Delete a cell by ID
   */
  deleteCellById(cellId: string): void {
    // Check if we're already in DELETING state
    const currentState = this.stateManager.getCurrentState();
    const isAlreadyDeleting = currentState === EditorState.DELETING;

    // If we're already in DELETING state, use confirmDeletion operation
    // Otherwise use deleteCell operation
    const operationToUse = isAlreadyDeleting ? 'confirmDeletion' : 'deleteCell';

    // Use executeIfAllowed to check if the operation is allowed in the current state
    const result = this.stateManager.executeIfAllowed(operationToUse, () => {
      if (!this.isInitialized() || !cellId) {
        this.logger.warn('Cannot delete: Renderer not initialized or no cell ID provided');
        return false;
      }

      try {
        // Only transition to DELETING state if we're not already in it
        if (!isAlreadyDeleting && !this.stateManager.transitionTo(EditorState.DELETING)) {
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

        // Delete the cell from the diagram model
        this.diagramService.deleteCell(cellId);

        // Delete the cell using the pre-delete info
        if (deleteInfo.type === 'vertex') {
          this.vertexService.deleteVertexWithInfo(deleteInfo);
        } else if (deleteInfo.type === 'edge') {
          this.edgeService.deleteEdgeWithInfo(deleteInfo);
        }

        this.logger.debug(`Deleted ${deleteInfo.description || 'cell'}`);

        // Only transition back to READY state if we initiated the DELETING state
        if (!isAlreadyDeleting) {
          this.stateManager.transitionTo(EditorState.READY);
        }
        return true;
      } catch (error) {
        this.logger.error(`Error deleting cell: ${cellId}`, error);
        // Transition to ERROR state on failure
        this.stateManager.transitionTo(EditorState.ERROR);
        return false;
      }
    });

    if (result === undefined) {
      this.logger.warn(
        `Cannot delete cell: Operation "${operationToUse}" not allowed in current state "${currentState}"`,
      );
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
