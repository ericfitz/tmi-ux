/**
 * Executor for edge-related operations (create, update, delete)
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { LoggerService } from '../../../../../core/services/logger.service';
import { BaseOperationExecutor } from './base-operation-executor';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  CreateEdgeOperation,
  UpdateEdgeOperation,
  DeleteEdgeOperation
} from '../../types/graph-operation.types';

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
            return [this.createFailureResult(operation, error)];
          }
        }
      }),
      map(result => {
        this.logOperationComplete(operation, result);
        return result;
      })
    );
  }

  private executeCreateEdge(
    operation: CreateEdgeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const edgeData = operation.edgeData;

      // Validate source and target nodes exist
      const sourceNode = this.getNode(graph, edgeData.sourceNodeId);
      const targetNode = this.getNode(graph, edgeData.targetNodeId);

      if (!sourceNode) {
        const error = `Source node not found: ${edgeData.sourceNodeId}`;
        return [this.createFailureResult(operation, error)];
      }

      if (!targetNode) {
        const error = `Target node not found: ${edgeData.targetNodeId}`;
        return [this.createFailureResult(operation, error)];
      }

      // Generate edge ID if not provided
      const edgeId = edgeData.id || this.generateCellId();

      // Create edge configuration
      const edgeConfig = {
        id: edgeId,
        shape: edgeData.shape || 'edge',
        source: {
          cell: edgeData.sourceNodeId,
          port: edgeData.sourcePort || undefined
        },
        target: {
          cell: edgeData.targetNodeId,
          port: edgeData.targetPort || undefined
        },
        attrs: {
          line: {
            stroke: edgeData.style?.stroke || '#000000',
            strokeWidth: edgeData.style?.strokeWidth || 1,
            strokeDasharray: edgeData.style?.strokeDasharray || undefined
          }
        },
        labels: edgeData.label ? [{
          markup: [{
            tagName: 'rect',
            selector: 'body'
          }, {
            tagName: 'text',
            selector: 'label'
          }],
          attrs: {
            label: {
              text: edgeData.label,
              fontSize: edgeData.style?.fontSize || 12,
              fill: edgeData.style?.textColor || '#000000'
            },
            body: {
              fill: edgeData.style?.labelBackground || '#ffffff',
              stroke: edgeData.style?.labelBorder || '#000000',
              strokeWidth: 1,
              rx: 3,
              ry: 3
            }
          }
        }] : [],
        data: {
          ...edgeData.properties,
          edgeType: edgeData.edgeType || 'dataflow'
        }
      };

      // Add edge to graph
      const edge = graph.addEdge(edgeConfig);

      // Apply any additional styling
      if (edgeData.style?.cssClass) {
        edge.addCssClass(edgeData.style.cssClass);
      }

      this.logger.debug('Edge created successfully', {
        edgeId,
        edgeType: edgeData.edgeType,
        sourceNodeId: edgeData.sourceNodeId,
        targetNodeId: edgeData.targetNodeId
      });

      return [this.createSuccessResult(
        operation,
        [edgeId],
        {
          edgeId,
          edgeType: edgeData.edgeType,
          sourceNodeId: edgeData.sourceNodeId,
          targetNodeId: edgeData.targetNodeId,
          hasLabel: !!edgeData.label
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to create edge: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, error });
      return [this.createFailureResult(operation, errorMessage)];
    }
  }

  private executeUpdateEdge(
    operation: UpdateEdgeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeId, updates } = operation;

      const edge = this.getEdge(graph, edgeId);
      if (!edge) {
        const error = `Edge not found: ${edgeId}`;
        return [this.createFailureResult(operation, error)];
      }

      // Apply updates
      const changedProperties: string[] = [];

      if (updates.label !== undefined) {
        if (updates.label) {
          // Add or update label
          edge.setLabels([{
            markup: [{
              tagName: 'rect',
              selector: 'body'
            }, {
              tagName: 'text',
              selector: 'label'
            }],
            attrs: {
              label: {
                text: updates.label,
                fontSize: updates.style?.fontSize || 12,
                fill: updates.style?.textColor || '#000000'
              },
              body: {
                fill: updates.style?.labelBackground || '#ffffff',
                stroke: updates.style?.labelBorder || '#000000',
                strokeWidth: 1,
                rx: 3,
                ry: 3
              }
            }
          }]);
        } else {
          // Remove label
          edge.setLabels([]);
        }
        changedProperties.push('label');
      }

      if (updates.style) {
        if (updates.style.stroke) {
          edge.setAttrByPath('line/stroke', updates.style.stroke);
          changedProperties.push('stroke');
        }
        if (updates.style.strokeWidth !== undefined) {
          edge.setAttrByPath('line/strokeWidth', updates.style.strokeWidth);
          changedProperties.push('strokeWidth');
        }
        if (updates.style.strokeDasharray !== undefined) {
          edge.setAttrByPath('line/strokeDasharray', updates.style.strokeDasharray);
          changedProperties.push('strokeDasharray');
        }
      }

      if (updates.sourceNodeId || updates.targetNodeId) {
        // Update source/target connections
        const source = edge.getSource();
        const target = edge.getTarget();

        if (updates.sourceNodeId) {
          const newSourceNode = this.getNode(graph, updates.sourceNodeId);
          if (!newSourceNode) {
            const error = `New source node not found: ${updates.sourceNodeId}`;
            return [this.createFailureResult(operation, error)];
          }
          edge.setSource({ 
            cell: updates.sourceNodeId, 
            port: updates.sourcePort || source.port 
          });
          changedProperties.push('source');
        }

        if (updates.targetNodeId) {
          const newTargetNode = this.getNode(graph, updates.targetNodeId);
          if (!newTargetNode) {
            const error = `New target node not found: ${updates.targetNodeId}`;
            return [this.createFailureResult(operation, error)];
          }
          edge.setTarget({ 
            cell: updates.targetNodeId, 
            port: updates.targetPort || target.port 
          });
          changedProperties.push('target');
        }
      }

      if (updates.properties) {
        const currentData = edge.getData() || {};
        edge.setData({ ...currentData, ...updates.properties });
        changedProperties.push('properties');
      }

      this.logger.debug('Edge updated successfully', {
        edgeId,
        changedProperties
      });

      return [this.createSuccessResult(
        operation,
        [edgeId],
        {
          edgeId,
          changedProperties,
          updates
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to update edge: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, edgeId: operation.edgeId, error });
      return [this.createFailureResult(operation, errorMessage, [operation.edgeId])];
    }
  }

  private executeDeleteEdge(
    operation: DeleteEdgeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { edgeId } = operation;

      const edge = this.getEdge(graph, edgeId);
      if (!edge) {
        // Edge already doesn't exist - consider this success
        this.logger.debug('Edge already deleted or not found', { edgeId });
        return [this.createSuccessResult(operation, [])];
      }

      // Store edge data for undo/metadata
      const edgeData = {
        id: edgeId,
        shape: edge.shape,
        source: edge.getSource(),
        target: edge.getTarget(),
        attrs: edge.getAttrs(),
        labels: edge.getLabels(),
        data: edge.getData()
      };

      // Remove the edge
      graph.removeEdge(edge);

      this.logger.debug('Edge deleted successfully', { edgeId });

      return [this.createSuccessResult(
        operation,
        [edgeId],
        {
          edgeId,
          deletedEdgeData: edgeData,
          sourceNodeId: typeof edgeData.source === 'object' ? edgeData.source.cell : edgeData.source,
          targetNodeId: typeof edgeData.target === 'object' ? edgeData.target.cell : edgeData.target
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to delete edge: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, edgeId: operation.edgeId, error });
      return [this.createFailureResult(operation, errorMessage, [operation.edgeId])];
    }
  }
}