import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InternalEvent } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { CellClickData, CellSelectionData } from '../interfaces/diagram-renderer.interface';
import { DiagramComponentMapperService } from '../components/diagram-component-mapper.service';

@Injectable({
  providedIn: 'root'
})
export class GraphEventHandlingService {
  // Cell click event
  private _cellClicked = new BehaviorSubject<CellClickData | null>(null);
  public cellClicked$ = this._cellClicked.asObservable();
  
  // Cell selection event
  private _cellSelected = new BehaviorSubject<CellSelectionData | null>(null);
  public cellSelected$ = this._cellSelected.asObservable();
  
  // Label editing state event
  private _labelEditingState = new BehaviorSubject<boolean>(false);
  public labelEditingState$ = this._labelEditingState.asObservable();
  
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(
    private logger: LoggerService,
    private componentMapper: DiagramComponentMapperService
  ) {
    this.logger.info('GraphEventHandlingService initialized');
  }
  
  /**
   * Set the graph instance to handle events for
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.model : null;
    
    if (this.graph) {
      this.setupEventHandlers();
    }
  }
  
  /**
   * Set up all event handlers for the graph
   */
  private setupEventHandlers(): void {
    if (!this.graph) {
      this.logger.error('Cannot set up event handlers: No graph instance');
      return;
    }
    
    try {
      this.logger.debug('Setting up graph event handlers');
      
      // Handle clicks on cells
      this.graph.addListener('click', (sender: any, evt: any) => {
        const cell = evt.getProperty('cell');
        this.handleCellClick(cell);
      });
      
      // Handle double clicks for label editing
      this.graph.addListener('dblclick', (sender: any, evt: any) => {
        const cell = evt.getProperty('cell');
        if (cell) {
          // Clear selection before starting label edit to isolate the editing experience
          this.graph.clearSelection();
          this.startEditingLabel(cell);
        }
      });
      
      // Handle selection changes
      this.graph.getSelectionModel().addListener('change', (sender: any, evt: any) => {
        this.handleGraphChange();
      });
      
      // Handle editing started event
      this.graph.addListener('startEditing', (sender: any, evt: any) => {
        this.logger.debug('Label editing started');
        this._labelEditingState.next(true);
      });
      
      // Handle editing stopped event
      this.graph.addListener('stopEditing', (sender: any, evt: any) => {
        this.logger.debug('Label editing stopped');
        this._labelEditingState.next(false);
      });
      
      // Handle label changes (when user edits a cell label)
      this.graph.addListener(InternalEvent.LABEL_CHANGED, (sender: any, evt: any) => {
        const cell = evt.getProperty('cell');
        const value = evt.getProperty('value');
        this.handleLabelChange(cell, value);
      });
      
      // Handle cell movement, including label position changes
      this.graph.addListener(InternalEvent.MOVE_CELLS, (sender: any, evt: any) => {
        const cells = evt.getProperty('cells');
        this.handleCellsMove(cells);
      });
      
      // Handle keyboard events
      this.graph.addListener('escape', () => {
        // Handle escape key press (e.g., cancel edge creation)
        this.logger.debug('Escape key pressed');
        this._cellClicked.next(null);
        this._cellSelected.next(null);
      });
      
      this.logger.debug('Graph event handlers set up successfully');
    } catch (error) {
      this.logger.error('Error setting up event handlers', error);
    }
  }
  
  /**
   * Handle cell click events
   */
  private handleCellClick(cell: any): void {
    if (!cell) {
      this.logger.debug('Click on empty space (no cell)');
      this._cellClicked.next(null);
      return;
    }
    
    try {
      const cellId = cell.id;
      
      if (this.isVertex(cell)) {
        this.logger.debug(`Vertex clicked: ${cellId}`);
        this._cellClicked.next({
          cellId,
          cellType: 'vertex'
        });
      } else if (this.isEdge(cell)) {
        this.logger.debug(`Edge clicked: ${cellId}`);
        this._cellClicked.next({
          cellId,
          cellType: 'edge'
        });
      } else {
        this.logger.debug(`Other cell type clicked: ${cellId}`);
        this._cellClicked.next(null);
      }
    } catch (error) {
      this.logger.error('Error handling cell click', error);
      this._cellClicked.next(null);
    }
  }
  
