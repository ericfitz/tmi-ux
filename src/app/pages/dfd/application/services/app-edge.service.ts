/**
 * Application Edge Service
 *
 * This application service orchestrates edge management functionality for DFD diagrams.
 * It coordinates between domain business rules and infrastructure implementations.
 *
 * Key functionality:
 * - Orchestrates edge creation and validation workflows
 * - Coordinates between domain rules and infrastructure adapters
 * - Manages edge lifecycle operations and state transitions
 * - Handles DFD-specific connection validation logic
 * - Coordinates with infrastructure services for X6 graph operations
 * - Manages edge styling, labels, and visual effects
 * - Orchestrates inverse connection creation workflows
 * - Integrates domain validation with infrastructure execution
 * - Handles remote operation coordination via WebSocket
 * - Manages edge operation history and state consistency
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Graph, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import { InfraX6ZOrderAdapter } from '../../infrastructure/adapters/infra-x6-z-order.adapter';
import { InfraX6HistoryAdapter } from '../../infrastructure/adapters/infra-x6-history.adapter';
import { InfraVisualEffectsService } from '../../infrastructure/services/infra-visual-effects.service';
import { InfraEdgeService } from '../../infrastructure/services/infra-edge.service';
import { EdgeInfo } from '../../domain/value-objects/edge-info';
import {
  GraphHistoryCoordinator,
  HISTORY_OPERATION_TYPES,
} from '../../services/graph-history-coordinator.service';

/**
 * Interface for connection validation arguments from X6
 */
export interface ConnectionValidationArgs {
  sourceView: any;
  targetView: any;
  sourceMagnet: Element;
  targetMagnet: Element;
}

/**
 * Interface for magnet validation arguments from X6
 */
export interface MagnetValidationArgs {
  magnet: Element;
}

/**
 * Consolidated service for edge handling, operations, and management in DFD diagrams
 * Combines the functionality of DfdEdgeManagerService and X6EdgeOperations
 */
