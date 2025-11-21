import { Injectable } from '@angular/core';
import { Cell, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Z-Order Service
 * Handles z-order business logic and rules (domain logic)
 * Extracted from x6-graph.adapter.ts to separate concerns
 */
@Injectable({
  providedIn: 'root',
})
export class ZOrderService {
  constructor(private logger: LoggerService) {}

  /**
   * Check if a cell is a security boundary (business rule)
   */
  isSecurityBoundaryCell(cell: Cell): boolean {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
      return nodeType === 'security-boundary';
    }
    return false;
  }

  /**
   * Get default z-index for a node type (business rule)
   */
  getDefaultZIndex(nodeType: string): number {
    switch (nodeType) {
      case 'security-boundary':
        return 1; // Security boundaries stay behind other nodes
      case 'text-box':
        return 20; // Textboxes appear above all other shapes
      default:
        return 10; // Default z-index for regular nodes
    }
  }

  /**
   * Calculate next z-index for moving forward (business logic)
   */
  calculateMoveForwardZIndex(
    cell: Cell,
    allCells: Cell[],
    isSelected: (cell: Cell) => boolean,
  ): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryUnselectedCells = allCells.filter(
      c =>
        c.id !== cell.id && !isSelected(c) && this.isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryUnselectedCells.length === 0) {
      this.logger.info('No other cells to move forward relative to', { cellId: cell.id });
      return null;
    }

    // Find the next higher z-index among unselected cells of the same category
    const higherZIndices = sameCategoryUnselectedCells
      .map(c => c.getZIndex() ?? 1)
      .filter(z => z > currentZIndex)
      .sort((a, b) => a - b);

    if (higherZIndices.length > 0) {
      const nextHigherZIndex = higherZIndices[0];
      return nextHigherZIndex + 1;
    }

    this.logger.info('Cell is already at the front among its category', { cellId: cell.id });
    return null;
  }

  /**
   * Calculate next z-index for moving backward (business logic)
   */
  calculateMoveBackwardZIndex(
    cell: Cell,
    allCells: Cell[],
    isSelected: (cell: Cell) => boolean,
  ): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryUnselectedCells = allCells.filter(
      c =>
        c.id !== cell.id && !isSelected(c) && this.isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryUnselectedCells.length === 0) {
      this.logger.info('No other cells to move backward relative to', { cellId: cell.id });
      return null;
    }

    // Find the next lower z-index among unselected cells of the same category
    const lowerZIndices = sameCategoryUnselectedCells
      .map(c => c.getZIndex() ?? 1)
      .filter(z => z < currentZIndex)
      .sort((a, b) => b - a);

    if (lowerZIndices.length > 0) {
      const nextLowerZIndex = lowerZIndices[0];
      return Math.max(nextLowerZIndex - 1, 1);
    }

    this.logger.info('Cell is already at the back among its category', { cellId: cell.id });
    return null;
  }

  /**
   * Calculate z-index for moving to front (business logic)
   * Respects embedding hierarchy constraints
   */
  calculateMoveToFrontZIndex(cell: Cell, allCells: Cell[]): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    // but exclude cells that would violate embedding hierarchy
    const validCells = allCells.filter(c => {
      if (c.id === cell.id) return false;
      if (this.isSecurityBoundaryCell(c) !== isSecurityBoundary) return false;

      // Don't allow moving above embedded children
      if (cell.isNode() && c.isNode()) {
        const cellNode = cell;
        const otherNode = c;

        // If other cell is a child of this cell, don't consider its zIndex for max calculation
        if (otherNode.getParent()?.id === cellNode.id) return false;

        // If this cell is a child of other cell, can't move above other cell's zIndex
        if (cellNode.getParent()?.id === otherNode.id) return false;
      }

      return true;
    });

    if (validCells.length === 0) {
      this.logger.info('No valid cells to move to front relative to', { cellId: cell.id });
      return null;
    }

    const maxZIndex = Math.max(...validCells.map(c => c.getZIndex() ?? 1));
    let newZIndex = maxZIndex + 1;

    // If this is a node with embedded children, ensure children maintain higher zIndex
    if (cell.isNode()) {
      const cellNode = cell;
      const children = allCells.filter(c => c.isNode() && c.getParent()?.id === cellNode.id);

      if (children.length > 0) {
        const maxChildZIndex = Math.max(...children.map(c => c.getZIndex() ?? 1));
        // Ensure new zIndex doesn't interfere with children's zIndex values
        newZIndex = Math.min(newZIndex, maxChildZIndex - children.length - 1);
      }
    }

    // If this is an embedded node, ensure it stays above its parent
    if (cell.isNode()) {
      const cellNode = cell;
      const parent = cellNode.getParent();
      if (parent && parent.isNode()) {
        const parentZIndex = parent.getZIndex() ?? 1;
        newZIndex = Math.max(newZIndex, parentZIndex + 1);
      }
    }

    if (newZIndex > currentZIndex && newZIndex !== currentZIndex) {
      return newZIndex;
    }

    this.logger.info('Cell is already at the front among its valid category', { cellId: cell.id });
    return null;
  }

  /**
   * Calculate z-index for moving to back (business logic)
   * Respects embedding hierarchy constraints
   */
  calculateMoveToBackZIndex(cell: Cell, allCells: Cell[]): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    // but exclude cells that would violate embedding hierarchy
    const validCells = allCells.filter(c => {
      if (c.id === cell.id) return false;
      if (this.isSecurityBoundaryCell(c) !== isSecurityBoundary) return false;

      // Don't allow moving below embedded parent
      if (cell.isNode() && c.isNode()) {
        const cellNode = cell;
        const otherNode = c;

        // If other cell is a parent of this cell, don't consider its zIndex for min calculation
        if (cellNode.getParent()?.id === otherNode.id) return false;

        // If this cell is a parent of other cell, can't move below other cell's zIndex
        if (otherNode.getParent()?.id === cellNode.id) return false;
      }

      return true;
    });

    if (validCells.length === 0) {
      this.logger.info('No valid cells to move to back relative to', { cellId: cell.id });
      return null;
    }

    const minZIndex = Math.min(...validCells.map(c => c.getZIndex() ?? 1));
    let newZIndex = Math.max(minZIndex - 1, 1);

    // If this is an embedded node, ensure it stays above its parent
    if (cell.isNode()) {
      const cellNode = cell;
      const parent = cellNode.getParent();
      if (parent && parent.isNode()) {
        const parentZIndex = parent.getZIndex() ?? 1;
        newZIndex = Math.max(newZIndex, parentZIndex + 1);
      }
    }

    // If this is a node with embedded children, ensure it stays below children
    if (cell.isNode()) {
      const cellNode = cell;
      const children = allCells.filter(c => c.isNode() && c.getParent()?.id === cellNode.id);

      if (children.length > 0) {
        const minChildZIndex = Math.min(...children.map(c => c.getZIndex() ?? 1));
        // Ensure new zIndex stays below all children
        newZIndex = Math.min(newZIndex, minChildZIndex - 1);
      }
    }

    if (newZIndex < currentZIndex && newZIndex >= 1) {
      return newZIndex;
    }

    this.logger.info('Cell is already at the back among its valid category', { cellId: cell.id });
    return null;
  }

  /**
   * Calculate z-index for edge based on connected nodes (business logic)
   */
  calculateEdgeZIndex(sourceZIndex: number, targetZIndex: number): number {
    return Math.max(sourceZIndex, targetZIndex);
  }

  /**
   * Validate z-order invariants and return corrections (business logic)
   */
  validateZOrderInvariants(nodes: Node[]): Array<{ node: Node; correctedZIndex: number }> {
    const corrections: Array<{ node: Node; correctedZIndex: number }> = [];
    const securityBoundaries: Node[] = [];
    const regularNodes: Node[] = [];

    // Categorize nodes by type
    nodes.forEach(node => {
      const nodeType = (node as any).getNodeTypeInfo
        ? (node as any).getNodeTypeInfo().type
        : 'process';

      if (nodeType === 'security-boundary') {
        securityBoundaries.push(node);
      } else {
        regularNodes.push(node);
      }
    });

    // Find the minimum z-index among regular nodes
    const regularNodeZIndices = regularNodes.map(node => node.getZIndex() ?? 10);
    const minRegularZIndex = regularNodeZIndices.length > 0 ? Math.min(...regularNodeZIndices) : 10;

    // Ensure all security boundaries have z-index lower than any regular node
    const maxSecurityBoundaryZIndex = Math.max(1, minRegularZIndex - 1);

    securityBoundaries.forEach((boundary, index) => {
      const currentZIndex = boundary.getZIndex() ?? 1;
      const targetZIndex = Math.min(maxSecurityBoundaryZIndex - index, 1);

      // Only correct if the security boundary is not embedded (embedded ones can have higher z-index)
      if (!boundary.getParent() && currentZIndex >= minRegularZIndex) {
        corrections.push({
          node: boundary,
          correctedZIndex: targetZIndex,
        });

        this.logger.info('Z-order violation detected for security boundary', {
          nodeId: boundary.id,
          currentZIndex,
          correctedZIndex: targetZIndex,
          minRegularZIndex,
          reason: 'security boundary was in front of regular nodes',
        });
      }
    });

    return corrections;
  }

  /**
   * Comprehensive z-order validation for all nodes (business logic)
   */
  validateComprehensiveZOrder(nodes: Node[]): {
    violations: Array<{ node: Node; issue: string; correctedZIndex: number }>;
    summary: {
      securityBoundariesUnembedded: number;
      securityBoundariesEmbedded: number;
      regularNodesUnembedded: number;
      regularNodesEmbedded: number;
    };
  } {
    const violations: Array<{ node: Node; issue: string; correctedZIndex: number }> = [];

    // Group nodes by type and embedding status
    const nodeGroups = {
      securityBoundariesUnembedded: [] as Node[],
      securityBoundariesEmbedded: [] as Node[],
      regularNodesUnembedded: [] as Node[],
      regularNodesEmbedded: [] as Node[],
    };

    nodes.forEach(node => {
      const nodeType = (node as any).getNodeTypeInfo
        ? (node as any).getNodeTypeInfo().type
        : 'process';
      const isEmbedded = !!node.getParent();

      if (nodeType === 'security-boundary') {
        if (isEmbedded) {
          nodeGroups.securityBoundariesEmbedded.push(node);
        } else {
          nodeGroups.securityBoundariesUnembedded.push(node);
        }
      } else {
        if (isEmbedded) {
          nodeGroups.regularNodesEmbedded.push(node);
        } else {
          nodeGroups.regularNodesUnembedded.push(node);
        }
      }
    });

    // Check invariant: unembedded security boundaries should be behind unembedded regular nodes
    const unembeddedRegularZIndices = nodeGroups.regularNodesUnembedded.map(
      n => n.getZIndex() ?? 10,
    );
    const minRegularZIndex =
      unembeddedRegularZIndices.length > 0 ? Math.min(...unembeddedRegularZIndices) : 10;

    nodeGroups.securityBoundariesUnembedded.forEach(boundary => {
      const currentZIndex = boundary.getZIndex() ?? 1;
      if (currentZIndex >= minRegularZIndex) {
        const correctedZIndex = Math.max(1, minRegularZIndex - 1);
        violations.push({
          node: boundary,
          issue: `Security boundary z-index ${currentZIndex} >= regular node min z-index ${minRegularZIndex}`,
          correctedZIndex,
        });
      }
    });

    return {
      violations,
      summary: {
        securityBoundariesUnembedded: nodeGroups.securityBoundariesUnembedded.length,
        securityBoundariesEmbedded: nodeGroups.securityBoundariesEmbedded.length,
        regularNodesUnembedded: nodeGroups.regularNodesUnembedded.length,
        regularNodesEmbedded: nodeGroups.regularNodesEmbedded.length,
      },
    };
  }

  /**
   * Get z-index for new security boundary shapes (lower than default)
   * Rule: New security boundary shapes are created with a lower zIndex than the default zIndex for nodes and edges
   */
  getNewSecurityBoundaryZIndex(): number {
    return 1; // Security boundaries always start at the lowest z-index
  }

  /**
   * Get z-index for new nodes (higher than security boundaries)
   * Rule: New nodes (other than security boundaries) get a higher default zIndex than security boundary nodes
   */
  getNewNodeZIndex(nodeType: string): number {
    if (nodeType === 'security-boundary') {
      return this.getNewSecurityBoundaryZIndex();
    }
    return this.getDefaultZIndex(nodeType);
  }

  /**
   * Get z-index for new edges based on connected nodes
   * Rule: The zIndex of new edges gets set to the higher value of either the zIndex for the source node
   * they connect to, or the zIndex for the target node they connect to
   */
  getNewEdgeZIndex(sourceNode: Node, targetNode: Node): number {
    const sourceZIndex = sourceNode.getZIndex() ?? this.getDefaultZIndex('process');
    const targetZIndex = targetNode.getZIndex() ?? this.getDefaultZIndex('process');
    return Math.max(sourceZIndex, targetZIndex);
  }

  /**
   * Update edge z-index on reconnection
   * Rule: On reconnecting an edge, the zIndex of the edge is recalculated and set to the higher value
   * of either the zIndex for the source node they connect to, or the zIndex for the target node they connect to
   */
  updateEdgeZIndexOnReconnection(edge: Edge, sourceNode: Node, targetNode: Node): number {
    const newZIndex = this.getNewEdgeZIndex(sourceNode, targetNode);

    this.logger.info('Updating edge z-index on reconnection', {
      edgeId: edge.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceZIndex: sourceNode.getZIndex() ?? this.getDefaultZIndex('process'),
      targetZIndex: targetNode.getZIndex() ?? this.getDefaultZIndex('process'),
      newEdgeZIndex: newZIndex,
    });

    return newZIndex;
  }

  /**
   * Get edges that need z-index updates when a node's z-index changes
   * Rule: When the zIndex of a node is adjusted, every edge connected to that node has its zIndex
   * recalculated and set to the higher value of either the zIndex for the source node they connect to,
   * or the zIndex for the target node they connect to
   */
  getConnectedEdgesForZIndexUpdate(
    node: Node,
    allEdges: Edge[],
  ): Array<{ edge: Edge; newZIndex: number }> {
    const updates: Array<{ edge: Edge; newZIndex: number }> = [];
    const nodeZIndex = node.getZIndex() ?? this.getDefaultZIndex('process');

    allEdges.forEach(edge => {
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      // Check if this edge is connected to the node
      if (sourceId === node.id || targetId === node.id) {
        // We need to get the other node to calculate the correct z-index
        // This will be handled by the adapter which has access to the graph
        updates.push({
          edge,
          newZIndex: nodeZIndex, // Placeholder - will be recalculated by adapter
        });
      }
    });

    this.logger.info('Found connected edges for z-index update', {
      nodeId: node.id,
      nodeZIndex,
      connectedEdgesCount: updates.length,
    });

    return updates;
  }

  /**
   * Calculate z-index for embedded node
   * Rule: On embedding, the zIndex of the new child node is set to at least one higher than the zIndex
   * of the new parent node. This is intended to trigger cascading recalculation of zIndex values for
   * edges connected to the new child node, and then recursively to child nodes of that node and their
   * connected edges, until there are no child nodes left
   */
  calculateEmbeddedNodeZIndex(parentNode: Node, childNode: Node): number {
    const parentZIndex = parentNode.getZIndex() ?? this.getDefaultZIndex('process');
    const childType = (childNode as any).getNodeTypeInfo
      ? (childNode as any).getNodeTypeInfo().type
      : 'process';

    let baseChildZIndex: number;

    // Security boundaries have special rules even when embedded
    if (childType === 'security-boundary') {
      // Embedded security boundaries should still be behind regular nodes but higher than unembedded ones
      baseChildZIndex = Math.max(parentZIndex + 1, 2);
    } else {
      // Regular nodes get at least one higher than parent
      baseChildZIndex = parentZIndex + 1;
    }

    this.logger.info('Calculated embedded node z-index', {
      parentId: parentNode.id,
      parentZIndex,
      childId: childNode.id,
      childType,
      calculatedZIndex: baseChildZIndex,
    });

    return baseChildZIndex;
  }

  /**
   * Get all descendant nodes for cascading z-index updates
   * Helper method to support recursive z-index updates during embedding
   */
  getDescendantNodesForCascadingUpdate(node: Node): Node[] {
    const descendants: Node[] = [];
    const children = node.getChildren() || [];

    children.forEach(child => {
      if (child.isNode()) {
        const childNode = child;
        descendants.push(childNode);
        // Recursively get descendants of this child
        descendants.push(...this.getDescendantNodesForCascadingUpdate(childNode));
      }
    });

    return descendants;
  }

  /**
   * Validate that embedded nodes have higher z-index than their parents
   * Business rule validation for embedding hierarchy
   */
  validateEmbeddingZOrderHierarchy(
    nodes: Node[],
  ): Array<{ node: Node; issue: string; correctedZIndex: number }> {
    const violations: Array<{ node: Node; issue: string; correctedZIndex: number }> = [];

    nodes.forEach(node => {
      const parent = node.getParent();
      if (parent && parent.isNode()) {
        const parentNode = parent;
        const nodeZIndex = node.getZIndex() ?? this.getDefaultZIndex('process');
        const parentZIndex = parentNode.getZIndex() ?? this.getDefaultZIndex('process');

        if (nodeZIndex <= parentZIndex) {
          const correctedZIndex = this.calculateEmbeddedNodeZIndex(parentNode, node);
          violations.push({
            node,
            issue: `Embedded node z-index ${nodeZIndex} <= parent z-index ${parentZIndex}`,
            correctedZIndex,
          });
        }
      }
    });

    return violations;
  }

  /**
   * Calculate z-indexes for both parent and child during embedding
   * Encapsulates the business logic for embedding z-index assignment
   */
  calculateEmbeddingZIndexes(
    parent: Node,
    child: Node,
  ): {
    parentZIndex: number;
    childZIndex: number;
  } {
    const parentType = this.getNodeType(parent);
    const childType = this.getNodeType(child);

    let parentZIndex: number;
    let childZIndex: number;

    // Parent z-index based on type
    if (parentType === 'security-boundary') {
      parentZIndex = 1; // Security boundaries stay at the back
    } else {
      parentZIndex = 10; // Regular nodes default
    }

    // Child z-index based on type and parent
    if (childType === 'security-boundary') {
      // Embedded security boundaries must respect parent hierarchy
      // Use Math.max to ensure child is always above parent
      childZIndex = Math.max(parentZIndex + 1, 2);
    } else {
      // Regular nodes: parent + 1
      childZIndex = parentZIndex + 1;
    }

    this.logger.info('Calculated embedding z-indexes', {
      parentId: parent.id,
      parentType,
      parentZIndex,
      childId: child.id,
      childType,
      childZIndex,
    });

    return { parentZIndex, childZIndex };
  }

  /**
   * Helper to get node type safely
   */
  private getNodeType(node: Node): string {
    return (node as any).getNodeTypeInfo ? (node as any).getNodeTypeInfo().type : 'process';
  }

  /**
   * Calculate z-index for unembedded security boundary node
   * Rule: When a security boundary node is unembedded and is no longer the child of any other object,
   * its zIndex is set back to the default zIndex for security boundary nodes
   */
  calculateUnembeddedSecurityBoundaryZIndex(node: Node): number {
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

    if (nodeType === 'security-boundary') {
      const defaultZIndex = this.getDefaultZIndex('security-boundary');

      this.logger.info('Calculated unembedded security boundary z-index', {
        nodeId: node.id,
        nodeType,
        defaultZIndex,
      });

      return defaultZIndex;
    }

    // For non-security-boundary nodes, use regular unembedding logic
    return this.getDefaultZIndex(nodeType);
  }

  /**
   * Recalculate z-order for all cells in the graph using iterative algorithm
   * Iterates until all z-index violations are fixed or max iterations reached
   *
   * Rules:
   * - Child nodes must have z-index > parent z-index (by at least 3)
   * - Edges must have z-index >= max(source z-index, target z-index)
   *
   * @param cells All cells in the graph (nodes and edges)
   * @returns Number of iterations performed
   */
  recalculateZOrder(cells: Cell[]): number {
    const maxIterations = cells.filter(c => c.isNode()).length;
    let iteration = 0;
    let changed = true;

    // this.logger.info('Starting z-order recalculation', {
    //   totalCells: cells.length,
    //   maxIterations,
    // });

    while (changed && iteration < maxIterations) {
      changed = false;
      iteration++;

      // Sort cells by current z-index (ascending)
      const sortedCells = [...cells].sort((a, b) => {
        const aZ = a.getZIndex() ?? 1;
        const bZ = b.getZIndex() ?? 1;
        return aZ - bZ;
      });

      // Iterate through each cell and check for violations
      for (const cell of sortedCells) {
        if (cell.isNode()) {
          const node = cell;
          const parent = node.getParent();

          if (parent && parent.isNode()) {
            const nodeZIndex = node.getZIndex() ?? 1;
            const parentZIndex = parent.getZIndex() ?? 1;

            // Violation: child z-index must be > parent z-index
            if (nodeZIndex <= parentZIndex) {
              const newZIndex = parentZIndex + 3;
              node.setZIndex(newZIndex);
              changed = true;

              this.logger.debugComponent(
                'ZOrderService',
                'Adjusted node z-index (parent violation)',
                {
                  nodeId: node.id,
                  oldZIndex: nodeZIndex,
                  newZIndex,
                  parentZIndex,
                  iteration,
                },
              );
            }
          }
        } else if (cell.isEdge()) {
          const edge = cell;
          const sourceId = edge.getSourceCellId();
          const targetId = edge.getTargetCellId();

          if (sourceId && targetId) {
            // Find source and target nodes in cells array
            const sourceNode = cells.find(c => c.id === sourceId && c.isNode()) as Node | undefined;
            const targetNode = cells.find(c => c.id === targetId && c.isNode()) as Node | undefined;

            if (sourceNode && targetNode) {
              const edgeZIndex = edge.getZIndex() ?? 1;
              const sourceZIndex = sourceNode.getZIndex() ?? 1;
              const targetZIndex = targetNode.getZIndex() ?? 1;
              const requiredZIndex = Math.max(sourceZIndex, targetZIndex);

              // Violation: edge z-index must be >= max(source, target)
              if (edgeZIndex < requiredZIndex) {
                edge.setZIndex(requiredZIndex);
                changed = true;

                this.logger.debugComponent('ZOrderService', 'Adjusted edge z-index', {
                  edgeId: edge.id,
                  oldZIndex: edgeZIndex,
                  newZIndex: requiredZIndex,
                  sourceZIndex,
                  targetZIndex,
                  iteration,
                });
              }
            }
          }
        }
      }
    }

    // Log results
    if (changed) {
      // Failed to converge
      this.logger.error('Z-order recalculation failed to converge', {
        iterations: iteration,
        maxIterations,
        cellCount: cells.length,
      });
    } else {
      // Success
      // this.logger.info('Z-order recalculation completed', {
      //   iterations: iteration,
      //   cellCount: cells.length,
      // });
    }

    return iteration;
  }
}