  /**
   * Handle graph selection changes
   */
  private handleGraphChange(): void {
    if (!this.graph) {
      return;
    }
    
    try {
      const cells = this.graph.getSelectionCells();
      
      if (!cells || cells.length === 0) {
        this.logger.debug('No cells selected');
        this.emitSelectionChanged(null);
        return;
      }
      
      // Take the first selected cell
      const cell = cells[0];
      
      if (!cell) {
        this.emitSelectionChanged(null);
        return;
      }
      
      if (this.isVertex(cell)) {
        this.logger.debug(`Vertex selected: ${cell.id}`);
        this.emitSelectionChanged({
          cellId: cell.id,
          cellType: 'vertex'
        });
      } else if (this.isEdge(cell)) {
        this.logger.debug(`Edge selected: ${cell.id}`);
        this.emitSelectionChanged({
          cellId: cell.id,
          cellType: 'edge'
        });
      } else {
        this.emitSelectionChanged(null);
      }
    } catch (error) {
      this.logger.error('Error handling graph change', error);
      this.emitSelectionChanged(null);
    }
  }
  
  /**
   * Emit selection changed event
   */
  private emitSelectionChanged(data: CellSelectionData | null): void {
    this._cellSelected.next(data);
  }
  
  /**
   * Handle label change events when a user edits a cell's label
   * @param cell The cell that was edited
   * @param newValue The new label value
   */
  private handleLabelChange(cell: any, newValue: string): void {
    if (!cell) {
      return;
    }
    
    try {
      this.logger.debug(`Label changed for cell ${cell.id} to "${newValue}"`);
      
      // Find the associated component to update its label in storage
      const component = this.componentMapper.findComponentByCellId(cell.id);
      if (component) {
        this.logger.debug(`Updating component ${component.id} label to "${newValue}"`);
        
        // Update the component data
        if (component.type === 'vertex') {
          // For vertices, update the label field
          if (component.data) {
            component.data['label'] = newValue;
            this.componentMapper.updateComponent(component.id, component);
          }
        } else if (component.type === 'edge') {
          // For edges, update the label field
          if (component.data) {
            component.data['label'] = newValue;
            this.componentMapper.updateComponent(component.id, component);
          }
        }
      } else {
        this.logger.warn(`No component found for cell ${cell.id} - label change will only apply to visual cell`);
      }
    } catch (error) {
      this.logger.error(`Error handling label change for cell ${cell?.id}`, error);
    }
  }
  
  /**
   * Explicitly start editing the label of a cell
   * @param cell The cell to edit
   */
  private startEditingLabel(cell: any): void {
    if (!this.graph || !cell) {
      return;
    }
    
    try {
      this.logger.debug(`Starting label edit for cell ${cell.id}`);
      
      // Select the cell first
      this.graph.setSelectionCell(cell);
      
      // Start editing the cell's label
      if (cell.isEdge && cell.isEdge()) {
        // For edges, we need to find the label position
        this.graph.startEditingAtCell(cell);
      } else {
        // For vertices, just start editing
        this.graph.startEditingAtCell(cell);
      }
    } catch (error) {
      this.logger.error(`Error starting label edit for cell ${cell?.id}`, error);
    }
  }
  
