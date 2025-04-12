import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Utility service for graph operations
 */
@Injectable({
  providedIn: 'root'
})
export class GraphUtilsService {
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(private logger: LoggerService) {
    this.logger.info('GraphUtilsService initialized');
  }
  
  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.getModel() : null;
  }
  
  /**
   * Get a cell by ID
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
  
  /**
   * Check if a cell is a vertex
   */
  isVertex(cell: any): boolean {
    return this.model && cell && this.model.isVertex(cell);
  }
  
  /**
   * Check if a cell is an edge
   */
  isEdge(cell: any): boolean {
    return this.model && cell && this.model.isEdge(cell);
  }
  
  /**
   * Get all vertices in the graph
   */
  getAllVertices(): any[] {
    if (!this.graph) {
      return [];
    }
    
    try {
      const parent = this.graph.getDefaultParent();
      return this.graph.getChildVertices(parent);
    } catch (error) {
      this.logger.error('Error getting all vertices', error);
      return [];
    }
  }
  
  /**
   * Get all edges in the graph
   */
  getAllEdges(): any[] {
    if (!this.graph) {
      return [];
    }
    
    try {
      const parent = this.graph.getDefaultParent();
      return this.graph.getChildEdges(parent);
    } catch (error) {
      this.logger.error('Error getting all edges', error);
      return [];
    }
  }
  
  /**
   * Get all cells in the graph
   */
  getAllCells(): any[] {
    if (!this.graph) {
      return [];
    }
    
    try {
      const parent = this.graph.getDefaultParent();
      return this.graph.getChildCells(parent);
    } catch (error) {
      this.logger.error('Error getting all cells', error);
      return [];
    }
  }
  
  /**
   * Get edges between two vertices
   */
  getEdgesBetween(source: any, target: any, directed: boolean = false): any[] {
    if (!this.graph || !source || !target) {
      return [];
    }
    
    try {
      return this.graph.getEdgesBetween(source, target, directed);
    } catch (error) {
      this.logger.error('Error getting edges between vertices', error);
      return [];
    }
  }
  
  /**
   * Get the bounds of a cell
   */
  getCellBounds(cellId: string): {x: number, y: number, width: number, height: number} | null {
    if (!this.graph) {
      return null;
    }
    
    try {
      const cell = this.getCellById(cellId);
      if (!cell) {
        return null;
      }
      
      const state = this.graph.view.getState(cell);
      if (!state) {
        return null;
      }
      
      return {
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height
      };
    } catch (error) {
      this.logger.error(`Error getting cell bounds: ${cellId}`, error);
      return null;
    }
  }
}