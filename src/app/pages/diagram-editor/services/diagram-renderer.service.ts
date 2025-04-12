import { Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

import { LoggerService } from '../../../core/services/logger.service';
import { DiagramService } from './diagram.service';
import { DiagramTheme, ThemeInfo } from '../models/diagram-theme.model';
import { 
  IDiagramRendererService, 
  CellClickData, 
  CellSelectionData, 
  VertexCreationResult,
  EdgeCreationResult
} from './interfaces/diagram-renderer.interface';
import { CellDeleteInfo } from './utils/cell-delete-info.model';

// Import specialized services
import { GraphInitializationService } from './graph/graph-initialization.service';
import { MxGraphPatchingService } from './graph/mx-graph-patching.service';
import { GraphEventHandlingService } from './graph/graph-event-handling.service';
import { GraphUtilsService } from './graph/graph-utils.service';
import { DiagramThemeService } from './theming/diagram-theme.service';
import { VertexManagementService } from './components/vertex-management.service';
import { EdgeManagementService } from './components/edge-management.service';
import { AnchorPointService } from './components/anchor-point.service';
import { DiagramComponentMapperService } from './components/diagram-component-mapper.service';

/**
 * Service for rendering diagrams using mxGraph
 * This is a facade that delegates to specialized services
 */
@Injectable({
  providedIn: 'root'
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
    private themeService: DiagramThemeService,
    private vertexService: VertexManagementService,
    private edgeService: EdgeManagementService,
    private anchorService: AnchorPointService,
    private componentMapper: DiagramComponentMapperService
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
      const cell = this.getCellById(cellId);
      if (!cell) {
        this.logger.warn(`Cannot capture pre-delete info: Cell not found: ${cellId}`);
        return null;
      }
      
      // Determine cell type and use appropriate service
      if (this.graphUtils.isVertex(cell)) {
        return this.vertexService.captureVertexDeleteInfo(cell);
      } else if (this.graphUtils.isEdge(cell)) {
        return this.edgeService.captureEdgeDeleteInfo(cell);
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
    this.graphInitService.initialize(container);
  }
  
  /**
   * Initialize the renderer
   */
  async initializeRenderer(): Promise<void> {
    this.logger.info('Initializing renderer');
    
    try {
      // Initialize graph
      await this.graphInitService.initializeRenderer();
      
      // Get graph instance
      const graph = this.graphInitService.getGraph();
      
      // Initialize all services with the graph instance
      this.eventHandlingService.setGraph(graph);
      this.graphUtils.setGraph(graph);
      this.themeService.setGraph(graph);
      this.vertexService.setGraph(graph);
      this.edgeService.setGraph(graph);
      this.anchorService.setGraph(graph);
      
      // Load default theme
      await this.themeService.switchTheme('default-theme');
      
      // Configure grid based on theme
      this.themeService.configureGrid();
      
      // Initial diagram render
      this.updateDiagram();
      
      this.logger.info('Renderer initialized successfully');
    } catch (error) {
      this.logger.error('Error initializing renderer', error);
      throw error;
    }
  }
  
  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    return this.graphInitService.isInitialized();
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
    
    // Hide all anchor points
    this.anchorService.hideAllAnchorPoints();
    
    // Destroy graph
    this.graphInitService.destroy();
  }
  
  /**
   * Update the diagram based on the current state
   */
  updateDiagram(): void {
    if (!this.isInitialized()) {
      this.logger.error('Cannot update diagram: Renderer not initialized');
      return;
    }
    
    try {
      const diagram = this.diagramService.getCurrentDiagram();
      if (!diagram) {
        this.logger.warn('No diagram to render');
        return;
      }
      
      this.logger.debug(`Rendering diagram: ${diagram.name} with ${diagram.components.length} components`);
      
      // Get graph and model
      const graph = this.graphInitService.getGraph();
      const model = graph.model;
      
      // Start batch update
      model.beginUpdate();
      
      try {
        // Clear existing elements
        const parent = graph.getDefaultParent();
        graph.removeCells(graph.getChildCells(parent));
        
        // Render components
        this.renderDiagramComponents(diagram.components);
      } finally {
        // End batch update
        model.endUpdate();
      }
      
      this.logger.debug('Diagram updated successfully');
    } catch (error) {
      this.logger.error('Error updating diagram', error);
    }
  }
  
  /**
   * Render diagram components
   */
  private renderDiagramComponents(components: any[]): void {
    if (!components || components.length === 0) {
      return;
    }
    
    try {
      // Create all vertices first
      const vertices = components.filter(c => c.type === 'vertex');
      
      for (const vertex of vertices) {
        try {
          // Get position data
          const position = vertex.data.position || { x: 0, y: 0, width: 100, height: 60 };
          const label = vertex.data.label || '';
          const style = vertex.data.style || '';
          
          // Create vertex
          const cellId = this.vertexService.createVertex(
            position.x,
            position.y,
            label,
            position.width,
            position.height,
            style
          );
          
          // Store the cell ID in the component if it doesn't match
          if (vertex.cellId !== cellId) {
            this.componentMapper.updateComponentCellId(vertex.id, cellId);
          }
        } catch (error) {
          this.logger.error(`Error rendering vertex component: ${vertex.id}`, error);
        }
      }
      
      // Then create edges
      const edges = components.filter(c => c.type === 'edge');
      
      for (const edge of edges) {
        try {
          const sourceId = edge.data.source;
          const targetId = edge.data.target;
          const label = edge.data.label || '';
          const style = edge.data.style || '';
          
          // Find source and target components
          const sourceComponent = components.find(c => c.id === sourceId);
          const targetComponent = components.find(c => c.id === targetId);
          
          if (!sourceComponent || !targetComponent) {
            this.logger.warn(`Cannot create edge: Source or target component not found: ${sourceId} -> ${targetId}`);
            continue;
          }
          
          // Create edge between source and target cells
          const edgeId = this.edgeService.createSingleEdgeWithVertices(
            sourceComponent.cellId,
            targetComponent.cellId,
            label,
            style,
            true,
            true
          );
          
          // Store the cell ID in the component if it doesn't match
          if (edge.cellId !== edgeId) {
            this.componentMapper.updateComponentCellId(edge.id, edgeId);
          }
        } catch (error) {
          this.logger.error(`Error rendering edge component: ${edge.id}`, error);
        }
      }
    } catch (error) {
      this.logger.error('Error rendering diagram components', error);
    }
  }
  
  /**
   * Get available themes
   */
  getAvailableThemes(): Observable<ThemeInfo[]> {
    return this.themeService.getAvailableThemes();
  }
  
  /**
   * Get current theme ID
   */
  getCurrentThemeId(): string | null {
    return this.themeService.getCurrentThemeId();
  }
  
  /**
   * Load a theme by ID
   */
  loadTheme(themeId: string): Promise<DiagramTheme> {
    return this.themeService.loadTheme(themeId);
  }
  
  /**
   * Switch to a theme by ID
   */
  switchTheme(themeId: string): Promise<void> {
    return this.themeService.switchTheme(themeId);
  }
  
  /**
   * Check if grid is enabled
   */
  isGridEnabled(): boolean {
    return this.themeService.isGridEnabled();
  }
  
  /**
   * Toggle grid visibility
   */
  toggleGridVisibility(): boolean {
    return this.themeService.toggleGridVisibility();
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
    style?: string
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
    style?: string
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
    style?: string
  ): EdgeCreationResult {
    return this.edgeService.createEdgeBetweenComponents(sourceComponentId, targetComponentId, label, style);
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
    targetIsCell?: boolean
  ): string {
    return this.edgeService.createSingleEdgeWithVertices(
      sourceId,
      targetId,
      label,
      style,
      sourceIsCell,
      targetIsCell
    );
  }
  
  /**
   * Highlight a cell
   */
  highlightCell(cellOrComponentId: string, highlight: boolean = true, isComponentId: boolean = true): void {
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
          this.logger.warn(`Cannot highlight: Component not found or has no cell ID: ${cellOrComponentId}`);
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
    if (!this.isInitialized()) {
      return;
    }
    
    try {
      const component = this.componentMapper.findComponentById(componentId);
      if (!component || !component.cellId) {
        this.logger.warn(`Cannot delete: Component not found or has no cell ID: ${componentId}`);
        // Still try to delete the component from the diagram model
        this.componentMapper.deleteComponent(componentId);
        return;
      }
      
      const cellId = component.cellId;
      
      // Capture all needed information BEFORE deletion
      const deleteInfo = this.capturePreDeleteInfo(cellId);
      
      // Clean up anchor points
      this.anchorService.cleanupForDeletedCell(cellId);
      
      // Delete component from model first
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
        this.logger.warn(`No pre-delete info available, using direct deletion for cell: ${cellId}`);
        const cell = this.getCellById(cellId);
        if (cell) {
          if (this.graphUtils.isVertex(cell)) {
            this.vertexService.deleteVertexByCellId(cellId);
          } else if (this.graphUtils.isEdge(cell)) {
            this.edgeService.deleteEdgeByCellId(cellId);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Error deleting component: ${componentId}`, error);
    }
  }
  
  /**
   * Delete a cell by ID
   */
  deleteCellById(cellId: string): void {
    if (!this.isInitialized() || !cellId) {
      return;
    }
    
    try {
      // Capture all needed information BEFORE deletion
      const deleteInfo = this.capturePreDeleteInfo(cellId);
      
      if (!deleteInfo) {
        this.logger.warn(`Cannot delete: Unable to get info for cell: ${cellId}`);
        return;
      }
      
      // Clean up anchor points
      this.anchorService.cleanupForDeletedCell(cellId);
      
      // Find and delete component first
      const component = this.componentMapper.findComponentByCellId(cellId);
      if (component) {
        this.componentMapper.deleteComponent(component.id);
      }
      
      // Delete the cell using the pre-delete info
      if (deleteInfo.type === 'vertex') {
        this.vertexService.deleteVertexWithInfo(deleteInfo);
      } else if (deleteInfo.type === 'edge') {
        this.edgeService.deleteEdgeWithInfo(deleteInfo);
      }
      
      this.logger.debug(`Deleted ${deleteInfo.description || 'cell'}`);
    } catch (error) {
      this.logger.error(`Error deleting cell: ${cellId}`, error);
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