import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramService } from '../diagram.service';
import { Cell, DiagramElementType } from '../../models/diagram.model';

/**
 * Service to manage the mapping between diagram cells and mxGraph
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramCellMapperService {
  constructor(
    private logger: LoggerService,
    private diagramService: DiagramService,
  ) {
    this.logger.info('DiagramCellMapperService initialized');
  }

  /**
   * Update cells without triggering renders
   * This avoids circular updates
   */
  batchUpdateCells(updates: Array<{ cellId: string; changes: Partial<Cell> }>): void {
    if (!updates || updates.length === 0) {
      return;
    }

    try {
      this.logger.debug(`Batch updating ${updates.length} cells`);

      // Use the special method that doesn't trigger renders
      this.diagramService.bulkUpdateCellsWithoutRender(updates);

      this.logger.debug('Batch update completed successfully');
    } catch (error) {
      this.logger.error('Error in batch update of cells', error);
    }
  }

  /**
   * Find a cell by ID
   */
  findCellById(cellId: string): Cell | undefined {
    if (!cellId) {
      return undefined;
    }

    return this.diagramService.findCellById(cellId);
  }

  /**
   * Update a cell with changes
   */
  updateCell(cellId: string, changes: Partial<Cell>): void {
    try {
      this.logger.debug(`Updating cell ${cellId} with changes`, changes);
      this.diagramService.updateCell(cellId, changes);
    } catch (error) {
      this.logger.error(`Error updating cell: ${cellId}`, error);
    }
  }

  /**
   * Add a cell to the diagram
   */
  addCell(type: DiagramElementType, properties: Partial<Cell>, cellId?: string): Cell {
    try {
      this.logger.debug(`Adding ${type} cell`, { properties, cellId });
      return this.diagramService.addCell(type, properties, cellId);
    } catch (error) {
      this.logger.error(`Error adding ${type} cell`, error);
      throw error;
    }
  }

  /**
   * Delete a cell from the diagram
   */
  deleteCell(cellId: string): void {
    try {
      this.logger.debug(`Deleting cell: ${cellId}`);
      this.diagramService.deleteCell(cellId);
    } catch (error) {
      this.logger.error(`Error deleting cell: ${cellId}`, error);
    }
  }

  /**
   * Get all cells from the current diagram
   */
  getAllCells(): Cell[] {
    const diagram = this.diagramService.getCurrentDiagram();
    if (!diagram || !diagram.graphData) return [];

    return diagram.graphData;
  }

  /**
   * Get all cell IDs for the current diagram
   */
  getAllCellIds(): Set<string> {
    const cells = this.getAllCells();
    return new Set(cells.map(c => c.id));
  }

  /**
   * Check if a cell exists with the given ID
   */
  hasCellId(cellId: string): boolean {
    return !!this.findCellById(cellId);
  }
}
