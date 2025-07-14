import { Injectable } from '@angular/core';
import { Graph, Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { EmbeddingService } from '../services/embedding.service';
import { X6ZOrderAdapter } from './x6-z-order.adapter';

/**
 * X6 Embedding Adapter
 * Handles X6-specific embedding implementation
 * Works with EmbeddingService for business logic
 */
@Injectable()
export class X6EmbeddingAdapter {
  constructor(
    private logger: LoggerService,
    private embeddingService: EmbeddingService,
    private x6ZOrderAdapter: X6ZOrderAdapter,
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
    return this.embeddingService.calculateEmbeddingDepth(node);
  }

  /**
   * Update all embedding appearances in the graph
   */
  updateAllEmbeddingAppearances(graph: Graph): void {
    const nodes = graph.getNodes();

    nodes.forEach(node => {
      const parent = node.getParent();
      if (parent?.isNode()) {
        this.updateEmbeddingAppearance(node, parent);
      } else {
        this.resetEmbeddingAppearance(node);
      }
    });

    this.logger.info('Updated all embedding appearances', {
      totalNodes: nodes.length,
      embeddedNodes: nodes.filter(n => n.getParent()?.isNode()).length,
    });
  }

  /**
   * Set up embedding-related event handlers
   */
  private setupEmbeddingEvents(graph: Graph): void {
    // Handle node embedding
    graph.on('node:embedded', ({ node, parent }: { node: Node; parent: Node }) => {
      this.handleNodeEmbedded(graph, node, parent);
    });

    // Handle node unembedding
    graph.on('node:unembedded', ({ node }: { node: Node }) => {
      this.handleNodeUnembedded(graph, node);
    });

    // Handle node movement during embedding
    graph.on('node:moved', ({ node }: { node: Node }) => {
      this.handleNodeMoved(graph, node);
    });

    this.logger.info('Embedding event handlers set up');
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
    const validation = this.embeddingService.validateEmbedding(child, parent);

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
   */
  private handleNodeEmbedded(graph: Graph, node: Node, parent: Node): void {
    this.logger.info('Node embedded', {
      nodeId: node.id,
      parentId: parent.id,
    });

    // Update visual appearance
    this.updateEmbeddingAppearance(node, parent);

    // Update z-order
    this.x6ZOrderAdapter.applyEmbeddingZIndexes(parent, node);

    // Update connected edges z-order
    this.x6ZOrderAdapter.updateConnectedEdgesZOrder(graph, node, node.getZIndex() ?? 15);
  }

  /**
   * Handle node unembedded event
   */
  private handleNodeUnembedded(graph: Graph, node: Node): void {
    this.logger.info('Node unembedded', {
      nodeId: node.id,
    });

    // Reset visual appearance
    this.resetEmbeddingAppearance(node);

    // Reset z-order
    this.x6ZOrderAdapter.applyUnembeddingZIndex(graph, node);
  }

  /**
   * Handle node moved event (for embedding operations)
   */
  private handleNodeMoved(graph: Graph, node: Node): void {
    // Check if this is a z-order restoration case
    this.x6ZOrderAdapter.handleNodeMovedZOrderRestoration(graph, node);

    // Update embedding appearance if the node is embedded
    const parent = node.getParent();
    if (parent?.isNode()) {
      this.updateEmbeddingAppearance(node, parent);
    }
  }

  /**
   * Update visual appearance for embedded nodes
   */
  private updateEmbeddingAppearance(node: Node, parent: Node): void {
    // Calculate embedding depth
    const depth = this.embeddingService.calculateEmbeddingDepth(node);

    // Calculate fill color based on depth
    const fillColor = this.embeddingService.calculateEmbeddingFillColor(depth);

    // Apply visual changes
    this.applyEmbeddingVisualEffects(node, fillColor, depth);

    this.logger.info('Updated embedding appearance', {
      nodeId: node.id,
      parentId: parent.id,
      depth,
      fillColor,
    });
  }

  /**
   * Reset visual appearance for unembedded nodes
   */
  private resetEmbeddingAppearance(node: Node): void {
    // Get original fill color
    const originalFillColor = this.getOriginalFillColor(node);

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

    // Store embedding metadata
    if ((node as any).setApplicationMetadata) {
      (node as any).setApplicationMetadata('embeddingDepth', String(depth));
      (node as any).setApplicationMetadata('embeddingFillColor', fillColor);
    }
  }

  /**
   * Get original fill color for a node
   */
  private getOriginalFillColor(node: Node): string {
    // Try to get from stored metadata first
    if ((node as any).getApplicationMetadata) {
      const storedColor = (node as any).getApplicationMetadata('originalFillColor');
      if (storedColor) {
        return storedColor;
      }
    }

    // Get node type info to determine default color
    const nodeTypeInfo = (node as any).getNodeTypeInfo ? (node as any).getNodeTypeInfo() : null;

    if (nodeTypeInfo?.type) {
      return this.getDefaultFillColorForType(nodeTypeInfo.type);
    }

    // Fallback to current fill color or default
    const currentAttrs = node.getAttrs() || {};
    const bodyAttrs = currentAttrs['body'] as any;
    const fillValue = bodyAttrs?.['fill'];
    return typeof fillValue === 'string' ? fillValue : '#ffffff';
  }

  /**
   * Get default fill color for node type
   */
  private getDefaultFillColorForType(nodeType: string): string {
    const colorMap: Record<string, string> = {
      process: '#e1f5fe',
      'external-entity': '#f3e5f5',
      'data-store': '#e8f5e8',
      'security-boundary': '#fff3e0',
    };

    return colorMap[nodeType] || '#ffffff';
  }
}
