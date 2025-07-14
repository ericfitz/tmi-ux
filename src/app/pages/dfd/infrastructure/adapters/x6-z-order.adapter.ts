import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { ZOrderService } from '../services/z-order.service';

/**
 * X6 Z-Order Adapter
 * Handles X6-specific z-order implementation
 * Works with ZOrderService for business logic
 */
@Injectable()
export class X6ZOrderAdapter {
  constructor(
    private logger: LoggerService,
    private zOrderService: ZOrderService,
  ) {}

  /**
   * Move selected cells forward in z-order
   */
  moveSelectedCellsForward(graph: Graph): void {
    const selectedCells = graph.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move forward operation');
      return;
    }

    this.logger.info('Moving selected cells forward', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this.moveCellForward(graph, cell);
    });
  }

  /**
   * Move selected cells backward in z-order
   */
  moveSelectedCellsBackward(graph: Graph): void {
    const selectedCells = graph.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move backward operation');
      return;
    }

    this.logger.info('Moving selected cells backward', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this.moveCellBackward(graph, cell);
    });
  }

  /**
   * Move selected cells to front
   */
  moveSelectedCellsToFront(graph: Graph): void {
    const selectedCells = graph.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to front operation');
      return;
    }

    this.logger.info('Moving selected cells to front', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this.moveCellToFront(graph, cell);
    });
  }

  /**
   * Move selected cells to back
   */
  moveSelectedCellsToBack(graph: Graph): void {
    const selectedCells = graph.getSelectedCells();
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for move to back operation');
      return;
    }

    this.logger.info('Moving selected cells to back', {
      selectedCellIds: selectedCells.map(cell => cell.id),
    });

    selectedCells.forEach(cell => {
      this.moveCellToBack(graph, cell);
    });
  }

  /**
   * Update the z-order of all edges connected to a node to match the node's z-order
   */
  updateConnectedEdgesZOrder(graph: Graph, node: Node, zIndex: number): void {
    const edges = graph.getConnectedEdges(node) || [];
    edges.forEach(edge => {
      edge.setZIndex(zIndex);
      this.logger.info('Updated connected edge z-order', {
        nodeId: node.id,
        edgeId: edge.id,
        newZIndex: zIndex,
      });
    });
  }

  /**
   * Set the z-order of an edge to the higher of its source or target node z-orders
   */
  setEdgeZOrderFromConnectedNodes(graph: Graph, edge: Edge): void {
    const sourceId = edge.getSourceCellId();
    const targetId = edge.getTargetCellId();

    if (!sourceId || !targetId) {
      this.logger.warn('Cannot set edge z-order: missing source or target', {
        edgeId: edge.id,
        sourceId,
        targetId,
      });
      return;
    }

    const sourceNode = graph.getCellById(sourceId) as Node;
    const targetNode = graph.getCellById(targetId) as Node;

    if (!sourceNode?.isNode() || !targetNode?.isNode()) {
      this.logger.warn('Cannot set edge z-order: source or target is not a node', {
        edgeId: edge.id,
        sourceIsNode: sourceNode?.isNode(),
        targetIsNode: targetNode?.isNode(),
      });
      return;
    }

    // Safety check for test environment where getZIndex might not exist
    const sourceZIndex =
      typeof sourceNode.getZIndex === 'function' ? (sourceNode.getZIndex() ?? 1) : 1;
    const targetZIndex =
      typeof targetNode.getZIndex === 'function' ? (targetNode.getZIndex() ?? 1) : 1;

    const edgeZIndex = this.zOrderService.calculateEdgeZIndex(sourceZIndex, targetZIndex);

    // Safety check for test environment where setZIndex might not exist
    if (typeof edge.setZIndex === 'function') {
      edge.setZIndex(edgeZIndex);
    }

    this.logger.info('Set edge z-order from connected nodes', {
      edgeId: edge.id,
      sourceNodeId: sourceId,
      targetNodeId: targetId,
      sourceZIndex,
      targetZIndex,
      edgeZIndex,
    });
  }

  /**
   * Enforce z-order invariants to ensure security boundaries are always behind other nodes
   */
  enforceZOrderInvariants(graph: Graph): void {
    const nodes = graph.getNodes();
    const corrections = this.zOrderService.validateZOrderInvariants(nodes);

    let correctionsMade = false;
    corrections.forEach(({ node, correctedZIndex }) => {
      const currentZIndex = node.getZIndex() ?? 1;
      node.setZIndex(correctedZIndex);
      this.updateConnectedEdgesZOrder(graph, node, correctedZIndex);
      correctionsMade = true;

      this.logger.info('Corrected z-order to maintain invariant', {
        nodeId: node.id,
        previousZIndex: currentZIndex,
        correctedZIndex,
      });
    });

    if (correctionsMade) {
      this.logger.info('Z-order invariants enforced', {
        correctionsCount: corrections.length,
      });
    }
  }

  /**
   * Validate and correct z-order for all nodes in the graph
   */
  validateAndCorrectZOrder(graph: Graph): void {
    this.logger.info('Starting comprehensive z-order validation and correction');

    const nodes = graph.getNodes();
    const validation = this.zOrderService.validateComprehensiveZOrder(nodes);

    // Apply corrections
    validation.violations.forEach(({ node, issue, correctedZIndex }) => {
      const currentZIndex = node.getZIndex() ?? 1;
      node.setZIndex(correctedZIndex);
      this.updateConnectedEdgesZOrder(graph, node, correctedZIndex);

      this.logger.warn('Z-order violation corrected', {
        nodeId: node.id,
        issue,
        previousZIndex: currentZIndex,
        correctedZIndex,
      });
    });

    if (validation.violations.length > 0) {
      this.logger.warn('Z-order violations found and corrected', {
        violationsCount: validation.violations.length,
        violations: validation.violations.map(v => ({
          nodeId: v.node.id,
          issue: v.issue,
          correctedZIndex: v.correctedZIndex,
        })),
        summary: validation.summary,
      });
    } else {
      this.logger.info('Z-order validation completed - no violations found', {
        summary: validation.summary,
      });
    }
  }

  /**
   * Handle z-order restoration after node movement without embedding
   */
  handleNodeMovedZOrderRestoration(graph: Graph, node: Node): void {
    // Safety check for test environment where getData might not exist
    if (typeof node.getData !== 'function') {
      return;
    }

    // Check if this node has a stored original z-index from embedding attempt
    const originalZIndexValue = (node as any).getApplicationMetadata
      ? (node as any).getApplicationMetadata('_originalZIndex')
      : '';
    const originalZIndex = originalZIndexValue ? Number(originalZIndexValue) : null;

    // If we have an original z-index stored and the node is not currently embedded,
    // restore the original z-index (this handles the case where dragging was just for movement)
    if (typeof originalZIndex === 'number' && !isNaN(originalZIndex) && !node.getParent()) {
      // Get the node type to determine the correct default z-index
      const nodeType = (node as any).getNodeTypeInfo
        ? (node as any).getNodeTypeInfo().type
        : 'process';

      // Use ZOrderService to get correct z-index
      const correctZIndex = nodeType === 'security-boundary' ? 1 : originalZIndex;

      // Only update if the current z-index is different from what it should be
      const currentZIndex = node.getZIndex() ?? 1;
      if (currentZIndex !== correctZIndex) {
        node.setZIndex(correctZIndex);
        // Update z-order for connected edges to match the restored node z-order
        this.updateConnectedEdgesZOrder(graph, node, correctZIndex);

        this.logger.info('Restored correct z-index after drag without embedding', {
          nodeId: node.id,
          nodeType,
          previousZIndex: currentZIndex,
          restoredZIndex: correctZIndex,
          wasSecurityBoundary: nodeType === 'security-boundary',
        });
      }

      // Clean up the temporary metadata
      if ((node as any).setApplicationMetadata) {
        (node as any).setApplicationMetadata('_originalZIndex', '');
      }
    }

    // Always enforce z-order invariants after any node movement
    this.enforceZOrderInvariants(graph);
  }

  /**
   * Set temporary z-index for embedding operation
   */
  setTemporaryEmbeddingZIndex(node: Node): void {
    // Store the original z-index before temporarily changing it using metadata
    const originalZIndex = node.getZIndex();
    if ((node as any).setApplicationMetadata) {
      (node as any).setApplicationMetadata('_originalZIndex', String(originalZIndex));
    }

    // Use EmbeddingService to get temporary z-index
    const tempZIndex = this.zOrderService.getDefaultZIndex('security-boundary'); // This will be enhanced
    node.setZIndex(tempZIndex);
  }

  /**
   * Apply z-index changes for embedding
   */
  applyEmbeddingZIndexes(parent: Node, child: Node): void {
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
      parent.setZIndex(parentZIndex);
    } else {
      parentZIndex = 10;
      parent.setZIndex(parentZIndex);
    }

    // Child gets appropriate z-index based on type
    let childZIndex: number;
    if (childType === 'security-boundary') {
      // Security boundaries should always stay behind, even when embedded
      childZIndex = 2; // Slightly higher than non-embedded security boundaries but still behind regular nodes
      child.setZIndex(childZIndex);
    } else {
      childZIndex = 15; // Regular nodes appear in front when embedded
      child.setZIndex(childZIndex);
    }

    this.logger.info('Applied embedding z-indexes', {
      parentId: parent.id,
      parentType,
      parentZIndex,
      childId: child.id,
      childType,
      childZIndex,
    });
  }

  /**
   * Apply z-index for unembedding
   */
  applyUnembeddingZIndex(graph: Graph, node: Node): void {
    const nodeType = (node as any).getNodeTypeInfo
      ? (node as any).getNodeTypeInfo().type
      : 'process';

    // Reset to default z-index based on type
    const nodeZIndex = this.zOrderService.getDefaultZIndex(nodeType);
    node.setZIndex(nodeZIndex);

    // Update z-order for edges connected to the node to match the node's z-order
    this.updateConnectedEdgesZOrder(graph, node, nodeZIndex);

    this.logger.info('Applied unembedding z-index', {
      nodeId: node.id,
      nodeType,
      nodeZIndex,
    });
  }

  /**
   * Move a single cell forward in z-order
   */
  private moveCellForward(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSelected = (c: Cell) => graph.isSelected(c);

    const newZIndex = this.zOrderService.calculateMoveForwardZIndex(cell, allCells, isSelected);

    if (newZIndex !== null) {
      const currentZIndex = cell.getZIndex() ?? 1;
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell forward', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    }

    // Enforce z-order invariants after manual z-order changes
    this.enforceZOrderInvariants(graph);
  }

  /**
   * Move a single cell backward in z-order
   */
  private moveCellBackward(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    const isSelected = (c: Cell) => graph.isSelected(c);

    const newZIndex = this.zOrderService.calculateMoveBackwardZIndex(cell, allCells, isSelected);

    if (newZIndex !== null) {
      const currentZIndex = cell.getZIndex() ?? 1;
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell backward', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    }

    // Enforce z-order invariants after manual z-order changes
    this.enforceZOrderInvariants(graph);
  }

  /**
   * Move a single cell to the front
   */
  private moveCellToFront(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];

    const newZIndex = this.zOrderService.calculateMoveToFrontZIndex(cell, allCells);

    if (newZIndex !== null) {
      const currentZIndex = cell.getZIndex() ?? 1;
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell to front', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    }
  }

  /**
   * Move a single cell to the back
   */
  private moveCellToBack(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];

    const newZIndex = this.zOrderService.calculateMoveToBackZIndex(cell, allCells);

    if (newZIndex !== null) {
      const currentZIndex = cell.getZIndex() ?? 1;
      cell.setZIndex(newZIndex);
      this.logger.info('Moved cell to back', {
        cellId: cell.id,
        oldZIndex: currentZIndex,
        newZIndex,
      });
    }
  }
}
