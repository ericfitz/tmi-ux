/**
 * Node Service
 *
 * This service provides comprehensive node management functionality for DFD diagrams.
 * It handles node creation, manipulation, and operations with proper history coordination.
 *
 * Key functionality:
 * - Provides node creation operations with different node types (actor, process, store, etc.)
 * - Manages node positioning and automatic layout algorithms
 * - Handles node configuration and default properties setup
 * - Coordinates with X6GraphAdapter for graph-specific node operations
 * - Integrates with GraphHistoryCoordinator for proper undo/redo support
 * - Manages node visual effects and styling operations
 * - Provides node validation and business rule enforcement
 * - Handles node z-order management and layering operations
 * - Supports node duplication and template-based creation
 * - Manages node metadata and custom properties
 * - Provides internationalization support for node labels
 * - Integrates with visual effects service for node animations
 * - Handles node lifecycle events and state management
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Graph } from '@antv/x6';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../../core/services/logger.service';
import { NodeInfo, NodeType } from '../../domain/value-objects/node-info';
import { X6GraphAdapter } from '../adapters/x6-graph.adapter';
import { X6ZOrderAdapter } from '../adapters/x6-z-order.adapter';
import { NodeConfigurationService } from './node-configuration.service';
import { VisualEffectsService } from './visual-effects.service';
import { getX6ShapeForNodeType } from '../adapters/x6-shape-definitions';
import { GraphHistoryCoordinator } from '../../services/graph-history-coordinator.service';
import { X6CoreOperationsService } from './x6-core-operations.service';

/**
 * Consolidated service for node creation, management, and operations in DFD diagrams
 * Combines the functionality of DfdNodeManagerService and X6NodeOperations
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNodeService {
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private x6GraphAdapter: X6GraphAdapter,
    private x6ZOrderAdapter: X6ZOrderAdapter,
    private nodeConfigurationService: NodeConfigurationService,
    private visualEffectsService: VisualEffectsService,
    private historyCoordinator: GraphHistoryCoordinator,
    private x6CoreOps: X6CoreOperationsService,
  ) {}

  // ========================================
  // High-level Node Management Methods
  // ========================================

  /**
   * Add a node at a predictable position
   */
  addGraphNode(
    shapeType: NodeType = 'actor',
    containerWidth: number,
    containerHeight: number,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Calculate a predictable position using a grid-based algorithm
    const position = this.calculateNextNodePosition(containerWidth, containerHeight);

    return this.createNode(shapeType, position);
  }

  /**
   * Calculate the next predictable position for a new node using a grid-based algorithm
   * that ensures nodes are always placed in the viewable area
   */
  private calculateNextNodePosition(
    containerWidth: number,
    containerHeight: number,
  ): { x: number; y: number } {
    const nodeWidth = 120; // Default node width
    const nodeHeight = 80; // Default node height
    const padding = 50; // Padding from edges and between nodes
    const gridSpacingX = nodeWidth + padding;
    const gridSpacingY = nodeHeight + padding;
    const offsetIncrement = 25; // Offset increment for layered placement

    // Calculate available grid dimensions
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;
    const maxColumns = Math.floor(availableWidth / gridSpacingX);
    const maxRows = Math.floor(availableHeight / gridSpacingY);
    const totalGridPositions = maxColumns * maxRows;

    // Get existing nodes to determine occupied positions
    const existingNodes = this.x6GraphAdapter.getNodes();

    // Calculate which layer we're on based on existing node count
    const currentLayer = Math.floor(existingNodes.length / totalGridPositions);
    const positionInLayer = existingNodes.length % totalGridPositions;

    // Calculate the offset for this layer to create a staggered effect
    const layerOffsetX = (currentLayer * offsetIncrement) % (gridSpacingX / 2);
    const layerOffsetY = (currentLayer * offsetIncrement) % (gridSpacingY / 2);

    // Calculate row and column for this position in the current layer
    const row = Math.floor(positionInLayer / maxColumns);
    const col = positionInLayer % maxColumns;

    // Calculate the actual position with layer offset
    const baseX = padding + col * gridSpacingX;
    const baseY = padding + row * gridSpacingY;
    const x = baseX + layerOffsetX;
    const y = baseY + layerOffsetY;

    // Ensure the position stays within the viewable area
    const clampedX = Math.min(Math.max(x, padding), containerWidth - nodeWidth - padding);
    const clampedY = Math.min(Math.max(y, padding), containerHeight - nodeHeight - padding);

    this.logger.info('Calculated predictable node position with layering', {
      layer: currentLayer,
      positionInLayer,
      gridPosition: { col, row },
      layerOffset: { x: layerOffsetX, y: layerOffsetY },
      calculatedPosition: { x, y },
      finalPosition: { x: clampedX, y: clampedY },
      totalGridPositions,
      existingNodeCount: existingNodes.length,
    });

    return { x: clampedX, y: clampedY };
  }

  /**
   * Create a node with the specified type and position directly in X6
   * All operations are batched into a single history command
   */
  private createNode(shapeType: NodeType, position: { x: number; y: number }): Observable<void> {
    const nodeId = uuidv4(); // Generate UUID type 4 for UX-created nodes

    try {
      // Add node directly to X6 graph using the graph instance
      const graph = this.x6GraphAdapter.getGraph();

      // Get node-specific configuration
      const nodeConfig = this.getNodeConfigForType(shapeType, nodeId, position);

      // Use centralized history coordinator for consistent filtering and batching
      let createdNode: any;

      this.historyCoordinator.executeCompoundOperation(graph, () => {
        const node = this.x6CoreOps.addNode(graph, nodeConfig);
        if (!node) {
          throw new Error(`Failed to create node with ID: ${nodeId}`);
        }
        // Apply proper z-index using ZOrderService after node creation
        this.x6ZOrderAdapter.applyNodeCreationZIndex(graph, node);
        createdNode = node; // Capture the created node for visual effects

        return node;
      });

      // Apply visual effects AFTER the batched operation (outside of history)
      if (createdNode) {
        this.historyCoordinator.executeVisualEffect(graph, () => {
          this.visualEffectsService.applyCreationHighlight(createdNode, graph);
        });
      }

      this.logger.info(
        'Node created successfully directly in X6 with creation highlight (batched)',
        { nodeId, shapeType },
      );
      return of(void 0);
    } catch (error) {
      this.logger.error('Error creating node directly in X6', error);
      throw error;
    }
  }

  /**
   * Get node configuration based on node type
   * Uses the original CSS-based styling system instead of inline attrs
   */
  private getNodeConfigForType(
    shapeType: NodeType,
    nodeId: string,
    position: { x: number; y: number },
  ): any {
    const x6Shape = getX6ShapeForNodeType(shapeType);
    const label = this.getDefaultLabelForType(shapeType);

    // Base configuration with minimal styling - let CSS handle the appearance
    const baseConfig = {
      id: nodeId,
      shape: x6Shape,
      x: position.x,
      y: position.y,
      width: 120,
      height: 80,
      label,
      zIndex: 1, // Temporary z-index, will be set properly after node creation
    };

    // Use NodeConfigurationService to get the correct port configuration for this node type
    const portConfig = this.nodeConfigurationService.getNodePorts(shapeType);

    // Adjust dimensions based on node type to match original styling
    switch (shapeType) {
      case 'process':
        return {
          ...baseConfig,
          width: 120,
          height: 60,
          ports: portConfig,
        };

      case 'store':
        return {
          ...baseConfig,
          width: 140,
          height: 40,
          ports: portConfig,
        };

      case 'actor':
        return {
          ...baseConfig,
          width: 100,
          height: 80,
          ports: portConfig,
        };

      case 'security-boundary':
        return {
          ...baseConfig,
          width: 200,
          height: 150,
          ports: portConfig,
        };

      case 'text-box':
        return {
          ...baseConfig,
          width: 100,
          height: 40,
          ports: portConfig, // This will be empty for text-box nodes
        };

      default:
        // Fallback for unknown node types
        return {
          ...baseConfig,
          ports: portConfig,
        };
    }
  }

  /**
   * Get default label for a shape type
   */
  private getDefaultLabelForType(shapeType: NodeType): string {
    switch (shapeType) {
      case 'actor':
        return this.transloco.translate('editor.nodeLabels.actor');
      case 'process':
        return this.transloco.translate('editor.nodeLabels.process');
      case 'store':
        return this.transloco.translate('editor.nodeLabels.store');
      case 'security-boundary':
        return this.transloco.translate('editor.nodeLabels.securityBoundary');
      case 'text-box':
        return this.transloco.translate('editor.nodeLabels.textbox');
      default:
        return this.transloco.translate('editor.nodeLabels.node');
    }
  }

  /**
   * Create a node from NodeInfo domain object for diagram loading
   * Used by diagram service for batch loading operations
   */
  createNodeFromInfo(
    graph: any,
    nodeInfo: NodeInfo,
    options: {
      ensureVisualRendering?: boolean;
      updatePortVisibility?: boolean;
      suppressHistory?: boolean;
    } = {},
  ): any {
    const { ensureVisualRendering = true, suppressHistory = false } = options;

    this.logger.info('Creating node from NodeInfo domain object', {
      nodeId: nodeInfo.id,
      nodeType: nodeInfo.type,
      position: { x: nodeInfo.x, y: nodeInfo.y },
      suppressHistory,
    });

    try {
      // Convert NodeInfo to X6 node configuration
      const nodeConfig = this.convertNodeInfoToX6Config(nodeInfo);

      let node: any;

      if (suppressHistory) {
        // Execute without history for remote operations
        node = this.historyCoordinator.executeRemoteOperation(graph, () => {
          return this.x6CoreOps.addNode(graph, nodeConfig);
        });
      } else {
        // Add node directly to X6 graph
        node = this.x6CoreOps.addNode(graph, nodeConfig);
      }

      if (!node) {
        throw new Error(`Failed to create node with ID: ${nodeInfo.id}`);
      }

      // Apply proper z-index using ZOrderService after node creation
      if (!suppressHistory) {
        this.x6ZOrderAdapter.applyNodeCreationZIndex(graph, node);
      }

      // Apply visual effects if not suppressed
      if (ensureVisualRendering && !suppressHistory) {
        this.visualEffectsService.applyCreationHighlight(node, graph);
      }

      this.logger.debugComponent('DfdNodeService', 'Node created successfully from NodeInfo', {
        nodeId: nodeInfo.id,
        nodeCreated: !!node,
        suppressHistory,
      });

      return node;
    } catch (error) {
      this.logger.error('Error creating node from NodeInfo', error);
      throw error;
    }
  }

  /**
   * Convert NodeInfo domain object to X6 node configuration
   * Private method used by createNodeFromInfo
   */
  private convertNodeInfoToX6Config(nodeInfo: NodeInfo): any {
    const x6Shape = getX6ShapeForNodeType(nodeInfo.type);

    // Base configuration
    const nodeConfig: any = {
      id: nodeInfo.id,
      shape: x6Shape,
      x: nodeInfo.x,
      y: nodeInfo.y,
      width: nodeInfo.width,
      height: nodeInfo.height,
      label: nodeInfo.attrs?.text?.text || '',
      zIndex: nodeInfo.zIndex || this.nodeConfigurationService.getNodeZIndex(nodeInfo.type),
    };

    // Use NodeConfigurationService to get the correct port configuration for this node type
    const portConfig = this.nodeConfigurationService.getNodePorts(nodeInfo.type);
    nodeConfig.ports = portConfig;

    // Add hybrid data (metadata + custom data) if present
    nodeConfig.data = nodeInfo.data;

    // Add X6-specific properties if present
    if (nodeInfo.markup) {
      nodeConfig.markup = nodeInfo.markup;
    }
    if (nodeInfo.tools) {
      nodeConfig.tools = nodeInfo.tools;
    }

    return nodeConfig;
  }

  /**
   * Create node from remote WebSocket operation with proper visual effects
   */
  createNodeFromRemoteOperation(graph: Graph, cellData: any, options: any): void {
    // Convert WebSocket cell data to NodeInfo format
    const nodeInfo = this.convertWebSocketCellToNodeInfo(cellData);

    // Create node using existing infrastructure
    const node = this.createNodeFromInfo(graph, nodeInfo, {
      suppressHistory: options?.suppressHistory ?? true,
      ensureVisualRendering: options?.ensureVisualRendering ?? true,
      updatePortVisibility: options?.updatePortVisibility ?? true,
    });

    // Apply visual effects for remote operations (different color to distinguish)
    if (options?.applyVisualEffects && node) {
      // TODO: Apply creation highlight with green color for remote operations
      // this.visualEffectsService.applyCreationHighlight(node, graph, '#00ff00');
    }
  }

  /**
   * Remove node from remote WebSocket operation
   */
  removeNodeFromRemoteOperation(graph: Graph, cellId: string, options: any): void {
    const cell = graph.getCellById(cellId);
    if (cell && cell.isNode()) {
      // Execute without history for remote operations
      this.historyCoordinator.executeRemoteOperation(graph, () => {
        // Use existing core operations service
        this.x6CoreOps.removeNode(graph, cellId, {
          suppressErrors: options?.suppressErrors ?? false,
          logOperation: options?.logOperation ?? true,
        });
      });
    }
  }

  /**
   * Convert WebSocket cell data to NodeInfo format
   */
  private convertWebSocketCellToNodeInfo(cellData: any): any {
    return {
      id: cellData.id,
      type: cellData.shape as NodeType,
      x: cellData.x,
      y: cellData.y,
      width: cellData.width,
      height: cellData.height,
      label: cellData.label || '',
      data: cellData.data || {},
    };
  }
}
