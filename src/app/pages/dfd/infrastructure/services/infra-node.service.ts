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
 * - Coordinates with InfraX6GraphAdapter for graph-specific node operations
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
import { InfraX6GraphAdapter } from '../adapters/infra-x6-graph.adapter';
import { InfraX6ZOrderAdapter } from '../adapters/infra-x6-z-order.adapter';
import { InfraX6EmbeddingAdapter } from '../adapters/infra-x6-embedding.adapter';
import { InfraNodeConfigurationService } from './infra-node-configuration.service';
import { InfraVisualEffectsService } from './infra-visual-effects.service';
import { InfraEdgeService } from './infra-edge.service';
import { InfraPortStateService } from './infra-port-state.service';
import { getX6ShapeForNodeType } from '../adapters/infra-x6-shape-definitions';
import { AppOperationStateManager } from '../../application/services/app-operation-state-manager.service';
import { InfraX6CoreOperationsService } from './infra-x6-core-operations.service';
import { DFD_STYLING_HELPERS } from '../../constants/styling-constants';

/**
 * Consolidated service for node creation, management, and operations in DFD diagrams
 * Combines the functionality of DfdNodeManagerService and X6NodeOperations
 */
@Injectable({
  providedIn: 'root',
})
export class InfraNodeService {
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private infraX6GraphAdapter: InfraX6GraphAdapter,
    private infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private infraX6EmbeddingAdapter: InfraX6EmbeddingAdapter,
    private infraNodeConfigurationService: InfraNodeConfigurationService,
    private infraVisualEffectsService: InfraVisualEffectsService,
    private infraEdgeService: InfraEdgeService,
    private infraPortStateService: InfraPortStateService,
    private historyCoordinator: AppOperationStateManager,
    private x6CoreOps: InfraX6CoreOperationsService,
  ) {}

  // ========================================
  // High-level Node Management Methods
  // ========================================

  /**
   * Add a node at a predictable position
   */
  addGraphNode(shapeType: NodeType = 'actor', isInitialized: boolean): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    const graph = this.infraX6GraphAdapter.getGraph();

    // Calculate a predictable position using a grid-based algorithm
    const position = this.calculateNextNodePosition(graph);

    return this.createNode(shapeType, position);
  }

  /**
   * Calculate the next predictable position for a new node using a grid-based algorithm
   * that ensures nodes are always placed in the visible viewport area
   */
  private calculateNextNodePosition(graph: Graph): { x: number; y: number } {
    // Use actor dimensions as the default for grid calculation (most common node type)
    const defaultDimensions = DFD_STYLING_HELPERS.getDefaultDimensions('actor');
    const nodeWidth = defaultDimensions.width;
    const nodeHeight = defaultDimensions.height;
    const padding = 50; // Padding from edges and between nodes
    const gridSpacingX = nodeWidth + padding;
    const gridSpacingY = nodeHeight + padding;
    const offsetIncrement = 25; // Offset increment for layered placement

    // Get the container element to determine visible area
    const container = graph.container;
    const containerRect = container.getBoundingClientRect();
    const visibleWidth = containerRect.width;
    const visibleHeight = containerRect.height;

    // Calculate the visible viewport area in graph coordinates
    // Use the container's actual position on the page to get the top-left of the visible viewport
    const viewportTopLeft = graph.pageToLocal(containerRect.left, containerRect.top);

    // Calculate available grid dimensions in the visible viewport
    const availableWidth = visibleWidth - 2 * padding;
    const availableHeight = visibleHeight - 2 * padding;
    const maxColumns = Math.max(1, Math.floor(availableWidth / gridSpacingX));
    const maxRows = Math.max(1, Math.floor(availableHeight / gridSpacingY));
    const totalGridPositions = maxColumns * maxRows;

    // Get existing nodes to determine occupied positions
    const existingNodes = this.infraX6GraphAdapter.getNodes();

    // Calculate which layer we're on based on existing node count
    const currentLayer = Math.floor(existingNodes.length / totalGridPositions);
    const positionInLayer = existingNodes.length % totalGridPositions;

    // Calculate the offset for this layer to create a staggered effect
    const layerOffsetX = (currentLayer * offsetIncrement) % (gridSpacingX / 2);
    const layerOffsetY = (currentLayer * offsetIncrement) % (gridSpacingY / 2);

    // Calculate row and column for this position in the current layer
    const row = Math.floor(positionInLayer / maxColumns);
    const col = positionInLayer % maxColumns;

    // Calculate the actual position with layer offset, starting from viewport top-left
    const baseX = viewportTopLeft.x + padding + col * gridSpacingX;
    const baseY = viewportTopLeft.y + padding + row * gridSpacingY;
    const x = baseX + layerOffsetX;
    const y = baseY + layerOffsetY;

    this.logger.info('Calculated predictable node position in visible viewport', {
      layer: currentLayer,
      positionInLayer,
      gridPosition: { col, row },
      layerOffset: { x: layerOffsetX, y: layerOffsetY },
      viewportTopLeft,
      visibleDimensions: { width: visibleWidth, height: visibleHeight },
      finalPosition: { x, y },
      totalGridPositions,
      existingNodeCount: existingNodes.length,
    });

    return { x, y };
  }

  /**
   * Create a node with the specified type and position directly in X6
   * All operations are batched into a single history command
   */
  private createNode(shapeType: NodeType, position: { x: number; y: number }): Observable<void> {
    const nodeId = uuidv4(); // Generate UUID type 4 for UX-created nodes

    try {
      // Add node directly to X6 graph using the graph instance
      const graph = this.infraX6GraphAdapter.getGraph();

      // Get node-specific configuration
      const nodeConfig = this.getNodeConfigForType(shapeType, nodeId, position);

      // Use centralized history coordinator for consistent filtering and batching
      let createdNode: any;

      // Start atomic operation for collaborative broadcasting
      const broadcaster = this.infraX6GraphAdapter.getDiagramOperationBroadcaster();
      broadcaster.startAtomicOperation();

      try {
        this.historyCoordinator.executeCompoundOperation(graph, () => {
          const node = this.x6CoreOps.addNode(graph, nodeConfig);
          if (!node) {
            throw new Error(`Failed to create node with ID: ${nodeId}`);
          }
          // Apply proper z-index using ZOrderService after node creation
          this.infraX6ZOrderAdapter.applyNodeCreationZIndex(graph, node);
          createdNode = node; // Capture the created node for visual effects

          return node;
        });

        // Commit collaborative operation after successful node creation
        broadcaster.commitAtomicOperation();
      } catch (error) {
        // Cancel collaborative operation on error
        broadcaster.cancelAtomicOperation();
        throw error;
      }

      // Apply visual effects AFTER the batched operation (outside of history)
      if (createdNode) {
        this.historyCoordinator.executeVisualEffect(graph, () => {
          this.infraVisualEffectsService.applyCreationHighlight(createdNode, graph);
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
    const dimensions = DFD_STYLING_HELPERS.getDefaultDimensions(shapeType);

    // Use InfraNodeConfigurationService to get the correct port configuration for this node type
    const portConfig = this.infraNodeConfigurationService.getNodePorts(shapeType);

    // Base configuration with minimal styling - let CSS handle the appearance
    return {
      id: nodeId,
      shape: x6Shape,
      x: position.x,
      y: position.y,
      width: dimensions.width,
      height: dimensions.height,
      label,
      zIndex: 1, // Temporary z-index, will be set properly after node creation
      ports: portConfig,
    };
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
        // we probably should return an error string here that can be used to diagnose unexpected case
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
        this.infraX6ZOrderAdapter.applyNodeCreationZIndex(graph, node);
      }

      // Apply visual effects if not suppressed
      if (ensureVisualRendering && !suppressHistory) {
        this.infraVisualEffectsService.applyCreationHighlight(node, graph);
      }

      this.logger.debugComponent('InfraNodeService', 'Node created successfully from NodeInfo', {
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
      zIndex: nodeInfo.zIndex || this.infraNodeConfigurationService.getNodeZIndex(nodeInfo.type),
    };

    // Use InfraNodeConfigurationService to get the correct port configuration for this node type
    const portConfig = this.infraNodeConfigurationService.getNodePorts(nodeInfo.type);
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

    // Apply visual effects for remote operations (green color to distinguish from local operations)
    if (options?.applyVisualEffects && node) {
      this.infraVisualEffectsService.applyCreationHighlight(
        node,
        graph,
        DFD_STYLING_HELPERS.getRemoteCreationColor(),
      );
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

  /**
   * Remove a node with comprehensive cleanup of edges and embeddings
   * Handles:
   * - Removal of all connected edges (source or target)
   * - Embedding hierarchy updates (parent/child relationships)
   * - Z-order and visual effects updates
   * - Port visibility updates
   * - All operations in a single atomic transaction
   */
  removeNode(
    graph: Graph,
    nodeId: string,
    options: {
      suppressHistory?: boolean;
      suppressErrors?: boolean;
      logOperation?: boolean;
    } = {},
  ): boolean {
    const { suppressHistory = false, suppressErrors = false, logOperation = true } = options;

    try {
      const node = graph.getCellById(nodeId);

      if (!node || !node.isNode()) {
        if (logOperation) {
          this.logger.warn('Node not found for removal', { nodeId });
        }
        return false;
      }

      if (logOperation) {
        this.logger.debugComponent('InfraNodeService', 'Removing node with full cleanup', {
          nodeId,
        });
      }

      // Execute all removal operations as a single compound operation for history
      const executeRemoval = () => {
        // 1. Get all connected edges before removal
        const connectedEdges = graph.getConnectedEdges(node) || [];
        const affectedNodeIds = new Set<string>();

        // Collect nodes that will need port visibility updates
        connectedEdges.forEach(edge => {
          const sourceId = edge.getSourceCellId();
          const targetId = edge.getTargetCellId();
          if (sourceId && sourceId !== nodeId) affectedNodeIds.add(sourceId);
          if (targetId && targetId !== nodeId) affectedNodeIds.add(targetId);
        });

        // 2. Handle embedding relationships
        const parent = node.getParent();
        const children = node.getChildren();

        // Re-parent children to the removed node's parent (or null if no grandparent)
        if (children && children.length > 0) {
          children.forEach(child => {
            if (child.isNode()) {
              if (parent && parent.isNode()) {
                // Move child to grandparent
                child.setParent(parent);
                if (logOperation) {
                  this.logger.debugComponent(
                    'InfraNodeService',
                    'Re-parented child to grandparent',
                    {
                      childId: child.id,
                      newParentId: parent.id,
                      removedNodeId: nodeId,
                    },
                  );
                }
              } else {
                // Unembed child (make it a root node)
                child.removeFromParent();
                if (logOperation) {
                  this.logger.debugComponent('InfraNodeService', 'Unembedded child node', {
                    childId: child.id,
                    removedNodeId: nodeId,
                  });
                }
              }
            }
          });
        }

        // 3. Remove all connected edges using InfraEdgeService for proper cleanup
        connectedEdges.forEach(edge => {
          this.infraEdgeService.removeEdge(graph, edge.id);
        });

        // 4. Remove the node itself
        this.x6CoreOps.removeNode(graph, nodeId, {
          suppressErrors,
          logOperation,
        });

        // 5. Update port visibility for all affected nodes
        affectedNodeIds.forEach(affectedNodeId => {
          const affectedNode = graph.getCellById(affectedNodeId);
          if (affectedNode && affectedNode.isNode()) {
            this.infraPortStateService.updateNodePortVisibility(graph, affectedNode);
          }
        });

        // 6. Update embedding styles and z-order for affected nodes
        if (parent && parent.isNode()) {
          // Update parent's appearance if it lost a child
          this.infraX6EmbeddingAdapter.updateAllEmbeddingAppearances(graph);
        }

        if (children && children.length > 0) {
          // Update children appearances and z-orders after re-parenting
          children.forEach(child => {
            if (child.isNode()) {
              const newParent = child.getParent();
              if (newParent && newParent.isNode()) {
                // Child was re-parented to grandparent
                this.infraX6ZOrderAdapter.applyEmbeddingZIndexes(newParent, child);
                this.infraX6ZOrderAdapter.updateConnectedEdgesZOrder(
                  graph,
                  child,
                  child.getZIndex() ?? 15,
                );
              } else {
                // Child was unembedded
                this.infraX6ZOrderAdapter.applyUnembeddingZIndex(graph, child);
                this.infraX6ZOrderAdapter.updateConnectedEdgesZOrder(
                  graph,
                  child,
                  child.getZIndex() ?? 10,
                );
              }
            }
          });
        }
      };

      // Execute with or without history based on options
      if (suppressHistory) {
        this.historyCoordinator.executeRemoteOperation(graph, executeRemoval);
      } else {
        this.historyCoordinator.executeCompoundOperation(graph, executeRemoval);
      }

      if (logOperation) {
        this.logger.debugComponent('InfraNodeService', 'Node removed with full cleanup', {
          nodeId,
          connectedEdgesRemoved: (graph.getConnectedEdges(node) || []).length,
        });
      }

      return true;
    } catch (error) {
      this.logger.error('Error removing node', {
        nodeId,
        error,
      });

      if (!suppressErrors) {
        throw error;
      }

      return false;
    }
  }
}
