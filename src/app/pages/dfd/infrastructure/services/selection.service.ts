import { Injectable } from '@angular/core';
import { Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * Selection Service
 * Handles selection business logic and algorithms (domain logic)
 * Extracted from X6SelectionManager to separate concerns
 */
@Injectable({
  providedIn: 'root',
})
export class SelectionService {
  constructor(private logger: LoggerService) {}

  /**
   * Copy selected cells (business logic)
   */
  copySelectedCells(selectedCells: Cell[]): Cell[] {
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for copying');
      return [];
    }

    // Clone the selected cells
    const copiedCells = selectedCells.map(cell => cell.clone());
    this.logger.info('Copied selected cells', { count: copiedCells.length });
    return copiedCells;
  }

  /**
   * Calculate paste position with offset (business logic)
   */
  calculatePastePositions(
    cells: Cell[],
    offsetX: number = 20,
    offsetY: number = 20,
  ): Array<{ cell: Cell; position: { x: number; y: number } }> {
    return cells.map(cell => {
      const clonedCell = cell.clone();
      let position = { x: 0, y: 0 };

      if (clonedCell.isNode()) {
        const node = clonedCell;
        const currentPosition = node.getPosition();
        position = {
          x: currentPosition.x + offsetX,
          y: currentPosition.y + offsetY,
        };
      }

      return { cell: clonedCell, position };
    });
  }

  /**
   * Calculate bounding box for grouping (business logic)
   */
  calculateGroupBoundingBox(nodes: Node[]): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (nodes.length === 0) {
      throw new Error('Cannot calculate bounding box for empty node list');
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    nodes.forEach(node => {
      const bbox = node.getBBox();
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    return {
      x: minX - 10,
      y: minY - 10,
      width: maxX - minX + 20,
      height: maxY - minY + 20,
    };
  }

  /**
   * Calculate alignment positions (business logic)
   */
  calculateAlignmentPositions(
    nodes: Node[],
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  ): Array<{ node: Node; position: { x: number; y: number } }> {
    if (nodes.length < 2) {
      this.logger.info('Need at least 2 nodes to align');
      return [];
    }

    const positions: Array<{ node: Node; position: { x: number; y: number } }> = [];

    // Calculate reference value based on alignment type
    switch (alignment) {
      case 'left': {
        const referenceX = Math.min(...nodes.map(node => node.getPosition().x));
        nodes.forEach(node => {
          positions.push({
            node,
            position: { x: referenceX, y: node.getPosition().y },
          });
        });
        break;
      }
      case 'right': {
        const referenceX = Math.max(
          ...nodes.map(node => {
            const pos = node.getPosition();
            const size = node.getSize();
            return pos.x + size.width;
          }),
        );
        nodes.forEach(node => {
          const size = node.getSize();
          positions.push({
            node,
            position: { x: referenceX - size.width, y: node.getPosition().y },
          });
        });
        break;
      }
      case 'center': {
        const centerX =
          nodes.reduce((sum, node) => {
            const pos = node.getPosition();
            const size = node.getSize();
            return sum + pos.x + size.width / 2;
          }, 0) / nodes.length;
        nodes.forEach(node => {
          const size = node.getSize();
          positions.push({
            node,
            position: { x: centerX - size.width / 2, y: node.getPosition().y },
          });
        });
        break;
      }
      case 'top': {
        const referenceY = Math.min(...nodes.map(node => node.getPosition().y));
        nodes.forEach(node => {
          positions.push({
            node,
            position: { x: node.getPosition().x, y: referenceY },
          });
        });
        break;
      }
      case 'bottom': {
        const referenceY = Math.max(
          ...nodes.map(node => {
            const pos = node.getPosition();
            const size = node.getSize();
            return pos.y + size.height;
          }),
        );
        nodes.forEach(node => {
          const size = node.getSize();
          positions.push({
            node,
            position: { x: node.getPosition().x, y: referenceY - size.height },
          });
        });
        break;
      }
      case 'middle': {
        const centerY =
          nodes.reduce((sum, node) => {
            const pos = node.getPosition();
            const size = node.getSize();
            return sum + pos.y + size.height / 2;
          }, 0) / nodes.length;
        nodes.forEach(node => {
          const size = node.getSize();
          positions.push({
            node,
            position: { x: node.getPosition().x, y: centerY - size.height / 2 },
          });
        });
        break;
      }
    }

    this.logger.info('Calculated alignment positions', { alignment, count: nodes.length });
    return positions;
  }

  /**
   * Calculate distribution positions (business logic)
   */
  calculateDistributionPositions(
    nodes: Node[],
    direction: 'horizontal' | 'vertical',
  ): Array<{ node: Node; position: { x: number; y: number } }> {
    if (nodes.length < 3) {
      this.logger.info('Need at least 3 nodes to distribute');
      return [];
    }

    // Sort nodes by position
    const sortedNodes = [...nodes].sort((a, b) => {
      const posA = a.getPosition();
      const posB = b.getPosition();
      return direction === 'horizontal' ? posA.x - posB.x : posA.y - posB.y;
    });

    const positions: Array<{ node: Node; position: { x: number; y: number } }> = [];
    const firstNode = sortedNodes[0];
    const lastNode = sortedNodes[sortedNodes.length - 1];

    if (direction === 'horizontal') {
      const firstX = firstNode.getPosition().x;
      const lastX = lastNode.getPosition().x + lastNode.getSize().width;
      const totalWidth = lastX - firstX;
      const spacing = totalWidth / (sortedNodes.length - 1);

      sortedNodes.forEach((node, index) => {
        if (index === 0 || index === sortedNodes.length - 1) {
          // Keep first and last nodes in place
          positions.push({
            node,
            position: node.getPosition(),
          });
        } else {
          const newX = firstX + spacing * index;
          positions.push({
            node,
            position: { x: newX, y: node.getPosition().y },
          });
        }
      });
    } else {
      const firstY = firstNode.getPosition().y;
      const lastY = lastNode.getPosition().y + lastNode.getSize().height;
      const totalHeight = lastY - firstY;
      const spacing = totalHeight / (sortedNodes.length - 1);

      sortedNodes.forEach((node, index) => {
        if (index === 0 || index === sortedNodes.length - 1) {
          // Keep first and last nodes in place
          positions.push({
            node,
            position: node.getPosition(),
          });
        } else {
          const newY = firstY + spacing * index;
          positions.push({
            node,
            position: { x: node.getPosition().x, y: newY },
          });
        }
      });
    }

    this.logger.info('Calculated distribution positions', { direction, count: nodes.length });
    return positions;
  }

  /**
   * Validate if nodes can be grouped (business logic)
   */
  canGroupNodes(nodes: Node[]): boolean {
    return nodes.length >= 2;
  }

  /**
   * Validate if a node can be ungrouped (business logic)
   */
  canUngroupNode(node: Node): boolean {
    const children = node.getChildren();
    return children !== null && children.length > 0;
  }

  /**
   * Get group configuration for creating a group node (business logic)
   */
  getGroupConfiguration(boundingBox: { x: number; y: number; width: number; height: number }): any {
    return {
      x: boundingBox.x,
      y: boundingBox.y,
      width: boundingBox.width,
      height: boundingBox.height,
      shape: 'rect',
      attrs: {
        body: {
          fill: 'transparent',
          stroke: '#666',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
        label: {
          text: 'Group',
          fontSize: 12,
          fill: '#666',
          fontFamily: '"Roboto Condensed", Arial, sans-serif',
        },
      },
      zIndex: -1, // Place behind other nodes
    };
  }
}
