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
// SEM@5b7995108d43c3368c218c5cf9f539e0c87aba54: manage X6 graph node embedding relationships and hierarchy validation
export class InfraX6EmbeddingAdapter {
  // SEM@8902c3506b8553f7ac8aaedab9ff2ba264e06c93: inject logger, embedding service, z-order adapter, and history coordinator
  constructor(
    private logger: LoggerService,
    private infraEmbeddingService: InfraEmbeddingService,
    private infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private historyCoordinator: AppOperationStateManager,
  ) {}

  /**
   * Initialize embedding functionality for the graph
   */
  // SEM@31e172d820a65e4d5bda2ae6c2dd752ccc9ccc07: register embedding event handlers on the X6 graph instance (mutates shared state)
  initializeEmbedding(graph: Graph): void {
    // this.logger.info('Initializing embedding functionality');

    // Note: X6 embedding plugin setup would be done here
    // For now, we'll handle embedding through manual methods
    // graph.use(embeddingPlugin, { ... });

    // Set up embedding event handlers
    this.setupEmbeddingEvents(graph);
  }

  /**
   * Embed a node into a parent manually
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: attach a child node to a parent node if the embedding is valid (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: detach a node from its parent in the graph embedding hierarchy (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the ancestor chain of a node from root to self (pure)
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
  // SEM@98bf9546a1fa99e7b4209fedfbc1204e9beaa03e: audit and repair invalid node embedding relationships after diagram load (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: list direct child nodes embedded within a graph node (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check if a node has a node parent in the embedding hierarchy (pure)
  isEmbedded(node: Node): boolean {
    const parent = node.getParent();
    return parent?.isNode() ?? false;
  }

  /**
   * Get embedding depth of a node
   */
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: compute the nesting depth of a node in the embedding hierarchy (pure)
  getEmbeddingDepth(node: Node): number {
    return this.infraEmbeddingService.calculateEmbeddingDepth(node);
  }

  /**
   * Update all embedding appearances in the graph
   * This is a style consistency operation and should not be added to history
   */
  // SEM@ed1f6c08609b9b0691bebca8e773f9d6d9af3c13: refresh fill and opacity for all embedded nodes in the graph (mutates shared state)
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
  // SEM@9bbddd20c1a355788e020707ed179a55cd0de167: register graph event listeners for node embed, unembed, and move (mutates shared state)
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
        const currentParentId = this.safeGetNodeId(current, node.id);

        this.logger.debugComponent('X6Embedding', 'Node parent changed', {
          nodeId: node.id,
          previousParentId,
          currentParentId,
          wasEmbedded: !!previousParentId,
          isEmbedded: !!currentParentId,
        });

        // Update parent state tracking
        nodeParentStates.set(node.id, currentParentId);

        this.dispatchParentChange(
          graph,
          node,
          previousParentId ?? null,
          currentParentId,
          current as Node,
        );
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

