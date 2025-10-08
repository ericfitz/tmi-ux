import { Injectable } from '@angular/core';
import { Node } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Embedding Service
 * Handles node embedding business logic and appearance rules (domain logic)
 * Extracted from x6-graph.adapter.ts to separate concerns
 */
@Injectable({
  providedIn: 'root',
})
export class InfraEmbeddingService {
  constructor(private logger: LoggerService) {}

  /**
   * Calculate the embedding depth of a node (business logic)
   */
  calculateEmbeddingDepth(node: Node): number {
    let depth = 0;
    let currentNode = node;

    // Traverse up the parent chain to count embedding levels
    while (currentNode.getParent()) {
      depth++;
      const parent = currentNode.getParent();
      if (!parent) break;

      // The parent is already a Cell object, not an ID
      if (!parent.isNode()) break;

      currentNode = parent;

      // Safety check to prevent infinite loops
      if (depth > 10) {
        this.logger.warn('Maximum embedding depth reached, breaking loop', { nodeId: node.id });
        break;
      }
    }

    return depth;
  }

  /**
   * Calculate the fill color based on embedding depth (business rule)
   * Level 0 (not embedded): white (#FFFFFF)
   * Level 1: very light bluish white (#F8F9FF)
   * Level 2: slightly darker (#F0F2FF)
   * Level 3+: progressively darker bluish tints
   */
  calculateEmbeddingFillColor(depth: number): string {
    if (depth === 0) {
      return '#FFFFFF'; // Pure white for non-embedded nodes
    }

    // Base bluish white color components
    const baseRed = 240;
    const baseGreen = 250;

    // Calculate darker tint based on depth
    // Each level reduces the RGB values by 10 points to create a progressively darker tint
    const reduction = Math.min(depth * 10, 60); // Cap at 60 to avoid going too dark

    const red = Math.max(baseRed - reduction, 200);
    const green = Math.max(baseGreen - reduction, 200);
    const blue = 255; // Keep blue at maximum to maintain bluish tint

    return `rgb(${red}, ${green}, ${blue})`;
  }

  /**
   * Get embedding configuration for a node based on its depth (business logic)
   */
  getEmbeddingConfiguration(node: Node): {
    depth: number;
    fillColor: string;
    shouldUpdateColor: boolean;
  } {
    const depth = this.calculateEmbeddingDepth(node);
    const fillColor = this.calculateEmbeddingFillColor(depth);

    // Determine if color should be updated based on node type
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

    // Don't update color for text-box nodes (they should remain transparent)
    const shouldUpdateColor = nodeType !== 'text-box';

    this.logger.info('Calculated embedding configuration', {
      nodeId: node.id,
      nodeType,
      embeddingDepth: depth,
      fillColor,
      shouldUpdateColor,
    });

    return {
      depth,
      fillColor,
      shouldUpdateColor,
    };
  }

  /**
   * Check if a child node is completely contained within a parent node's bounds
   * @param child The child node to check
   * @param parent The potential parent node
   * @returns true if child is 100% within parent bounds
   */
  isCompletelyContained(child: Node, parent: Node): boolean {
    const childPosition = child.getPosition();
    const childSize = child.getSize();
    const childBounds = {
      x: childPosition.x,
      y: childPosition.y,
      width: childSize.width,
      height: childSize.height,
    };

    const parentPosition = parent.getPosition();
    const parentSize = parent.getSize();
    const parentBounds = {
      x: parentPosition.x,
      y: parentPosition.y,
      width: parentSize.width,
      height: parentSize.height,
    };

    // Check if child is completely within parent bounds (100% containment)
    const isContained =
      childBounds.x >= parentBounds.x &&
      childBounds.y >= parentBounds.y &&
      childBounds.x + childBounds.width <= parentBounds.x + parentBounds.width &&
      childBounds.y + childBounds.height <= parentBounds.y + parentBounds.height;

    return isContained;
  }

