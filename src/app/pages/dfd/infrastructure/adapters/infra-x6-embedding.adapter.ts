/**
 * X6 Embedding Adapter
 *
 * This adapter handles node embedding functionality within the X6 graph library,
 * enabling nodes to be contained within other nodes (parent-child relationships).
 *
 * Key functionality:
 * - Manages parent-child node relationships in X6 graph structure
 * - Handles automatic node embedding when nodes are dragged over containers
 * - Implements embedding validation rules for different node types
 * - Provides embedding/unembedding operations with proper event handling
 * - Manages z-order adjustments for embedded nodes
 * - Coordinates with InfraEmbeddingService for business logic validation
 * - Handles visual feedback during embedding operations
 * - Supports automatic layout adjustments for embedded nodes
 * - Manages embedding constraints and business rules
 * - Provides embedding state queries and validation
 * - Integrates with X6 event system for drag-and-drop operations
 * - Handles embedding persistence and restoration
 */

import { Injectable } from '@angular/core';
import { Graph, Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { InfraEmbeddingService } from '../services/infra-embedding.service';
import { InfraX6ZOrderAdapter } from './infra-x6-z-order.adapter';
import { AppOperationStateManager } from '../../application/services/app-operation-state-manager.service';

/**
 * X6 Embedding Adapter
 * Handles X6-specific embedding implementation
 * Works with InfraEmbeddingService for business logic
 */
@Injectable()
export class InfraX6EmbeddingAdapter {
  constructor(
    private logger: LoggerService,
    private infraEmbeddingService: InfraEmbeddingService,
    private infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private historyCoordinator: AppOperationStateManager,
  ) {}

  /**
   * Initialize embedding functionality for the graph
   */
  initializeEmbedding(graph: Graph): void {
    this.logger.info('Initializing embedding functionality');

    // Note: X6 embedding plugin setup would be done here
    // For now, we'll handle embedding through manual methods
    // graph.use(embeddingPlugin, { ... });

    // Set up embedding event handlers
    this.setupEmbeddingEvents(graph);
  }

  /**
   * Embed a node into a parent manually
   */
  embedNode(graph: Graph, child: Node, parent: Node): boolean {
    // Validate embedding
    if (!this.validateEmbedding(child, parent)) {
      return false;
    }

    // Perform embedding
    child.setParent(parent);

    // Trigger embedded event manually
    this.handleNodeEmbedded(graph, child, parent);

    this.logger.info('Manually embedded node', {
      childId: child.id,
      parentId: parent.id,
    });

    return true;
  }

  /**
   * Unembed a node manually
   */
  unembedNode(graph: Graph, node: Node): boolean {
    const parent = node.getParent();
    if (!parent?.isNode()) {
      this.logger.warn('Cannot unembed node: no parent found', {
        nodeId: node.id,
      });
      return false;
    }

    // Remove parent relationship
    node.removeFromParent();

    // Trigger unembedded event manually
    this.handleNodeUnembedded(graph, node);

    this.logger.info('Manually unembedded node', {
      nodeId: node.id,
      formerParentId: parent.id,
    });

    return true;
  }

  /**
   * Get embedding hierarchy for a node
   */
  getEmbeddingHierarchy(node: Node): Node[] {
    const hierarchy: Node[] = [];
    let current: Cell | null = node;

    while (current?.isNode()) {
      hierarchy.unshift(current);
      current = current.getParent();
    }

    return hierarchy;
  }

  /**
   * Validate and fix embedding relationships after diagram load
   * Ensures all loaded embeddings comply with current business rules
   */
  validateAndFixLoadedDiagram(graph: Graph): {
    fixed: number;
    violations: Array<{ nodeId: string; parentId: string; reason: string; action: string }>;
  } {
    const violations: Array<{ nodeId: string; parentId: string; reason: string; action: string }> =
      [];
    let fixedCount = 0;

    this.logger.info('Validating embedding relationships after diagram load');

    const allNodes = graph.getNodes();

    allNodes.forEach(node => {
      const parent = node.getParent();

      // Check if node has a parent (is embedded)
      if (parent && parent.isNode()) {
        // Validate the embedding relationship
        const validation = this.infraEmbeddingService.validateEmbedding(parent, node);

        if (!validation.isValid) {
          this.logger.warn('Invalid embedding detected in loaded diagram', {
            nodeId: node.id,
            parentId: parent.id,
            reason: validation.reason,
          });

          violations.push({
            nodeId: node.id,
            parentId: parent.id,
            reason: validation.reason || 'Unknown validation failure',
            action: 'Unembedded node',
          });

          // Fix by unembedding the node
          node.removeFromParent();
          // Ensure parent is fully cleared (X6 internal state cleanup)
          (node as any).setParent(null);
          this.handleNodeUnembedded(graph, node);
          fixedCount++;
        }
      }
    });

    if (fixedCount > 0) {
      this.logger.warn('Fixed invalid embeddings in loaded diagram', {
        fixedCount,
        violations: violations.length,
      });
    } else {
      this.logger.info('All embedding relationships validated successfully');
    }

    return { fixed: fixedCount, violations };
  }

  /**
   * Get all embedded children of a node
   */
  getEmbeddedChildren(node: Node): Node[] {
    const children = node.getChildren();
    if (!children) {
      return [];
    }

    return children.filter(child => child.isNode());
  }

  /**
   * Check if a node is embedded
   */
  isEmbedded(node: Node): boolean {
    const parent = node.getParent();
    return parent?.isNode() ?? false;
  }

  /**
   * Get embedding depth of a node
   */
  getEmbeddingDepth(node: Node): number {
    return this.infraEmbeddingService.calculateEmbeddingDepth(node);
  }

  /**
   * Update all embedding appearances in the graph
   * This is a style consistency operation and should not be added to history
   */
  updateAllEmbeddingAppearances(graph: Graph): void {
    const nodes = graph.getNodes();

    // Wrap in executeVisualEffect to exclude from history
    this.historyCoordinator.executeVisualEffect(graph, () => {
      nodes.forEach(node => {
        const parent = node.getParent();
        if (parent?.isNode()) {
          this.updateEmbeddingAppearance(node, parent);
        } else {
          this.resetEmbeddingAppearance(node);
        }
      });
    });

    this.logger.debugComponent('X6Embedding', 'Updated all embedding appearances', {
      totalNodes: nodes.length,
      embeddedNodes: nodes.filter(n => n.getParent()?.isNode()).length,
    });
  }

  /**
   * Set up embedding-related event handlers
   */
  private setupEmbeddingEvents(graph: Graph): void {
    // Track previous parent states for unembedding detection
    const nodeParentStates = new Map<string, string | null>();

    // Handle node embedding
    graph.on('node:embedded', ({ node, parent }: { node: Node; parent?: Node }) => {
      if (!node) {
        this.logger.warn('Node embedding event received with undefined node');
        return;
      }

      // If parent is not provided in the event, try to get it from the node
      let actualParent = parent;
      if (!actualParent) {
        const nodeParent = node.getParent();
        if (nodeParent?.isNode()) {
          actualParent = nodeParent;
          this.logger.info('Found parent from node after embedding event', {
            nodeId: node.id,
            parentId: actualParent.id,
          });
        } else {
          this.logger.warn(
            'Node embedding event received with undefined parent and no parent found on node',
            {
              nodeId: node.id,
            },
          );
          return;
        }
      }

      // Update parent state tracking
      nodeParentStates.set(node.id, actualParent.id);

      this.handleNodeEmbedded(graph, node, actualParent);
    });

    // Handle node unembedding
    graph.on('node:unembedded', ({ node }: { node: Node }) => {
      if (!node) {
        this.logger.warn('Node unembedding event received with undefined node');
        return;
      }

      // Update parent state tracking
      nodeParentStates.set(node.id, null);

      this.handleNodeUnembedded(graph, node);
    });

    // Handle parent changes to detect unembedding
    graph.on(
      'node:change:parent',
      ({
        node,
        current,
        _previous,
      }: {
        node: Node;
        current?: Node | null;
        _previous?: Node | null;
      }) => {
        if (!node) {
          this.logger.warn('Node parent change event received with undefined node');
          return;
        }

        const previousParentId = nodeParentStates.get(node.id);
        const currentParent = current;

        // Safely check if currentParent is a valid Node with isNode method
        let currentParentId: string | null = null;
        if (currentParent && typeof currentParent === 'object' && 'isNode' in currentParent) {
          try {
            if (typeof currentParent.isNode === 'function' && currentParent.isNode()) {
              currentParentId = currentParent.id;
            }
          } catch (error) {
            this.logger.warn('Error checking if currentParent is a node', {
              nodeId: node.id,
              currentParent,
              error,
            });
          }
        }

        this.logger.info('Node parent changed', {
          nodeId: node.id,
          previousParentId,
          currentParentId,
          wasEmbedded: !!previousParentId,
          isEmbedded: !!currentParentId,
        });

        // Update parent state tracking
        nodeParentStates.set(node.id, currentParentId);

        // Detect unembedding: had a parent before, now doesn't
        if (previousParentId && !currentParentId) {
          this.logger.info('Detected unembedding via parent change', {
            nodeId: node.id,
            formerParentId: previousParentId,
          });
          this.handleNodeUnembedded(graph, node);
        }
        // Detect embedding: didn't have a parent before, now does
        else if (
          !previousParentId &&
          currentParentId &&
          currentParent &&
          typeof currentParent === 'object' &&
          'isNode' in currentParent
        ) {
          try {
            if (typeof currentParent.isNode === 'function' && currentParent.isNode()) {
              this.logger.info('Detected embedding via parent change', {
                nodeId: node.id,
                newParentId: currentParentId,
              });
              this.handleNodeEmbedded(graph, node, currentParent);
            }
          } catch (error) {
            this.logger.warn('Error handling embedding via parent change', {
              nodeId: node.id,
              error,
            });
          }
        }
        // Handle parent change (from one parent to another - re-embedding)
        else if (
          previousParentId &&
          currentParentId &&
          previousParentId !== currentParentId &&
          currentParent &&
          typeof currentParent === 'object' &&
          'isNode' in currentParent
        ) {
          try {
            if (typeof currentParent.isNode === 'function' && currentParent.isNode()) {
              this.logger.info('Detected parent change (re-embedding)', {
                nodeId: node.id,
                formerParentId: previousParentId,
                newParentId: currentParentId,
              });

              // Validate re-embedding
              const validation = this.infraEmbeddingService.validateEmbedding(currentParent, node);

              if (!validation.isValid) {
                this.logger.warn('Re-embedding validation failed - reverting', {
                  nodeId: node.id,
                  formerParentId: previousParentId,
                  attemptedParentId: currentParentId,
                  reason: validation.reason,
                });

                // Get the previous parent to restore
                const previousParent = graph.getCellById(previousParentId);
                if (previousParent && previousParent.isNode()) {
                  // Revert to previous parent
                  node.setParent(previousParent);
                } else {
                  // If previous parent no longer exists, unembed entirely
                  node.removeFromParent();
                }

                return;
              }

              // Valid re-embedding - handle it
              // Note: This will update appearance, z-order, and recalculate descendant depths
              this.handleNodeReEmbedded(graph, node, currentParent);
            }
          } catch (error) {
            this.logger.warn('Error handling parent change (re-embedding)', {
              nodeId: node.id,
              error,
            });
          }
        }
      },
    );

    // Handle node movement during embedding
    graph.on('node:moved', ({ node }: { node: Node }) => {
      if (!node) {
        this.logger.warn('Node moved event received with undefined node');
        return;
      }

      this.handleNodeMoved(graph, node);
    });

    // Initialize parent state tracking for existing nodes
    graph.getNodes().forEach(node => {
      const parent = node.getParent();
      const parentId = parent?.isNode() ? parent.id : null;
      nodeParentStates.set(node.id, parentId);
    });

    this.logger.info('Embedding event handlers set up with unembedding detection');
  }

  /**
   * Find potential parent for embedding
   */
  private findEmbeddingParent(graph: Graph, node: Node): Node | null {
    const nodePosition = node.getPosition();
    const nodeSize = node.getSize();
    const nodeBounds = {
      x: nodePosition.x,
      y: nodePosition.y,
      width: nodeSize.width,
      height: nodeSize.height,
    };

    // Get all nodes except the current one
    const allNodes = graph.getNodes().filter(n => n.id !== node.id);

    // Simple implementation for finding potential parents
    // This will be enhanced when we implement the full embedding service
    const potentialParents = allNodes.filter(potentialParent => {
      const parentPosition = potentialParent.getPosition();
      const parentSize = potentialParent.getSize();

      // Check if node is within parent bounds
      return (
        nodeBounds.x >= parentPosition.x &&
        nodeBounds.y >= parentPosition.y &&
        nodeBounds.x + nodeBounds.width <= parentPosition.x + parentSize.width &&
        nodeBounds.y + nodeBounds.height <= parentPosition.y + parentSize.height
      );
    });

    // Return the best parent (first in the list)
    return potentialParents.length > 0 ? potentialParents[0] : null;
  }

  /**
   * Validate if embedding is allowed
   */
  private validateEmbedding(child: Node, parent: Node): boolean {
    const validation = this.infraEmbeddingService.validateEmbedding(parent, child);

    if (!validation.isValid) {
      this.logger.warn('Embedding validation failed', {
        childId: child.id,
        parentId: parent.id,
        reason: validation.reason,
      });
    }

    return validation.isValid;
  }

  /**
   * Handle node embedded event
   * Note: This is called AFTER setParent, which is already in history.
   * Style updates should not create a separate history entry.
   */
  private handleNodeEmbedded(graph: Graph, node: Node, parent: Node): void {
    if (!node || !parent) {
      this.logger.error('handleNodeEmbedded called with invalid parameters', {
        nodeId: node?.id || 'undefined',
        parentId: parent?.id || 'undefined',
      });
      return;
    }

    this.logger.info('Node embedded', {
      nodeId: node.id,
      parentId: parent.id,
    });

    try {
      // Update visual appearance and z-order without adding to history
      // The setParent operation is already in history; these are just visual updates
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Update visual appearance
        this.updateEmbeddingAppearance(node, parent);

        // Update z-order
        this.infraX6ZOrderAdapter.applyEmbeddingZIndexes(parent, node);

        // Update connected edges z-order
        this.infraX6ZOrderAdapter.updateConnectedEdgesZOrder(graph, node, node.getZIndex() ?? 15);
      });
    } catch (error) {
      this.logger.error('Error handling node embedded event', {
        nodeId: node.id,
        parentId: parent.id,
        error,
      });
    }
  }

  /**
   * Handle node unembedded event
   * Note: This is called AFTER removeFromParent, which is already in history.
   * Style updates should not create a separate history entry.
   */
  private handleNodeUnembedded(graph: Graph, node: Node): void {
    if (!node) {
      this.logger.error('handleNodeUnembedded called with invalid node parameter');
      return;
    }

    this.logger.info('Node unembedded', {
      nodeId: node.id,
    });

    try {
      // Update visual appearance and z-order without adding to history
      // The removeFromParent operation is already in history; these are just visual updates
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Recalculate embedding appearance based on new embedding depth
        const newDepth = this.infraEmbeddingService.calculateEmbeddingDepth(node);
        const fillColor =
          newDepth === 0
            ? this._getOriginalFillColorForShape(node.shape)
            : this.infraEmbeddingService.calculateEmbeddingFillColor(newDepth);
        this.applyEmbeddingVisualEffects(node, fillColor, newDepth);

        // Reset z-order - check if this is a security boundary node
        const nodeType = (node as any).getNodeTypeInfo
          ? (node as any).getNodeTypeInfo().type
          : 'process';

        if (nodeType === 'security-boundary') {
          // Use specific rule for unembedded security boundary nodes
          this.infraX6ZOrderAdapter.applyUnembeddedSecurityBoundaryZIndex(graph, node);
        } else {
          // Use general unembedding z-index for other node types
          this.infraX6ZOrderAdapter.applyUnembeddingZIndex(graph, node);
        }

        // CRITICAL FIX: Recalculate z-indexes for all descendants
        // This handles nested security boundaries and deep embedding hierarchies
        this.recalculateAllDescendantsZIndex(graph, node);
      });
    } catch (error) {
      this.logger.error('Error handling node unembedded event', {
        nodeId: node.id,
        error,
      });
    }
  }

  /**
   * Recalculate z-indexes for all descendants of a node
   * Called after unembedding to ensure nested children have correct z-order relative to their new hierarchy
   */
  private recalculateAllDescendantsZIndex(graph: Graph, node: Node): void {
    const descendants = this.getAllDescendants(node);

    if (descendants.length === 0) {
      return;
    }

    this.logger.info('Recalculating z-indexes for descendants after unembed', {
      parentId: node.id,
      descendantCount: descendants.length,
    });

    descendants.forEach(descendant => {
      const parent = descendant.getParent();
      if (parent && parent.isNode()) {
        // Recalculate based on parent's current z-index
        const parentZIndex = parent.getZIndex() ?? 10;
        const childType = (descendant as any).getNodeTypeInfo
          ? (descendant as any).getNodeTypeInfo().type
          : 'process';

        let correctZIndex: number;
        if (childType === 'security-boundary') {
          correctZIndex = Math.max(parentZIndex + 1, 2);
        } else {
          correctZIndex = parentZIndex + 1;
        }

        descendant.setZIndex(correctZIndex);

        // Also update connected edges
        this.infraX6ZOrderAdapter.updateConnectedEdgesZOrder(graph, descendant, correctZIndex);

        this.logger.debugComponent('Embedding', 'Recalculated descendant z-index', {
          descendantId: descendant.id,
          parentId: parent.id,
          newZIndex: correctZIndex,
        });
      }
    });
  }

  /**
   * Get all descendants of a node recursively (children, grandchildren, etc.)
   */
  private getAllDescendants(node: Node): Node[] {
    const descendants: Node[] = [];
    const children = node.getChildren() || [];

    children.forEach(child => {
      if (child.isNode()) {
        const childNode = child;
        descendants.push(childNode);
        // Recursive - get descendants of this child
        descendants.push(...this.getAllDescendants(childNode));
      }
    });

    return descendants;
  }

  /**
   * Handle node re-embedded event (moving from one parent to another)
   * This ensures descendant depths and appearances are recalculated
   */
  private handleNodeReEmbedded(graph: Graph, node: Node, newParent: Node): void {
    if (!node || !newParent) {
      this.logger.error('handleNodeReEmbedded called with invalid parameters', {
        nodeId: node?.id || 'undefined',
        newParentId: newParent?.id || 'undefined',
      });
      return;
    }

    this.logger.info('Node re-embedded to new parent', {
      nodeId: node.id,
      newParentId: newParent.id,
    });

    try {
      // Update visual appearance and z-order without adding to history
      // The setParent operation is already in history; these are just visual updates
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Update visual appearance for new embedding depth
        this.updateEmbeddingAppearance(node, newParent);

        // Update z-order
        this.infraX6ZOrderAdapter.applyEmbeddingZIndexes(newParent, node);

        // Update connected edges z-order
        this.infraX6ZOrderAdapter.updateConnectedEdgesZOrder(graph, node, node.getZIndex() ?? 15);

        // Recalculate descendant depths and appearances recursively
        this.recalculateDescendantEmbeddings(graph, node);
      });
    } catch (error) {
      this.logger.error('Error handling node re-embedded event', {
        nodeId: node.id,
        newParentId: newParent.id,
        error,
      });
    }
  }

  /**
   * Recalculate embedding depths and appearances for all descendants of a node
   * Called when a node is re-embedded to ensure children maintain correct appearance
   */
  private recalculateDescendantEmbeddings(graph: Graph, parentNode: Node): void {
    const children = this.getEmbeddedChildren(parentNode);

    if (children.length === 0) {
      return;
    }

    this.logger.info('Recalculating descendant embeddings', {
      parentId: parentNode.id,
      childCount: children.length,
    });

    children.forEach(child => {
      // Update appearance based on new depth
      const newDepth = this.infraEmbeddingService.calculateEmbeddingDepth(child);
      const fillColor = this.infraEmbeddingService.calculateEmbeddingFillColor(newDepth);
      this.applyEmbeddingVisualEffects(child, fillColor, newDepth);

      // Recursively update grandchildren
      this.recalculateDescendantEmbeddings(graph, child);
    });
  }

  /**
   * Handle node moved event (for embedding operations)
   */
  private handleNodeMoved(graph: Graph, node: Node): void {
    if (!node) {
      this.logger.error('handleNodeMoved called with invalid node parameter');
      return;
    }

    try {
      // Check if this is a z-order restoration case
      this.infraX6ZOrderAdapter.handleNodeMovedZOrderRestoration(graph, node);

      // Update embedding appearance if the node is embedded
      // This is a style consistency operation and should not be added to history
      const parent = node.getParent();
      if (parent?.isNode()) {
        this.historyCoordinator.executeVisualEffect(graph, () => {
          this.updateEmbeddingAppearance(node, parent);
        });
      }
    } catch (error) {
      this.logger.error('Error handling node moved event', {
        nodeId: node.id,
        error,
      });
    }
  }

  /**
   * Update visual appearance for embedded nodes
   */
  private updateEmbeddingAppearance(node: Node, parent: Node): void {
    // Get embedding configuration which includes shouldUpdateColor flag
    const config = this.infraEmbeddingService.getEmbeddingConfiguration(node);

    // For text-box nodes, keep original fill color (transparent)
    const fillColor = config.shouldUpdateColor
      ? config.fillColor
      : this._getOriginalFillColorForShape(node.shape);

    // Apply visual changes
    this.applyEmbeddingVisualEffects(node, fillColor, config.depth);

    this.logger.info('Updated embedding appearance', {
      nodeId: node.id,
      parentId: parent.id,
      depth: config.depth,
      fillColor,
      shouldUpdateColor: config.shouldUpdateColor,
    });
  }

  /**
   * Reset visual appearance for unembedded nodes
   */
  private resetEmbeddingAppearance(node: Node): void {
    // Get original fill color based on shape type
    const originalFillColor = this._getOriginalFillColorForShape(node.shape);

    // Reset visual effects
    this.applyEmbeddingVisualEffects(node, originalFillColor, 0);

    this.logger.info('Reset embedding appearance', {
      nodeId: node.id,
      originalFillColor,
    });
  }

  /**
   * Apply visual effects for embedding
   */
  private applyEmbeddingVisualEffects(node: Node, fillColor: string, depth: number): void {
    // Update node attributes
    const currentAttrs = node.getAttrs() || {};

    // Update body fill color using bracket notation for index signatures
    const currentBody = (currentAttrs['body'] as any) || {};
    const updatedAttrs = {
      ...currentAttrs,
      body: {
        ...currentBody,
        fill: fillColor,
      },
    };

    // Apply opacity based on depth (deeper = more transparent)
    if (depth > 0) {
      const opacity = Math.max(0.7, 1 - depth * 0.1);
      updatedAttrs.body = {
        ...updatedAttrs.body,
        fillOpacity: opacity,
      };
    } else {
      // Reset opacity for unembedded nodes
      const bodyAttrs = updatedAttrs.body;
      if (bodyAttrs && 'fillOpacity' in bodyAttrs) {
        delete bodyAttrs.fillOpacity;
      }
    }

    node.setAttrs(updatedAttrs);
  }

  /**
   * Get original fill color based on X6 shape type (matches shape definitions)
   */
  private _getOriginalFillColorForShape(shape: string): string {
    const shapeColorMap: Record<string, string> = {
      process: '#FFFFFF',
      store: '#FFFFFF',
      actor: '#FFFFFF',
      'security-boundary': '#FFFFFF',
      'text-box': 'transparent',
    };

    return shapeColorMap[shape] || '#FFFFFF';
  }
}
