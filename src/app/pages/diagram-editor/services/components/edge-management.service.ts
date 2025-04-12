import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramComponentMapperService } from './diagram-component-mapper.service';
import { EdgeCreationResult } from '../interfaces/diagram-renderer.interface';

/**
 * Service to manage edge creation and manipulation
 */
@Injectable({
  providedIn: 'root'
})
export class EdgeManagementService {
  // Edge creation mode
  private _edgeCreationMode = false;
  
  // Cached references
  private graph: any = null;
  private model: any = null;
  
  constructor(
    private logger: LoggerService,
    private componentMapper: DiagramComponentMapperService
  ) {
    this.logger.info('EdgeManagementService initialized');
  }
  
  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.getModel() : null;
  }
  
  /**
   * Set edge creation mode
   */
  setEdgeCreationMode(enabled: boolean): void {
    this._edgeCreationMode = enabled;
    this.logger.debug(`Edge creation mode ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Check if edge creation mode is enabled
   */
  isEdgeCreationMode(): boolean {
    return this._edgeCreationMode;
  }
  
  /**
   * Create an edge between two components
   */
  createEdgeBetweenComponents(
    sourceComponentId: string,
    targetComponentId: string,
    label: string = '',
    style: string = ''
  ): EdgeCreationResult {
    if (!this.graph) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return { cellId: '', componentId: '', success: false };
    }
    
    try {
      this.logger.debug(
        `Creating edge from component ${sourceComponentId} to ${targetComponentId} with label: ${label}`
      );
      
      // Find source and target components
      const sourceComponent = this.componentMapper.findComponentById(sourceComponentId);
      const targetComponent = this.componentMapper.findComponentById(targetComponentId);
      
      if (!sourceComponent || !targetComponent) {
        this.logger.error('Source or target component not found');
        return { cellId: '', componentId: '', success: false };
      }
      
      // Get cell IDs from components
      const sourceCellId = sourceComponent.cellId;
      const targetCellId = targetComponent.cellId;
      
      if (!sourceCellId || !targetCellId) {
        this.logger.error('Source or target cell ID not found');
        return { cellId: '', componentId: '', success: false };
      }
      
      // Create the edge
      const edgeId = this.createSingleEdgeWithVertices(
        sourceCellId,
        targetCellId,
        label,
        style,
        true,
        true
      );
      
      if (!edgeId) {
        this.logger.error('Failed to create edge');
        return { cellId: '', componentId: '', success: false };
      }
      
      // Generate component ID
      const componentId = uuidv4();
      
      // Create the edge component
      const edgeData = {
        source: sourceComponentId,
        target: targetComponentId,
        label,
        style,
        cellId: edgeId
      };
      
      // Add to component store
      this.componentMapper.addComponent('edge', edgeData, componentId);
      
      this.logger.debug(`Edge created with cellId: ${edgeId}, componentId: ${componentId}`);
      
      return {
        cellId: edgeId,
        componentId,
        success: true
      };
    } catch (error) {
      this.logger.error('Error creating edge between components', error);
      return { cellId: '', componentId: '', success: false };
    }
  }
  
  /**
   * Create a single edge between two vertices
   */
  createSingleEdgeWithVertices(
    sourceId: string,
    targetId: string,
    label: string = '',
    style: string = '',
    sourceIsCell: boolean = true,
    targetIsCell: boolean = true
  ): string {
    if (!this.graph) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return '';
    }
    
    try {
      this.logger.debug(`Creating edge from ${sourceId} to ${targetId} with label: ${label}`);
      
      // Get source and target cells
      let sourceCell = sourceIsCell ? this.model.getCell(sourceId) : null;
      let targetCell = targetIsCell ? this.model.getCell(targetId) : null;
      
      // Try to find cells by component ID if needed
      if (!sourceCell && !sourceIsCell) {
        const sourceComponent = this.componentMapper.findComponentById(sourceId);
        if (sourceComponent && sourceComponent.cellId) {
          sourceCell = this.model.getCell(sourceComponent.cellId);
        }
      }
      
      if (!targetCell && !targetIsCell) {
        const targetComponent = this.componentMapper.findComponentById(targetId);
        if (targetComponent && targetComponent.cellId) {
          targetCell = this.model.getCell(targetComponent.cellId);
        }
      }
      
      if (!sourceCell || !targetCell) {
        this.logger.error('Source or target cell not found');
        return '';
      }
      
      // Create the edge
      this.model.beginUpdate();
      
      try {
        const parent = this.graph.getDefaultParent();
        const edge = this.graph.insertEdge(parent, null, label, sourceCell, targetCell, style);
        
        this.logger.debug(`Edge created with id: ${edge.id}`);
        return edge.id;
      } finally {
        this.model.endUpdate();
      }
    } catch (error) {
      this.logger.error('Error creating edge', error);
      return '';
    }
  }
  
  /**
   * Highlight an edge
   */
  highlightEdge(cellId: string, highlight: boolean): void {
    if (!this.graph || !cellId) {
      return;
    }
    
    try {
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isEdge(cell)) {
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
      this.logger.error(`Error highlighting edge: ${cellId}`, error);
    }
  }
  
  /**
   * Delete an edge by cell ID
   */
  deleteEdgeByCellId(cellId: string): void {
    if (!this.graph || !cellId) {
      return;
    }
    
    try {
      this.logger.debug(`Deleting edge with cell ID: ${cellId}`);
      
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isEdge(cell)) {
        this.logger.warn(`Cell is not an edge or does not exist: ${cellId}`);
        return;
      }
      
      // Begin update
      this.model.beginUpdate();
      
      try {
        // Delete the edge
        this.graph.removeCells([cell]);
      } finally {
        // End update
        this.model.endUpdate();
      }
      
      this.logger.debug(`Edge deleted: ${cellId}`);
    } catch (error) {
      this.logger.error(`Error deleting edge: ${cellId}`, error);
    }
  }
}