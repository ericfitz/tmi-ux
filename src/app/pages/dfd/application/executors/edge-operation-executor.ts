/**
 * Executor for edge-related operations (create, update, delete)
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Graph } from '@antv/x6';

import { LoggerService } from '../../../../core/services/logger.service';
import { DFD_STYLING } from '../../constants/styling-constants';
import { BaseOperationExecutor } from './base-operation-executor';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation,
} from '../../types/graph-operation.types';
import { Cell } from '../../../../core/types/websocket-message.types';
import { normalizeCell } from '../../utils/cell-normalization.util';

@Injectable()
export class EdgeOperationExecutor extends BaseOperationExecutor {
  readonly priority = 100;

  constructor(logger: LoggerService) {
    super(logger);
  }

  canExecute(operation: GraphOperation): boolean {
    return ['create-edge', 'update-edge', 'delete-edge'].includes(operation.type);
  }

  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    this.logOperationStart(operation);

    return this.validateGraph(context.graph, operation).pipe(
      switchMap(_graph => {
        switch (operation.type) {
          case 'create-edge': {
            return this.executeCreateEdge(operation as CreateEdgeOperation, context);
          }
          case 'update-edge': {
            return this.executeUpdateEdge(operation as UpdateEdgeOperation, context);
          }
          case 'delete-edge': {
            return this.executeDeleteEdge(operation as DeleteEdgeOperation, context);
          }
          default: {
            const error = `Unsupported operation type: ${operation.type}`;
            this.logger.error(error, { operationId: operation.id });
            return of(this.createFailureResult(operation, error));
          }
        }
      }),
      map(result => {
        this.logOperationComplete(operation, result);
        return result;
      }),
    );
  }

  private executeCreateEdge(
    operation: CreateEdgeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeInfo, sourceNodeId, targetNodeId, sourcePortId, targetPortId } = operation;

      // Validate source and target nodes exist
      const sourceNode = this.getNode(graph, sourceNodeId);
      if (!sourceNode) {
        return of(this.createFailureResult(operation, `Source node not found: ${sourceNodeId}`));
      }

      const targetNode = this.getNode(graph, targetNodeId);
      if (!targetNode) {
        return of(this.createFailureResult(operation, `Target node not found: ${targetNodeId}`));
      }

      const edgeId = edgeInfo.id || this.generateCellId();
      const existingEdge = this.getEdge(graph, edgeId);

      // Handle retroactive creation (edge already created by X6 drag-connect)
      if (existingEdge && operation.metadata?.['retroactive'] === true) {
        return of(this._handleRetroactiveCreation(graph, operation, edgeId));
      }

      if (existingEdge) {
        this.logger.warn(`Edge already exists: ${edgeId}`);
        return of(this.createFailureResult(operation, `Edge already exists: ${edgeId}`));
      }

      // Build and add the edge
      const labels = this._buildEdgeLabels(edgeInfo);
      const edgeConfig = {
        id: edgeId,
        shape: edgeInfo.shape || 'edge',
        source: { cell: sourceNodeId, port: sourcePortId || undefined },
        target: { cell: targetNodeId, port: targetPortId || undefined },
        attrs: {
          line: {
            stroke: (edgeInfo as any).style?.stroke || DFD_STYLING.EDGES.STROKE,
            strokeWidth: (edgeInfo as any).style?.strokeWidth || DFD_STYLING.EDGES.STROKE_WIDTH,
            strokeDasharray: (edgeInfo as any).style?.strokeDasharray || undefined,
          },
        },
        labels,
        data: {
          ...(edgeInfo as any).properties,
          edgeType: (edgeInfo as any).edgeType || 'data-flow',
        },
      };

      graph.addEdge(edgeConfig);

      const currentState = this._captureEdgeState(graph, edgeId);

      this.logger.debugComponent('EdgeOperationExecutor', 'Edge created successfully', {
        edgeId,
        edgeType: (edgeInfo as any).edgeType,
        sourceNodeId,
        targetNodeId,
      });

      const result = this.createSuccessResult(operation, [edgeId], {
        edgeId,
        edgeType: (edgeInfo as any).edgeType,
        sourceNodeId,
        targetNodeId,
        hasLabel: !!(edgeInfo as any).label,
      });

      return of({
        ...result,
        previousState: [],
        currentState: currentState ? [currentState] : [],
      });
    } catch (error) {
      const errorMessage = `Failed to create edge: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, error });
      return of(this.createFailureResult(operation, errorMessage));
    }
  }

  /**
   * Handle retroactive edge creation where the edge was already created by X6 drag-connect.
   * Captures state for history without re-creating the edge.
   */
  private _handleRetroactiveCreation(
    graph: Graph,
    operation: CreateEdgeOperation,
    edgeId: string,
  ): OperationResult {
    const { edgeInfo, sourceNodeId, targetNodeId } = operation;

    this.logger.debugComponent(
      'EdgeOperationExecutor',
      'Retroactive edge creation - edge already exists, capturing state',
      { edgeId },
    );

    const currentState = this._captureEdgeState(graph, edgeId);

    const result = this.createSuccessResult(operation, [edgeId], {
      edgeId,
      edgeType: (edgeInfo as any).edgeType,
      sourceNodeId,
      targetNodeId,
      hasLabel: !!(edgeInfo as any).label,
      retroactive: true,
    });

    return {
      ...result,
      previousState: [],
      currentState: currentState ? [currentState] : [],
    };
  }

  /**
   * Build edge labels from edgeInfo.
   * Uses labels directly if available, otherwise creates from legacy label string.
   */
  private _buildEdgeLabels(edgeInfo: any): any[] {
    if (edgeInfo.labels && edgeInfo.labels.length > 0) {
      return edgeInfo.labels;
    }

    if (edgeInfo.label) {
      return [
        {
          position: 0.5,
          attrs: {
            text: {
              text: edgeInfo.label,
              fontSize: edgeInfo.style?.fontSize || DFD_STYLING.DEFAULT_FONT_SIZE,
              fill: edgeInfo.style?.textColor || DFD_STYLING.EDGES.LABEL_TEXT_COLOR,
              fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
              textAnchor: 'middle',
              dominantBaseline: 'middle',
            },
          },
        },
      ];
    }

    return [];
  }

  private executeUpdateEdge(
    operation: UpdateEdgeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeId, updates } = operation;

      const edge = this.getEdge(graph, edgeId);
      if (!edge) {
        return of(this.createFailureResult(operation, `Edge not found: ${edgeId}`));
      }

      // Use pre-captured state from metadata if available (for label changes where
      // the graph has already been updated before the operation runs)
      const previousState = operation.metadata?.['previousCellState']
        ? (operation.metadata['previousCellState'] as Cell)
        : this._captureEdgeState(graph, edgeId);

      // Apply updates and collect changed property names
      const endpointError = this._applyEdgeUpdates(graph, edge, updates, operation);
      if (endpointError) {
        return of(endpointError);
      }

      const changedProperties = this._collectChangedProperties(updates);
      const currentState = this._captureEdgeState(graph, edgeId);

      this.logger.debugComponent('EdgeOperationExecutor', 'Edge updated successfully', {
        edgeId,
        changedProperties,
      });

      const result = this.createSuccessResult(operation, [edgeId], {
        edgeId,
        changedProperties,
        updates,
      });

      return of({
        ...result,
        previousState: previousState ? [previousState] : [],
        currentState: currentState ? [currentState] : [],
      });
    } catch (error) {
      const errorMessage = `Failed to update edge: ${String(error)}`;
      this.logger.error(errorMessage, {
        operationId: operation.id,
        edgeId: operation.edgeId,
        error,
      });
      return of(this.createFailureResult(operation, errorMessage, [operation.edgeId]));
    }
  }

  /**
   * Apply all update fields to an edge. Returns a failure result if an endpoint
   * node is not found, or null on success.
   */
  private _applyEdgeUpdates(
    graph: Graph,
    edge: any,
    updates: any,
    operation: UpdateEdgeOperation,
  ): OperationResult | null {
    // Handle singular label string (from facade label changes)
    if (updates.label !== undefined) {
      edge.setLabels([
        {
          position: 0.5,
          attrs: {
            text: {
              text: updates.label,
              fontSize: DFD_STYLING.DEFAULT_FONT_SIZE,
              fill: DFD_STYLING.EDGES.LABEL_TEXT_COLOR,
              fontFamily: DFD_STYLING.TEXT_FONT_FAMILY,
              textAnchor: 'middle',
              dominantBaseline: 'middle',
            },
          },
        },
      ]);
    }

    // Handle labels array (from remote operations or history)
    if (updates.labels !== undefined) {
      edge.setLabels(updates.labels);
    }

    // Handle style updates
    if (updates.style) {
      if (updates.style.stroke) {
        edge.setAttrByPath('line/stroke', updates.style.stroke);
      }
      if (updates.style.strokeWidth !== undefined) {
        edge.setAttrByPath('line/strokeWidth', updates.style.strokeWidth);
      }
      if (updates.style.strokeDasharray !== undefined) {
        edge.setAttrByPath('line/strokeDasharray', updates.style.strokeDasharray);
      }
    }

    // Handle endpoint updates (may fail if nodes not found)
    if (updates.sourceNodeId) {
      if (!this.getNode(graph, updates.sourceNodeId)) {
        return this.createFailureResult(
          operation,
          `New source node not found: ${updates.sourceNodeId}`,
        );
      }
      const source = edge.getSource();
      edge.setSource({
        cell: updates.sourceNodeId,
        port: updates.sourcePort || (source).port,
      });
    }

    if (updates.targetNodeId) {
      if (!this.getNode(graph, updates.targetNodeId)) {
        return this.createFailureResult(
          operation,
          `New target node not found: ${updates.targetNodeId}`,
        );
      }
      const target = edge.getTarget();
      edge.setTarget({
        cell: updates.targetNodeId,
        port: updates.targetPort || (target).port,
      });
    }

    // Handle data properties
    if (updates.properties) {
      const currentData = edge.getData() || {};
      edge.setData({ ...currentData, ...updates.properties });
    }

    return null;
  }

  /**
   * Collect names of changed properties from an updates object.
   */
  private _collectChangedProperties(updates: any): string[] {
    const changed: string[] = [];

    if (updates.label !== undefined || updates.labels !== undefined) changed.push('label');
    if (updates.style?.stroke) changed.push('stroke');
    if (updates.style?.strokeWidth !== undefined) changed.push('strokeWidth');
    if (updates.style?.strokeDasharray !== undefined) changed.push('strokeDasharray');
    if (updates.sourceNodeId) changed.push('source');
    if (updates.targetNodeId) changed.push('target');
    if (updates.properties) changed.push('properties');

    return changed;
  }

  private executeDeleteEdge(
    operation: DeleteEdgeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeId } = operation;

      const edge = this.getEdge(graph, edgeId);
      if (!edge) {
        // Edge already doesn't exist - consider this success
        this.logger.debugComponent('EdgeOperationExecutor', 'Edge already deleted or not found', {
          edgeId,
        });
        return of(this.createSuccessResult(operation, []));
      }

      // Capture previous state before deletion
      const previousState = this._captureEdgeState(graph, edgeId);

      // Store edge data for undo/metadata
      const edgeData = {
        id: edgeId,
        shape: edge.shape,
        source: edge.getSource(),
        target: edge.getTarget(),
        attrs: edge.getAttrs(),
        labels: edge.getLabels(),
        data: edge.getData(),
      };

      // Remove the edge
      graph.removeEdge(edge);

      this.logger.debugComponent('EdgeOperationExecutor', 'Edge deleted successfully', { edgeId });

      const result = this.createSuccessResult(operation, [edgeId], {
        edgeId,
        deletedEdgeData: edgeData,
        sourceNodeId:
          typeof edgeData.source === 'object' ? (edgeData.source as any).cell : edgeData.source,
        targetNodeId:
          typeof edgeData.target === 'object' ? (edgeData.target as any).cell : edgeData.target,
      });

      return of({
        ...result,
        previousState: previousState ? [previousState] : [],
        currentState: [],
      });
    } catch (error) {
      const errorMessage = `Failed to delete edge: ${String(error)}`;
      this.logger.error(errorMessage, {
        operationId: operation.id,
        edgeId: operation.edgeId,
        error,
      });
      return of(this.createFailureResult(operation, errorMessage, [operation.edgeId]));
    }
  }

  /**
   * Capture the current state of an edge for history tracking
   * Uses normalizeCell to ensure consistency with persistence filtering
   */
  private _captureEdgeState(graph: Graph, edgeId: string): Cell | null {
    const edge = this.getEdge(graph, edgeId);
    if (!edge) {
      return null;
    }

    const typedEdge = edge;
    const cellData: Cell = {
      id: typedEdge.id,
      shape: typedEdge.shape,
      source: typedEdge.getSource(),
      target: typedEdge.getTarget(),
      vertices: typedEdge.getVertices?.() || [],
      attrs: typedEdge.getAttrs(),
      labels: typedEdge.getLabels?.() || [],
      data: typedEdge.getData(),
      zIndex: typedEdge.getZIndex(),
    };

    return normalizeCell(cellData);
  }
}
