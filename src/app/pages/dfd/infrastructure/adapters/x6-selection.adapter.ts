import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { Selection } from '@antv/x6-plugin-selection';
import { Transform } from '@antv/x6-plugin-transform';
import { NODE_TOOLS, EDGE_TOOLS } from '../constants/tool-configurations';
import { LoggerService } from '../../../../core/services/logger.service';
import { SelectionService } from '../services/selection.service';

/**
 * X6 Selection Adapter
 * Handles X6-specific selection implementation and visual effects
 * Works with SelectionService for business logic
 */
@Injectable()
export class X6SelectionAdapter {
  /**
   * Standard tool configurations for consistent behavior
   */

  private selectionPlugin: Selection | null = null;
  private transformPlugin: Transform | null = null;
  private selectedCells = new Set<string>();

  constructor(
    private logger: LoggerService,
    private selectionService: SelectionService,
  ) {}

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
      showNodeSelectionBox: false,
      showEdgeSelectionBox: false,
      modifiers: null, // Allow rubberband selection without modifiers
      pointerEvents: 'none',
    });

    // Configure transform plugin
    this.transformPlugin = new Transform({
      resizing: {
        enabled: true,
        minWidth: 40,
        minHeight: 30,
        maxWidth: Number.MAX_SAFE_INTEGER,
        maxHeight: Number.MAX_SAFE_INTEGER,
        orthogonal: false,
        restrict: false,
        preserveAspectRatio: false,
      },
      rotating: false,
    });

    // Use plugins
    graph.use(this.selectionPlugin);
    graph.use(this.transformPlugin);

    this.logger.info('Selection and transform plugins initialized');
  }

  /**
   * Setup selection event handlers for visual feedback
   */
  setupSelectionEvents(graph: Graph, onCellDeletion?: (cell: Cell) => void): void {
    // Clear selection on blank click
    graph.on('blank:click', () => {
      if (graph && typeof graph.cleanSelection === 'function') {
        graph.cleanSelection();
      }
    });

    // Add hover effects with subtle red glow
    graph.on('cell:mouseenter', ({ cell }: { cell: Cell }) => {
      if (!this.selectedCells.has(cell.id)) {
        this.applyHoverEffect(cell);
      }
    });

    graph.on('cell:mouseleave', ({ cell }: { cell: Cell }) => {
      if (!this.selectedCells.has(cell.id)) {
        this.removeHoverEffect(cell);
      }
    });

    // Handle selection changes
    graph.on('selection:changed', ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
      // Apply glow effects and tools to newly selected cells
      added.forEach((cell: Cell) => {
        this.selectedCells.add(cell.id);
        this.applySelectionEffect(cell);
        this.addCellTools(cell, onCellDeletion);
      });

      // Remove glow effects and tools from deselected cells
      removed.forEach((cell: Cell) => {
        this.selectedCells.delete(cell.id);
        this.removeSelectionEffect(cell);
        cell.removeTools();
      });

      this.logger.info('Selection changed', {
        added: added.length,
        removed: removed.length,
        total: graph.getSelectedCells().length,
      });
    });
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
   * Copy selected cells using SelectionService business logic
   */
  copySelected(graph: Graph): Cell[] {
    const selectedCells = this.getSelectedCells(graph);
    return this.selectionService.copySelectedCells(selectedCells);
  }

  /**
   * Paste cells using SelectionService business logic
   */
  pasteCells(graph: Graph, cells: Cell[], offsetX: number = 20, offsetY: number = 20): void {
    if (cells.length === 0) {
      this.logger.info('No cells to paste');
      return;
    }

    // Use SelectionService to calculate positions
    const pasteData = this.selectionService.calculatePastePositions(cells, offsetX, offsetY);

    // Clear current selection
    this.clearSelection(graph);

    // Add cells with calculated positions
    const pastedCells: Cell[] = [];
    pasteData.forEach(({ cell, position }) => {
      if (cell.isNode()) {
        const node = cell;
        node.setPosition(position.x, position.y);
      }

      graph.addCell(cell);
      pastedCells.push(cell);
    });

    // Select the pasted cells
    this.selectCells(graph, pastedCells);
    this.logger.info('Pasted cells', { count: pastedCells.length });
  }

  /**
   * Group selected cells using SelectionService business logic
   */
  groupSelected(graph: Graph): Node | null {
    const selectedNodes = this.getSelectedNodes(graph);

    if (!this.selectionService.canGroupNodes(selectedNodes)) {
      this.logger.info('Cannot group selected nodes');
      return null;
    }

    // Use SelectionService to calculate bounding box
    const boundingBox = this.selectionService.calculateGroupBoundingBox(selectedNodes);
    const groupConfig = this.selectionService.getGroupConfiguration(boundingBox);

    // Create group node using X6
    const groupNode = graph.addNode(groupConfig);

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
   * Ungroup selected group using SelectionService business logic
   */
  ungroupSelected(graph: Graph): void {
    const selectedNodes = this.getSelectedNodes(graph);

    selectedNodes.forEach(node => {
      if (this.selectionService.canUngroupNode(node)) {
        const children = node.getChildren();
        if (children) {
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
      }
    });
  }

  /**
   * Align selected nodes using SelectionService business logic
   */
  alignNodes(
    graph: Graph,
    alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
  ): void {
    const selectedNodes = this.getSelectedNodes(graph);

    // Use SelectionService to calculate positions
    const alignmentData = this.selectionService.calculateAlignmentPositions(
      selectedNodes,
      alignment,
    );

    // Apply positions using X6
    alignmentData.forEach(({ node, position }) => {
      node.setPosition(position.x, position.y);
    });

    this.logger.info('Aligned nodes', { alignment, count: selectedNodes.length });
  }

  /**
   * Distribute selected nodes using SelectionService business logic
   */
  distributeNodes(graph: Graph, direction: 'horizontal' | 'vertical'): void {
    const selectedNodes = this.getSelectedNodes(graph);

    // Use SelectionService to calculate positions
    const distributionData = this.selectionService.calculateDistributionPositions(
      selectedNodes,
      direction,
    );

    // Apply positions using X6
    distributionData.forEach(({ node, position }) => {
      node.setPosition(position.x, position.y);
    });

    this.logger.info('Distributed nodes', { direction, count: selectedNodes.length });
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
   * Apply hover effect to a cell
   */
  private applyHoverEffect(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
      if (nodeType === 'text-box') {
        // For text-box shapes, apply hover glow to text element since body is transparent
        cell.attr('text/filter', 'drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
      } else {
        // For all other node types, apply hover glow to body element
        cell.attr('body/filter', 'drop-shadow(0 0 4px rgba(255, 0, 0, 0.6))');
      }
    } else if (cell.isEdge()) {
      // Add subtle red glow for edge hover
      cell.attr('line/filter', 'drop-shadow(0 0 3px rgba(255, 0, 0, 0.6))');
    }
  }

  /**
   * Remove hover effect from a cell
   */
  private removeHoverEffect(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
      if (nodeType === 'text-box') {
        // For text-box shapes, remove hover glow from text element
        cell.attr('text/filter', 'none');
      } else {
        // For all other node types, remove hover glow from body element
        cell.attr('body/filter', 'none');
      }
    } else if (cell.isEdge()) {
      // Remove hover glow
      cell.attr('line/filter', 'none');
    }
  }

  /**
   * Apply selection effect to a cell
   */
  private applySelectionEffect(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
      if (nodeType === 'text-box') {
        // For text-box shapes, apply glow to text element since body is transparent
        cell.attr('text/filter', 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
      } else {
        // For all other node types, apply glow to body element
        cell.attr('body/filter', 'drop-shadow(0 0 8px rgba(255, 0, 0, 0.8))');
        cell.attr('body/strokeWidth', 3);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'drop-shadow(0 0 6px rgba(255, 0, 0, 0.8))');
      cell.attr('line/strokeWidth', 3);
    }
  }

  /**
   * Remove selection effect from a cell
   */
  private removeSelectionEffect(cell: Cell): void {
    if (cell.isNode()) {
      const nodeType = (cell as any).getNodeTypeInfo
        ? (cell as any).getNodeTypeInfo().type
        : 'process';
      if (nodeType === 'text-box') {
        // For text-box shapes, remove glow from text element
        cell.attr('text/filter', 'none');
      } else {
        // For all other node types, remove glow from body element
        cell.attr('body/filter', 'none');
        cell.attr('body/strokeWidth', 2);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'none');
      cell.attr('line/strokeWidth', 2);
    }
  }

  /**
   * Add tools to a cell based on its type
   */
  private addCellTools(cell: Cell, onCellDeletion?: (cell: Cell) => void): void {
    if (cell.isNode()) {
      this.addNodeTools(cell, onCellDeletion);
    } else if (cell.isEdge()) {
      this.addEdgeTools(cell, onCellDeletion);
    }
  }

  /**
   * Add tools to a selected node using X6's native tool system
   */
  private addNodeTools(node: Node, onCellDeletion?: (cell: Cell) => void): void {
    // Clone tools and add delete handler to button-remove
    const tools = NODE_TOOLS.map(tool => {
      if (tool.name === 'button-remove') {
        return {
          ...tool,
          args: {
            ...tool.args,
            onClick: ({ cell }: { cell: Cell }) => {
              if (onCellDeletion) {
                onCellDeletion(cell);
              }
            },
          },
        };
      }
      return tool;
    });

    node.addTools(tools);
  }

  /**
   * Add tools to a selected edge using X6's native tool system
   */
  private addEdgeTools(edge: Edge, onCellDeletion?: (cell: Cell) => void): void {
    // Clone tools and add delete handler to button-remove
    const tools = EDGE_TOOLS.map(tool => {
      if (tool.name === 'button-remove') {
        return {
          ...tool,
          args: {
            ...tool.args,
            onClick: ({ cell }: { cell: Cell }) => {
              if (onCellDeletion) {
                onCellDeletion(cell);
              }
            },
          },
        };
      }
      return tool;
    });

    edge.addTools(tools);
  }
}
