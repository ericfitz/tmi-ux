import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Graph, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { X6ZOrderAdapter } from '../infrastructure/adapters/x6-z-order.adapter';
import { X6HistoryManager } from '../infrastructure/adapters/x6-history-manager';
import { VisualEffectsService } from '../infrastructure/services/visual-effects.service';
import { DfdConnectionValidationService } from './dfd-connection-validation.service';

/**
 * Consolidated service for edge handling, operations, and management in DFD diagrams
 * Combines the functionality of DfdEdgeManagerService and X6EdgeOperations
 */
@Injectable({
  providedIn: 'root',
})
export class DfdEdgeService {
  constructor(
    private logger: LoggerService,
    private x6GraphAdapter: X6GraphAdapter,
    private x6ZOrderAdapter: X6ZOrderAdapter,
    private x6HistoryManager: X6HistoryManager,
    private connectionValidationService: DfdConnectionValidationService,
    private visualEffectsService: VisualEffectsService,
  ) {}

  // ========================================
  // High-level Edge Management Methods
  // ========================================

  /**
   * Handle edge added events from the graph adapter
   * Now simplified to just validate the edge without domain model sync
   */
  handleEdgeAdded(edge: Edge, diagramId: string, isInitialized: boolean): Observable<void> {
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
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
      throw new Error('Edge added without valid source or target nodes');
    }

    // Verify that the source and target nodes actually exist in the graph
    const sourceNode = this.x6GraphAdapter.getNode(sourceNodeId);
    const targetNode = this.x6GraphAdapter.getNode(targetNodeId);

    if (!sourceNode || !targetNode) {
      this.logger.warn('Edge references non-existent nodes', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
        sourceNodeExists: !!sourceNode,
        targetNodeExists: !!targetNode,
      });
      // Remove the invalid edge from the graph
      this.x6GraphAdapter.removeEdge(edge.id);
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
    const edge = this.x6GraphAdapter.getEdge(edgeId);
    if (!edge) {
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
  addInverseConnection(edge: Edge, _diagramId: string): Observable<void> {
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
      // Create inverse edge directly in X6 graph
      const graph = this.x6GraphAdapter.getGraph();

      // Batch all inverse edge creation operations into a single history command
      graph.batchUpdate(() => {
        const inverseEdge = graph.addEdge({
          id: inverseEdgeId,
          source: { cell: targetNodeId, port: targetPortId },
          target: { cell: sourceNodeId, port: sourcePortId },
          shape: 'edge',
          markup: [
            {
              tagName: 'path',
              selector: 'wrap',
              attrs: {
                fill: 'none',
                cursor: 'pointer',
                stroke: 'transparent',
                strokeLinecap: 'round',
              },
            },
            {
              tagName: 'path',
              selector: 'line',
              attrs: {
                fill: 'none',
                pointerEvents: 'none',
              },
            },
          ],
          attrs: {
            wrap: {
              connection: true,
              strokeWidth: 10,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              stroke: 'transparent',
              fill: 'none',
            },
            line: {
              connection: true,
              stroke: '#000000',
              strokeWidth: 2,
              fill: 'none',
              targetMarker: {
                name: 'classic',
                size: 8,
                fill: '#000000',
                stroke: '#000000',
              },
            },
          },
          vertices: [],
          labels: [
            {
              position: 0.5,
              attrs: {
                text: {
                  text: originalLabel,
                  fontSize: 12,
                  fill: '#333',
                  fontFamily: '"Roboto Condensed", Arial, sans-serif',
                  textAnchor: 'middle',
                  dominantBaseline: 'middle',
                },
                rect: {
                  fill: '#ffffff',
                  stroke: 'none',
                },
              },
            },
          ],
          zIndex: 1, // Temporary z-index, will be set properly by ZOrderAdapter
        });

        // Apply proper zIndex using the same logic as normal edge creation
        this.x6ZOrderAdapter.setEdgeZOrderFromConnectedNodes(graph, inverseEdge);

        // Apply creation highlight effect for programmatically created inverse edges
        this.visualEffectsService.applyCreationHighlight(inverseEdge, graph);
      });

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

      // Validate connection rules
      if (!this.validateConnection(sourceNode, targetNode)) {
        this.logger.warn('Invalid connection attempt', {
          sourceType: sourceNode.shape,
          targetType: targetNode.shape,
        });
        return null;
      }

      const edgeConfig: any = {
        source: {
          cell: sourceNodeId,
          port: sourcePortId,
        },
        target: {
          cell: targetNodeId,
          port: targetPortId,
        },
        attrs: {
          line: {
            stroke: '#333',
            strokeWidth: 2,
            targetMarker: {
              name: 'classic',
              size: 8,
            },
          },
        },
        connector: {
          name: 'rounded',
          args: {
            radius: 10,
          },
        },
        router: {
          name: 'manhattan',
          args: {
            padding: 10,
          },
        },
      };

      // Add label if provided
      if (label) {
        edgeConfig.labels = [
          {
            attrs: {
              text: {
                text: label,
                fontSize: 12,
                fill: '#333',
                fontFamily: '"Roboto Condensed", Arial, sans-serif',
              },
              rect: {
                fill: 'white',
                stroke: '#ccc',
                strokeWidth: 1,
                rx: 3,
                ry: 3,
              },
            },
            position: 0.5,
          },
        ];
      }

      let createdEdge!: Edge;

      // Batch all edge creation operations into a single history command
      graph.batchUpdate(() => {
        createdEdge = graph.addEdge(edgeConfig);


        // Apply creation highlight effect for programmatically created edges
        this.visualEffectsService.applyCreationHighlight(createdEdge, graph);
      });

      this.logger.info('Edge created successfully with creation highlight (batched)', {
        edgeId: createdEdge.id,
        sourceNodeId,
        targetNodeId,
        sourcePortId,
        targetPortId,
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
    return this.connectionValidationService.isNodeConnectionValid(sourceNode, targetNode);
  }

  /**
   * Update edge label
   */
  updateEdgeLabel(edge: Edge, label: string): void {
    try {
      edge.setLabels([
        {
          attrs: {
            text: {
              text: label,
              fontSize: 12,
              fill: '#333',
              fontFamily: '"Roboto Condensed", Arial, sans-serif',
            },
            rect: {
              fill: 'white',
              stroke: '#ccc',
              strokeWidth: 1,
              rx: 3,
              ry: 3,
            },
          },
          position: 0.5,
        },
      ]);

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
      edge.setLabels([]);
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
      const labels = edge.getLabels();
      if (labels && labels.length > 0) {
        const firstLabel = labels[0];
        const textAttr = firstLabel.attrs?.['text'];
        if (textAttr && typeof textAttr === 'object' && 'text' in textAttr) {
          const textValue = textAttr['text'];
          return typeof textValue === 'string' ? textValue : '';
        }
      }
      return '';
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

    // Remove all connected edges in a single batch for proper undo/redo
    graph.batchUpdate(() => {
      connectedEdges.forEach(edge => {
        graph.removeCell(edge);
      });
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


}
