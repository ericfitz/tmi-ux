import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { Selection } from '@antv/x6-plugin-selection';
import { Transform } from '@antv/x6-plugin-transform';
import { NODE_TOOLS, EDGE_TOOLS } from '../constants/tool-configurations';
import { LoggerService } from '../../../../core/services/logger.service';
import { SelectionService } from '../services/infra-selection.service';
import { DFD_STYLING, DFD_STYLING_HELPERS, NodeType } from '../../constants/styling-constants';
import {
  AppGraphHistoryCoordinator,
  HISTORY_OPERATION_TYPES,
} from '../../application/services/app-graph-history-coordinator.service';
import { InfraX6CoreOperationsService } from '../services/infra-x6-core-operations.service';
import { InfraEdgeService } from '../services/infra-edge.service';

/**
 * X6 Selection Adapter
 * Handles X6-specific selection implementation and visual effects
 * Works with SelectionService for business logic
 */
@Injectable()
export class InfraX6SelectionAdapter {
  /**
   * Standard tool configurations for consistent behavior
   */

  private selectionPlugin: Selection | null = null;
  private transformPlugin: Transform | null = null;
  private selectedCells = new Set<string>();
  private historyController: { disable: () => void; enable: () => void } | null = null;
  private portStateManager: any = null;
  private infraNodeService: any = null; // Set via setNodeService to avoid circular dependency

  constructor(
    private logger: LoggerService,
    private selectionService: SelectionService,
    private historyCoordinator: AppGraphHistoryCoordinator,
    private x6CoreOps: InfraX6CoreOperationsService,
    private infraEdgeService: InfraEdgeService,
  ) {}

  /**
   * Set node service for node deletion (injected to avoid circular dependency)
   */
  setNodeService(nodeService: any): void {
    this.infraNodeService = nodeService;
  }

  /**
   * Set port state manager for coordinating port visibility during hover
   */
  setPortStateManager(portStateManager: any): void {
    this.portStateManager = portStateManager;
  }

  /**
   * Set history controller for managing visual effects without history interference
   */
  setHistoryController(controller: { disable: () => void; enable: () => void }): void {
    this.historyController = controller;
  }

