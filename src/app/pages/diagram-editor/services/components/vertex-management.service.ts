import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramComponentMapperService } from './diagram-component-mapper.service';
import { VertexCreationResult } from '../interfaces/diagram-renderer.interface';
import { CellDeleteInfo } from '../utils/cell-delete-info.model';

/**
 * Service to manage vertex creation and manipulation
 */
@Injectable({
  providedIn: 'root',
})
export class VertexManagementService {
  // Cached references
  private graph: any = null;
  private model: any = null;

  constructor(
    private logger: LoggerService,
    private componentMapper: DiagramComponentMapperService,
  ) {
    this.logger.info('VertexManagementService initialized');
  }

  /**
   * Set the graph instance
   */
  setGraph(graph: any): void {
    this.graph = graph;
    this.model = graph ? graph.model : null;
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
    style: string | Record<string, any> = '',
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
    style: string | Record<string, any> = '',
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

        // If style is a style name (e.g., 'process', 'store', 'actor'), use it directly
        // This will use the style from the stylesheet that was applied by the theme
        // No need to modify the style name, as the DiagramThemeService already registered it
        this.logger.debug(
          `Using style: ${typeof style === 'string' ? style : JSON.stringify(style)}`,
        );

        const vertex = this.graph.insertVertex(parent, null, label, x, y, width, height, style);
        cellId = vertex.id;

        // Position information for the component data
        const position = {
          x,
          y,
          width,
          height,
        };

        // Create component that references the cell
        const componentData = {
          label,
          position,
          style,
          cellId,
        };

        // Add to component store
        this.componentMapper.addComponent('vertex', componentData, componentId);

        this.logger.debug(`Vertex created with cellId: ${cellId}, componentId: ${componentId}`);

        return {
          cellId,
          componentId,
          success: true,
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
        success: false,
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

    // Store cellId as a primitive string value right away
    // This prevents issues with logging after the cell is deleted
    const cellIdStr = String(cellId);

    try {
      this.logger.debug(`Deleting vertex with cell ID: ${cellIdStr}`);

      // Use the stored primitive string value
      const cell = this.model.getCell(cellId);
      if (!cell) {
        this.logger.warn(`Cell does not exist: ${cellIdStr}`);
        return;
      }

      // In MaxGraph, model.isVertex might not exist - use a more reliable check
      if (cell.isEdge && cell.isEdge()) {
        this.logger.warn(`Cell is an edge, not a vertex: ${cellIdStr}`);
        return;
      }

      // Capture vertex info before deletion
      const info = this.captureVertexDeleteInfo(cell);

      // Now delete using the captured info
      this.deleteVertexWithInfo(info);
    } catch (error) {
      this.logger.error(`Error deleting vertex: ${cellIdStr}`, error);
    }
  }

  /**
   * Delete a vertex using pre-captured information
   * This avoids accessing the cell after it's deleted
   */
  deleteVertexWithInfo(info: CellDeleteInfo): void {
    if (!this.graph || !info || !info.id) {
      return;
    }

    try {
      this.logger.debug(
        `Deleting vertex with info: ${info.id} (${info.description || 'no description'})`,
      );

      // Begin update
      this.model.beginUpdate();

      try {
        // Get connected edges from info or directly from the graph
        if (info.connectedEdgeIds && info.connectedEdgeIds.length > 0) {
          // Use pre-captured edge IDs
          const edgeCells = info.connectedEdgeIds
            .map(id => this.model.getCell(id))
            .filter(cell => cell !== null);

          if (edgeCells.length > 0) {
            // Remove the edges
            this.graph.removeCells(edgeCells);

            // Delete components for these edges
            for (const edge of edgeCells) {
              if (edge) {
                const component = this.componentMapper.findComponentByCellId(edge.id);
                if (component) {
                  this.componentMapper.deleteComponent(component.id);
                }
              }
            }
          }
        } else {
          // Fall back to getting edges from the graph
          const cell = this.model.getCell(info.id);
          if (cell) {
            this.deleteEdgesConnectedToVertex(cell);
          }
        }

        // Delete the vertex cell
        const vertexCell = this.model.getCell(info.id);
        if (vertexCell) {
          this.graph.removeCells([vertexCell]);
        }
      } finally {
        // End update
        this.model.endUpdate();
      }

      this.logger.debug(`Vertex deleted: ${info.id}`);
    } catch (error) {
      this.logger.error(`Error deleting vertex with info: ${info.id}`, error);
    }
  }

  /**
   * Capture all information needed from a vertex before deletion
   */
  captureVertexDeleteInfo(vertex: any): CellDeleteInfo {
    if (!this.graph || !vertex) {
      return { id: '', type: 'vertex', label: '' };
    }

    try {
      const cellId = vertex.id;
      const label = vertex.value || '';
      const geometry = vertex.geometry;

      // Get connected edges
      const edges = this.graph.getEdges(vertex) || [];
      const connectedEdgeIds = edges.map((edge: any) => edge.id);

      // Get associated component
      const component = this.componentMapper.findComponentByCellId(cellId);
      const componentId = component?.id;

      // Create the delete info
      const info: CellDeleteInfo = {
        id: cellId,
        type: 'vertex',
        label,
        connectedEdgeIds,
        componentId,
        description: `vertex "${label}" (ID: ${cellId})`,
      };

      // Add geometry if available
      if (geometry) {
        info.geometry = {
          x: geometry.x,
          y: geometry.y,
          width: geometry.width,
          height: geometry.height,
        };
      }

      return info;
    } catch (error) {
      this.logger.error(`Error capturing vertex delete info for cell: ${vertex?.id}`, error);
      return {
        id: vertex?.id || '',
        type: 'vertex',
        label: vertex?.value || '',
      };
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