    // this.logger.info('Embedding event handlers set up with unembedding detection');
  }

  /**
   * Safely extract the ID from a potential parent node reference.
   * Handles the case where the value may not be a valid X6 Node.
   */
  // SEM@9bbddd20c1a355788e020707ed179a55cd0de167: extract a node's ID from a candidate reference, returning null if invalid (pure)
  private safeGetNodeId(candidate: Node | null | undefined, contextNodeId: string): string | null {
    if (!candidate || typeof candidate !== 'object' || !('isNode' in candidate)) {
      return null;
    }

    try {
      if (typeof candidate.isNode === 'function' && candidate.isNode()) {
        return candidate.id;
      }
    } catch (error) {
      this.logger.warn('Error checking if candidate is a node', {
        nodeId: contextNodeId,
        candidate,
        error,
      });
    }

    return null;
  }

  /**
   * Dispatch the appropriate handler based on parent change state transition.
   * Determines whether this is an unembed, embed, or re-embed and delegates accordingly.
   */
  // SEM@9bbddd20c1a355788e020707ed179a55cd0de167: route a parent-change transition to the embed, unembed, or re-embed handler (mutates shared state)
  private dispatchParentChange(
    graph: Graph,
    node: Node,
    previousParentId: string | null,
    currentParentId: string | null,
    currentParent: Node,
  ): void {
    const hadParent = !!previousParentId;
    const hasParent = !!currentParentId;

    if (hadParent && !hasParent) {
      // Unembed: had a parent, now doesn't
      this.logger.info('Detected unembedding via parent change', {
        nodeId: node.id,
        formerParentId: previousParentId,
      });
      this.handleNodeUnembedded(graph, node);
    } else if (!hadParent && hasParent) {
      // New embedding: didn't have a parent, now does
      this.logger.info('Detected embedding via parent change', {
        nodeId: node.id,
        newParentId: currentParentId,
      });
      this.handleNodeEmbedded(graph, node, currentParent);
    } else if (hadParent && hasParent && previousParentId !== currentParentId) {
      // Re-embedding: parent changed to a different node
      this.handleReEmbedding(graph, node, currentParent, previousParentId, currentParentId);
    }
  }

  /**
   * Handle re-embedding: validate and either apply or revert the parent change.
   */
  // SEM@9bbddd20c1a355788e020707ed179a55cd0de167: validate and apply or revert a node parent change to a new embedding target (mutates shared state)
  private handleReEmbedding(
    graph: Graph,
    node: Node,
    newParent: Node,
    previousParentId: string,
    newParentId: string,
  ): void {
    this.logger.info('Detected parent change (re-embedding)', {
      nodeId: node.id,
      formerParentId: previousParentId,
      newParentId,
    });

    const validation = this.infraEmbeddingService.validateEmbedding(newParent, node);

    if (!validation.isValid) {
      this.logger.warn('Re-embedding validation failed - reverting', {
        nodeId: node.id,
        formerParentId: previousParentId,
        attemptedParentId: newParentId,
        reason: validation.reason,
      });

      // Revert to previous parent, or unembed if it no longer exists
      const previousParent = graph.getCellById(previousParentId);
      if (previousParent && previousParent.isNode()) {
        node.setParent(previousParent);
      } else {
        node.removeFromParent();
      }

      return;
    }

    this.handleNodeReEmbedded(graph, node, newParent);
  }

  /**
   * Find potential parent for embedding
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: search for the first graph node whose bounds fully contain the given node (pure)
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
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: validate that a child node may be embedded in a candidate parent (pure)
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
  // SEM@d9b90af4d6dde8edf7ca0cfd5fc0840d565aa5be: apply visual appearance and z-order after a node is embedded in a parent (mutates shared state)
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

        // Recalculate z-order for all cells to fix cascading violations
        this.infraX6ZOrderAdapter.recalculateZOrder(graph);
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
  // SEM@d9b90af4d6dde8edf7ca0cfd5fc0840d565aa5be: restore fill, opacity, and z-order after a node is removed from its parent (mutates shared state)
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

        // Recalculate z-order for all cells to fix cascading violations
        this.infraX6ZOrderAdapter.recalculateZOrder(graph);
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
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: recompute z-index for all recursive descendants of a node after unembed (mutates shared state)
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
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: recursively collect all descendant nodes in an embedding subtree (pure)
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
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: update appearance and z-order when a node moves to a new parent (mutates shared state)
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
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: recompute depth-based fill and opacity for all children after re-embedding (mutates shared state)
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
  // SEM@ed1f6c08609b9b0691bebca8e773f9d6d9af3c13: restore z-order and refresh embedding appearance after a node is moved (mutates shared state)
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
  // SEM@5ea5c4bdeac9840635aca4b362b2e8435c89c4ca: apply depth-driven fill color and opacity to an embedded node (mutates shared state)
  private updateEmbeddingAppearance(node: Node, parent: Node): void {
    // Get embedding configuration which includes shouldUpdateColor flag
    const config = this.infraEmbeddingService.getEmbeddingConfiguration(node);

    // For text-box nodes, keep original fill color (transparent)
    const fillColor = config.shouldUpdateColor
      ? config.fillColor
      : this._getOriginalFillColorForShape(node.shape);

    // Apply visual changes
    this.applyEmbeddingVisualEffects(node, fillColor, config.depth);

    this.logger.debugComponent('X6Embedding', 'Updated embedding appearance', {
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
  // SEM@5b7995108d43c3368c218c5cf9f539e0c87aba54: restore a node's original fill and opacity when it leaves an embedding (mutates shared state)
  private resetEmbeddingAppearance(node: Node): void {
    // Respect user-authored styles — don't override body/fill when the node
    // has been marked customStyles via the style panel.
    if (node.getData?.()?.customStyles) {
      return;
    }

    // Get original fill color based on shape type
    const originalFillColor = this._getOriginalFillColorForShape(node.shape);

    // Reset visual effects
    this.applyEmbeddingVisualEffects(node, originalFillColor, 0);
  }

  /**
   * Apply visual effects for embedding
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: set node body fill color and depth-scaled opacity attributes (mutates shared state)
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
  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: map a diagram shape type to its default fill color (pure)
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
