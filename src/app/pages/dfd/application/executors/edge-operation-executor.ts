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
      const targetNode = this.getNode(graph, targetNodeId);

      if (!sourceNode) {
        const error = `Source node not found: ${sourceNodeId}`;
        return of(this.createFailureResult(operation, error));
      }

      if (!targetNode) {
        const error = `Target node not found: ${targetNodeId}`;
        return of(this.createFailureResult(operation, error));
      }

      // Generate edge ID if not provided
      const edgeId = edgeInfo.id || this.generateCellId();

      // Check if this is a retroactive operation (edge already exists)
      const existingEdge = this.getEdge(graph, edgeId);
      const isRetroactive = operation.metadata?.['retroactive'] === true;

      if (existingEdge && isRetroactive) {
        // Edge already exists (created by X6 drag-connect), just capture state for history
        this.logger.debug('Retroactive edge creation - edge already exists, capturing state', {
          edgeId,
        });

        const currentState = this._captureEdgeState(graph, edgeId);

        const result = this.createSuccessResult(operation, [edgeId], {
          edgeId,
          edgeType: (edgeInfo as any).edgeType,
          sourceNodeId,
          targetNodeId,
          hasLabel: !!(edgeInfo as any).label,
          retroactive: true,
        });

        return of({
          ...result,
          previousState: [],
          currentState: currentState ? [currentState] : [],
        });
      }

      // Normal edge creation (not retroactive)
      if (existingEdge) {
        const error = `Edge already exists: ${edgeId}`;
        this.logger.warn(error);
        return of(this.createFailureResult(operation, error));
      }

      // Create edge configuration
      const edgeConfig = {
        id: edgeId,
        shape: edgeInfo.shape || 'edge',
        source: {
          cell: sourceNodeId,
          port: sourcePortId || undefined,
        },
        target: {
          cell: targetNodeId,
          port: targetPortId || undefined,
        },
        attrs: {
          line: {
            stroke: (edgeInfo as any).style?.stroke || DFD_STYLING.EDGES.STROKE,
            strokeWidth: (edgeInfo as any).style?.strokeWidth || DFD_STYLING.EDGES.STROKE_WIDTH,
            strokeDasharray: (edgeInfo as any).style?.strokeDasharray || undefined,
          },
        },
        labels:
          (edgeInfo as any).label || edgeInfo.labels
            ? [
                {
                  markup: [
                    {
                      tagName: 'rect',
                      selector: 'body',
                    },
                    {
                      tagName: 'text',
                      selector: 'label',
                    },
                  ],
                  attrs: {
                    label: {
                      text: (edgeInfo as any).label || '',
                      fontSize: (edgeInfo as any).style?.fontSize || DFD_STYLING.DEFAULT_FONT_SIZE,
                      fill:
                        (edgeInfo as any).style?.textColor || DFD_STYLING.EDGES.LABEL_TEXT_COLOR,
                    },
                    body: {
                      fill:
                        (edgeInfo as any).style?.labelBackground ||
                        DFD_STYLING.EDGES.LABEL_BACKGROUND,
                      stroke:
                        (edgeInfo as any).style?.labelBorder || DFD_STYLING.EDGES.LABEL_BORDER,
                      strokeWidth: DFD_STYLING.EDGES.LABEL_BORDER_WIDTH,
                      rx: 3,
                      ry: 3,
                    },
                  },
                },
              ]
            : [],
        data: {
          ...(edgeInfo as any).properties,
          edgeType: (edgeInfo as any).edgeType || 'data-flow',
        },
      };

      // Add edge to graph
      const _edge = graph.addEdge(edgeConfig);

      // Apply any additional styling
      if ((edgeInfo as any).style?.cssClass) {
        // Note: addCssClass might not exist, skip for now
        // _edge.addCssClass(edgeInfo.style.cssClass);
      }

      // Capture current state for history
      const currentState = this._captureEdgeState(graph, edgeId);

      this.logger.debug('Edge created successfully', {
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

  private executeUpdateEdge(
    operation: UpdateEdgeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeId, updates } = operation;

      const edge = this.getEdge(graph, edgeId);
      if (!edge) {
        const error = `Edge not found: ${edgeId}`;
        return of(this.createFailureResult(operation, error));
      }

      // Capture previous state before any changes
      const previousState = this._captureEdgeState(graph, edgeId);

      // Apply updates
      const changedProperties: string[] = [];

      if (updates.labels !== undefined && updates.labels.length > 0) {
        if (updates.labels[0]) {
          // Add or update label
          edge.setLabels([
            {
              markup: [
                {
                  tagName: 'rect',
                  selector: 'body',
                },
                {
                  tagName: 'text',
                  selector: 'label',
                },
              ],
              attrs: {
                label: {
                  text: (updates.labels[0] as any).text || '',
                  fontSize:
                    (updates.labels[0] as any).attrs?.label?.fontSize ||
                    DFD_STYLING.DEFAULT_FONT_SIZE,
                  fill:
                    (updates.labels[0] as any).attrs?.label?.fill ||
                    DFD_STYLING.EDGES.LABEL_TEXT_COLOR,
                },
                body: {
                  fill:
                    (updates as any).style?.labelBackground || DFD_STYLING.EDGES.LABEL_BACKGROUND,
                  stroke: (updates as any).style?.labelBorder || DFD_STYLING.EDGES.LABEL_BORDER,
                  strokeWidth: DFD_STYLING.EDGES.LABEL_BORDER_WIDTH,
                  rx: 3,
                  ry: 3,
                },
              },
            },
          ]);
        } else {
          // Remove label
          edge.setLabels([]);
        }
        changedProperties.push('label');
      }

      if ((updates as any).style) {
        if ((updates as any).style.stroke) {
          edge.setAttrByPath('line/stroke', (updates as any).style.stroke);
          changedProperties.push('stroke');
        }
        if ((updates as any).style.strokeWidth !== undefined) {
          edge.setAttrByPath('line/strokeWidth', (updates as any).style.strokeWidth);
          changedProperties.push('strokeWidth');
        }
        if ((updates as any).style.strokeDasharray !== undefined) {
          edge.setAttrByPath('line/strokeDasharray', (updates as any).style.strokeDasharray);
          changedProperties.push('strokeDasharray');
        }
      }

      if ((updates as any).sourceNodeId || (updates as any).targetNodeId) {
        // Update source/target connections
        const source = edge.getSource();
        const target = edge.getTarget();

        if ((updates as any).sourceNodeId) {
          const newSourceNode = this.getNode(graph, (updates as any).sourceNodeId);
          if (!newSourceNode) {
            const error = `New source node not found: ${(updates as any).sourceNodeId}`;
            return of(this.createFailureResult(operation, error));
          }
          edge.setSource({
            cell: (updates as any).sourceNodeId,
            port: (updates as any).sourcePort || (source as any).port,
          });
          changedProperties.push('source');
        }

        if ((updates as any).targetNodeId) {
          const newTargetNode = this.getNode(graph, (updates as any).targetNodeId);
          if (!newTargetNode) {
            const error = `New target node not found: ${(updates as any).targetNodeId}`;
            return of(this.createFailureResult(operation, error));
          }
          edge.setTarget({
            cell: (updates as any).targetNodeId,
            port: (updates as any).targetPort || (target as any).port,
          });
          changedProperties.push('target');
        }
      }

      if ((updates as any).properties) {
        const currentData = edge.getData() || {};
        edge.setData({ ...currentData, ...(updates as any).properties });
        changedProperties.push('properties');
      }

      // Capture current state after all changes
      const currentState = this._captureEdgeState(graph, edgeId);

      this.logger.debug('Edge updated successfully', {
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
        this.logger.debug('Edge already deleted or not found', { edgeId });
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

      this.logger.debug('Edge deleted successfully', { edgeId });

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
