import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import * as mxgraph from '@maxgraph/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../core/services/logger.service';
import { DiagramService } from './diagram.service';
import { DiagramComponent } from '../models/diagram.model';

/**
 * Interface for cell click event data
 */
export interface CellClickData {
  cellId: string;
  cellType: 'vertex' | 'edge';
  cell: any; // mxgraph cell
}

/**
 * Service responsible for rendering diagrams with maxGraph
 */
@Injectable({
  providedIn: 'root'
})
export class DiagramRendererService {
  // maxGraph instances
  private graph: any = null;
  private model: any = null;
  
  // Track initialization state
  private _isInitialized = new BehaviorSubject<boolean>(false);
  public isInitialized$ = this._isInitialized.asObservable();
  
  // Cell click events
  private _cellClicked = new BehaviorSubject<CellClickData | null>(null);
  public cellClicked$ = this._cellClicked.asObservable();
  
  // Cell selection events
  private _cellSelected = new BehaviorSubject<{ cellId: string; cellType: 'vertex' | 'edge' } | null>(null);
  public cellSelected$ = this._cellSelected.asObservable();
  
  // Edge creation mode
  private _edgeCreationMode = false;
  
  // Container reference
  private container: HTMLElement | null = null;
  
  constructor(
    private logger: LoggerService,
    private diagramService: DiagramService,
    private ngZone: NgZone
  ) {
    this.logger.info('DiagramRendererService initialized');
  }
  
  /**
   * Initialize maxGraph with a container element
   */
  initialize(container: HTMLElement): void {
    this.logger.info('Initializing maxGraph');
    this.container = container;
    
    try {
      // Run outside Angular zone for better performance
      this.ngZone.runOutsideAngular(() => {
        // Create graph instance
        this.graph = new mxgraph.Graph(container);
        
        if (!this.graph) {
          throw new Error('Failed to create maxGraph instance');
        }
        
        // Store the model reference
        this.model = this.graph.model;
        
        // Configure graph
        this.configureGraph();
        
        // Set up event handlers
        this.setupEventHandlers();
        
        this._isInitialized.next(true);
        this.logger.info('maxGraph initialized successfully');
      });
    } catch (error) {
      this.logger.error('Failed to initialize maxGraph', error);
      this._isInitialized.next(false);
    }
  }
  
  /**
   * Configure the graph instance
   */
  private configureGraph(): void {
    if (!this.graph) {
      this.logger.error('Cannot configure graph: Graph not initialized');
      return;
    }
    
    // Grid settings
    this.graph.setGridEnabled(true);
    this.graph.setGridSize(10);
    
    // Enable panning
    this.graph.setPanning(true);
    
    // Configure visual appearance
    const style = this.graph.getStylesheet().getDefaultVertexStyle();
    style['fillColor'] = '#ffffff';
    style['strokeColor'] = '#1565c0';
    style['rounded'] = true;
    style['shadow'] = true;
    
    const edgeStyle = this.graph.getStylesheet().getDefaultEdgeStyle();
    edgeStyle['strokeColor'] = '#78909c';
    edgeStyle['edgeStyle'] = 'orthogonalEdgeStyle';
    edgeStyle['shadow'] = true;
    edgeStyle['rounded'] = true;
    
    // Define a selected style for highlighting vertices
    const highlightedStyle: Record<string, any> = {};
    Object.assign(highlightedStyle, style);
    highlightedStyle['strokeColor'] = '#ff0000';
    highlightedStyle['strokeWidth'] = 3;
    this.graph.getStylesheet().putCellStyle('highlighted', highlightedStyle);
    
    // Define edge creation mode style
    const edgeCreationStyle: Record<string, any> = {};
    Object.assign(edgeCreationStyle, style);
    edgeCreationStyle['strokeColor'] = '#4caf50';
    edgeCreationStyle['strokeWidth'] = 2;
    edgeCreationStyle['fillColor'] = '#e8f5e9';
    this.graph.getStylesheet().putCellStyle('edgeCreation', edgeCreationStyle);
    
    this.logger.debug('Graph instance configured');
  }
  
