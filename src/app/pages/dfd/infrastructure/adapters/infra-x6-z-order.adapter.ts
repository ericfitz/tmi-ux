import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { ZOrderService } from '../services/infra-z-order.service';
import {
  AppGraphHistoryCoordinator,
  HISTORY_OPERATION_TYPES,
} from '../../application/services/app-graph-history-coordinator.service';

/**
 * X6 Z-Order Adapter
 * Handles X6-specific z-order implementation
 * Works with ZOrderService for business logic
 *
 * Uses X6's standard 'shape' property for node type determination.
 */
@Injectable()
export class InfraX6ZOrderAdapter {
  constructor(
    private logger: LoggerService,
    private zOrderService: ZOrderService,
    private historyCoordinator: AppGraphHistoryCoordinator,
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

    // Group all z-order changes into a single atomic operation
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedCells.forEach(cell => {
          this.moveCellForward(graph, cell);
        });
      },
      HISTORY_OPERATION_TYPES.Z_ORDER_FORWARD,
    );
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

    // Group all z-order changes into a single atomic operation
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedCells.forEach(cell => {
          this.moveCellBackward(graph, cell);
        });
      },
      HISTORY_OPERATION_TYPES.Z_ORDER_BACKWARD,
    );
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

    // Group all z-order changes into a single atomic operation
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedCells.forEach(cell => {
          this.moveCellToFront(graph, cell);
        });
      },
      HISTORY_OPERATION_TYPES.Z_ORDER_TO_FRONT,
    );
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

    // Group all z-order changes into a single atomic operation
    this.historyCoordinator.executeAtomicOperation(
      graph,
      () => {
        selectedCells.forEach(cell => {
          this.moveCellToBack(graph, cell);
        });
      },
      HISTORY_OPERATION_TYPES.Z_ORDER_TO_BACK,
    );
  }

  /**
   * Update the z-order of all edges connected to a node based on z-order rules
   * Rule: When the zIndex of a node is adjusted, every edge connected to that node has its zIndex
   * recalculated and set to the higher value of either the zIndex for the source node they connect to,
   * or the zIndex for the target node they connect to
   */
  updateConnectedEdgesZOrder(graph: Graph, node: Node, _nodeZIndex: number): void {
    const edges = graph.getConnectedEdges(node) || [];

    edges.forEach(edge => {
      // Get the source and target nodes to calculate proper z-index
      const sourceId = edge.getSourceCellId();
      const targetId = edge.getTargetCellId();

      if (sourceId && targetId) {
        const sourceNode = graph.getCellById(sourceId) as Node;
        const targetNode = graph.getCellById(targetId) as Node;

        if (sourceNode?.isNode() && targetNode?.isNode()) {
          const newZIndex = this.zOrderService.getNewEdgeZIndex(sourceNode, targetNode);
          edge.setZIndex(newZIndex);

          this.logger.info('Updated connected edge z-order using z-order rules', {
            nodeId: node.id,
            edgeId: edge.id,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            sourceZIndex: sourceNode.getZIndex() ?? 10,
            targetZIndex: targetNode.getZIndex() ?? 10,
            newZIndex,
          });
        }
      }
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

    // Use InfraEmbeddingService to get temporary z-index
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
   * Apply z-index for unembedded security boundary node
   * Rule: When a security boundary node is unembedded and is no longer the child of any other object,
   * its zIndex is set back to the default zIndex for security boundary nodes
   */
  applyUnembeddedSecurityBoundaryZIndex(graph: Graph, node: Node): void {
    const nodeZIndex = this.zOrderService.calculateUnembeddedSecurityBoundaryZIndex(node);
    node.setZIndex(nodeZIndex);

    // Update z-order for edges connected to the node to match the node's z-order
    this.updateConnectedEdgesZOrder(graph, node, nodeZIndex);

    this.logger.info('Applied unembedded security boundary z-index', {
      nodeId: node.id,
      nodeZIndex,
    });
  }

  /**
   * Apply proper z-index for newly created nodes based on node shape and context
   * Rule: New nodes get z-index based on their shape - security boundaries (1), regular nodes (10), text-boxes (20)
   * Uses X6's standard 'shape' property for type determination
   */
  applyNodeCreationZIndex(graph: Graph, node: Node): void {
    // Get node type using getNodeTypeInfo for reliable node type detection
    let nodeType = 'unknown'; // Default fallback for nodes without type info

    if (typeof (node as any).getNodeTypeInfo === 'function') {
      try {
        const nodeTypeInfo = (node as any).getNodeTypeInfo();
        nodeType = nodeTypeInfo?.type || 'unknown';
      } catch (error) {
        // If getNodeTypeInfo call fails, default to 'unknown'
        this.logger.warn('Error calling getNodeTypeInfo extension', {
          nodeId: node.id,
          shape: node.shape,
          error,
        });
        nodeType = 'unknown';
      }
    } else {
      // If getNodeTypeInfo method doesn't exist, log warning and default to 'unknown'
      this.logger.warn('Node missing getNodeTypeInfo extension', {
        nodeId: node.id,
        shape: node.shape,
      });
      nodeType = 'unknown';
    }

    // Use getDefaultZIndex for all node types
    const zIndex = this.zOrderService.getDefaultZIndex(nodeType);

    node.setZIndex(zIndex);
    this.logger.info('Applied node creation z-index', {
      nodeId: node.id,
      nodeType,
      zIndex,
    });
  }

  /**
   * Set z-index for new security boundary
   * Rule: New security boundary shapes are created with a lower zIndex than the default zIndex for nodes and edges
   */
  setNewSecurityBoundaryZIndex(node: Node): void {
    const zIndex = this.zOrderService.getDefaultZIndex('security-boundary');
    node.setZIndex(zIndex);

    this.logger.info('Set new security boundary z-index', {
      nodeId: node.id,
      zIndex,
    });
  }

  /**
   * Set z-index for new node
   * Rule: New nodes (other than security boundaries) get a higher default zIndex than security boundary nodes
   */
  setNewNodeZIndex(node: Node, nodeType: string): void {
    const zIndex = this.zOrderService.getDefaultZIndex(nodeType);
    node.setZIndex(zIndex);

    this.logger.info('Set new node z-index', {
      nodeId: node.id,
      nodeType,
      zIndex,
    });
  }

  /**
   * Set z-index for new edge based on connected nodes
   * Rule: The zIndex of new edges gets set to the higher value of either the zIndex for the source node
   * they connect to, or the zIndex for the target node they connect to
   */
  setNewEdgeZIndex(edge: Edge, sourceNode: Node, targetNode: Node): void {
    const zIndex = this.zOrderService.getNewEdgeZIndex(sourceNode, targetNode);
    edge.setZIndex(zIndex);

    this.logger.info('Set new edge z-index based on connected nodes', {
      edgeId: edge.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceZIndex: sourceNode.getZIndex() ?? 10,
      targetZIndex: targetNode.getZIndex() ?? 10,
      edgeZIndex: zIndex,
    });
  }

  /**
   * Update edge z-index on reconnection
   * Rule: On reconnecting an edge, the zIndex of the edge is recalculated and set to the higher value
   * of either the zIndex for the source node they connect to, or the zIndex for the target node they connect to
   */
  updateEdgeZIndexOnReconnection(edge: Edge, sourceNode: Node, targetNode: Node): void {
    const newZIndex = this.zOrderService.updateEdgeZIndexOnReconnection(
      edge,
      sourceNode,
      targetNode,
    );
    edge.setZIndex(newZIndex);

    this.logger.info('Updated edge z-index on reconnection', {
      edgeId: edge.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      newZIndex,
    });
  }

  /**
   * Apply embedding z-index with cascading updates
   * Rule: On embedding, the zIndex of the new child node is set to at least one higher than the zIndex
   * of the new parent node. This triggers cascading recalculation of zIndex values for edges connected
   * to the new child node, and then recursively to child nodes of that node and their connected edges
   */
  applyEmbeddingZIndexWithCascading(graph: Graph, parent: Node, child: Node): void {
    // Calculate and set the child's z-index
    const childZIndex = this.zOrderService.calculateEmbeddedNodeZIndex(parent, child);
    child.setZIndex(childZIndex);

    // Update connected edges for the child
    this.updateConnectedEdgesZOrder(graph, child, childZIndex);

    // Recursively update descendant nodes and their edges
    this.updateDescendantNodesZIndex(graph, child);

    this.logger.info('Applied embedding z-index with cascading updates', {
      parentId: parent.id,
      childId: child.id,
      childZIndex,
    });
  }

  /**
   * Validate and correct embedding z-order hierarchy
   * Ensures embedded nodes have higher z-index than their parents
   */
  validateAndCorrectEmbeddingHierarchy(graph: Graph): void {
    const nodes = graph.getNodes();
    const violations = this.zOrderService.validateEmbeddingZOrderHierarchy(nodes);

    violations.forEach(({ node, issue, correctedZIndex }) => {
      const currentZIndex = node.getZIndex() ?? 10;
      node.setZIndex(correctedZIndex);

      // Update connected edges
      this.updateConnectedEdgesZOrder(graph, node, correctedZIndex);

      this.logger.warn('Corrected embedding hierarchy z-order violation', {
        nodeId: node.id,
        issue,
        previousZIndex: currentZIndex,
        correctedZIndex,
      });
    });

    if (violations.length > 0) {
      this.logger.warn('Embedding hierarchy z-order violations corrected', {
        violationsCount: violations.length,
      });
    }
  }

  /**
   * Recursively update z-index for descendant nodes and their connected edges
   * Supporting method for cascading z-index updates during embedding
   */
  private updateDescendantNodesZIndex(graph: Graph, parentNode: Node): void {
    const descendants = this.zOrderService.getDescendantNodesForCascadingUpdate(parentNode);

    descendants.forEach(descendant => {
      const descendantParent = descendant.getParent();
      if (descendantParent && descendantParent.isNode()) {
        const newZIndex = this.zOrderService.calculateEmbeddedNodeZIndex(
          descendantParent,
          descendant,
        );
        descendant.setZIndex(newZIndex);

        // Update connected edges for this descendant
        this.updateConnectedEdgesZOrder(graph, descendant, newZIndex);

        this.logger.info('Updated descendant node z-index', {
          descendantId: descendant.id,
          parentId: descendantParent.id,
          newZIndex,
        });
      }
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
