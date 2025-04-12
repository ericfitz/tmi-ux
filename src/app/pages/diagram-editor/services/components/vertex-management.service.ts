import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramComponentMapperService } from './diagram-component-mapper.service';
import { VertexCreationResult } from '../interfaces/diagram-renderer.interface';

/**
 * Service to manage vertex creation and manipulation
 */
@Injectable({
  providedIn: 'root'
})
export class VertexManagementService {
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(
    private logger: LoggerService,
    private componentMapper: DiagramComponentMapperService
  ) {
    this.logger.info('VertexManagementService initialized');
  }
  
  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.getModel() : null;
  }
  
  /**
   * Create a vertex at the specified coordinates
   */
  createVertex(
    x: number,
    y: number,
    label: string,
    width: number = 100,
    height: number = 60,
    style: string = ''
  ): string {
    if (!this.graph) {
      this.logger.error('Cannot create vertex: Graph not initialized');
      throw new Error('Graph not initialized');
    }
    
    try {
      this.logger.debug(`Creating vertex at (${x}, ${y}) with label: ${label}`);
      
      // Begin update
      this.model.beginUpdate();
      
      try {
        const parent = this.graph.getDefaultParent();
        const vertex = this.graph.insertVertex(parent, null, label, x, y, width, height, style);
        
        this.logger.debug(`Vertex created with id: ${vertex.id}`);
        return vertex.id;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex', error);
      throw error;
    }
  }
  
  /**
   * Create a vertex with component integration
   */
  createVertexWithIds(
    x: number,
    y: number,
    label: string,
    width: number = 100,
    height: number = 60,
    style: string = ''
  ): VertexCreationResult {
    if (!this.graph) {
      this.logger.error('Cannot create vertex with IDs: Graph not initialized');
      throw new Error('Graph not initialized');
    }
    
    try {
      this.logger.debug(`Creating vertex with component at (${x}, ${y}) with label: ${label}`);
      
      // Generate component ID upfront
      const componentId = uuidv4();
      
      // Create the vertex
      let cellId = '';
      
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Create vertex cell first
        const parent = this.graph.getDefaultParent();
        const vertex = this.graph.insertVertex(parent, null, label, x, y, width, height, style);
        cellId = vertex.id;
        
        // Position information for the component data
        const position = {
          x,
          y,
          width,
          height
        };
        
        // Create component that references the cell
        const componentData = {
          label,
          position,
          style,
          cellId
        };
        
        // Add to component store
        this.componentMapper.addComponent('vertex', componentData, componentId);
        
        this.logger.debug(`Vertex created with cellId: ${cellId}, componentId: ${componentId}`);
        
        return {
          cellId,
          componentId,
          success: true
        };
      } catch (error) {
        this.logger.error('Error in vertex creation transaction', error);
        throw error;
      } finally {
        // End update
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating vertex with IDs', error);
      return {
        cellId: '',
        componentId: '',
        success: false
      };
    }
  }
  
  /**
   * Highlight a vertex
   */
  highlightVertex(cellId: string, highlight: boolean): void {
    if (!this.graph || !cellId) {
      return;
    }
    
    try {
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isVertex(cell)) {
        return;
      }
      
      // Get current style
      const style = this.graph.getCellStyle(cell);
      let styleString = this.graph.getModel().getStyle(cell);
      
      if (highlight) {
        // Add highlight style if not already present
        if (!styleString.includes('highlighted')) {
          styleString = styleString ? styleString + ';highlighted' : 'highlighted';
        }
      } else {
        // Remove highlight style if present
        styleString = styleString ? styleString.replace(';highlighted', '') : '';
        styleString = styleString ? styleString.replace('highlighted', '') : '';
      }
      
      // Apply the updated style
      this.graph.getModel().setStyle(cell, styleString);
      
      // Refresh cell to show highlight
      this.graph.refresh(cell);
    } catch (error) {
      this.logger.error(`Error highlighting vertex: ${cellId}`, error);
    }
  }
  
  /**
   * Delete a vertex by cell ID
   */
  deleteVertexByCellId(cellId: string): void {
    if (!this.graph || !cellId) {
      return;
    }
    
    try {
      this.logger.debug(`Deleting vertex with cell ID: ${cellId}`);
      
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isVertex(cell)) {
        this.logger.warn(`Cell is not a vertex or does not exist: ${cellId}`);
        return;
      }
      
      // Begin update
      this.model.beginUpdate();
      
      try {
        // First delete all connected edges
        this.deleteEdgesConnectedToVertex(cell);
        
        // Then delete the vertex
        this.graph.removeCells([cell]);
      } finally {
        // End update
        this.model.endUpdate();
      }
      
      this.logger.debug(`Vertex deleted: ${cellId}`);
    } catch (error) {
      this.logger.error(`Error deleting vertex: ${cellId}`, error);
    }
  }
  
  /**
   * Delete all edges connected to a vertex
   */
  private deleteEdgesConnectedToVertex(vertex: any): void {
    if (!this.graph || !vertex) {
      return;
    }
    
    try {
      // Get all edges connected to the vertex
      const edges = this.graph.getEdges(vertex);
      if (!edges || edges.length === 0) {
        return;
      }
      
      // Delete each edge
      this.graph.removeCells(edges);
      
      // Find and delete components for these edges
      for (const edge of edges) {
        const component = this.componentMapper.findComponentByCellId(edge.id);
        if (component) {
          this.componentMapper.deleteComponent(component.id);
        }
      }
    } catch (error) {
      this.logger.error('Error deleting connected edges', error);
    }
  }
}