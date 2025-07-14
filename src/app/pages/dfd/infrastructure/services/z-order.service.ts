import { Injectable } from '@angular/core';
import { Cell, Node } from '@antv/x6';
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
      case 'textbox':
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
   */
  calculateMoveToFrontZIndex(cell: Cell, allCells: Cell[]): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryCells = allCells.filter(
      c => c.id !== cell.id && this.isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryCells.length === 0) {
      this.logger.info('No other cells to move to front relative to', { cellId: cell.id });
      return null;
    }

    const maxZIndex = Math.max(...sameCategoryCells.map(c => c.getZIndex() ?? 1));
    const newZIndex = maxZIndex + 1;

    if (newZIndex > currentZIndex) {
      return newZIndex;
    }

    this.logger.info('Cell is already at the front among its category', { cellId: cell.id });
    return null;
  }

  /**
   * Calculate z-index for moving to back (business logic)
   */
  calculateMoveToBackZIndex(cell: Cell, allCells: Cell[]): number | null {
    const isSecurityBoundary = this.isSecurityBoundaryCell(cell);
    const currentZIndex = cell.getZIndex() ?? 1;

    // Get cells of the same type (security boundaries vs non-security boundaries)
    const sameCategoryCells = allCells.filter(
      c => c.id !== cell.id && this.isSecurityBoundaryCell(c) === isSecurityBoundary,
    );

    if (sameCategoryCells.length === 0) {
      this.logger.info('No other cells to move to back relative to', { cellId: cell.id });
      return null;
    }

    const minZIndex = Math.min(...sameCategoryCells.map(c => c.getZIndex() ?? 1));
    const newZIndex = Math.max(minZIndex - 1, 1);

    if (newZIndex < currentZIndex) {
      return newZIndex;
    }

    this.logger.info('Cell is already at the back among its category', { cellId: cell.id });
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
}
