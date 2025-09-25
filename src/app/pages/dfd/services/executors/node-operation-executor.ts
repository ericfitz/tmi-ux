/**
 * NodeOperationExecutor - Handles all node-related graph operations
 *
 * This executor is responsible for:
 * - Creating new nodes with proper styling and configuration
 * - Updating existing nodes with validation
 * - Deleting nodes and handling connected edges
 * - Providing undo/redo data for history tracking
 */

import { Observable, of, throwError } from 'rxjs';

import { LoggerService } from '../../../../core/services/logger.service';
import { getX6ShapeForNodeType } from '../../infrastructure/adapters/infra-x6-shape-definitions';
import {
  GraphOperation,
  OperationResult,
  OperationContext,
  OperationExecutor,
  CreateNodeOperation,
  UpdateNodeOperation,
  DeleteNodeOperation,
  NodeData,
} from '../../types/graph-operation.types';

export class NodeOperationExecutor implements OperationExecutor {
  readonly priority = 100; // Standard priority for node operations

  constructor(private readonly logger: LoggerService) {}

  canExecute(operation: GraphOperation): boolean {
    return (
      operation.type === 'create-node' ||
      operation.type === 'update-node' ||
      operation.type === 'delete-node'
    );
  }

  execute(operation: GraphOperation, context: OperationContext): Observable<OperationResult> {
    this.logger.debug('NodeOperationExecutor: Executing operation', {
      operationId: operation.id,
      type: operation.type,
    });

    switch (operation.type) {
      case 'create-node':
        return this._createNode(operation as CreateNodeOperation, context);
      case 'update-node':
        return this._updateNode(operation as UpdateNodeOperation, context);
      case 'delete-node':
        return this._deleteNode(operation as DeleteNodeOperation, context);
      default:
        return of({
          success: false,
          operationType: operation.type,
          affectedCellIds: [],
          timestamp: Date.now(),
          error: `Unsupported operation type: ${operation.type}`,
        });
    }
  }