  /**
   * Set up graph event handlers
   */
  private setupEventHandlers(): void {
    if (!this.graph) {
      this.logger.error('Cannot set up event handlers: Graph not initialized');
      return;
    }
    
    // Use a more direct approach for cell click handling
    // This avoids the issue with mouseMove not being a function
    this.graph.addListener('click', (sender: any, evt: any) => {
      try {
        const cell = evt.getProperty('cell');
        this.logger.debug('Click event received from graph', {
          hasCell: Boolean(cell),
          eventType: evt.name,
          eventSource: evt.source ? evt.source.toString() : 'unknown'
        });
        
        if (cell) {
          // Run inside Angular zone to update UI
          this.ngZone.run(() => {
            this.handleCellClick(cell);
          });
        } else {
          this.logger.debug('Click was not on a cell');
          // Clicked on the background - deselect any selected cells
          this.ngZone.run(() => {
            // Clear the graph selection
            if (this.graph) {
              this.logger.info('Clearing graph selection due to background click');
              this.graph.clearSelection();
            }
            
            // Explicitly emit null selection
            this.logger.info('Manually emitting null selection due to background click');
            this.emitSelectionChanged(null);
          });
        }
      } catch (error) {
        this.logger.error('Error handling click event', error);
      }
    });
    
    // Add selection change listener
    this.graph.getSelectionModel().addListener('changed', (_sender: any, evt: any) => {
      try {
        // Get the current selection
        const cells = this.graph.getSelectionModel().cells;
        const cellsArray = Object.values(cells || {});
        
        this.logger.info(`Selection changed: ${cellsArray.length} cells selected`);
        
        // Dump detailed information about selected cells for debugging
        if (cellsArray.length > 0) {
          cellsArray.forEach((cell: any, index) => {
            this.logger.info(`Selected cell ${index}: id=${cell.id}, vertex=${this.isVertex(cell)}, edge=${this.isEdge(cell)}`);
          });
        }
        
        // Run inside Angular zone to update UI
        this.ngZone.run(() => {
          if (cellsArray.length > 0) {
            const selectedCell = cellsArray[0] as any; // Just handle the first selected cell for now
            const cellId = selectedCell.id;
            const cellType = this.isVertex(selectedCell) ? 'vertex' : this.isEdge(selectedCell) ? 'edge' : 'unknown';
            
            this.logger.info(`Processing selection: cellId=${cellId}, cellType=${cellType}`);
            
            if (cellType !== 'unknown') {
              this.emitSelectionChanged({ cellId, cellType: cellType as 'vertex' | 'edge' });
            } else {
              this.logger.warn(`Unknown cell type in selection: ${cellId}`);
              this.emitSelectionChanged(null);
            }
          } else {
            this.logger.info('No cells selected, clearing selection state');
            this.emitSelectionChanged(null);
          }
        });
      } catch (error) {
        this.logger.error('Error handling selection change event', error);
      }
    });
    
    // Complete mouse listener implementation with all required methods
    const mouseListener = {
      mouseDown: (_sender: any, me: any) => {
        this.logger.debug('Mouse down on graph', {
          x: me.graphX,
          y: me.graphY,
          event: me.getEvent().type
        });
      },
      mouseMove: (_sender: any, _me: any) => {
        // Empty implementation to avoid "is not a function" error
      },
      mouseUp: (_sender: any, _me: any) => {
        // Empty implementation to avoid "is not a function" error
      }
    };
    
    // Add the complete mouse listener
    this.graph.addMouseListener(mouseListener);
    
    this.logger.debug('Graph event handlers set up');
  }
  
  /**
   * Emit a selection changed event
   */
  emitSelectionChanged(selection: { cellId: string; cellType: 'vertex' | 'edge' } | null): void {
    this._cellSelected.next(selection);
    this.logger.debug(`Selection changed: ${selection ? `${selection.cellType} ${selection.cellId}` : 'none'}`);
  }
  
  /**
   * Handle cell click events
   */
  /**
   * Helper method to check if a cell is a vertex
   */
  private isVertex(cell: any): boolean {
    // Try multiple ways to detect if a cell is a vertex
    return cell.vertex === 1 || 
           cell.getAttribute('vertex') === 1 || 
           (cell.style && cell.style.includes('shape')) || 
           Boolean(cell.geometry && cell.geometry.width && cell.geometry.height);
  }
  
  /**
   * Helper method to check if a cell is an edge
   */
  private isEdge(cell: any): boolean {
    // Try multiple ways to detect if a cell is an edge
    return cell.edge === 1 || 
           cell.getAttribute('edge') === 1 || 
           (cell.style && cell.style.includes('edgeStyle')) || 
           Boolean(cell.source && cell.target);
  }
  
