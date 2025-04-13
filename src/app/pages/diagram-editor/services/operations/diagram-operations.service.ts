import { Injectable } from '@angular/core';
import { Observable } from '../../../../core/rxjs-imports';
import { LoggerService } from '../../../../core/services/logger.service';

import { DiagramEventBusService, DiagramEventType } from '../event-bus/diagram-event-bus.service';
import { DiagramElementRegistryService } from '../registry/diagram-element-registry.service';
import { StateManagerService } from '../state/state-manager.service';
import { EditorState } from '../state/editor-state.enum';
import { GraphInitializationService } from '../graph/graph-initialization.service';
import { VertexManagementService } from '../components/vertex-management.service';
import { EdgeManagementService } from '../components/edge-management.service';
import { GraphUtilsService } from '../graph/graph-utils.service';
import { VertexCreationResult, EdgeCreationResult } from '../interfaces/diagram-renderer.interface';

/**
 * Result of a vertex creation operation
 */
export interface VertexOperationResult {
  success: boolean;
  cellId?: string;
  componentId?: string;
  error?: Error;
}

/**
 * Result of an edge creation operation
 */
export interface EdgeOperationResult {
  success: boolean;
  cellId?: string;
  componentId?: string;
  error?: Error;
}

/**
 * High-level service for diagram operations
 * Provides a clean API for common diagram operations
 * Delegates to specialized services and handles error recovery
 */
@Injectable({
  providedIn: 'root',
})
export class DiagramOperationsService {
  constructor(
    private logger: LoggerService,
    private eventBus: DiagramEventBusService,
    private registry: DiagramElementRegistryService,
    private stateManager: StateManagerService,
    private graphInitService: GraphInitializationService,
    private vertexService: VertexManagementService,
    private edgeService: EdgeManagementService,
    private graphUtils: GraphUtilsService,
  ) {
    this.logger.info('DiagramOperationsService initialized');
  }

