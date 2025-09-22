/**
 * Executor for node-related operations (create, update, delete)
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
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation
} from '../../types/graph-operation.types';

@Injectable()
export class NodeOperationExecutor extends BaseOperationExecutor {
  readonly priority = 100;

  constructor(logger: LoggerService) {
    super(logger);
  }

  canExecute(operation: GraphOperation): boolean {
    return ['create-node', 'update-node', 'delete-node'].includes(operation.type);
  }

  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    this.logOperationStart(operation);

    return this.validateGraph(context.graph, operation).pipe(
      switchMap(_graph => {
        switch (operation.type) {
          case 'create-node': {
            return this.executeCreateNode(operation as CreateNodeOperation, context);
          }
          case 'update-node': {
            return this.executeUpdateNode(operation as UpdateNodeOperation, context);
          }
          case 'delete-node': {
            return this.executeDeleteNode(operation as DeleteNodeOperation, context);
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

  private executeCreateNode(
    operation: CreateNodeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const nodeData = operation.nodeData;

      // Generate ID if not provided
      const nodeId = nodeData.id || this.generateCellId();

      // Create node configuration
      const nodeConfig = {
        id: nodeId,
        shape: nodeData.shape || 'rect',
        x: nodeData.position?.x || 100,
        y: nodeData.position?.y || 100,
        width: nodeData.size?.width || 120,
        height: nodeData.size?.height || 60,
        attrs: {
          body: {
            fill: nodeData.style?.fill || '#ffffff',
            stroke: nodeData.style?.stroke || '#000000',
            strokeWidth: nodeData.style?.strokeWidth || 1
          },
          label: {
            text: nodeData.label || 'New Node',
            fontSize: nodeData.style?.fontSize || 14,
            fill: nodeData.style?.textColor || '#000000'
          }
        },
        data: {
          ...nodeData.properties,
          nodeType: nodeData.nodeType || 'process'
        }
      };

      // Add node to graph
      const node = graph.addNode(nodeConfig);

      // Apply any additional styling
      if (nodeData.style?.cssClass) {
        node.addCssClass(nodeData.style.cssClass);
      }

      this.logger.debug('Node created successfully', {
        nodeId,
        nodeType: nodeData.nodeType,
        position: nodeData.position
      });

      return [this.createSuccessResult(
        operation,
        [nodeId],
        {
          nodeId,
          nodeType: nodeData.nodeType,
          position: { x: nodeConfig.x, y: nodeConfig.y },
          size: { width: nodeConfig.width, height: nodeConfig.height }
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to create node: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, error });
      return [this.createFailureResult(operation, errorMessage)];
    }
  }

  private executeUpdateNode(
    operation: UpdateNodeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { nodeId, updates } = operation;

      const node = this.getNode(graph, nodeId);
      if (!node) {
        const error = `Node not found: ${nodeId}`;
        return [this.createFailureResult(operation, error)];
      }

      // Apply updates
      const changedProperties: string[] = [];

      if (updates.position) {
        node.setPosition(updates.position.x, updates.position.y);
        changedProperties.push('position');
      }

      if (updates.size) {
        node.setSize(updates.size.width, updates.size.height);
        changedProperties.push('size');
      }

      if (updates.label !== undefined) {
        node.setAttrByPath('label/text', updates.label);
        changedProperties.push('label');
      }

      if (updates.style) {
        if (updates.style.fill) {
          node.setAttrByPath('body/fill', updates.style.fill);
          changedProperties.push('fill');
        }
        if (updates.style.stroke) {
          node.setAttrByPath('body/stroke', updates.style.stroke);
          changedProperties.push('stroke');
        }
        if (updates.style.strokeWidth !== undefined) {
          node.setAttrByPath('body/strokeWidth', updates.style.strokeWidth);
          changedProperties.push('strokeWidth');
        }
        if (updates.style.fontSize !== undefined) {
          node.setAttrByPath('label/fontSize', updates.style.fontSize);
          changedProperties.push('fontSize');
        }
        if (updates.style.textColor) {
          node.setAttrByPath('label/fill', updates.style.textColor);
          changedProperties.push('textColor');
        }
      }

      if (updates.properties) {
        const currentData = node.getData() || {};
        node.setData({ ...currentData, ...updates.properties });
        changedProperties.push('properties');
      }

      this.logger.debug('Node updated successfully', {
        nodeId,
        changedProperties
      });

      return [this.createSuccessResult(
        operation,
        [nodeId],
        {
          nodeId,
          changedProperties,
          updates
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to update node: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, nodeId: operation.nodeId, error });
      return [this.createFailureResult(operation, errorMessage, [operation.nodeId])];
    }
  }

  private executeDeleteNode(
    operation: DeleteNodeOperation, 
    context: OperationContext
  ): Observable<OperationResult> {
    try {
      const graph = context.graph;
      const { nodeId } = operation;

      const node = this.getNode(graph, nodeId);
      if (!node) {
        // Node already doesn't exist - consider this success
        this.logger.debug('Node already deleted or not found', { nodeId });
        return [this.createSuccessResult(operation, [])];
      }

      // Get connected edges before deletion
      const connectedEdges = graph.getConnectedEdges(node);
      const affectedCellIds = [nodeId, ...connectedEdges.map(edge => edge.id)];

      // Store node data for undo/metadata
      const nodeData = {
        id: nodeId,
        shape: node.shape,
        position: node.getPosition(),
        size: node.getSize(),
        attrs: node.getAttrs(),
        data: node.getData()
      };

      // Remove the node (this will also remove connected edges)
      graph.removeNode(node);

      this.logger.debug('Node deleted successfully', {
        nodeId,
        connectedEdgesCount: connectedEdges.length
      });

      return [this.createSuccessResult(
        operation,
        affectedCellIds,
        {
          nodeId,
          deletedNodeData: nodeData,
          deletedEdgeIds: connectedEdges.map(edge => edge.id),
          connectedEdgesCount: connectedEdges.length
        }
      )];

    } catch (error) {
      const errorMessage = `Failed to delete node: ${String(error)}`;
      this.logger.error(errorMessage, { operationId: operation.id, nodeId: operation.nodeId, error });
      return [this.createFailureResult(operation, errorMessage, [operation.nodeId])];
    }
  }
}