  private handleCellClick(cell: any): void {
    if (!cell) return;
    
    const cellId = cell.id;
    
    // Log cell properties for debugging
    this.logger.debug('Cell properties:', {
      id: cell.id,
      vertex: cell.vertex,
      edge: cell.edge,
      value: cell.value,
      style: cell.style,
      geometry: cell.geometry ? { 
        width: cell.geometry.width,
        height: cell.geometry.height,
        x: cell.geometry.x,
        y: cell.geometry.y
      } : null,
      source: cell.source ? cell.source.id : null,
      target: cell.target ? cell.target.id : null
    });
    
    // Determine cell type using helper methods
    const isVertex = this.isVertex(cell);
    const isEdge = this.isEdge(cell);
    
    this.logger.info(`Cell clicked: ${cellId} (${isVertex ? 'vertex' : isEdge ? 'edge' : 'unknown'})`);
    
    // Look up if there's a component associated with this cell
    const component = this.diagramService.findComponentByCellId(cellId);
    
    if (component) {
      this.logger.debug(`Found component with ID ${component.id} for cell ${cellId}`);
    } else {
      this.logger.debug(`No component found for cell ${cellId}`);
    }
    
    // Select this cell in the graph and force a selection change notification
    if (this.graph) {
      this.logger.info(`Selecting cell ${cellId} in graph`);
      this.graph.setSelectionCell(cell);
      
      // Explicitly emit the selection change since the event might not fire
      const cellType = isVertex ? 'vertex' : isEdge ? 'edge' : 'unknown';
      if (cellType !== 'unknown') {
        this.logger.info(`Manually emitting selection for cell ${cellId}`);
        this.emitSelectionChanged({ cellId, cellType: cellType as 'vertex' | 'edge' });
      }
    }
    
    // Emit cell click event for component to handle
    if (isVertex) {
      this._cellClicked.next({
        cellId,
        cellType: 'vertex',
        cell
      });
      this.logger.info(`Emitted vertex click event for cell ${cellId}`);
    } else if (isEdge) {
      this._cellClicked.next({
        cellId,
        cellType: 'edge',
        cell
      });
      this.logger.info(`Emitted edge click event for cell ${cellId}`);
    } else {
      this.logger.warn(`Cell type not recognized for ${cellId}, not emitting event`);
    }
  }
  
  /**
   * Handle graph change events
   */
  private handleGraphChange(): void {
    // TODO: Sync changes to diagram model
    this.logger.debug('Graph changed');
  }
  
