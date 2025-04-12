import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InternalEvent } from '@maxgraph/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { CellClickData, CellSelectionData } from '../interfaces/diagram-renderer.interface';

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
  
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(private logger: LoggerService) {
    this.logger.info('GraphEventHandlingService initialized');
  }
  
  /**
   * Set the graph instance to handle events for
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.getModel() : null;
    
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
      
      // Handle selection changes
      this.graph.getSelectionModel().addListener('change', (sender: any, evt: any) => {
        this.handleGraphChange();
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
   * Check if a cell is a vertex
   */
  private isVertex(cell: any): boolean {
    return this.model && cell && this.model.isVertex(cell);
  }
  
  /**
   * Check if a cell is an edge
   */
  private isEdge(cell: any): boolean {
    return this.model && cell && this.model.isEdge(cell);
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