@Injectable()
export class AppEdgeService {
  /**
   * Valid DFD node shape types
   */
  private readonly validNodeShapes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];

  /**
   * DFD connection rules - which shapes can connect to which other shapes
   */
  private readonly connectionRules: Record<string, string[]> = {
    process: ['store', 'actor', 'process'],
    store: ['process'],
    actor: ['process'],
  };

  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private infraX6ZOrderAdapter: InfraX6ZOrderAdapter,
    private infraX6HistoryAdapter: InfraX6HistoryAdapter,
    private infraVisualEffectsService: InfraVisualEffectsService,
    private infraEdgeService: InfraEdgeService,
    private historyCoordinator: GraphHistoryCoordinator,
  ) {}

  // ========================================
  // High-level Edge Management Methods
  // ========================================

  /**
   * Handle edge added events from the graph adapter
   * Now simplified to just validate the edge without domain model sync
   */
  handleEdgeAdded(
    edge: Edge,
    graph: Graph,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle edge added: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Check if this edge was created by user interaction (drag-connect)
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Edge added without valid source or target nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      // Remove the invalid edge from the graph using InfraEdgeService
      this.infraEdgeService.removeEdge(graph, edge.id);
      throw new Error('Edge added without valid source or target nodes');
    }

    // Verify that the source and target nodes actually exist in the graph
    const sourceNode = graph.getCellById(sourceNodeId) as Node;
    const targetNode = graph.getCellById(targetNodeId) as Node;

    if (!sourceNode || !targetNode || !sourceNode.isNode() || !targetNode.isNode()) {
      this.logger.warn('Edge references non-existent nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
        sourceNodeExists: !!(sourceNode && sourceNode.isNode()),
        targetNodeExists: !!(targetNode && targetNode.isNode()),
      });
      // Remove the invalid edge from the graph using InfraEdgeService
      this.infraEdgeService.removeEdge(graph, edge.id);
      throw new Error('Edge references non-existent nodes');
    }

    // Set default label for newly created edges if they don't have one
    const currentLabel = this.getEdgeLabel(edge);
    this.logger.debug('Edge label check on creation', {
      edgeId: edge.id,
      currentLabel,
      hasGetLabel: !!(edge as any).getLabel,
      hasSetLabel: !!(edge as any).setLabel,
    });

    if (!currentLabel || currentLabel.trim() === '') {
      const defaultLabel = this.getLocalizedFlowLabel();

      this.logger.info('Setting default label for new edge', {
        edgeId: edge.id,
        defaultLabel,
        currentLanguage: this.transloco.getActiveLang(),
        beforeUpdate: currentLabel,
      });

      // Set the label as a visual effect (without creating separate history entry)
      // This makes edge creation + label setting atomic in the history
      this.historyCoordinator.executeVisualEffect(graph, () => {
        this.updateEdgeLabel(edge, defaultLabel);
      });

      // Verify the label was set
      const verifyLabel = this.getEdgeLabel(edge);
      this.logger.info('Default label set verification', {
        edgeId: edge.id,
        expectedLabel: defaultLabel,
        actualLabel: verifyLabel,
        success: verifyLabel === defaultLabel,
      });
    } else {
      this.logger.debug('Edge already has label, skipping default', {
        edgeId: edge.id,
        existingLabel: currentLabel,
      });
    }

    this.logger.info('Edge validated successfully', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
      label: this.getEdgeLabel(edge),
    });

    return of(void 0);
  }

  /**
   * Handle edge vertices changes from the graph adapter
   * Now simplified to just log the change without domain model sync
   */
  handleEdgeVerticesChanged(
    edgeId: string,
    vertices: Array<{ x: number; y: number }>,
    graph: Graph,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot handle edge vertices changed: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    this.logger.info('Edge vertices changed', {
      edgeId,
      vertexCount: vertices.length,
      vertices,
    });

    // Verify the edge still exists
    const edge = graph.getCellById(edgeId) as Edge;
    if (!edge || !edge.isEdge()) {
      this.logger.warn('Edge not found for vertices update', { edgeId });
      throw new Error('Edge not found for vertices update');
    }

    this.logger.info('Edge vertices updated successfully', {
      edgeId,
      vertexCount: vertices.length,
    });

    return of(void 0);
  }

  /**
   * Add an inverse connection for the specified edge
   * Now works directly with X6 without domain model sync
   * All operations are batched into a single history command
   */
  addInverseConnection(edge: Edge, graph: Graph, _diagramId: string): Observable<void> {
    const sourceNodeId = edge.getSourceCellId();
    const targetNodeId = edge.getTargetCellId();
    const sourcePortId = edge.getSourcePortId();
    const targetPortId = edge.getTargetPortId();

    if (!sourceNodeId || !targetNodeId) {
      this.logger.warn('Cannot create inverse connection: edge missing source or target', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
      });
      throw new Error('Cannot create inverse connection: edge missing source or target');
    }

    this.logger.info('Creating inverse connection for edge', {
      originalEdgeId: edge.id,
      originalSource: sourceNodeId,
      originalTarget: targetNodeId,
      originalSourcePort: sourcePortId,
      originalTargetPort: targetPortId,
    });

    // Get the original edge's vertices and label
    const originalVertices = edge.getVertices();
    const originalLabel = (edge as any).getLabel() || this.getLocalizedFlowLabel();

    // Process label for inverse edge
    const inverseLabel = this._processLabelForInverse(originalLabel);

    // Generate a new UUID for the inverse edge
    const inverseEdgeId = uuidv4();

    try {
      // Execute all inverse connection operations as a single atomic operation
      const inverseEdge = this.historyCoordinator.executeAtomicOperation(
        graph,
        () => {
          // Step 1: Process the original edge vertices if needed (inside transaction)
          let processedOriginalVertices = [...originalVertices];
          if (originalVertices.length === 0) {
            // Add a vertex at the center and move it perpendicular to the source-destination line
            processedOriginalVertices = this._addCenterVertexToStraightEdge(edge);
            // Update the original edge with the new vertex
            edge.setVertices(processedOriginalVertices);
          }

          // Step 2: Calculate mirrored vertices for the inverse edge
          const inverseVertices = this._mirrorVerticesAroundSourceTargetLine(
            processedOriginalVertices,
            edge,
          );

          // Step 3: Create inverse EdgeInfo domain object (without label initially)
          const inverseEdgeInfo = EdgeInfo.create({
            id: inverseEdgeId,
            sourceNodeId: targetNodeId, // Swap source and target for inverse
            targetNodeId: sourceNodeId,
            sourcePortId: targetPortId,
            targetPortId: sourcePortId,
            vertices: inverseVertices,
          });

          // Step 4: Create the inverse edge via InfraEdgeService (suppress history since we're in atomic operation)
          const createdInverseEdge = this.infraEdgeService.createEdge(graph, inverseEdgeInfo, {
            ensureVisualRendering: true,
            updatePortVisibility: true,
          });

          // Step 5: Set the label using the utility function (inside same transaction)
          this.updateEdgeLabel(createdInverseEdge, inverseLabel);

          return createdInverseEdge;
        },
        HISTORY_OPERATION_TYPES.EDGE_ADD_INVERSE,
      );

      // Apply visual effects (z-order and highlighting) outside of history
      this.historyCoordinator.executeVisualEffect(graph, () => {
        // Apply proper zIndex using the same logic as normal edge creation
        this.infraX6ZOrderAdapter.setEdgeZOrderFromConnectedNodes(graph, inverseEdge);

        // Apply creation highlight effect for programmatically created inverse edges
        this.infraVisualEffectsService.applyCreationHighlight(inverseEdge, graph);
      });

      this.logger.info(
        'Inverse edge created successfully with atomic operation (edge creation, vertex processing, and label setting)',
        {
          originalEdgeId: edge.id,
          inverseEdgeId,
          newSource: targetNodeId,
          newTarget: sourceNodeId,
          newSourcePort: targetPortId,
          newTargetPort: sourcePortId,
          originalVertexCount: originalVertices.length,
          inverseVertexCount:
            inverseEdge && typeof inverseEdge.getVertices === 'function'
              ? inverseEdge.getVertices().length
              : 'N/A (mock)',
          originalLabel,
          inverseLabel,
          atomicOperationUsed: true,
        },
      );

      return of(void 0);
    } catch (error) {
      this.logger.error('Error creating inverse edge directly in X6', error);
      throw error;
    }
  }

  /**
   * Add a vertex at the geometric center of a straight edge and move it perpendicular to the edge line
   */
  private _addCenterVertexToStraightEdge(edge: Edge): Array<{ x: number; y: number }> {
    // Get the actual geometric points where the edge connects to the nodes
    const sourcePoint = edge.getSourcePoint();
    const targetPoint = edge.getTargetPoint();

    if (!sourcePoint || !targetPoint) {
      this.logger.warn('Cannot add center vertex: unable to get edge connection points');
      return [];
    }

    // Calculate the geometric center of the edge
    const centerX = (sourcePoint.x + targetPoint.x) / 2;
    const centerY = (sourcePoint.y + targetPoint.y) / 2;

    // Calculate the direction vector of the edge
    const dx = targetPoint.x - sourcePoint.x;
    const dy = targetPoint.y - sourcePoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) {
      // If source and target are at the same position, just offset vertically
      return [{ x: centerX, y: centerY - 15 }];
    }

    // Create perpendicular vector (rotate 90 degrees)
    const perpX = -dy / length; // Perpendicular vector
    const perpY = dx / length;

    // Move 15 pixels perpendicular from the geometric center
    const vertexX = centerX + perpX * 15;
    const vertexY = centerY - perpY * 15;

    return [{ x: vertexX, y: vertexY }];
  }

  /**
   * Mirror vertices around the line from source connection point to target connection point
   */
  private _mirrorVerticesAroundSourceTargetLine(
    originalVertices: Array<{ x: number; y: number }>,
    edge: Edge,
  ): Array<{ x: number; y: number }> {
    // Get the actual geometric points where the edge connects to the nodes
    const sourcePoint = edge.getSourcePoint();
    const targetPoint = edge.getTargetPoint();

    if (!sourcePoint || !targetPoint) {
      this.logger.warn('Cannot mirror vertices: unable to get edge connection points');
      return [];
    }

    // Calculate line parameters for mirroring using actual connection points
    const lineStartX = sourcePoint.x;
    const lineStartY = sourcePoint.y;
    const lineDx = targetPoint.x - sourcePoint.x;
    const lineDy = targetPoint.y - sourcePoint.y;

    // Mirror each vertex
    return originalVertices.map(vertex => {
      // Vector from line start to point
      const pointDx = vertex.x - lineStartX;
      const pointDy = vertex.y - lineStartY;

      // Project the point onto the line
      const lineLengthSquared = lineDx * lineDx + lineDy * lineDy;
      if (lineLengthSquared === 0) {
        // If line has no length, return the point as is
        return { x: vertex.x, y: vertex.y };
      }

      const t = (pointDx * lineDx + pointDy * lineDy) / lineLengthSquared;
      const projectionX = lineStartX + t * lineDx;
      const projectionY = lineStartY + t * lineDy;

      // Calculate the mirrored point
      const mirroredX = 2 * projectionX - vertex.x;
      const mirroredY = 2 * projectionY - vertex.y;

      return { x: mirroredX, y: mirroredY };
    });
  }

  /**
   * Process label for inverse edge, swapping request/query with response/reply
   */
  private _processLabelForInverse(originalLabel: string): string {
    if (!originalLabel || originalLabel.trim() === '') {
      return originalLabel;
    }

    const label = originalLabel.trim();

    // Check if the label ends with request or query (case-insensitive)
    if (/\brequest$/i.test(label)) {
      return label.replace(/\brequest$/i, 'response');
    } else if (/\bquery$/i.test(label)) {
      return label.replace(/\bquery$/i, 'response');
    }
    // Check if the label ends with response or reply (case-insensitive)
    else if (/\bresponse$/i.test(label)) {
      return label.replace(/\bresponse$/i, 'request');
    } else if (/\breply$/i.test(label)) {
      return label.replace(/\breply$/i, 'request');
    }

    // If none of the patterns match, return the original label
    return originalLabel;
  }

  // ========================================
  // Low-level X6 Edge Operations
  // ========================================

  /**
   * Create an edge between two nodes
   * All operations are batched into a single history command
   */
  createEdge(
    graph: Graph,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
    label?: string,
  ): Edge | null {
    try {
      const sourceNode = graph.getCellById(sourceNodeId) as Node;
      const targetNode = graph.getCellById(targetNodeId) as Node;

      if (!sourceNode || !targetNode) {
        this.logger.error('Source or target node not found', {
          sourceNodeId,
          targetNodeId,
        });
        return null;
      }

      // Business logic validation (DFD-specific rules - kept in application layer)
      if (!this.validateConnection(sourceNode, targetNode)) {
        this.logger.warn('Invalid connection attempt', {
          sourceType: sourceNode.shape,
          targetType: targetNode.shape,
        });
        return null;
      }

      // Generate unique edge ID
      const edgeId = uuidv4();

      // Create EdgeInfo domain object with DFD-specific defaults
      const edgeInfo = EdgeInfo.create({
        id: edgeId,
        sourceNodeId,
        targetNodeId,
        sourcePortId: sourcePortId || 'right',
        targetPortId: targetPortId || 'left',
        label: label || this.getLocalizedFlowLabel(),
      });

      // Delegate to InfraEdgeService for X6 operations (proper layered architecture)
      const createdEdge = this.infraEdgeService.createEdge(graph, edgeInfo, {
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });

      // Apply DFD-specific visual effects (application layer responsibility)
      this.infraVisualEffectsService.applyCreationHighlight(createdEdge, graph);

      this.logger.info('Edge created successfully via InfraEdgeService', {
        edgeId: createdEdge.id,
        sourceNodeId,
        targetNodeId,
        sourcePortId: edgeInfo.source.port,
        targetPortId: edgeInfo.target.port,
        label,
      });

      return createdEdge;
    } catch (error) {
      this.logger.error('Failed to create edge', {
        error,
        sourceNodeId,
        targetNodeId,
        sourcePortId,
        targetPortId,
      });
      return null;
    }
  }

  /**
   * Validate if a connection between two nodes is allowed
   */
  validateConnection(sourceNode: Node, targetNode: Node): boolean {
    return this.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Update edge label
   */
  updateEdgeLabel(edge: Edge, label: string): void {
    try {
      // Use standardized setLabel method from x6-cell-extensions
      if ((edge as any).setLabel) {
        (edge as any).setLabel(label);
      } else {
        this.logger.warn('Edge does not support setLabel method', { edgeId: edge.id });
      }

      this.logger.info('Edge label updated', { edgeId: edge.id, label });
    } catch (error) {
      this.logger.error('Failed to update edge label', { error, edgeId: edge.id, label });
    }
  }

  /**
   * Remove edge label
   */
  removeEdgeLabel(edge: Edge): void {
    try {
      // Use standardized setLabel method to set empty label
      if ((edge as any).setLabel) {
        (edge as any).setLabel('');
      } else {
        this.logger.warn('Edge does not support setLabel method', { edgeId: edge.id });
      }
      this.logger.info('Edge label removed', { edgeId: edge.id });
    } catch (error) {
      this.logger.error('Failed to remove edge label', { error, edgeId: edge.id });
    }
  }

  /**
   * Get edge label text
   */
  getEdgeLabel(edge: Edge): string {
    try {
      // Use standardized getLabel method from x6-cell-extensions
      if ((edge as any).getLabel) {
        return (edge as any).getLabel();
      } else {
        this.logger.warn('Edge does not support getLabel method', { edgeId: edge.id });
        return '';
      }
    } catch (error) {
      this.logger.error('Failed to get edge label', { error, edgeId: edge.id });
      return '';
    }
  }

  /**
   * Update edge style
   */
  updateEdgeStyle(
    edge: Edge,
    style: {
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
    },
  ): void {
    try {
      const attrs: any = {};

      if (style.stroke) {
        attrs['line/stroke'] = style.stroke;
      }
      if (style.strokeWidth) {
        attrs['line/strokeWidth'] = style.strokeWidth;
      }
      if (style.strokeDasharray) {
        attrs['line/strokeDasharray'] = style.strokeDasharray;
      }

      edge.setAttrs(attrs);

      this.logger.info('Edge style updated', { edgeId: edge.id, style });
    } catch (error) {
      this.logger.error('Failed to update edge style', { error, edgeId: edge.id, style });
    }
  }

  /**
   * Check if edge is connected to a specific node
   */
  isEdgeConnectedToNode(edge: Edge, nodeId: string): boolean {
    const sourceId = edge.getSourceCellId();
    const targetId = edge.getTargetCellId();
    return sourceId === nodeId || targetId === nodeId;
  }

  /**
   * Get all edges connected to a node
   */
  getNodeEdges(graph: Graph, nodeId: string): Edge[] {
    return graph.getEdges().filter(edge => this.isEdgeConnectedToNode(edge, nodeId));
  }

  /**
   * Get incoming edges for a node
   */
  getIncomingEdges(graph: Graph, nodeId: string): Edge[] {
    return graph.getEdges().filter(edge => edge.getTargetCellId() === nodeId);
  }

  /**
   * Get outgoing edges for a node
   */
  getOutgoingEdges(graph: Graph, nodeId: string): Edge[] {
    return graph.getEdges().filter(edge => edge.getSourceCellId() === nodeId);
  }

  /**
   * Remove all edges connected to a node
   */
  removeNodeEdges(graph: Graph, nodeId: string): void {
    const connectedEdges = this.getNodeEdges(graph, nodeId);

    // Remove all connected edges using InfraEdgeService for proper layered architecture
    connectedEdges.forEach(edge => {
      this.infraEdgeService.removeEdge(graph, edge.id);
    });

    this.logger.info('Removed edges connected to node', {
      nodeId,
      edgeCount: connectedEdges.length,
    });
  }

  /**
   * Validate edge connection during creation
   */
  validateEdgeConnection(
    graph: Graph,
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
  ): { valid: boolean; reason?: string } {
    // Check if nodes exist
    const sourceNode = graph.getCellById(sourceNodeId) as Node;
    const targetNode = graph.getCellById(targetNodeId) as Node;

    if (!sourceNode) {
      return { valid: false, reason: 'Source node not found' };
    }

    if (!targetNode) {
      return { valid: false, reason: 'Target node not found' };
    }

    // Check if connecting to self
    if (sourceNodeId === targetNodeId) {
      return { valid: false, reason: 'Cannot connect node to itself' };
    }

    // Check DFD connection rules
    if (!this.validateConnection(sourceNode, targetNode)) {
      return { valid: false, reason: 'Connection not allowed by DFD rules' };
    }

    // Check if ports exist (if specified)
    if (sourcePortId) {
      const sourcePorts = sourceNode.getPorts();
      if (!sourcePorts.some(port => port.id === sourcePortId)) {
        return { valid: false, reason: 'Source port not found' };
      }
    }

    if (targetPortId) {
      const targetPorts = targetNode.getPorts();
      if (!targetPorts.some(port => port.id === targetPortId)) {
        return { valid: false, reason: 'Target port not found' };
      }
    }

    // Check for duplicate connections
    const existingEdges = graph.getEdges();
    const duplicateEdge = existingEdges.find(edge => {
      const edgeSourceId = edge.getSourceCellId();
      const edgeTargetId = edge.getTargetCellId();
      const edgeSourcePortId = edge.getSourcePortId();
      const edgeTargetPortId = edge.getTargetPortId();

      return (
        edgeSourceId === sourceNodeId &&
        edgeTargetId === targetNodeId &&
        edgeSourcePortId === sourcePortId &&
        edgeTargetPortId === targetPortId
      );
    });

    if (duplicateEdge) {
      return { valid: false, reason: 'Connection already exists' };
    }

    return { valid: true };
  }

  // ========================================
  // Connection Validation Methods (formerly DfdConnectionValidationService)
  // ========================================

  /**
   * Check if a magnet (port) is valid for connection
   */
  isMagnetValid(args: MagnetValidationArgs): boolean {
    const magnet = args.magnet;
    if (!magnet) {
      this.logger.debugComponent('DfdEdge', 'isMagnetValid: no magnet found');
      return false;
    }

    // Check for magnet="true" or magnet="active" to match port configuration
    const magnetAttr = magnet.getAttribute('magnet');
    const isValid = magnetAttr === 'true' || magnetAttr === 'active';

    this.logger.debugComponent('DfdEdge', 'isMagnetValid result', {
      magnetAttribute: magnetAttr,
      portGroup: magnet.getAttribute('port-group'),
      isValid,
    });

    return isValid;
  }

  /**
   * Check if a connection can be made between two ports
   */
  isConnectionValid(args: ConnectionValidationArgs): boolean {
    const { sourceView, targetView, sourceMagnet, targetMagnet } = args;

    // Prevent creating an edge if source and target are the same port on the same node
    if (sourceView === targetView && sourceMagnet === targetMagnet) {
      // this.logger.debugComponent('DfdEdge', 'Connection rejected: same port on same node');
      return false;
    }

    if (!targetMagnet || !sourceMagnet) {
      this.logger.debugComponent('DfdEdge', 'isConnectionValid: missing magnet', {
        hasSourceMagnet: !!sourceMagnet,
        hasTargetMagnet: !!targetMagnet,
      });
      return false;
    }

    // Check if ports have valid port groups
    const sourcePortGroup = sourceMagnet.getAttribute('port-group');
    const targetPortGroup = targetMagnet.getAttribute('port-group');

    if (!sourcePortGroup || !targetPortGroup) {
      this.logger.debugComponent('DfdEdge', 'isConnectionValid: missing port groups', {
        sourcePortGroup,
        targetPortGroup,
      });
      return false;
    }

    // this.logger.debugComponent('DfdEdge', 'Connection validation passed');
    return true;
  }

  /**
   * Check if a connection can be made between two nodes based on DFD rules
   */
  isNodeConnectionValid(sourceNode: Node, targetNode: Node): boolean {
    const sourceShape = sourceNode.shape;
    const targetShape = targetNode.shape;

    const allowedTargets = this.connectionRules[sourceShape];
    if (!allowedTargets) {
      this.logger.warn('Unknown source shape type for connection validation', { sourceShape });
      return false;
    }

    const isValid = allowedTargets.includes(targetShape);
    if (!isValid) {
      this.logger.info('Connection not allowed by DFD rules', {
        sourceShape,
        targetShape,
        allowedTargets,
      });
    }

    return isValid;
  }

  /**
   * Validate node shape type
   */
  validateNodeShape(nodeType: string, nodeId: string): void {
    if (!nodeType || typeof nodeType !== 'string') {
      const error = `[DFD] Invalid node shape: shape property must be a non-empty string. Node ID: ${nodeId}, shape: ${nodeType}`;
      this.logger.error(error);
      throw new Error(error);
    }

    if (!this.validNodeShapes.includes(nodeType)) {
      const error = `[DFD] Invalid node shape: '${nodeType}' is not a recognized shape type. Valid shapes: ${this.validNodeShapes.join(', ')}. Node ID: ${nodeId}`;
      this.logger.error(error);
      throw new Error(error);
    }
  }

  /**
   * Validate that an X6 node was created with the correct shape property
   */
  validateX6NodeShape(x6Node: Node): void {
    const nodeShape = x6Node.shape;
    const nodeId = x6Node.id;

    if (!nodeShape || typeof nodeShape !== 'string') {
      const error = `[DFD] X6 node created without valid shape property. Node ID: ${nodeId}, shape: ${nodeShape}`;
      this.logger.error(error);
      throw new Error(error);
    }

    // Validate the shape matches expected X6 shape names
    const expectedX6Shapes = ['process', 'store', 'actor', 'security-boundary', 'text-box'];
    if (!expectedX6Shapes.includes(nodeShape)) {
      this.logger.warn('X6 node created with unexpected shape', {
        nodeId,
        shape: nodeShape,
        expectedShapes: expectedX6Shapes,
      });
    }
  }

  /**
   * Get valid connection targets for a given source shape
   */
  getValidConnectionTargets(sourceShape: string): string[] {
    return this.connectionRules[sourceShape] || [];
  }

  /**
   * Get all valid node shape types
   */
  getValidNodeShapes(): string[] {
    return [...this.validNodeShapes];
  }

  /**
   * Check if two shapes can be connected according to DFD rules
   */
  canShapesConnect(sourceShape: string, targetShape: string): boolean {
    const allowedTargets = this.connectionRules[sourceShape];
    return allowedTargets ? allowedTargets.includes(targetShape) : false;
  }

  /**
   * Get localized flow label with fallback for when translations aren't loaded yet
   */
  private getLocalizedFlowLabel(): string {
    const translatedLabel = this.transloco.translate('editor.flowLabel');

    // If translation service returns the key itself, it means the translation wasn't found
    // This can happen if translations aren't loaded yet or the key doesn't exist
    if (translatedLabel === 'editor.flowLabel') {
      this.logger.warn('Translation not available for editor.flowLabel, using fallback', {
        currentLanguage: this.transloco.getActiveLang(),
        returnedValue: translatedLabel,
      });
      return 'Flow';
    }

    return translatedLabel;
  }

  /**
   * Create edge from remote WebSocket operation
   */
  createEdgeFromRemoteOperation(graph: Graph, cellData: any, options: any): void {
    // Convert WebSocket cell data to EdgeInfo format
    const edgeInfo = this.convertWebSocketCellToEdgeInfo(cellData);

    // Create edge using infrastructure InfraEdgeService
    this.infraEdgeService.createEdge(graph, edgeInfo, {
      ensureVisualRendering: options?.ensureVisualRendering ?? true,
      updatePortVisibility: options?.updatePortVisibility ?? true,
      suppressHistory: options?.suppressHistory ?? true,
    });
  }

  /**
   * Remove edge from remote WebSocket operation
   */
  removeEdgeFromRemoteOperation(graph: Graph, cellId: string, _options: any): void {
    const cell = graph.getCellById(cellId);
    if (cell && cell.isEdge()) {
      // Execute without history for remote operations
      this.historyCoordinator.executeRemoteOperation(graph, () => {
        // Use infrastructure InfraEdgeService (doesn't take options parameter)
        this.infraEdgeService.removeEdge(graph, cellId);
      });
    }
  }

  /**
   * Convert WebSocket cell data to EdgeInfo format
   */
  private convertWebSocketCellToEdgeInfo(cellData: any): any {
    return {
      id: cellData.id,
      source: cellData.source,
      target: cellData.target,
      vertices: cellData.vertices || [],
      labels: cellData.labels || [],
      data: cellData.data || {},
    };
  }
}
