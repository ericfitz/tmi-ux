import { Injectable } from '@angular/core';

import { LoggerService } from '../../../../core/services/logger.service';
import { DiagramService } from '../diagram.service';
import { DiagramComponent } from '../../models/diagram.model';

/**
 * Service to manage the mapping between diagram components and mxGraph cells
 */
@Injectable({
  providedIn: 'root'
})
export class DiagramComponentMapperService {
  
  constructor(
    private logger: LoggerService,
    private diagramService: DiagramService
  ) {
    this.logger.info('DiagramComponentMapperService initialized');
  }
  
  /**
   * Update components with cell IDs without triggering renders
   * This avoids circular updates between components and cells
   */
  batchUpdateComponentCellIds(updates: Array<{componentId: string, cellId: string}>): void {
    if (!updates || updates.length === 0) {
      return;
    }
    
    try {
      this.logger.debug(`Batch updating ${updates.length} component cell IDs`);
      
      // Map to the format expected by the diagram service
      const mappedUpdates = updates.map(update => ({
        componentId: update.componentId,
        changes: { cellId: update.cellId }
      }));
      
      // Use the special method that doesn't trigger renders
      this.diagramService.bulkUpdateComponentsWithoutRender(mappedUpdates);
      
      this.logger.debug('Batch update completed successfully');
    } catch (error) {
      this.logger.error('Error in batch update of component cell IDs', error);
    }
  }
  
  /**
   * Find a component by cell ID
   */
  findComponentByCellId(cellId: string): DiagramComponent | undefined {
    if (!cellId) {
      return undefined;
    }
    
    return this.diagramService.findComponentByCellId(cellId);
  }
  
  /**
   * Update a component's cell ID
   */
  updateComponentCellId(componentId: string, cellId: string): void {
    try {
      this.logger.debug(`Updating component ${componentId} with cell ID ${cellId}`);
      this.diagramService.updateComponentCellId(componentId, cellId);
    } catch (error) {
      this.logger.error(`Error updating component cell ID: ${componentId}`, error);
    }
  }
  
  /**
   * Update a component with changes
   */
  updateComponent(componentId: string, changes: Partial<DiagramComponent>): void {
    try {
      this.logger.debug(`Updating component ${componentId} with changes`, changes);
      this.diagramService.updateComponent(componentId, changes);
    } catch (error) {
      this.logger.error(`Error updating component: ${componentId}`, error);
    }
  }
  
  /**
   * Add a component to the diagram
   */
  addComponent(
    type: 'vertex' | 'edge',
    data: Record<string, unknown>,
    componentId?: string
  ): DiagramComponent {
    try {
      this.logger.debug(`Adding ${type} component`, { data, componentId });
      return this.diagramService.addComponent(type, data, componentId);
    } catch (error) {
      this.logger.error(`Error adding ${type} component`, error);
      throw error;
    }
  }
  
  /**
   * Delete a component from the diagram
   */
  deleteComponent(componentId: string): void {
    try {
      this.logger.debug(`Deleting component: ${componentId}`);
      this.diagramService.deleteComponent(componentId);
    } catch (error) {
      this.logger.error(`Error deleting component: ${componentId}`, error);
    }
  }
  
  /**
   * Get all components from the current diagram
   */
  getAllComponents(): DiagramComponent[] {
    const diagram = this.diagramService.getCurrentDiagram();
    return diagram ? diagram.components : [];
  }
  
  /**
   * Find a component by ID
   */
  findComponentById(componentId: string): DiagramComponent | undefined {
    const diagram = this.diagramService.getCurrentDiagram();
    return diagram?.components.find(c => c.id === componentId);
  }
  
  /**
   * Get all cell IDs for the current diagram components
   */
  getAllCellIds(): Set<string> {
    const components = this.getAllComponents();
    return new Set(
      components
        .filter(c => c.cellId !== undefined)
        .map(c => c.cellId as string)
    );
  }
  
  /**
   * Check if a component exists with the given cell ID
   */
  hasCellId(cellId: string): boolean {
    return !!this.findComponentByCellId(cellId);
  }
}