  /**
   * Create a new node on the graph
   */
  private _createNode(
    operation: CreateNodeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const { nodeData } = operation;
      const { graph } = context;

      // Validate required fields (before applying defaults)
      if (!context.suppressValidation) {
        const validationError = this._validateNodeData(nodeData);
        if (validationError) {
          return throwError(() => new Error(`Node validation failed: ${validationError}`));
        }
      }

      // Generate node ID if not provided
      const nodeId = nodeData.id || this._generateNodeId();

      // Apply default values for missing properties
      const finalNodeData = this._applyNodeDefaults(nodeData);

      // Create node configuration for X6
      const nodeConfig = this._buildNodeConfig(nodeId, finalNodeData);

      // Add node to graph
      const addedNode = graph.addNode(nodeConfig);

      // Use the actual node ID from the added node (in case the graph modifies it)
      const actualNodeId = addedNode.id || nodeId;

      // Apply CSS classes if specified
      if (finalNodeData.style?.['cssClass']) {
        // Note: addCssClass method might not exist on X6 nodes, skip for now
        // addedNode.addCssClass(finalNodeData.style['cssClass']);
      }

      this.logger.debug('Node created successfully', {
        nodeId: actualNodeId,
        nodeType: finalNodeData.nodeType,
        position: finalNodeData.position,
      });

      return of({
        success: true,
        operationType: 'create-node',
        affectedCellIds: [actualNodeId],
        timestamp: Date.now(),
        metadata: {
          nodeId: actualNodeId,
          nodeType: finalNodeData.nodeType,
          position: finalNodeData.position,
          size: finalNodeData.size,
        },
      });
    } catch (error) {
      this.logger.error('Failed to create node', { error, operation });

      return of({
        success: false,
        operationType: 'create-node',
        affectedCellIds: [],
        timestamp: Date.now(),
        error: `Failed to create node: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Update an existing node
   */
  private _updateNode(
    operation: UpdateNodeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const { nodeId, updates } = operation;
      const { graph } = context;

      // Find the node
      const node = graph.getCellById(nodeId);
      if (!node || !node.isNode?.()) {
        return of({
          success: false,
          operationType: 'update-node',
          affectedCellIds: [],
          timestamp: Date.now(),
          error: `Node not found: ${nodeId}`,
        });
      }

      const changedProperties: string[] = [];

      // Update position
      if (updates.position && node.isNode?.()) {
        node.setPosition(updates.position.x, updates.position.y);
        changedProperties.push('position');
      }

      // Update size
      if (updates.size && node.isNode?.()) {
        node.setSize(updates.size.width, updates.size.height);
        changedProperties.push('size');
      }

      // Update label
      if (updates.label !== undefined) {
        node.setAttrByPath('label/text', updates.label);
        changedProperties.push('label');
      }

      // Update style properties
      if (updates.style) {
        if (updates.style['fill'] !== undefined) {
          node.setAttrByPath('body/fill', updates.style['fill']);
          changedProperties.push('fill');
        }
        if (updates.style['stroke'] !== undefined) {
          node.setAttrByPath('body/stroke', updates.style['stroke']);
          changedProperties.push('stroke');
        }
        if (updates.style['strokeWidth'] !== undefined) {
          node.setAttrByPath('body/strokeWidth', updates.style['strokeWidth']);
          changedProperties.push('strokeWidth');
        }
        if (updates.style['fontSize'] !== undefined) {
          node.setAttrByPath('label/fontSize', updates.style['fontSize']);
          changedProperties.push('fontSize');
        }
        if (updates.style['textColor'] !== undefined) {
          node.setAttrByPath('label/fill', updates.style['textColor']);
          changedProperties.push('textColor');
        }
      }

      // Update properties (custom data)
      if (updates.properties) {
        const currentData = node.getData() || {};
        const newData = { ...currentData, ...updates.properties };
        node.setData(newData);
        changedProperties.push('properties');
      }

      this.logger.debug('Node updated successfully', {
        nodeId,
        changedProperties,
        updatesCount: changedProperties.length,
      });

      return of({
        success: true,
        operationType: 'update-node',
        affectedCellIds: [nodeId],
        timestamp: Date.now(),
        metadata: {
          nodeId,
          changedProperties,
        },
      });
    } catch (error) {
      this.logger.error('Failed to update node', { error, operation });

      return of({
        success: false,
        operationType: 'update-node',
        affectedCellIds: [],
        timestamp: Date.now(),
        error: `Failed to update node: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Delete a node and its connected edges
   */
  private _deleteNode(
    operation: DeleteNodeOperation,
    context: OperationContext,
  ): Observable<OperationResult> {
    try {
      const { nodeId } = operation;
      const { graph } = context;

      // Find the node
      const node = graph.getCellById(nodeId);
      if (!node || !node.isNode?.()) {
        // Node doesn't exist, consider it a successful no-op
        this.logger.debug('Node not found for deletion, treating as success', { nodeId });
        return of({
          success: true,
          operationType: 'delete-node',
          affectedCellIds: [],
          timestamp: Date.now(),
          metadata: {
            nodeId,
            connectedEdgesCount: 0,
          },
        });
      }

      // Get connected edges before deletion
      const connectedEdges = graph.getConnectedEdges(node) || [];
      const connectedEdgeIds = connectedEdges.map(edge => edge.id);

      // Store node data for undo functionality
      const nodeData = {
        id: node.id,
        shape: node.shape,
        position: node.isNode?.() ? node.getPosition() : { x: 0, y: 0 },
        size: node.isNode?.() ? node.getSize() : { width: 0, height: 0 },
        attrs: node.getAttrs(),
        data: node.getData(),
      };

      // Remove the node (this will also remove connected edges)
      if (node.isNode?.()) {
        graph.removeNode(node.id);
      } else {
        graph.removeCell(node);
      }

      this.logger.debug('Node deleted successfully', {
        nodeId,
        connectedEdgesCount: connectedEdgeIds.length,
      });

      return of({
        success: true,
        operationType: 'delete-node',
        affectedCellIds: [nodeId, ...connectedEdgeIds],
        timestamp: Date.now(),
        metadata: {
          nodeId,
          connectedEdgesCount: connectedEdgeIds.length,
          deletedNodeData: nodeData,
          deletedEdgeIds: connectedEdgeIds,
        },
      });
    } catch (error) {
      this.logger.error('Failed to delete node', { error, operation });

      return of({
        success: false,
        operationType: 'delete-node',
        affectedCellIds: [],
        timestamp: Date.now(),
        error: `Failed to delete node: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Generate a unique node ID
   */
  private _generateNodeId(): string {
    return `node-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Apply default values to node data
   */
  private _applyNodeDefaults(nodeData: NodeData): NodeData {
    // Get node-type-specific default dimensions
    const defaultSize = this._getDefaultSizeForNodeType(nodeData.nodeType);
    const defaultLabel = this._getDefaultLabelForNodeType(nodeData.nodeType);

    return {
      nodeType: nodeData.nodeType,
      id: nodeData.id,
      position: nodeData.position || { x: 100, y: 100 },
      size: nodeData.size || defaultSize,
      label: nodeData.label || defaultLabel,
      style: {
        fill: '#ffffff',
        stroke: '#000000',
        strokeWidth: 1,
        fontSize: 12,
        textColor: '#000000',
        ...nodeData.style,
      },
      properties: nodeData.properties || {},
    };
  }

  /**
   * Build X6 node configuration
   */
  private _buildNodeConfig(nodeId: string, nodeData: NodeData): any {
    const config = {
      id: nodeId,
      shape: this._getShapeForNodeType(nodeData.nodeType),
      x: nodeData.position!.x,
      y: nodeData.position!.y,
      width: nodeData.size!.width,
      height: nodeData.size!.height,
      attrs: {
        body: {
          fill: nodeData.style!['fill'],
          stroke: nodeData.style!['stroke'],
          strokeWidth: nodeData.style!['strokeWidth'],
        },
        label: {
          text: nodeData.label,
          fontSize: nodeData.style!['fontSize'],
          fill: nodeData.style!['textColor'],
        },
      },
      data: {
        nodeType: nodeData.nodeType,
        ...nodeData.properties,
      },
    };

    return config;
  }

  /**
   * Get X6 shape name for node type
   */
  private _getShapeForNodeType(nodeType: string): string {
    // Use the centralized shape mapping function that handles all custom shapes
    return getX6ShapeForNodeType(nodeType);
  }

  /**
   * Get default size for node type to match InfraNodeService dimensions
   */
  private _getDefaultSizeForNodeType(nodeType: string): { width: number; height: number } {
    switch (nodeType) {
      case 'process':
        return { width: 120, height: 60 };
      case 'store':
        return { width: 140, height: 40 };
      case 'actor':
        return { width: 100, height: 80 };
      case 'security-boundary':
        return { width: 200, height: 150 };
      case 'text-box':
        return { width: 100, height: 40 };
      default:
        return { width: 120, height: 60 };
    }
  }

  /**
   * Get default label for node type
   */
  private _getDefaultLabelForNodeType(nodeType: string): string {
    switch (nodeType) {
      case 'actor':
        return 'Actor';
      case 'process':
        return 'Process';
      case 'store':
        return 'Store';
      case 'security-boundary':
        return 'Security Boundary';
      case 'text-box':
        return 'Text Box';
      default:
        return 'New Node';
    }
  }

  /**
   * Validate node data for required fields
   */
  private _validateNodeData(nodeData: NodeData): string | null {
    if (!nodeData.nodeType) {
      return 'nodeType is required';
    }

    // Check if position was explicitly set to undefined (invalid) vs not provided at all (valid, use defaults)
    if (
      Object.prototype.hasOwnProperty.call(nodeData, 'position') &&
      nodeData.position === undefined
    ) {
      return 'position is required';
    }

    if (
      nodeData.position &&
      (nodeData.position.x === undefined || nodeData.position.y === undefined)
    ) {
      return 'position must have x and y coordinates';
    }

    if (nodeData.size && (nodeData.size.width <= 0 || nodeData.size.height <= 0)) {
      return 'size must have positive width and height';
    }

    return null; // No validation errors
  }
}
