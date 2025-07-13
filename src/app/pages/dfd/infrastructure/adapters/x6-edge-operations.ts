import { Injectable } from '@angular/core';
import { Graph, Node, Edge } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';

/**
 * X6 Edge Operations
 * Handles edge creation, validation, and management for DFD diagrams
 */
@Injectable()
export class X6EdgeOperations {
  constructor(private logger: LoggerService) {}

  /**
   * Create an edge between two nodes
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

      const edge = graph.addEdge(edgeConfig);

      this.logger.info('Edge created successfully', {
        edgeId: edge.id,
        sourceNodeId,
        targetNodeId,
        sourcePortId,
        targetPortId,
        label,
      });

      return edge;
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
    const sourceShape = sourceNode.shape;
    const targetShape = targetNode.shape;

    // DFD connection rules
    const connectionRules: Record<string, string[]> = {
      'dfd-process': ['dfd-datastore', 'dfd-external-entity', 'dfd-process'],
      'dfd-datastore': ['dfd-process'],
      'dfd-external-entity': ['dfd-process'],
    };

    const allowedTargets = connectionRules[sourceShape];
    if (!allowedTargets) {
      this.logger.warn('Unknown source shape type', { sourceShape });
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
   * Highlight edge
   */
  highlightEdge(edge: Edge, highlight: boolean = true): void {
    try {
      if (highlight) {
        edge.setAttrs({
          line: {
            stroke: '#ff6b6b',
            strokeWidth: 3,
          },
        });
      } else {
        edge.setAttrs({
          line: {
            stroke: '#333',
            strokeWidth: 2,
          },
        });
      }

      this.logger.info('Edge highlight updated', { edgeId: edge.id, highlight });
    } catch (error) {
      this.logger.error('Failed to update edge highlight', { error, edgeId: edge.id, highlight });
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
    connectedEdges.forEach(edge => {
      graph.removeCell(edge);
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

  /**
   * Setup edge interaction behaviors
   */
  setupEdgeInteractions(graph: Graph): void {
    // Handle edge hover
    graph.on('edge:mouseenter', ({ edge }) => {
      this.highlightEdge(edge, true);
    });

    graph.on('edge:mouseleave', ({ edge }) => {
      // Only remove highlight if edge is not selected
      if (!graph.isSelected(edge)) {
        this.highlightEdge(edge, false);
      }
    });

    // Handle edge selection
    graph.on('edge:selected', ({ edge }) => {
      this.highlightEdge(edge, true);
    });

    graph.on('edge:unselected', ({ edge }) => {
      this.highlightEdge(edge, false);
    });

    // Handle edge double-click for label editing
    graph.on('edge:dblclick', ({ edge }) => {
      const currentLabel = this.getEdgeLabel(edge);
      const newLabel = prompt('Enter edge label:', currentLabel);

      if (newLabel !== null) {
        if (newLabel.trim()) {
          this.updateEdgeLabel(edge, newLabel.trim());
        } else {
          this.removeEdgeLabel(edge);
        }
      }
    });

    this.logger.info('Edge interactions setup completed');
  }
}
