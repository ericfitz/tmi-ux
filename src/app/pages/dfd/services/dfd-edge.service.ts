/**
 * DFD Edge Service
 *
 * This service provides comprehensive edge management functionality for DFD diagrams.
 * It handles edge creation, validation, and operations with connection rule enforcement.
 *
 * Key functionality:
 * - Manages edge creation and validation according to DFD rules
 * - Provides connection validation for different node type combinations
 * - Handles edge routing and automatic path calculation
 * - Manages edge styling and visual properties
 * - Coordinates with X6GraphAdapter for graph-specific edge operations
 * - Implements DFD-specific connection rules and constraints
 * - Provides edge manipulation operations (vertices, labels, styling)
 * - Handles inverse connection creation for bi-directional flows
 * - Manages edge metadata and custom properties
 * - Provides edge validation and business rule enforcement
 * - Supports edge templates and styling configurations
 * - Integrates with visual effects service for edge animations
 * - Handles magnet and port validation for connection endpoints
 * - Manages edge lifecycle events and state changes
 */

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Graph, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { X6ZOrderAdapter } from '../infrastructure/adapters/x6-z-order.adapter';
import { X6HistoryManager } from '../infrastructure/adapters/x6-history-manager';
import { VisualEffectsService } from '../infrastructure/services/visual-effects.service';
import { EdgeService } from '../infrastructure/services/edge.service';
import { EdgeInfo } from '../domain/value-objects/edge-info';
import { DFD_STYLING } from '../constants/styling-constants';

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
export class DfdEdgeService {
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
    private x6ZOrderAdapter: X6ZOrderAdapter,
    private x6HistoryManager: X6HistoryManager,
    private visualEffectsService: VisualEffectsService,
    private edgeService: EdgeService,
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
      // Remove the invalid edge from the graph using EdgeService
      this.edgeService.removeEdge(graph, edge.id);
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
      // Remove the invalid edge from the graph using EdgeService
      this.edgeService.removeEdge(graph, edge.id);
      throw new Error('Edge references non-existent nodes');
    }

    this.logger.info('Edge validated successfully', {
      edgeId: edge.id,
      sourceNodeId,
      targetNodeId,
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

    // Generate a new UUID for the inverse edge
    const inverseEdgeId = uuidv4();

    // Get the original edge's label for consistency using the correct label extraction method
    const originalLabel = (edge as any).getLabel() || 'Flow';

    try {
      // Create inverse EdgeInfo domain object
      const inverseEdgeInfo = EdgeInfo.create({
        id: inverseEdgeId,
        sourceNodeId: targetNodeId, // Swap source and target for inverse
        targetNodeId: sourceNodeId,
        sourcePortId: targetPortId,
        targetPortId: sourcePortId,
        label: originalLabel,
      });

      // Delegate to EdgeService for X6 operations (proper layered architecture)
      const inverseEdge = this.edgeService.createEdge(graph, inverseEdgeInfo, {
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });

      // Apply proper zIndex using the same logic as normal edge creation (application layer)
      this.x6ZOrderAdapter.setEdgeZOrderFromConnectedNodes(graph, inverseEdge);

      // Apply creation highlight effect for programmatically created inverse edges (application layer)
      this.visualEffectsService.applyCreationHighlight(inverseEdge, graph);

      this.logger.info(
        'Inverse edge created successfully directly in X6 with creation highlight (batched)',
        {
          originalEdgeId: edge.id,
          inverseEdgeId,
          newSource: targetNodeId,
          newTarget: sourceNodeId,
          newSourcePort: targetPortId,
          newTargetPort: sourcePortId,
          appliedZIndexLogic: true,
        },
      );

      return of(void 0);
    } catch (error) {
      this.logger.error('Error creating inverse edge directly in X6', error);
      throw error;
    }
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
        label: label || DFD_STYLING.EDGES.DEFAULT_LABEL,
      });

      // Delegate to EdgeService for X6 operations (proper layered architecture)
      const createdEdge = this.edgeService.createEdge(graph, edgeInfo, {
        ensureVisualRendering: true,
        updatePortVisibility: true,
      });

      // Apply DFD-specific visual effects (application layer responsibility)
      this.visualEffectsService.applyCreationHighlight(createdEdge, graph);

      this.logger.info('Edge created successfully via EdgeService', {
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

    // Remove all connected edges using EdgeService for proper layered architecture
    connectedEdges.forEach(edge => {
      this.edgeService.removeEdge(graph, edge.id);
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
      this.logger.debugComponent('DfdEdge', 'Connection rejected: same port on same node');
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

    this.logger.debugComponent('DfdEdge', 'Connection validation passed');
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
}