  /**
   * Create a vertex at the specified position
   * @param type The type of vertex to create
   * @param x The x coordinate
   * @param y The y coordinate
   * @param properties Optional properties for the vertex
   * @returns An observable that emits the result of the operation
   */
  createVertex(
    type: string,
    x: number,
    y: number,
    properties?: Record<string, unknown>,
  ): Observable<VertexOperationResult> {
    return new Observable<VertexOperationResult>(observer => {
      // Check if we're in a valid state for vertex creation
      if (!this.stateManager.isOperationAllowed('createVertex')) {
        const error = new Error(
          `Cannot create vertex: Operation not allowed in current state (${this.stateManager.getCurrentState()})`,
        );
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'createVertex', type, x, y });
        observer.next({ success: false, error });
        observer.complete();
        return;
      }

      // Check if graph is initialized
      if (!this.graphInitService.isInitialized()) {
        const error = new Error('Cannot create vertex: Graph not initialized');
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'createVertex', type, x, y });
        observer.next({ success: false, error });
        observer.complete();
        return;
      }

      try {
        // Get the graph instance
        const graph = this.graphInitService.getGraph();

        // Create default label based on type
        const label =
          (properties && 'label' in properties ? (properties['label'] as string) : null) ||
          type.charAt(0).toUpperCase() + type.slice(1);

        // Create style based on type
        let style = '';
        switch (type) {
          case 'process':
            style = 'rounded=1;fillColor=#2196F3;strokeColor=#0D47A1;fontColor=#ffffff';
            break;
          case 'store':
            style = 'shape=cylinder;fillColor=#4CAF50;strokeColor=#1B5E20;fontColor=#ffffff';
            break;
          case 'actor':
            style = 'shape=actor;fillColor=#9C27B0;strokeColor=#4A148C;fontColor=#ffffff';
            break;
          default:
            style = 'fillColor=#90CAF9;strokeColor=#1565C0;fontColor=#000000';
        }

        // Create the vertex with component integration
        const result = this.vertexService.createVertexWithIds(
          x,
          y,
          label,
          100, // default width
          60, // default height
          style,
        );

        if (!result || !result.success) {
          const error = new Error(`Failed to create vertex of type ${type}`);
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'createVertex', type, x, y });
          observer.next({ success: false, error });
          observer.complete();
          return;
        }

        // Publish the event
        this.eventBus.publishCellEvent(
          DiagramEventType.VERTEX_CREATED,
          result.cellId,
          result.componentId,
          { type, x, y, properties },
        );

        // Return the result
        observer.next({
          success: true,
          cellId: result.cellId,
          componentId: result.componentId,
        });
        observer.complete();
      } catch (error) {
        this.logger.error('Error creating vertex', error);
        this.eventBus.publishError(error as Error, { operation: 'createVertex', type, x, y });
        observer.next({ success: false, error: error as Error });
        observer.complete();
      }
    });
  }

  /**
   * Create an edge between two vertices
   * @param sourceId The source vertex component ID
   * @param targetId The target vertex component ID
   * @param type The type of edge to create
   * @param properties Optional properties for the edge
   * @returns An observable that emits the result of the operation
   */
  createEdge(
    sourceId: string,
    targetId: string,
    type: string,
    properties?: Record<string, unknown>,
  ): Observable<EdgeOperationResult> {
    return new Observable<EdgeOperationResult>(observer => {
      // Check if we're in a valid state for edge creation
      if (!this.stateManager.isOperationAllowed('createEdge')) {
        const error = new Error(
          `Cannot create edge: Operation not allowed in current state (${this.stateManager.getCurrentState()})`,
        );
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'createEdge', sourceId, targetId, type });
        observer.next({ success: false, error });
        observer.complete();
        return;
      }

      // Check if graph is initialized
      if (!this.graphInitService.isInitialized()) {
        const error = new Error('Cannot create edge: Graph not initialized');
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'createEdge', sourceId, targetId, type });
        observer.next({ success: false, error });
        observer.complete();
        return;
      }

      try {
        // Get the source and target cell IDs from the registry
        const sourceCellId = this.registry.getCellId(sourceId);
        const targetCellId = this.registry.getCellId(targetId);

        if (!sourceCellId || !targetCellId) {
          const error = new Error(
            `Cannot create edge: ${!sourceCellId ? 'Source' : 'Target'} cell not found in registry`,
          );
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'createEdge', sourceId, targetId, type });
          observer.next({ success: false, error });
          observer.complete();
          return;
        }

        // Get the source and target cells
        const sourceCell = this.graphUtils.getCellById(sourceCellId);
        const targetCell = this.graphUtils.getCellById(targetCellId);

        if (!sourceCell || !targetCell) {
          const error = new Error(
            `Cannot create edge: ${!sourceCell ? 'Source' : 'Target'} cell not found in graph`,
          );
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'createEdge', sourceId, targetId, type });
          observer.next({ success: false, error });
          observer.complete();
          return;
        }

        // Create style based on type
        let style = '';
        switch (type) {
          case 'flow':
            style = 'endArrow=classic;strokeColor=#FF9800;strokeWidth=2;';
            break;
          case 'association':
            style = 'endArrow=none;strokeColor=#2196F3;strokeWidth=1;dashed=1;';
            break;
          case 'dependency':
            style = 'endArrow=open;strokeColor=#F44336;strokeWidth=1;dashed=1;';
            break;
          default:
            style = 'endArrow=classic;strokeColor=#616161;strokeWidth=1;';
        }

        // Create the edge
        const graph = this.graphInitService.getGraph();
        const parent = graph.getDefaultParent();

        // Begin update
        graph.model.beginUpdate();

        try {
          // Create the edge
          const edge = graph.insertEdge(
            parent,
            null,
            properties && properties['label'] ? (properties['label'] as string) : '',
            sourceCell,
            targetCell,
            style,
          );

          // Generate a component ID
          const componentId = `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

          // Register the edge in the registry
          this.registry.register(edge.id, componentId, 'edge');

          // Publish the event
          this.eventBus.publishCellEvent(DiagramEventType.EDGE_CREATED, edge.id, componentId, {
            type,
            sourceId,
            targetId,
            properties,
          });

          // Return the result
          observer.next({
            success: true,
            cellId: edge.id,
            componentId,
          });
          observer.complete();
        } finally {
          // End update
          graph.model.endUpdate();
        }
      } catch (error) {
        this.logger.error('Error creating edge', error);
        this.eventBus.publishError(error as Error, {
          operation: 'createEdge',
          sourceId,
          targetId,
          type,
        });
        observer.next({ success: false, error: error as Error });
        observer.complete();
      }
    });
  }

  /**
   * Delete a cell by its component ID
   * @param componentId The component ID of the cell to delete
   * @returns An observable that emits the result of the operation
   */
  deleteCell(componentId: string): Observable<boolean> {
    return new Observable<boolean>(observer => {
      // Check if we're in a valid state for deletion
      if (!this.stateManager.isOperationAllowed('deleteCell')) {
        const error = new Error(
          `Cannot delete cell: Operation not allowed in current state (${this.stateManager.getCurrentState()})`,
        );
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'deleteCell', componentId });
        observer.next(false);
        observer.complete();
        return;
      }

      try {
        // Get the cell ID from the registry
        const cellId = this.registry.getCellId(componentId);

        if (!cellId) {
          const error = new Error(
            `Cannot delete cell: Cell not found in registry for component ${componentId}`,
          );
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'deleteCell', componentId });
          observer.next(false);
          observer.complete();
          return;
        }

        // Get the graph instance
        const graph = this.graphInitService.getGraph();

        // Get the cell
        const cell = this.graphUtils.getCellById(cellId);

        if (!cell) {
          const error = new Error(`Cannot delete cell: Cell not found in graph for ID ${cellId}`);
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'deleteCell', componentId, cellId });
          observer.next(false);
          observer.complete();
          return;
        }

        // Determine if it's a vertex or edge
        const isVertex = this.graphUtils.isVertex(cell);
        const isEdge = this.graphUtils.isEdge(cell);

        // Delete the cell
        graph.removeCells([cell]);

        // Unregister from registry
        this.registry.unregister(cellId, componentId);

        // Publish the event
        if (isVertex) {
          this.eventBus.publishCellEvent(DiagramEventType.VERTEX_DELETED, cellId, componentId);
        } else if (isEdge) {
          this.eventBus.publishCellEvent(DiagramEventType.EDGE_DELETED, cellId, componentId);
        } else {
          this.eventBus.publishCellEvent(DiagramEventType.CELL_DELETED, cellId, componentId);
        }

        observer.next(true);
        observer.complete();
      } catch (error) {
        this.logger.error('Error deleting cell', error);
        this.eventBus.publishError(error as Error, { operation: 'deleteCell', componentId });
        observer.next(false);
        observer.complete();
      }
    });
  }

  /**
   * Update a cell's properties
   * @param componentId The component ID of the cell to update
   * @param properties The properties to update
   * @returns An observable that emits the result of the operation
   */
  updateCell(componentId: string, properties: Record<string, unknown>): Observable<boolean> {
    return new Observable<boolean>(observer => {
      // Check if we're in a valid state for updating
      if (!this.stateManager.isOperationAllowed('updateCell')) {
        const error = new Error(
          `Cannot update cell: Operation not allowed in current state (${this.stateManager.getCurrentState()})`,
        );
        this.logger.error(error.message);
        this.eventBus.publishError(error, { operation: 'updateCell', componentId, properties });
        observer.next(false);
        observer.complete();
        return;
      }

      try {
        // Get the cell ID from the registry
        const cellId = this.registry.getCellId(componentId);

        if (!cellId) {
          const error = new Error(
            `Cannot update cell: Cell not found in registry for component ${componentId}`,
          );
          this.logger.error(error.message);
          this.eventBus.publishError(error, { operation: 'updateCell', componentId, properties });
          observer.next(false);
          observer.complete();
          return;
        }

        // Get the cell
        const cell = this.graphUtils.getCellById(cellId);

        if (!cell) {
          const error = new Error(`Cannot update cell: Cell not found in graph for ID ${cellId}`);
          this.logger.error(error.message);
          this.eventBus.publishError(error, {
            operation: 'updateCell',
            componentId,
            cellId,
            properties,
          });
          observer.next(false);
          observer.complete();
          return;
        }

        // Get the graph instance
        const graph = this.graphInitService.getGraph();

        // Begin update
        graph.model.beginUpdate();

        try {
          // Update label if provided
          if ('label' in properties) {
            graph.model.setValue(cell, properties['label']);
          }

          // Update style if provided
          if ('style' in properties) {
            graph.setCellStyle(properties['style'] as string, [cell]);
          }

          // Update other properties
          if ('width' in properties && 'height' in properties) {
            const geo = graph.model.getGeometry(cell).clone();
            geo.width = properties['width'] as number;
            geo.height = properties['height'] as number;
            graph.model.setGeometry(cell, geo);
          }

          // Determine if it's a vertex or edge
          const isVertex = this.graphUtils.isVertex(cell);
          const isEdge = this.graphUtils.isEdge(cell);

          // Publish the event
          if (isVertex) {
            this.eventBus.publishCellEvent(
              DiagramEventType.VERTEX_UPDATED,
              cellId,
              componentId,
              properties,
            );
          } else if (isEdge) {
            this.eventBus.publishCellEvent(
              DiagramEventType.EDGE_UPDATED,
              cellId,
              componentId,
              properties,
            );
          } else {
            this.eventBus.publishCellEvent(
              DiagramEventType.CELL_UPDATED,
              cellId,
              componentId,
              properties,
            );
          }

          observer.next(true);
          observer.complete();
        } finally {
          // End update
          graph.model.endUpdate();
        }
      } catch (error) {
        this.logger.error('Error updating cell', error);
        this.eventBus.publishError(error as Error, {
          operation: 'updateCell',
          componentId,
          properties,
        });
        observer.next(false);
        observer.complete();
      }
    });
  }
}