  /**
   * Handle cell movement events, including label position changes
   * @param cells The cells that were moved
   */
  private handleCellsMove(cells: any[]): void {
    if (!cells || cells.length === 0) {
      return;
    }
    
    try {
      // Make sure model is available
      if (!this.graph || !this.model) {
        this.logger.warn('Cannot handle cells move: Graph or model not available');
        return;
      }
      
      // Process each moved cell
      for (const cell of cells) {
        if (!cell) continue;
        
        this.logger.debug(`Cell ${cell.id} was moved`);
        
        // Find the associated component to update its position in storage
        const component = this.componentMapper.findComponentByCellId(cell.id);
        if (component) {
          this.logger.debug(`Updating component ${component.id} position data`);
          
          // Get the current cell geometry - use the graph's method if model's is not working
          let geometry = null;
          if (this.model && typeof this.model.getGeometry === 'function') {
            geometry = this.model.getGeometry(cell);
          } else if (cell.geometry) {
            // Fallback to directly accessing the geometry property
            geometry = cell.geometry;
          }
          
          if (!geometry) continue;
          
          // Update the component position data based on cell type
          if (component.type === 'vertex') {
            // For vertices, update the position x, y, width, height
            if (component.data) {
              // Create or update position object
              if (!component.data['position']) {
                component.data['position'] = {};
              }
              
              const position = component.data['position'] as Record<string, number>;
              position['x'] = geometry.x;
              position['y'] = geometry.y;
              position['width'] = geometry.width;
              position['height'] = geometry.height;
              
              // Update component
              this.componentMapper.updateComponent(component.id, component);
            }
          } else if (component.type === 'edge') {
            // For edges, we might want to store points, label position, etc.
            // This depends on how detailed we want to be with edge positioning
            
            // We'll update the label position if it exists
            if (component.data && geometry.offset) {
              // Store label offset information
              if (!component.data['labelOffset']) {
                component.data['labelOffset'] = {};
              }
              const labelOffset = component.data['labelOffset'] as Record<string, number>;
              labelOffset['x'] = geometry.offset.x;
              labelOffset['y'] = geometry.offset.y;
              
              // Update component
              this.componentMapper.updateComponent(component.id, component);
              this.logger.debug(`Updated edge ${component.id} label position to (${geometry.offset.x}, ${geometry.offset.y})`);
            } else {
              this.logger.debug(`Edge component ${component.id} was moved, but no position data needs updating`);
            }
          }
        } else {
          this.logger.warn(`No component found for cell ${cell.id} - move will only apply to visual cell`);
        }
      }
    } catch (error) {
      this.logger.error('Error handling cells move event', error);
    }
  }
  
  /**
   * Check if a cell is a vertex
   */
  private isVertex(cell: any): boolean {
    if (!this.model || !cell) {
      return false;
    }
    
    // MaxGraph API uses different methods to check cell types
    // Try different approaches to determine if it's a vertex
    try {
      // Check if the vertex has a geometry property with width and height
      const geometry = cell.geometry;
      if (geometry && geometry.width !== undefined && geometry.height !== undefined) {
        return true;
      }
      
      // Try to check if it's not an edge
      if (cell.isEdge !== undefined) {
        return !cell.isEdge;
      }
      
      // Check for edge-specific properties
      return !(cell.source && cell.target);
    } catch (error) {
      this.logger.error('Error checking if cell is vertex', error);
      return false;
    }
  }
  
  /**
   * Check if a cell is an edge
   */
  private isEdge(cell: any): boolean {
    if (!this.model || !cell) {
      return false;
    }
    
    // MaxGraph API uses different methods to check cell types
    try {
      // Check for source and target properties (edges connect vertices)
      if (cell.source && cell.target) {
        return true;
      }
      
      // Try to check if it has isEdge property
      if (cell.isEdge !== undefined) {
        return cell.isEdge;
      }
      
      // Check for typical edge geometry (no width/height)
      const geometry = cell.geometry;
      return geometry && geometry.width === undefined && geometry.height === undefined;
    } catch (error) {
      this.logger.error('Error checking if cell is edge', error);
      return false;
    }
  }
  
  /**
   * Get cell by ID
   */
  getCellById(id: string): any {
    if (!this.model || !id) {
      return null;
    }
    
    try {
      // First try direct lookup (faster)
      const cellDirectLookup = this.model.getCell(id);
      if (cellDirectLookup) {
        return cellDirectLookup;
      }
      
      // If direct lookup fails, search all cells
      const root = this.model.getRoot();
      const rootChildren = this.model.getChildCells(root);
      
      for (const child of rootChildren) {
        if (child.id === id) {
          return child;
        }
      }
      
      return null;
    } catch (error) {
      this.logger.error(`Error getting cell by ID: ${id}`, error);
      return null;
    }
  }
}