import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramComponentMapperService } from './diagram-component-mapper.service';
import { EdgeCreationResult } from '../interfaces/diagram-renderer.interface';
import { CellDeleteInfo } from '../utils/cell-delete-info.model';

/**
 * Service to manage edge creation and manipulation
 */
@Injectable({
  providedIn: 'root',
})
export class EdgeManagementService {
  // Edge creation mode
  private _edgeCreationMode = false;

  // Cached references
  private graph: any = null;
  private model: any = null;

  constructor(
    private logger: LoggerService,
    private componentMapper: DiagramComponentMapperService,
  ) {
    this.logger.info('EdgeManagementService initialized');
  }

  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.model : null;
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
    style: string | Record<string, any> = '',
  ): EdgeCreationResult {
    if (!this.graph) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return { cellId: '', componentId: '', success: false };
    }

    try {
      this.logger.debug(
        `Creating edge from component ${sourceComponentId} to ${targetComponentId} with label: ${label} and style: ${typeof style === 'string' ? style : JSON.stringify(style)}`,
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
        true,
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
        cellId: edgeId,
      };

      // Add to component store
      this.componentMapper.addComponent('edge', edgeData, componentId);

      this.logger.debug(`Edge created with cellId: ${edgeId}, componentId: ${componentId}`);

      return {
        cellId: edgeId,
        componentId,
        success: true,
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
    style: string | Record<string, any> = '',
    sourceIsCell: boolean = true,
    targetIsCell: boolean = true,
  ): string {
    if (!this.graph) {
      this.logger.error('Cannot create edge: Graph not initialized');
      return '';
    }

    try {
      this.logger.debug(
        `Creating edge from ${sourceId} to ${targetId} with label: ${label} and style: ${typeof style === 'string' ? style : JSON.stringify(style)}`,
      );

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
      let styleString = this.model.getStyle(cell);

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
      this.model.setStyle(cell, styleString);

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

    // Store cellId as a primitive string value right away
    // This prevents issues with logging after the cell is deleted
    const cellIdStr = String(cellId);

    try {
      this.logger.debug(`Deleting edge with cell ID: ${cellIdStr}`);

      // Use the stored primitive string value
      const cell = this.model.getCell(cellId);
      if (!cell || !this.model.isEdge(cell)) {
        this.logger.warn(`Cell is not an edge or does not exist: ${cellIdStr}`);
        return;
      }

      // Capture edge info before deletion
      const info = this.captureEdgeDeleteInfo(cell);

      // Now delete using the captured info
      this.deleteEdgeWithInfo(info);
    } catch (error) {
      this.logger.error(`Error deleting edge: ${cellIdStr}`, error);
    }
  }

  /**
   * Delete an edge using pre-captured information
   * This avoids accessing the cell after it's deleted
   */
  deleteEdgeWithInfo(info: CellDeleteInfo): void {
    if (!this.graph || !info || !info.id) {
      return;
    }

    try {
      this.logger.debug(
        `Deleting edge with info: ${info.id} (${info.description || 'no description'})`,
      );

      // Begin update
      this.model.beginUpdate();

      try {
        // Delete the edge cell
        const edgeCell = this.model.getCell(info.id);
        if (edgeCell) {
          this.graph.removeCells([edgeCell]);
        }
      } finally {
        // End update
        this.model.endUpdate();
      }

      this.logger.debug(`Edge deleted: ${info.id}`);
    } catch (error) {
      this.logger.error(`Error deleting edge with info: ${info.id}`, error);
    }
  }

  /**
   * Capture all information needed from an edge before deletion
   */
  captureEdgeDeleteInfo(edge: any): CellDeleteInfo {
    if (!this.graph || !edge) {
      return { id: '', type: 'edge', label: '' };
    }

    try {
      const cellId = edge.id;
      const label = edge.value || '';
      const sourceId = edge.source?.id || '';
      const targetId = edge.target?.id || '';
      const geometry = edge.geometry;

      // Get associated component
      const component = this.componentMapper.findComponentByCellId(cellId);
      const componentId = component?.id;

      // Create the delete info
      const info: CellDeleteInfo = {
        id: cellId,
        type: 'edge',
        label,
        source: sourceId,
        target: targetId,
        componentId,
        description: `edge "${label}" (ID: ${cellId}) from ${sourceId} to ${targetId}`,
      };

      // Add geometry if available
      if (geometry) {
        info.geometry = {};

        // Add points array if it exists
        if (geometry.points && Array.isArray(geometry.points)) {
          info.geometry.points = geometry.points.map((point: any) => ({
            x: point.x,
            y: point.y,
          }));
        }

        // Add source and target points if they exist
        if (geometry.sourcePoint) {
          info.geometry.sourcePoint = {
            x: geometry.sourcePoint.x,
            y: geometry.sourcePoint.y,
          };
        }

        if (geometry.targetPoint) {
          info.geometry.targetPoint = {
            x: geometry.targetPoint.x,
            y: geometry.targetPoint.y,
          };
        }
      }

      return info;
    } catch (error) {
      this.logger.error(`Error capturing edge delete info for cell: ${edge?.id}`, error);
      return {
        id: edge?.id || '',
        type: 'edge',
        label: edge?.value || '',
      };
    }
  }
}