  /**
   * Update the rendered diagram based on the model
   */
  updateDiagram(): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot update diagram: Graph not initialized');
      return;
    }
    
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.warn('No diagram to render');
      return;
    }
    
    try {
      // Begin graph update
      this.model.beginUpdate();
      
      try {
        // Clear existing graph
        const cells = this.graph.getChildVertices(this.graph.getDefaultParent());
        this.graph.removeCells(cells);
        
        // Add components to graph
        this.renderDiagramComponents(diagram.components);
        
        this.logger.info(`Diagram updated: ${diagram.name} (${diagram.components.length} components)`);
      } finally {
        // End graph update (applies layout)
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error updating diagram', error);
    }
  }
  
  /**
   * Render diagram components to the graph
   */
  private renderDiagramComponents(components: DiagramComponent[]): void {
    if (!this.graph) {
      this.logger.error('Cannot render components: Graph not initialized');
      return;
    }
    
    const parent = this.graph.getDefaultParent();
    
    // Log how many components we're rendering
    this.logger.debug(`Rendering ${components.length} diagram components`);
    
    // Track the cells we create for each component
    const vertexComponents: DiagramComponent[] = [];
    const edgeComponents: DiagramComponent[] = [];
    // Track cell IDs to update component model in a single operation later
    const componentIdToCellId: Map<string, string> = new Map();
    
    // First pass: Create all vertices
    for (const component of components) {
      if (component.type === 'vertex') {
        const { x, y, width, height, label, style } = component.data;
        
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const vertex = this.graph.insertVertex(
          parent,
          cellId, // Use UUID for cell ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          style || 'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // Store the mapping for later batch updating
        componentIdToCellId.set(component.id, cellId);
        
        // Add to vertices list for debugging
        vertexComponents.push(component);
        this.logger.debug(`Rendered vertex: component=${component.id}, cell=${cellId}`);
      } else if (component.type === 'edge') {
        // Collect edges for second pass
        edgeComponents.push(component);
      }
    }
    
    // Second pass: Create all edges
    let edgesRendered = 0;
    let edgesSkipped = 0;
    
    for (const component of edgeComponents) {
      const { source, target, label, style } = component.data;
      
      // Find the source and target components
      const sourceComponent = components.find(c => c.id === source);
      const targetComponent = components.find(c => c.id === target);
      
      if (!sourceComponent || !targetComponent) {
        this.logger.warn(`Could not create edge ${component.id}: missing source or target component`);
        edgesSkipped++;
        continue;
      }
      
      // Get the cell IDs from our mapping
      const sourceCellId = componentIdToCellId.get(sourceComponent.id) || sourceComponent.cellId;
      const targetCellId = componentIdToCellId.get(targetComponent.id) || targetComponent.cellId;
      
      if (!sourceCellId || !targetCellId) {
        this.logger.warn(`Could not create edge ${component.id}: missing source or target cell ID`);
        edgesSkipped++;
        continue;
      }
      
      const sourceCell = this.getCellById(sourceCellId);
      const targetCell = this.getCellById(targetCellId);
      
      if (sourceCell && targetCell) {
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          cellId, // Use UUID for cell ID
          label || '',
          sourceCell,
          targetCell,
          style || 'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Store the mapping for later batch updating
        componentIdToCellId.set(component.id, cellId);
        
        this.logger.debug(`Rendered edge: component=${component.id}, cell=${cellId}, source=${source}, target=${target}`);
        edgesRendered++;
      } else {
        this.logger.warn(`Could not create edge ${component.id}: missing source (${source}) or target (${target}) cell`);
        this.logger.debug(`Source cell found: ${Boolean(sourceCell)}, Target cell found: ${Boolean(targetCell)}`);
        edgesSkipped++;
      }
    }
    
    // After all cells are created, update component references in a batch to avoid circular updates
    this.batchUpdateComponentCellIds(componentIdToCellId);
    
    // Log rendering summary
    this.logger.debug(`Rendering summary: ${vertexComponents.length} vertices, ${edgesRendered} edges rendered, ${edgesSkipped} edges skipped`);
  }
  
  /**
   * Batch update component cell IDs without triggering circular updates
   */
  private batchUpdateComponentCellIds(componentIdToCellId: Map<string, string>): void {
    const updateOperations = [];
    
    for (const [componentId, cellId] of componentIdToCellId.entries()) {
      // Create update operation for each component
      const operation = {
        componentId,
        changes: { cellId }
      };
      updateOperations.push(operation);
    }
    
    if (updateOperations.length > 0) {
      // Tell the diagram service to update components without triggering re-renders
      this.diagramService.bulkUpdateComponentsWithoutRender(updateOperations);
      this.logger.debug(`Batch updated ${updateOperations.length} component cell IDs`);
    }
  }
  
  /**
   * Helper method to get a cell by ID
   */
  private getCellById(cellId?: string): any {
    if (!cellId || !this.graph) return null;
    
    // Get all cells from the graph
    const allCells = this.graph.getChildCells(this.graph.getDefaultParent());
    
    // Find the cell with the matching ID
    for (const cell of allCells) {
      if (cell.id === cellId) {
        return cell;
      }
    }
    
    return null;
  }
  
  /**
   * Get the current graph instance
   */
  getGraph(): any {
    return this.graph;
  }
  
  /**
   * Check if renderer is initialized
   */
  isInitialized(): boolean {
    return this._isInitialized.getValue();
  }
  
  /**
   * Set edge creation mode
   */
  setEdgeCreationMode(active: boolean): void {
    this._edgeCreationMode = active;
    this.logger.debug(`Edge creation mode: ${active ? 'active' : 'inactive'}`);
    
    // Optionally update cursor or other visual indicators
    if (this.container) {
      this.container.style.cursor = active ? 'crosshair' : 'default';
    }
  }
  
  /**
   * Highlight a cell (vertex or edge)
   * 
   * @param id The ID to highlight - can be either a component ID or a cell ID
   * @param highlight Whether to highlight or unhighlight the cell
   * @param isComponentId Whether the provided ID is a component ID (true) or a cell ID (false)
   */
  highlightCell(id: string, highlight: boolean, isComponentId = true): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot highlight cell: Graph not initialized');
      return;
    }
    
    if (!id) {
      this.logger.error('Cannot highlight cell: No ID provided');
      return;
    }
    
    let cell;
    
    if (isComponentId) {
      // Find the component by ID
      const component = this.diagramService.getCurrentDiagram()?.components.find(c => c.id === id);
      
      if (!component) {
        this.logger.error(`Cannot highlight cell: Component not found ${id}`);
        return;
      }
      
      // Get the cell using the cellId from the component (if it exists)
      if (!component.cellId) {
        this.logger.error(`Cannot highlight cell: Component ${id} has no cellId`);
        return;
      }
      
      cell = this.getCellById(component.cellId);
      
      if (!cell) {
        this.logger.error(`Cannot highlight cell: Cell not found for component ${id} (cellId: ${component.cellId})`);
        return;
      }
      
      this.logger.debug(`Highlighting by component ID: ${id}, using cell ID: ${component.cellId}`);
    } else {
      // The ID is directly a cell ID
      cell = this.getCellById(id);
      
      if (!cell) {
        this.logger.error(`Cannot highlight cell: Cell not found with ID ${id}`);
        return;
      }
      
      this.logger.debug(`Highlighting directly by cell ID: ${id}`);
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        if (highlight) {
          // Apply highlighted style
          const currentStyle = this.graph.getCellStyle(cell);
          const newStyle = currentStyle ? 'highlighted' : 'highlighted';
          this.graph.setCellStyle(newStyle, [cell]);
        } else {
          // Reset to default style
          const isVertex = this.isVertex(cell);
          const isEdge = this.isEdge(cell);
          
          if (isVertex) {
            this.graph.setCellStyle('', [cell]); // Default vertex style
            this.logger.debug(`Reset vertex ${cell.id} to default style`);
          } else if (isEdge) {
            this.graph.setCellStyle('', [cell]); // Default edge style
            this.logger.debug(`Reset edge ${cell.id} to default style`);
          } else {
            this.logger.warn(`Unable to determine cell type for ${cell.id} during unhighlight`);
          }
        }
        
        const actionType = highlight ? 'highlighted' : 'unhighlighted';
        const idType = isComponentId ? 'component' : 'cell';
        this.logger.debug(`${idType} ${id} ${actionType} (cell: ${cell.id})`);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error highlighting cell', error);
    }
  }
  
  /**
   * Create a new vertex at the specified position
   */
  createVertex(x: number, y: number, label: string, width = 100, height = 40): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create vertex: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // First create the cell in mxGraph
        const parent = this.graph.getDefaultParent();
        const vertex = this.graph.insertVertex(
          parent,
          null, // Let mxGraph generate the cell ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // Get the generated cell ID
        const cellId = vertex.id;
        
        // Create the component data with the cell ID
        const componentData = {
          x,
          y,
          width,
          height,
          label,
          style: 'rounded=1;whiteSpace=wrap;html=1;'
        };
        
        // Add the component to diagram with cellId already set
        // This follows the "mxGraph first" approach in our architecture
        const component = this.diagramService.addComponent('vertex', { ...componentData, cellId });
        
        // Log for debugging
        this.logger.debug(`Vertex created: component=${component.id}, cell=${cellId}`);
        
        // Return component ID
        this.logger.info(`Vertex created: ${cellId}`);
        return component.id;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex', error);
      return null;
    }
  }
  
  /**
   * Create a new vertex and return both component and cell IDs
   * This follows the architecture where mxGraph cells are created first, 
   * then component models that reference them
   */
  createVertexWithIds(
    x: number, 
    y: number, 
    label: string, 
    width = 100, 
    height = 40, 
    style = 'rounded=1;whiteSpace=wrap;html=1;'
  ): { componentId: string, cellId: string } | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create vertex: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // 1. FIRST CREATE THE CELL IN MXGRAPH
        const parent = this.graph.getDefaultParent();
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const vertex = this.graph.insertVertex(
          parent,
          cellId, // Use UUID instead of letting mxGraph generate the ID
          label || '',
          x || 0,
          y || 0,
          width || 100,
          height || 40,
          style
        );
        
        // Verify the cell ID is what we provided
        // (mxGraph should have used our UUID)
        this.logger.debug(`Created mxGraph cell with ID: ${cellId}`);
        
        // 2. THEN CREATE THE COMPONENT THAT REFERENCES THE MXGRAPH CELL
        // Create the component data with the cell ID
        const componentData = {
          x,
          y,
          width,
          height,
          label,
          style,
          cellId // Include the cellId in the initial data
        };
        
        // Add the component to the diagram
        const component = this.diagramService.addComponent('vertex', componentData);
        
        // Log for debugging
        this.logger.debug(`Created component with ID: ${component.id} for cell: ${cellId}`);
        
        // Return both IDs to allow proper tracking
        return {
          componentId: component.id,
          cellId
        };
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex', error);
      return null;
    }
  }

  /**
   * Create a new edge between components by their IDs
   * This method is designed to work with component IDs, not cell IDs
   */
  createEdgeBetweenComponents(
    sourceComponentId: string, 
    targetComponentId: string, 
    label = '', 
    style = 'edgeStyle=orthogonalEdgeStyle;rounded=1;'
  ): { componentId: string, cellId: string } | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    this.logger.debug(`Creating edge between components: ${sourceComponentId} -> ${targetComponentId}`);
    
    // Get the source and target components
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.error('Cannot create edge: No diagram loaded');
      return null;
    }
    
    // Find source component
    const sourceComponent = diagram.components.find(c => c.id === sourceComponentId);
    if (!sourceComponent) {
      this.logger.error(`Cannot create edge: Source component not found: ${sourceComponentId}`);
      
      // Debug info - list available components
      const availableComponents = diagram.components.map(c => ({id: c.id, type: c.type}));
      this.logger.debug(`Available components: ${JSON.stringify(availableComponents)}`);
      return null;
    }
    
    // Find target component
    const targetComponent = diagram.components.find(c => c.id === targetComponentId);
    if (!targetComponent) {
      this.logger.error(`Cannot create edge: Target component not found: ${targetComponentId}`);
      return null;
    }
    
    // Get cell IDs from components
    const sourceCellId = sourceComponent.cellId;
    const targetCellId = targetComponent.cellId;
    
    if (!sourceCellId || !targetCellId) {
      this.logger.error('Cannot create edge: Source or target component missing cell ID', {
        sourceComponentId,
        targetComponentId,
        sourceCellId: sourceCellId ?? 'undefined',
        targetCellId: targetCellId ?? 'undefined'
      });
      return null;
    }
    
    // Get actual cells using cell IDs
    const sourceCell = this.getCellById(sourceCellId);
    const targetCell = this.getCellById(targetCellId);
    
    if (!sourceCell) {
      this.logger.error(`Cannot create edge: Source cell not found with ID: ${sourceCellId}`);
      return null;
    }
    
    if (!targetCell) {
      this.logger.error(`Cannot create edge: Target cell not found with ID: ${targetCellId}`);
      return null;
    }
    
    this.logger.debug(`Found required cells: source=${sourceCellId}, target=${targetCellId}`);
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // 1. FIRST CREATE THE MXGRAPH EDGE
        const parent = this.graph.getDefaultParent();
        
        // Generate UUID for the cell ID
        const cellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          cellId, // Use UUID instead of letting mxGraph generate the ID
          label || '',
          sourceCell,
          targetCell,
          style
        );
        
        if (!edge) {
          throw new Error('Edge creation failed: insertEdge returned null or undefined');
        }
        
        // Verify the cell ID is what we provided
        // (mxGraph should have used our UUID)
        this.logger.debug(`Created mxGraph edge with ID: ${cellId}`);
        
        // 2. THEN CREATE THE COMPONENT THAT REFERENCES THE MXGRAPH EDGE
        // Create the component data with the cell ID
        const componentData = {
          source: sourceComponentId,
          target: targetComponentId,
          label,
          style,
          cellId // Include cell ID from the start
        };
        
        // Add the component to the diagram
        const component = this.diagramService.addComponent('edge', componentData);
        this.logger.debug(`Created component with ID: ${component.id} for edge cell: ${cellId}`);
        
        this.logger.info(`Edge created successfully: component=${component.id}, cell=${cellId}, source=${sourceComponentId}, target=${targetComponentId}`);
        
        // Return both IDs
        return {
          componentId: component.id,
          cellId
        };
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating edge', error);
      return null;
    }
  }

  /**
   * Create a new edge between two vertices using component IDs
   * @deprecated Use createEdgeBetweenComponents instead which returns both component and cell IDs
   */
  createEdge(sourceComponentId: string, targetComponentId: string, label = '', style = 'edgeStyle=orthogonalEdgeStyle;rounded=1;'): string | null {
    this.logger.debug(`Using deprecated createEdge method - delegating to createEdgeBetweenComponents`);
    
    // Simply delegate to the more robust method and return just the component ID
    const result = this.createEdgeBetweenComponents(sourceComponentId, targetComponentId, label, style);
    
    if (result) {
      return result.componentId;
    }
    
    return null;
  }
  
  /**
   * Delete a component from the diagram
   * Following our architecture: delete mxGraph cells first, then remove components
   */
  deleteComponent(componentId: string): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot delete component: Graph not initialized');
      return;
    }
    
    // Find the component
    const component = this.diagramService.getCurrentDiagram()?.components.find(c => c.id === componentId);
    
    if (!component) {
      this.logger.error(`Cannot delete component: Component not found ${componentId}`);
      return;
    }
    
    // Get the cell using the cellId from the component (if it exists)
    const cell = component.cellId ? this.getCellById(component.cellId) : null;
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Remove from graph first if cell exists
        if (cell) {
          // If this is a vertex, also remove all connected edges
          if (this.isVertex(cell)) {
            this.logger.info(`Deleting vertex with connected edges: ${component.cellId}`);
            // Setting includeEdges to true removes all connected edges
            this.graph.removeCells([cell], true);
            
            // We also need to delete the edge components from our diagram model
            if (component.cellId) {
              this.deleteEdgesConnectedToVertex(component.id, component.cellId);
            }
          } else {
            // For edges or other cells, just remove the cell
            this.graph.removeCells([cell]);
          }
          this.logger.debug(`Removed cell ${component.cellId} from graph`);
        } else {
          this.logger.warn(`Cell not found for component ${componentId}, only removing component from model`);
        }
        
        // Then remove from diagram model
        this.diagramService.deleteComponent(componentId);
        
        this.logger.info(`Component deleted: ${componentId}, cell: ${component.cellId ?? 'not found'}`);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error deleting component', error);
    }
  }
  
  /**
   * Delete all edges connected to a vertex from the diagram model
   * This is called after deleting a vertex from mxGraph to keep the model in sync
   */
  private deleteEdgesConnectedToVertex(vertexComponentId: string, vertexCellId: string | undefined): void {
    if (!vertexCellId) {
      this.logger.warn(`Cannot delete connected edges: No cellId for component ${vertexComponentId}`);
      return;
    }
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram) {
      this.logger.warn('Cannot delete connected edges: No diagram loaded');
      return;
    }
    
    // Find all edge components connected to this vertex component
    const edgesToDelete = diagram.components.filter(component => {
      if (component.type !== 'edge') return false;
      
      // Look for edges where this vertex is the source or target
      const edgeData = component.data as Record<string, unknown>;
      const source = edgeData['source'] as string;
      const target = edgeData['target'] as string;
      
      return source === vertexComponentId || target === vertexComponentId;
    });
    
    // Delete each connected edge component
    if (edgesToDelete.length > 0) {
      this.logger.info(`Found ${edgesToDelete.length} edges connected to vertex ${vertexComponentId} to delete`);
      
      for (const edge of edgesToDelete) {
        this.logger.debug(`Deleting edge component: ${edge.id}`);
        this.diagramService.deleteComponent(edge.id);
      }
    } else {
      this.logger.debug(`No edges found connected to vertex ${vertexComponentId}`);
    }
  }
  
  /**
   * Delete a cell directly by its ID
   * This is used when a cell doesn't have an associated component
   */
  deleteCellById(cellId: string): void {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot delete cell: Graph not initialized');
      return;
    }
    
    // Get the cell by ID
    const cell = this.getCellById(cellId);
    
    if (!cell) {
      this.logger.error(`Cannot delete cell: Cell not found with ID ${cellId}`);
      return;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Remove the cell from the graph
        this.graph.removeCells([cell]);
        this.logger.info(`Cell deleted: ${cellId}`);
        
        // Emit a selection changed event to update UI
        this.emitSelectionChanged(null);
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error(`Error deleting cell with ID ${cellId}`, error);
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.graph) {
      this.graph.destroy();
      this.graph = null;
    }
    
    this.model = null;
    this.container = null;
    this._isInitialized.next(false);
    
    this.logger.info('DiagramRendererService destroyed');
  }
  
  /**
   * Create a direct edge between two vertices - simpler version for testing
   * This creates two vertices and an edge between them in one operation
   */
  createDirectEdge(sourceX: number, sourceY: number, targetX: number, targetY: number, label = ''): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    try {
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Create the source vertex first
        const parent = this.graph.getDefaultParent();
        
        // 1. First create the source vertex in mxGraph with UUID
        const sourceCellId = uuidv4();
        const sourceVertex = this.graph.insertVertex(
          parent,
          sourceCellId, // Use UUID
          'Source',
          sourceX,
          sourceY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Then create the component that references the cell
        const sourceComponentData = {
          x: sourceX,
          y: sourceY,
          width: 100,
          height: 40,
          label: 'Source',
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: sourceCellId // Use our UUID
        };
        
        // Add source component to diagram model
        const sourceComponent = this.diagramService.addComponent('vertex', sourceComponentData);
        this.logger.debug(`Created source vertex: component=${sourceComponent.id}, cell=${sourceCellId}`);

        // 1. First create the target vertex in mxGraph with UUID
        const targetCellId = uuidv4();
        const targetVertex = this.graph.insertVertex(
          parent,
          targetCellId, // Use UUID
          'Target',
          targetX,
          targetY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Then create the component that references the cell
        const targetComponentData = {
          x: targetX,
          y: targetY,
          width: 100,
          height: 40,
          label: 'Target',
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: targetCellId // Use our UUID
        };
        
        // Add target component to diagram model
        const targetComponent = this.diagramService.addComponent('vertex', targetComponentData);
        this.logger.debug(`Created target vertex: component=${targetComponent.id}, cell=${targetCellId}`);
        
        // First create the edge in the graph (mxGraph first) with UUID
        const edgeCellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          edgeCellId, // Use UUID
          label,
          sourceVertex,
          targetVertex,
          'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Then create the edge component with the cell ID
        const edgeComponentData = {
          source: sourceComponent.id,
          target: targetComponent.id,
          label,
          style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;',
          cellId: edgeCellId // Include the cell ID from the start
        };
        
        // Add the edge component to the diagram model
        const edgeComponent = this.diagramService.addComponent('edge', edgeComponentData);
        
        this.logger.info(`Direct edge created: component=${edgeComponent.id}, cell=${edgeCellId}`);
        return edgeComponent.id;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating direct edge', error);
      return null;
    }
  }
  
  /**
   * Create a complete edge with source and target vertices in a single operation.
   * This method handles both the graph operations and component creation in one step.
   * Following our architecture: create mxGraph elements first, then create components.
   */
  createSingleEdgeWithVertices(
    sourceX: number,
    sourceY: number,
    sourceLabel: string,
    targetX: number,
    targetY: number,
    targetLabel: string,
    edgeLabel = ''
  ): string | null {
    if (!this.graph || !this.model) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return null;
    }
    
    try {
      // Begin a single atomic update for all mxGraph operations
      this.model.beginUpdate();
      
      try {
        const parent = this.graph.getDefaultParent();
        
        // 1. First create source vertex in mxGraph with UUID
        const sourceCellId = uuidv4();
        const sourceVertex = this.graph.insertVertex(
          parent,
          sourceCellId, // Use UUID
          sourceLabel,
          sourceX,
          sourceY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 2. Create target vertex in mxGraph with UUID
        const targetCellId = uuidv4();
        const targetVertex = this.graph.insertVertex(
          parent,
          targetCellId, // Use UUID
          targetLabel,
          targetX,
          targetY,
          100, // width
          40,  // height
          'rounded=1;whiteSpace=wrap;html=1;'
        );
        
        // 3. Create the edge in mxGraph with UUID
        const edgeCellId = uuidv4();
        const edge = this.graph.insertEdge(
          parent,
          edgeCellId, // Use UUID
          edgeLabel,
          sourceVertex,
          targetVertex,
          'edgeStyle=orthogonalEdgeStyle;rounded=1;'
        );
        
        // Create an array of component updates to batch together
        const componentsToAdd = [];
        
        // 4. Create source vertex component with cell ID already set
        const sourceComponentData = {
          x: sourceX,
          y: sourceY,
          width: 100,
          height: 40,
          label: sourceLabel,
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: sourceCellId
        };
        
        // 5. Create target vertex component with cell ID already set
        const targetComponentData = {
          x: targetX,
          y: targetY,
          width: 100,
          height: 40,
          label: targetLabel,
          style: 'rounded=1;whiteSpace=wrap;html=1;',
          cellId: targetCellId
        };
        
        // Create and add components in one step
        const sourceComponent = this.diagramService.addComponent('vertex', sourceComponentData);
        const targetComponent = this.diagramService.addComponent('vertex', targetComponentData);
        
        // 6. Create edge component with cell ID already set
        const edgeComponentData = {
          source: sourceComponent.id,
          target: targetComponent.id,
          label: edgeLabel,
          style: 'edgeStyle=orthogonalEdgeStyle;rounded=1;',
          cellId: edgeCellId
        };
        
        // Create and add edge component in one step
        const edgeComponent = this.diagramService.addComponent('edge', edgeComponentData);
        
        // Log what we've created
        this.logger.info('Created complete edge with vertices', {
          sourceComponentId: sourceComponent.id,
          targetComponentId: targetComponent.id,
          edgeComponentId: edgeComponent.id,
          sourceCellId: sourceCellId,
          targetCellId: targetCellId,
          edgeCellId: edgeCellId
        });
        
        return edgeComponent.id;
      } finally {
        // End the update to apply all changes at once
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating edge with vertices', error);
      return null;
    }
  }
}