  /**
   * Check if a node is a descendant of another node (for circular embedding detection)
   */
  isDescendant(potentialChild: Node, potentialAncestor: Node): boolean {
    if (potentialChild.id === potentialAncestor.id) {
      return true;
    }

    let current = potentialAncestor.getParent();
    let depth = 0;

    while (current && current.isNode()) {
      if (current.id === potentialChild.id) {
        return true;
      }

      current = current.getParent();
      depth++;

      // Safety check to prevent infinite loops
      if (depth > 10) {
        this.logger.warn('Maximum depth reached in descendant check', {
          childId: potentialChild.id,
          ancestorId: potentialAncestor.id,
        });
        break;
      }
    }

    return false;
  }

  /**
   * Validate embedding rules (business logic)
   */
  validateEmbedding(
    parent: Node,
    child: Node,
  ): {
    isValid: boolean;
    reason?: string;
  } {
    const parentType = (parent as any).getNodeTypeInfo
      ? (parent as any).getNodeTypeInfo().type
      : 'process';
    const childType = (child as any).getNodeTypeInfo
      ? (child as any).getNodeTypeInfo().type
      : 'process';

    // Prevent circular embedding: check if parent is a descendant of child
    if (this.isDescendant(child, parent)) {
      return {
        isValid: false,
        reason: 'Circular embedding is not allowed',
      };
    }

    // text-box shapes cannot be embedded into other shapes
    if (childType === 'text-box') {
      return {
        isValid: false,
        reason: 'text-box shapes cannot be embedded into other shapes',
      };
    }

    // Other shapes cannot be embedded into text-box shapes
    if (parentType === 'text-box') {
      return {
        isValid: false,
        reason: 'Other shapes cannot be embedded into text-box shapes',
      };
    }

    // Security boundaries can only be embedded into other security boundaries
    if (childType === 'security-boundary') {
      if (parentType !== 'security-boundary') {
        return {
          isValid: false,
          reason: 'Security boundaries can only be embedded into other security boundaries',
        };
      }
    }

    // All other node types can be embedded into any compatible node type
    return {
      isValid: true,
    };
  }

  /**
   * Calculate z-index adjustments for embedding (business logic)
   */
  calculateEmbeddingZIndexes(
    parent: Node,
    child: Node,
  ): {
    parentZIndex: number;
    childZIndex: number;
  } {
    const parentType = (parent as any).getNodeTypeInfo
      ? (parent as any).getNodeTypeInfo().type
      : 'process';
    const childType = (child as any).getNodeTypeInfo
      ? (child as any).getNodeTypeInfo().type
      : 'process';

    // Parent keeps its base z-index (security boundaries stay behind)
    let parentZIndex: number;
    if (parentType === 'security-boundary') {
      parentZIndex = 1; // Security boundaries stay at the back
    } else {
      parentZIndex = 10;
    }

    // Child gets appropriate z-index based on type
    let childZIndex: number;
    if (childType === 'security-boundary') {
      // Security boundaries should always stay behind, even when embedded
      childZIndex = 2; // Slightly higher than non-embedded security boundaries but still behind regular nodes
    } else {
      childZIndex = 15; // Regular nodes appear in front when embedded
    }

    return {
      parentZIndex,
      childZIndex,
    };
  }

  /**
   * Calculate z-index for unembedding (business logic)
   */
  calculateUnembeddingZIndex(node: Node): number {
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

    // Reset to default z-index based on type
    if (nodeType === 'security-boundary') {
      return 1; // Security boundaries always stay at the back
    } else {
      return 10; // Default for regular nodes
    }
  }

  /**
   * Get temporary z-index for embedding operation (business logic)
   */
  getTemporaryEmbeddingZIndex(node: Node): number {
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

    // When a node is being embedded, ensure it appears in front temporarily
    // But respect the node type - security boundaries should stay behind regular nodes
    if (nodeType === 'security-boundary') {
      // Security boundaries get a temporary higher z-index but still behind regular nodes
      return 5;
    } else {
      // Regular nodes get a higher temporary z-index
      return 20;
    }
  }
}
