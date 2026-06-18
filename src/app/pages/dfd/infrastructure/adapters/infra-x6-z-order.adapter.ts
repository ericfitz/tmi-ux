import { Injectable } from '@angular/core';
import { Graph, Node, Edge, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { ZOrderService } from '../services/infra-z-order.service';
import {
  AppOperationStateManager,
  HISTORY_OPERATION_TYPES,
} from '../../application/services/app-operation-state-manager.service';

/**
 * X6 Z-Order Adapter
 * Handles X6-specific z-order implementation
 * Works with ZOrderService for business logic
 *
 * Uses X6's standard 'shape' property for node type determination.
 */
@Injectable()
// SEM@822261a3efc4f8a3dd9938b78529667058f40c9e: manage z-order operations for DFD graph cells via X6 and history tracking
export class InfraX6ZOrderAdapter {
  // SEM@8902c3506b8553f7ac8aaedab9ff2ba264e06c93: inject logger, z-order service, and history coordinator dependencies (pure)
  constructor(
    private logger: LoggerService,
    private zOrderService: ZOrderService,
    private historyCoordinator: AppOperationStateManager,
  ) {}

  /**
   * Move selected cells forward in z-order
   */
  // SEM@a96b1b1f05df303c6b32b62e7a2b222e11785ee8: increment z-order of all selected graph cells by one step atomically (mutates shared state)
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
  // SEM@a96b1b1f05df303c6b32b62e7a2b222e11785ee8: decrement z-order of all selected graph cells by one step atomically (mutates shared state)
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
  // SEM@a96b1b1f05df303c6b32b62e7a2b222e11785ee8: move all selected graph cells to the highest z-order position atomically (mutates shared state)
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
  // SEM@a96b1b1f05df303c6b32b62e7a2b222e11785ee8: move all selected graph cells to the lowest z-order position atomically (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: recalculate and apply z-order of all edges connected to a node (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: set an edge z-order to the higher of its source or target node z-orders (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate and correct z-order so security boundaries stay behind other nodes (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate all diagram node z-indexes and correct violations (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: restore a node's z-index after drag without embedding, enforce invariants (mutates shared state)
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
  // SEM@0c4b0e63a2f170695121de276aae1d8887c94516: store original z-index and apply temporary embedding z-index to a node (mutates shared state)
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
   * Delegates to service for business logic
   */
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: apply calculated z-indexes to parent and child nodes on embedding (mutates shared state)
  applyEmbeddingZIndexes(parent: Node, child: Node): void {
    // Use service to calculate proper z-indexes
    const zIndexes = this.zOrderService.calculateEmbeddingZIndexes(parent, child);

    // Apply calculated z-indexes
    parent.setZIndex(zIndexes.parentZIndex);
    child.setZIndex(zIndexes.childZIndex);

    this.logger.info('Applied embedding z-indexes', {
      parentId: parent.id,
      parentZIndex: zIndexes.parentZIndex,
      childId: child.id,
      childZIndex: zIndexes.childZIndex,
    });
  }

  /**
   * Apply z-index for unembedding
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: reset a node and its edges to default z-index after unembedding (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: restore a security boundary's default z-index after it is unembedded (mutates shared state)
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
  // SEM@822261a3efc4f8a3dd9938b78529667058f40c9e: assign the default z-index to a newly created diagram node by type (mutates shared state)
  applyNodeCreationZIndex(graph: Graph, node: Node): void {
    // Get node type using getNodeTypeInfo for reliable node type detection
    // Default to 'unknown' for nodes without type info or when getNodeTypeInfo fails
    let nodeType = 'unknown';

    if (typeof (node as any).getNodeTypeInfo === 'function') {
      try {
        const nodeTypeInfo = (node as any).getNodeTypeInfo();
        nodeType = nodeTypeInfo?.type || 'unknown';
      } catch (error) {
        // If getNodeTypeInfo call fails, keep default 'unknown'
        this.logger.warn('Error calling getNodeTypeInfo extension', {
          nodeId: node.id,
          shape: node.shape,
          error,
        });
      }
    } else {
      // If getNodeTypeInfo method doesn't exist, log warning and keep default 'unknown'
      this.logger.warn('Node missing getNodeTypeInfo extension', {
        nodeId: node.id,
        shape: node.shape,
      });
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
   * Validate and correct all z-order relationships after diagram load
   * Runs comprehensive validation and fixes any violations
   */
  // SEM@41de72ef1c753a3e626b8cc587c272e5e4614a4a: validate and fix all z-order violations in a freshly loaded diagram (mutates shared state)
  validateAndCorrectLoadedDiagram(graph: Graph): {
    fixed: number;
    violations: Array<{ nodeId: string; issue: string; oldZIndex: number; newZIndex: number }>;
  } {
    const violations: Array<{
      nodeId: string;
      issue: string;
      oldZIndex: number;
      newZIndex: number;
    }> = [];
    let fixedCount = 0;

    this.logger.info('Validating z-order relationships after diagram load');

    const allNodes = graph.getNodes();

    // Run comprehensive validation
    const validationResult = this.zOrderService.validateComprehensiveZOrder(allNodes);

    if (validationResult.violations.length > 0) {
      this.logger.warn('Z-order violations detected in loaded diagram', {
        violationsCount: validationResult.violations.length,
        summary: validationResult.summary,
      });

      // Apply corrections
      validationResult.violations.forEach(violation => {
        const oldZIndex = violation.node.getZIndex() ?? 1;
        violation.node.setZIndex(violation.correctedZIndex);
        fixedCount++;

        violations.push({
          nodeId: violation.node.id,
          issue: violation.issue,
          oldZIndex,
          newZIndex: violation.correctedZIndex,
        });
      });
    }

    // Also run embedding hierarchy validation
    const embeddingViolations = this.zOrderService.validateEmbeddingZOrderHierarchy(allNodes);

    if (embeddingViolations.length > 0) {
      this.logger.warn('Embedding hierarchy z-order violations detected', {
        violationsCount: embeddingViolations.length,
      });

      embeddingViolations.forEach(violation => {
        const oldZIndex = violation.node.getZIndex() ?? 1;
        violation.node.setZIndex(violation.correctedZIndex);
        fixedCount++;

        violations.push({
          nodeId: violation.node.id,
          issue: violation.issue,
          oldZIndex,
          newZIndex: violation.correctedZIndex,
        });
      });
    }

    if (fixedCount > 0) {
      this.logger.warn('Fixed z-order violations in loaded diagram', {
        fixedCount,
        violations: violations.length,
      });
    } else {
      this.logger.info('All z-order relationships validated successfully');
    }

    return { fixed: fixedCount, violations };
  }

  /**
   * Set z-index for new security boundary
   * Rule: New security boundary shapes are created with a lower zIndex than the default zIndex for nodes and edges
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: assign the default low z-index to a new security boundary node (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: assign the type-appropriate default z-index to a new non-boundary node (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: assign a new edge's z-index as the max of its two connected nodes' z-indexes (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: recalculate and update an edge's z-index after it is reconnected to new nodes (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: apply child z-index on embedding and cascade updates to all descendants and edges (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate embedded nodes have higher z-index than parents and correct violations (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: recursively update z-indexes for all descendant nodes and their connected edges (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: increment a diagram cell's z-index by one step forward past non-selected cells (mutates shared state)
  private moveCellForward(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a diagram cell is currently selected in the graph (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: decrement a diagram cell's z-index by one step backward past non-selected cells (mutates shared state)
  private moveCellBackward(graph: Graph, cell: Cell): void {
    const allCells = [...graph.getNodes(), ...graph.getEdges()];
    // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: check whether a diagram cell is currently selected in the graph (pure)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: set a diagram cell's z-index to the maximum across all cells (mutates shared state)
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
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: set a diagram cell's z-index to the minimum across all cells (mutates shared state)
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

  /**
   * Recalculate z-order for all cells in the graph
   * Uses iterative algorithm to fix all z-index violations
   * Does NOT record changes in history (treated as visual effect)
   *
   * @param graph The X6 graph instance
   */
  // SEM@de544147454a028d516f46db42c16b0ca0b3a9a5: recompute z-indexes for all graph cells outside history, fixing all violations (mutates shared state)
  recalculateZOrder(graph: Graph): void {
    // Temporarily disable history recording
    const historyEnabled = (graph as any).isHistoryEnabled
      ? (graph as any).isHistoryEnabled()
      : false;
    if (historyEnabled) {
      (graph as any).disableHistory();
    }

    try {
      const cells = graph.getCells();
      this.zOrderService.recalculateZOrder(cells);
    } finally {
      // Re-enable history if it was enabled before
      if (historyEnabled && (graph as any).enableHistory) {
        (graph as any).enableHistory();
      }
    }
  }
}
