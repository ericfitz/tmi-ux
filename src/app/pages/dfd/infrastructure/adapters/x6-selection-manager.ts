import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { Selection } from '@antv/x6-plugin-selection';
import { Transform } from '@antv/x6-plugin-transform';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 Selection Manager
 * Handles selection, transformation tools, and multi-select operations
 */
@Injectable()
export class X6SelectionManager {
  private selectionPlugin: Selection | null = null;
  private transformPlugin: Transform | null = null;

  constructor(private logger: LoggerService) {}

  /**
   * Initialize selection and transform plugins
   */
  initializePlugins(graph: Graph): void {
    // Configure selection plugin
    this.selectionPlugin = new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      movable: true,
      showNodeSelectionBox: true,
      showEdgeSelectionBox: false,
      pointerEvents: 'none',
      className: 'dfd-selection',
    });

    // Configure transform plugin
    this.transformPlugin = new Transform({
      resizing: {
        enabled: true,
        minWidth: 50,
        minHeight: 30,
        maxWidth: 500,
        maxHeight: 300,
        orthogonal: false,
        restrict: false,
        preserveAspectRatio: false,
      },
      rotating: {
        enabled: false, // Disable rotation for DFD elements
      },
    });

    // Use plugins
    graph.use(this.selectionPlugin);
    graph.use(this.transformPlugin);

    this.logger.info('Selection and transform plugins initialized');
  }

  /**
   * Enable selection mode
   */
  enableSelection(graph: Graph): void {
    if (this.selectionPlugin) {
      this.selectionPlugin.enable();
      graph.enableSelection();
      this.logger.info('Selection mode enabled');
    }
  }

  /**
   * Disable selection mode
   */
  disableSelection(graph: Graph): void {
    if (this.selectionPlugin) {
      this.selectionPlugin.disable();
      graph.disableSelection();
      this.clearSelection(graph);
      this.logger.info('Selection mode disabled');
    }
  }

  /**
   * Get currently selected cells
   */
  getSelectedCells(graph: Graph): Cell[] {
    return graph.getSelectedCells();
  }

  /**
   * Get currently selected nodes
   */
  getSelectedNodes(graph: Graph): Node[] {
    return graph.getSelectedCells().filter(cell => cell.isNode());
  }

  /**
   * Get currently selected edges
   */
  getSelectedEdges(graph: Graph): Edge[] {
    return graph.getSelectedCells().filter(cell => cell.isEdge());
  }

  /**
   * Select specific cells
   */
  selectCells(graph: Graph, cells: Cell[]): void {
    graph.select(cells);
    this.logger.info('Selected cells', { count: cells.length });
  }

  /**
   * Select all cells in the graph
   */
  selectAll(graph: Graph): void {
    const allCells = graph.getCells();
    this.selectCells(graph, allCells);
    this.logger.info('Selected all cells', { count: allCells.length });
  }

  /**
   * Clear current selection
   */
  clearSelection(graph: Graph): void {
    graph.unselect(graph.getSelectedCells());
    this.logger.info('Selection cleared');
  }

  /**
   * Delete selected cells
   */
  deleteSelected(graph: Graph): void {
    const selectedCells = this.getSelectedCells(graph);
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for deletion');
      return;
    }

    // Remove selected cells
    selectedCells.forEach(cell => {
      graph.removeCell(cell);
    });

    this.logger.info('Deleted selected cells', { count: selectedCells.length });
  }

  /**
   * Copy selected cells to clipboard (simplified implementation)
   */
  copySelected(graph: Graph): Cell[] {
    const selectedCells = this.getSelectedCells(graph);
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
   * Paste cells at a specific position
   */
  pasteCells(graph: Graph, cells: Cell[], offsetX: number = 20, offsetY: number = 20): void {
    if (cells.length === 0) {
      this.logger.info('No cells to paste');
      return;
    }

    // Clear current selection
    this.clearSelection(graph);

    // Add cloned cells with offset
    const pastedCells: Cell[] = [];
    cells.forEach(cell => {
      const clonedCell = cell.clone();

      if (clonedCell.isNode()) {
        const node = clonedCell;
        const position = node.getPosition();
        node.setPosition(position.x + offsetX, position.y + offsetY);
      }

      graph.addCell(clonedCell);
      pastedCells.push(clonedCell);
    });

    // Select the pasted cells
    this.selectCells(graph, pastedCells);
    this.logger.info('Pasted cells', { count: pastedCells.length });
  }

  /**
   * Group selected cells
   */
  groupSelected(graph: Graph): Node | null {
    const selectedNodes = this.getSelectedNodes(graph);
    if (selectedNodes.length < 2) {
      this.logger.info('Need at least 2 nodes to create a group');
      return null;
    }

    // Calculate bounding box for the group
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach(node => {
      const bbox = node.getBBox();
      minX = Math.min(minX, bbox.x);
      minY = Math.min(minY, bbox.y);
      maxX = Math.max(maxX, bbox.x + bbox.width);
      maxY = Math.max(maxY, bbox.y + bbox.height);
    });

    // Create group node
    const groupNode = graph.addNode({
      x: minX - 10,
      y: minY - 10,
      width: maxX - minX + 20,
      height: maxY - minY + 20,
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
        },
      },
      zIndex: -1, // Place behind other nodes
    });

    // Add nodes to group
    selectedNodes.forEach(node => {
      groupNode.addChild(node);
    });

    this.logger.info('Created group with nodes', {
      groupId: groupNode.id,
      nodeCount: selectedNodes.length,
    });

    return groupNode;
  }

  /**
   * Ungroup selected group
   */
  ungroupSelected(graph: Graph): void {
    const selectedNodes = this.getSelectedNodes(graph);

    selectedNodes.forEach(node => {
      const children = node.getChildren();
      if (children && children.length > 0) {
        // Remove children from group
        children.forEach(child => {
          node.removeChild(child);
        });

        // Remove the group node
        graph.removeCell(node);

        this.logger.info('Ungrouped node', {
          groupId: node.id,
          childCount: children.length,
        });
      }
    });
  }

  /**
   * Align selected nodes
   */
  alignNodes(
    graph: Graph,
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  ): void {
    const selectedNodes = this.getSelectedNodes(graph);
    if (selectedNodes.length < 2) {
      this.logger.info('Need at least 2 nodes to align');
      return;
    }

    let referenceValue: number;

    // Calculate reference value based on alignment type
    switch (alignment) {
      case 'left':
        referenceValue = Math.min(...selectedNodes.map(node => node.getPosition().x));
        selectedNodes.forEach(node => {
          node.setPosition(referenceValue, node.getPosition().y);
        });
        break;
      case 'right':
        referenceValue = Math.max(
          ...selectedNodes.map(node => {
            const pos = node.getPosition();
            const size = node.getSize();
            return pos.x + size.width;
          }),
        );
        selectedNodes.forEach(node => {
          const size = node.getSize();
          node.setPosition(referenceValue - size.width, node.getPosition().y);
        });
        break;
      case 'center': {
        const centerX =
          selectedNodes.reduce((sum, node) => {
            const pos = node.getPosition();
            const size = node.getSize();
            return sum + pos.x + size.width / 2;
          }, 0) / selectedNodes.length;
        selectedNodes.forEach(node => {
          const size = node.getSize();
          node.setPosition(centerX - size.width / 2, node.getPosition().y);
        });
        break;
      }
      case 'top':
        referenceValue = Math.min(...selectedNodes.map(node => node.getPosition().y));
        selectedNodes.forEach(node => {
          node.setPosition(node.getPosition().x, referenceValue);
        });
        break;
      case 'bottom':
        referenceValue = Math.max(
          ...selectedNodes.map(node => {
            const pos = node.getPosition();
            const size = node.getSize();
            return pos.y + size.height;
          }),
        );
        selectedNodes.forEach(node => {
          const size = node.getSize();
          node.setPosition(node.getPosition().x, referenceValue - size.height);
        });
        break;
      case 'middle': {
        const centerY =
          selectedNodes.reduce((sum, node) => {
            const pos = node.getPosition();
            const size = node.getSize();
            return sum + pos.y + size.height / 2;
          }, 0) / selectedNodes.length;
        selectedNodes.forEach(node => {
          const size = node.getSize();
          node.setPosition(node.getPosition().x, centerY - size.height / 2);
        });
        break;
      }
    }

    this.logger.info('Aligned nodes', { alignment, count: selectedNodes.length });
  }

  /**
   * Distribute selected nodes evenly
   */
  distributeNodes(graph: Graph, direction: 'horizontal' | 'vertical'): void {
    const selectedNodes = this.getSelectedNodes(graph);
    if (selectedNodes.length < 3) {
      this.logger.info('Need at least 3 nodes to distribute');
      return;
    }

    // Sort nodes by position
    selectedNodes.sort((a, b) => {
      const posA = a.getPosition();
      const posB = b.getPosition();
      return direction === 'horizontal' ? posA.x - posB.x : posA.y - posB.y;
    });

    const firstNode = selectedNodes[0];
    const lastNode = selectedNodes[selectedNodes.length - 1];

    if (direction === 'horizontal') {
      const firstX = firstNode.getPosition().x;
      const lastX = lastNode.getPosition().x + lastNode.getSize().width;
      const totalWidth = lastX - firstX;
      const spacing = totalWidth / (selectedNodes.length - 1);

      selectedNodes.forEach((node, index) => {
        if (index > 0 && index < selectedNodes.length - 1) {
          const newX = firstX + spacing * index;
          node.setPosition(newX, node.getPosition().y);
        }
      });
    } else {
      const firstY = firstNode.getPosition().y;
      const lastY = lastNode.getPosition().y + lastNode.getSize().height;
      const totalHeight = lastY - firstY;
      const spacing = totalHeight / (selectedNodes.length - 1);

      selectedNodes.forEach((node, index) => {
        if (index > 0 && index < selectedNodes.length - 1) {
          const newY = firstY + spacing * index;
          node.setPosition(node.getPosition().x, newY);
        }
      });
    }

    this.logger.info('Distributed nodes', { direction, count: selectedNodes.length });
  }

  /**
   * Setup selection event handlers
   */
  setupSelectionEvents(graph: Graph): void {
    // Handle selection changes
    graph.on('selection:changed', ({ added, removed }) => {
      this.logger.info('Selection changed', {
        added: added.length,
        removed: removed.length,
        total: graph.getSelectedCells().length,
      });
    });

    // Handle cell selection
    graph.on('cell:selected', ({ cell }) => {
      this.logger.info('Cell selected', { cellId: cell.id, cellType: cell.shape });
    });

    // Handle cell unselection
    graph.on('cell:unselected', ({ cell }) => {
      this.logger.info('Cell unselected', { cellId: cell.id, cellType: cell.shape });
    });
  }
}