  /**
   * Initialize selection and transform plugins
   */
  initializePlugins(graph: Graph): void {
    // Configure selection plugin
    this.selectionPlugin = new Selection({
      enabled: true,
      multiple: true,
      rubberband: true,
      modifiers: null, // Allow rubberband selection without modifiers
      movable: true,
      multipleSelectionModifiers: ['shift'], // Shift for multi-selection
      showNodeSelectionBox: false,
      showEdgeSelectionBox: false,
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
    // Clear selection on blank click and update port visibility
    graph.on('blank:click', () => {
      if (graph && typeof graph.cleanSelection === 'function') {
        graph.cleanSelection();
      }

      // Update port visibility for all nodes after blank click
      if (this.portStateManager) {
        this.portStateManager.hideUnconnectedPorts(graph);
      }
    });

    // Add hover effects with subtle red glow - use centralized history coordinator
    graph.on('cell:mouseenter', ({ cell }: { cell: Cell }) => {
      if (!this.selectedCells.has(cell.id)) {
        // Use centralized history coordinator to exclude visual effects from history
        this.historyCoordinator.executeVisualEffect(graph, () => {
          this.applyHoverEffect(cell);

          // Show ports for nodes during hover (if port state manager available)
          if (cell.isNode() && this.portStateManager) {
            this.portStateManager.showNodePorts(graph, cell);
          }
        });
      }
    });

    graph.on('cell:mouseleave', ({ cell }: { cell: Cell }) => {
      if (!this.selectedCells.has(cell.id)) {
        // Use centralized history coordinator to exclude visual effects from history
        this.historyCoordinator.executeVisualEffect(graph, () => {
          this.removeHoverEffect(cell);

          // Hide unconnected ports for nodes when hover ends (if port state manager available)
          if (cell.isNode() && this.portStateManager) {
            this.portStateManager.hideUnconnectedNodePorts(graph, cell);
          }
        });
      }
    });

    // Handle selection changes
    graph.on('selection:changed', ({ added, removed }: { added: Cell[]; removed: Cell[] }) => {
      // Use history coordinator to exclude all selection-related visual effects from history
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Batch all selection styling changes to prevent history pollution
        graph.batchUpdate(() => {
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

            // Hide ports for deselected nodes
            if (cell.isNode() && this.portStateManager) {
              this.portStateManager.hideUnconnectedNodePorts(graph, cell);
            }
          });
        });
      });

      this.logger.debugComponent('InfraX6SelectionAdapter', 'Selection changed - visual adapter', {
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
    // Use our internal selectedCells set to get the actual selected cells
    const cells: Cell[] = [];
    this.selectedCells.forEach(cellId => {
      const cell = graph.getCellById(cellId);
      if (cell) {
        cells.push(cell);
      }
    });
    return cells;
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
    this.logger.debugComponent('InfraX6SelectionAdapter', 'Selected cells', {
      count: cells.length,
    });
  }

  /**
   * Select all cells in the graph
   */
  selectAll(graph: Graph): void {
    const allCells = graph.getCells();
    this.selectCells(graph, allCells);
    this.logger.debugComponent('InfraX6SelectionAdapter', 'Selected all cells', {
      count: allCells.length,
    });
  }

  /**
   * Clear current selection
   */
  clearSelection(graph: Graph): void {
    // Get selected cells using our helper method and unselect them
    const selectedCells = this.getSelectedCells(graph);
    if (selectedCells.length > 0) {
      graph.unselect(selectedCells);
    }
    this.logger.debugComponent('InfraX6SelectionAdapter', 'Selection cleared');
  }

  /**
   * Delete selected cells
   */
  deleteSelected(graph: Graph): void {
    const selectedCells = this.getSelectedCells(graph);
    if (selectedCells.length === 0) {
      this.logger.debugComponent('InfraX6SelectionAdapter', 'No cells selected for deletion');
      return;
    }

    // Use history coordinator to ensure proper atomic deletion with port visibility suppression
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedCells.forEach(cell => {
          if (cell.isEdge()) {
            // Use InfraEdgeService for edge deletions (handles business logic and port visibility)
            this.infraEdgeService.removeEdge(graph, cell.id);
          } else {
            // Use InfraNodeService for node deletions if available (handles edges, embeddings, and all cleanup)
            if (this.infraNodeService && this.infraNodeService.removeNode) {
              this.infraNodeService.removeNode(graph, cell.id);
            } else {
              // Fallback to core operations if node service not yet injected
              this.x6CoreOps.removeCellObject(graph, cell);
            }
          }
        });
      },
      HISTORY_OPERATION_TYPES.MULTI_CELL_DELETE,
    );

    this.logger.debugComponent('InfraX6SelectionAdapter', 'Deleted selected cells', {
      count: selectedCells.length,
    });
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
      this.logger.debugComponent('InfraX6SelectionAdapter', 'No cells to paste');
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

      // For paste operations, use direct X6 addCell to preserve complex cell configurations
      // This is acceptable here as paste is a complex operation that needs to preserve
      // exact cell structure and relationships during copy/paste operations
      graph.addCell(cell);
      pastedCells.push(cell);
    });

    // Select the pasted cells
    this.selectCells(graph, pastedCells);
    this.logger.debugComponent('InfraX6SelectionAdapter', 'Pasted cells', {
      count: pastedCells.length,
    });
  }

  /**
   * Group selected cells using SelectionService business logic
   */
  groupSelected(graph: Graph): Node | null {
    const selectedNodes = this.getSelectedNodes(graph);

    if (!this.selectionService.canGroupNodes(selectedNodes)) {
      this.logger.debugComponent('InfraX6SelectionAdapter', 'Cannot group selected nodes');
      return null;
    }

    // Use SelectionService to calculate bounding box
    const boundingBox = this.selectionService.calculateGroupBoundingBox(selectedNodes);
    const groupConfig = this.selectionService.getGroupConfiguration(boundingBox);

    // Use centralized history coordinator for consistent filtering and atomic batching
    const groupNode = this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        // Create group node using InfraX6CoreOperationsService
        const createdGroupNode = this.x6CoreOps.addNode(graph, groupConfig);

        if (!createdGroupNode) {
          throw new Error('Failed to create group node');
        }

        // Add nodes to group
        selectedNodes.forEach(node => {
          createdGroupNode.addChild(node);
        });

        return createdGroupNode;
      },
      HISTORY_OPERATION_TYPES.GROUP_CREATE,
    );

    this.logger.debugComponent('InfraX6SelectionAdapter', 'Created group with nodes', {
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

    // Use centralized history coordinator for atomic ungrouping operation
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedNodes.forEach(node => {
          if (this.selectionService.canUngroupNode(node)) {
            const children = node.getChildren();
            if (children) {
              // Remove children from group
              children.forEach(child => {
                node.removeChild(child);
              });

              // Remove the group node using InfraX6CoreOperationsService
              this.x6CoreOps.removeCellObject(graph, node);

              this.logger.debugComponent('InfraX6SelectionAdapter', 'Ungrouped node', {
                groupId: node.id,
                childCount: children.length,
              });
            }
          }
        });
      },
      HISTORY_OPERATION_TYPES.GROUP_UNGROUP,
    );
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

    this.logger.debugComponent('InfraX6SelectionAdapter', 'Aligned nodes', {
      alignment,
      count: selectedNodes.length,
    });
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

    this.logger.debugComponent('InfraX6SelectionAdapter', 'Distributed nodes', {
      direction,
      count: selectedNodes.length,
    });
  }

  /**
   * Enable selection mode
   */
  enableSelection(graph: Graph): void {
    if (this.selectionPlugin) {
      this.selectionPlugin.enable();
      graph.enableSelection();
      this.logger.debugComponent('InfraX6SelectionAdapter', 'Selection mode enabled');
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
      this.logger.debugComponent('InfraX6SelectionAdapter', 'Selection mode disabled');
    }
  }

  /**
   * Apply hover effect to a cell
   */
  private applyHoverEffect(cell: Cell): void {
    if (cell.isNode()) {
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';
      if (nodeType === 'text-box') {
        // For text-box shapes, apply hover glow to text element since body is transparent
        cell.attr('text/filter', DFD_STYLING_HELPERS.getHoverFilter(nodeType));
      } else {
        // For all other node types, apply hover glow to body element
        cell.attr('body/filter', DFD_STYLING_HELPERS.getHoverFilter(nodeType));
      }
    } else if (cell.isEdge()) {
      // Add subtle red glow for edge hover
      cell.attr('line/filter', DFD_STYLING_HELPERS.getHoverFilter('edge'));
    }
  }

  /**
   * Remove hover effect from a cell
   */
  private removeHoverEffect(cell: Cell): void {
    if (cell.isNode()) {
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';
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
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';

      if (nodeType === 'text-box') {
        // For text-box shapes, apply glow to text element since body is transparent
        cell.attr('text/filter', DFD_STYLING_HELPERS.getSelectionFilter(nodeType));
      } else {
        // For all other node types, apply glow to body element
        cell.attr('body/filter', DFD_STYLING_HELPERS.getSelectionFilter(nodeType));
        cell.attr('body/strokeWidth', DFD_STYLING.SELECTION.STROKE_WIDTH);
        cell.attr('body/stroke', DFD_STYLING.SELECTION.STROKE_COLOR);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', DFD_STYLING_HELPERS.getSelectionFilter('edge'));
      cell.attr('line/strokeWidth', DFD_STYLING.SELECTION.STROKE_WIDTH);
      cell.attr('line/stroke', DFD_STYLING.SELECTION.STROKE_COLOR);
    }
  }

  /**
   * Remove selection effect from a cell
   */
  private removeSelectionEffect(cell: Cell): void {
    if (cell.isNode()) {
      // Use getNodeTypeInfo for reliable node type detection
      const nodeTypeInfo = (cell as any).getNodeTypeInfo();
      const nodeType = nodeTypeInfo?.type || 'unknown';
      if (nodeType === 'text-box') {
        // For text-box shapes, remove glow from text element
        cell.attr('text/filter', 'none');
      } else {
        // For all other node types, remove glow from body element
        cell.attr('body/filter', 'none');
        // Restore shape-specific default stroke width and color
        const defaultStrokeWidth = DFD_STYLING_HELPERS.getDefaultStrokeWidth(nodeType as NodeType);
        const defaultStroke = DFD_STYLING_HELPERS.getDefaultStroke(nodeType as NodeType);
        cell.attr('body/strokeWidth', defaultStrokeWidth);
        cell.attr('body/stroke', defaultStroke);
      }
    } else if (cell.isEdge()) {
      cell.attr('line/filter', 'none');
      cell.attr('line/strokeWidth', DFD_STYLING.DEFAULT_STROKE_WIDTH);
      cell.attr('line/stroke', DFD_STYLING.EDGES.DEFAULT_STROKE);
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
