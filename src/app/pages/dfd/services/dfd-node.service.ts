import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { Graph, Node } from '@antv/x6';
import { TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '../../../core/services/logger.service';
import { NodeType } from '../domain/value-objects/node-data';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { getX6ShapeForNodeType } from '../infrastructure/adapters/x6-shape-definitions';

/**
 * Consolidated service for node creation, management, and operations in DFD diagrams
 * Combines the functionality of DfdNodeManagerService and X6NodeOperations
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNodeService {
  constructor(
    private logger: LoggerService,
    private transloco: TranslocoService,
    private x6GraphAdapter: X6GraphAdapter,
  ) {}

  // ========================================
  // High-level Node Management Methods
  // ========================================

  /**
   * Add a node at a predictable position
   */
  addGraphNode(
    shapeType: NodeType = 'actor',
    containerWidth: number,
    containerHeight: number,
    diagramId: string,
    isInitialized: boolean,
  ): Observable<void> {
    if (!isInitialized) {
      this.logger.warn('Cannot add node: Graph is not initialized');
      throw new Error('Graph is not initialized');
    }

    // Calculate a predictable position using a grid-based algorithm
    const position = this.calculateNextNodePosition(containerWidth, containerHeight);

    return this.createNode(shapeType, position);
  }

  /**
   * Calculate the next predictable position for a new node using a grid-based algorithm
   * that ensures nodes are always placed in the viewable area
   */
  private calculateNextNodePosition(
    containerWidth: number,
    containerHeight: number,
  ): { x: number; y: number } {
    const nodeWidth = 120; // Default node width
    const nodeHeight = 80; // Default node height
    const padding = 50; // Padding from edges and between nodes
    const gridSpacingX = nodeWidth + padding;
    const gridSpacingY = nodeHeight + padding;
    const offsetIncrement = 25; // Offset increment for layered placement

    // Calculate available grid dimensions
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;
    const maxColumns = Math.floor(availableWidth / gridSpacingX);
    const maxRows = Math.floor(availableHeight / gridSpacingY);
    const totalGridPositions = maxColumns * maxRows;

    // Get existing nodes to determine occupied positions
    const existingNodes = this.x6GraphAdapter.getNodes();

    // Calculate which layer we're on based on existing node count
    const currentLayer = Math.floor(existingNodes.length / totalGridPositions);
    const positionInLayer = existingNodes.length % totalGridPositions;

    // Calculate the offset for this layer to create a staggered effect
    const layerOffsetX = (currentLayer * offsetIncrement) % (gridSpacingX / 2);
    const layerOffsetY = (currentLayer * offsetIncrement) % (gridSpacingY / 2);

    // Calculate row and column for this position in the current layer
    const row = Math.floor(positionInLayer / maxColumns);
    const col = positionInLayer % maxColumns;

    // Calculate the actual position with layer offset
    const baseX = padding + col * gridSpacingX;
    const baseY = padding + row * gridSpacingY;
    const x = baseX + layerOffsetX;
    const y = baseY + layerOffsetY;

    // Ensure the position stays within the viewable area
    const clampedX = Math.min(Math.max(x, padding), containerWidth - nodeWidth - padding);
    const clampedY = Math.min(Math.max(y, padding), containerHeight - nodeHeight - padding);

    this.logger.info('Calculated predictable node position with layering', {
      layer: currentLayer,
      positionInLayer,
      gridPosition: { col, row },
      layerOffset: { x: layerOffsetX, y: layerOffsetY },
      calculatedPosition: { x, y },
      finalPosition: { x: clampedX, y: clampedY },
      totalGridPositions,
      existingNodeCount: existingNodes.length,
    });

    return { x: clampedX, y: clampedY };
  }

  /**
   * Create a node with the specified type and position directly in X6
   */
  private createNode(shapeType: NodeType, position: { x: number; y: number }): Observable<void> {
    const nodeId = uuidv4(); // Generate UUID type 4 for UX-created nodes

    try {
      // Add node directly to X6 graph using the graph instance
      const graph = this.x6GraphAdapter.getGraph();

      // Get node-specific configuration
      const nodeConfig = this.getNodeConfigForType(shapeType, nodeId, position);

      graph.addNode(nodeConfig);

      this.logger.info('Node created successfully directly in X6', { nodeId, shapeType });
      return of(void 0);
    } catch (error) {
      this.logger.error('Error creating node directly in X6', error);
      throw error;
    }
  }

  /**
   * Get node configuration based on node type
   * Uses the original CSS-based styling system instead of inline attrs
   */
  private getNodeConfigForType(
    shapeType: NodeType,
    nodeId: string,
    position: { x: number; y: number },
  ): any {
    const x6Shape = getX6ShapeForNodeType(shapeType);
    const label = this.getDefaultLabelForType(shapeType);

    // Base configuration with minimal styling - let CSS handle the appearance
    const baseConfig = {
      id: nodeId,
      shape: x6Shape,
      x: position.x,
      y: position.y,
      width: 120,
      height: 80,
      label,
      data: {
        type: shapeType, // This allows CSS targeting via [data-type="..."]
      },
      zIndex: 1,
    };

    // Configure ports with proper magnet properties for edge creation
    // but minimal styling - let the CSS handle the visual appearance
    const portConfig = {
      groups: {
        top: {
          position: 'top',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              class: 'x6-port-body',
            },
          },
        },
        right: {
          position: 'right',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              class: 'x6-port-body',
            },
          },
        },
        bottom: {
          position: 'bottom',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              class: 'x6-port-body',
            },
          },
        },
        left: {
          position: 'left',
          attrs: {
            circle: {
              r: 5,
              magnet: true,
              class: 'x6-port-body',
            },
          },
        },
      },
      items: [
        { id: 'top', group: 'top' },
        { id: 'right', group: 'right' },
        { id: 'bottom', group: 'bottom' },
        { id: 'left', group: 'left' },
      ],
    };

    // Adjust dimensions based on node type to match original styling
    switch (shapeType) {
      case 'process':
        return {
          ...baseConfig,
          width: 120,
          height: 60,
          ports: portConfig,
        };

      case 'store':
        return {
          ...baseConfig,
          width: 140,
          height: 40,
          ports: portConfig,
        };

      case 'actor':
        return {
          ...baseConfig,
          width: 100,
          height: 80,
          ports: portConfig,
        };

      default:
        // Default configuration for security-boundary, textbox, etc.
        return {
          ...baseConfig,
          ports: portConfig,
        };
    }
  }

  /**
   * Get default label for a shape type
   */
  private getDefaultLabelForType(shapeType: NodeType): string {
    switch (shapeType) {
      case 'actor':
        return this.transloco.translate('editor.nodeLabels.actor');
      case 'process':
        return this.transloco.translate('editor.nodeLabels.process');
      case 'store':
        return this.transloco.translate('editor.nodeLabels.store');
      case 'security-boundary':
        return this.transloco.translate('editor.nodeLabels.securityBoundary');
      case 'textbox':
        return this.transloco.translate('editor.nodeLabels.textbox');
      default:
        return this.transloco.translate('editor.nodeLabels.node');
    }
  }

  // ========================================
  // Low-level X6 Node Operations
  // ========================================

  /**
   * Create a DFD process node
   */
  createProcessNode(
    graph: Graph,
    x: number,
    y: number,
    label: string = 'Process',
    id?: string,
  ): Node {
    const node = graph.addNode({
      id,
      x,
      y,
      width: 120,
      height: 60,
      shape: 'dfd-process',
      label,
      attrs: {
        body: {
          fill: '#e8f4fd',
          stroke: '#1890ff',
          strokeWidth: 2,
        },
        label: {
          text: label,
          fontSize: 12,
          fill: '#333',
          fontFamily: '"Roboto Condensed", Arial, sans-serif',
        },
      },
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#1890ff',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#1890ff',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
        },
        items: [
          { id: 'in1', group: 'in' },
          { id: 'in2', group: 'in' },
          { id: 'out1', group: 'out' },
          { id: 'out2', group: 'out' },
        ],
      },
    });

    this.logger.info('Process node created', { nodeId: node.id, label, x, y });
    return node;
  }

  /**
   * Create a DFD data store node
   */
  createDataStoreNode(
    graph: Graph,
    x: number,
    y: number,
    label: string = 'Data Store',
    id?: string,
  ): Node {
    const node = graph.addNode({
      id,
      x,
      y,
      width: 140,
      height: 40,
      shape: 'dfd-datastore',
      label,
      attrs: {
        body: {
          fill: '#fff7e6',
          stroke: '#fa8c16',
          strokeWidth: 2,
        },
        label: {
          text: label,
          fontSize: 12,
          fill: '#333',
          fontFamily: '"Roboto Condensed", Arial, sans-serif',
        },
      },
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#fa8c16',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#fa8c16',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
        },
        items: [
          { id: 'in1', group: 'in' },
          { id: 'out1', group: 'out' },
        ],
      },
    });

    this.logger.info('Data store node created', { nodeId: node.id, label, x, y });
    return node;
  }

  /**
   * Create a DFD external entity node
   */
  createExternalEntityNode(
    graph: Graph,
    x: number,
    y: number,
    label: string = 'External Entity',
    id?: string,
  ): Node {
    const node = graph.addNode({
      id,
      x,
      y,
      width: 100,
      height: 80,
      shape: 'dfd-external-entity',
      label,
      attrs: {
        body: {
          fill: '#f6ffed',
          stroke: '#52c41a',
          strokeWidth: 2,
        },
        label: {
          text: label,
          fontSize: 12,
          fill: '#333',
          fontFamily: '"Roboto Condensed", Arial, sans-serif',
        },
      },
      ports: {
        groups: {
          in: {
            position: 'left',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#52c41a',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
          out: {
            position: 'right',
            attrs: {
              circle: {
                r: 4,
                magnet: true,
                stroke: '#52c41a',
                strokeWidth: 2,
                fill: '#fff',
                style: {
                  visibility: 'hidden',
                },
              },
            },
          },
        },
        items: [
          { id: 'in1', group: 'in' },
          { id: 'out1', group: 'out' },
        ],
      },
    });

    this.logger.info('External entity node created', { nodeId: node.id, label, x, y });
    return node;
  }

  /**
   * Update node label
   */
  updateNodeLabel(node: Node, label: string): void {
    try {
      node.setAttrs({
        label: {
          text: label,
        },
      });

      // Also update the internal label property
      node.prop('label', label);

      this.logger.info('Node label updated', { nodeId: node.id, label });
    } catch (error) {
      this.logger.error('Failed to update node label', { error, nodeId: node.id, label });
    }
  }

  /**
   * Get node label
   */
  getNodeLabel(node: Node): string {
    try {
      return node.prop('label') || '';
    } catch (error) {
      this.logger.error('Failed to get node label', { error, nodeId: node.id });
      return '';
    }
  }

  /**
   * Update node position
   */
  updateNodePosition(node: Node, x: number, y: number): void {
    try {
      node.setPosition(x, y);
      this.logger.info('Node position updated', { nodeId: node.id, x, y });
    } catch (error) {
      this.logger.error('Failed to update node position', { error, nodeId: node.id, x, y });
    }
  }

  /**
   * Update node size
   */
  updateNodeSize(node: Node, width: number, height: number): void {
    try {
      node.setSize(width, height);
      this.logger.info('Node size updated', { nodeId: node.id, width, height });
    } catch (error) {
      this.logger.error('Failed to update node size', { error, nodeId: node.id, width, height });
    }
  }

  /**
   * Update node style
   */
  updateNodeStyle(
    node: Node,
    style: {
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      strokeDasharray?: string;
    },
  ): void {
    try {
      const attrs: any = {};

      if (style.fill) {
        attrs['body/fill'] = style.fill;
      }
      if (style.stroke) {
        attrs['body/stroke'] = style.stroke;
      }
      if (style.strokeWidth) {
        attrs['body/strokeWidth'] = style.strokeWidth;
      }
      if (style.strokeDasharray) {
        attrs['body/strokeDasharray'] = style.strokeDasharray;
      }

      node.setAttrs(attrs);

      this.logger.info('Node style updated', { nodeId: node.id, style });
    } catch (error) {
      this.logger.error('Failed to update node style', { error, nodeId: node.id, style });
    }
  }

  /**
   * Highlight node
   */
  highlightNode(node: Node, highlight: boolean = true): void {
    try {
      if (highlight) {
        node.setAttrs({
          body: {
            stroke: '#ff6b6b',
            strokeWidth: 3,
          },
        });
      } else {
        // Reset to original color based on node type
        const shape = node.shape;
        let originalStroke = '#333';

        switch (shape) {
          case 'dfd-process':
            originalStroke = '#1890ff';
            break;
          case 'dfd-datastore':
            originalStroke = '#fa8c16';
            break;
          case 'dfd-external-entity':
            originalStroke = '#52c41a';
            break;
        }

        node.setAttrs({
          body: {
            stroke: originalStroke,
            strokeWidth: 2,
          },
        });
      }

      this.logger.info('Node highlight updated', { nodeId: node.id, highlight });
    } catch (error) {
      this.logger.error('Failed to update node highlight', { error, nodeId: node.id, highlight });
    }
  }

  /**
   * Clone node
   */
  cloneNode(graph: Graph, node: Node, offsetX: number = 20, offsetY: number = 20): Node {
    try {
      const clonedNode = node.clone();
      const position = node.getPosition();

      clonedNode.setPosition(position.x + offsetX, position.y + offsetY);
      graph.addCell(clonedNode);

      this.logger.info('Node cloned', {
        originalId: node.id,
        clonedId: clonedNode.id,
        offsetX,
        offsetY,
      });

      return clonedNode;
    } catch (error) {
      this.logger.error('Failed to clone node', { error, nodeId: node.id });
      throw error;
    }
  }

  /**
   * Get node bounds
   */
  getNodeBounds(node: Node): { x: number; y: number; width: number; height: number } {
    try {
      const bbox = node.getBBox();
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      };
    } catch (error) {
      this.logger.error('Failed to get node bounds', { error, nodeId: node.id });
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  /**
   * Check if point is inside node
   */
  isPointInNode(node: Node, x: number, y: number): boolean {
    try {
      const bounds = this.getNodeBounds(node);
      return (
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      );
    } catch (error) {
      this.logger.error('Failed to check point in node', { error, nodeId: node.id, x, y });
      return false;
    }
  }

  /**
   * Get nodes in area
   */
  getNodesInArea(graph: Graph, x: number, y: number, width: number, height: number): Node[] {
    try {
      const nodes = graph.getNodes();
      return nodes.filter(node => {
        const bounds = this.getNodeBounds(node);
        return (
          bounds.x < x + width &&
          bounds.x + bounds.width > x &&
          bounds.y < y + height &&
          bounds.y + bounds.height > y
        );
      });
    } catch (error) {
      this.logger.error('Failed to get nodes in area', { error, x, y, width, height });
      return [];
    }
  }

  /**
   * Get node center point
   */
  getNodeCenter(node: Node): { x: number; y: number } {
    try {
      const bounds = this.getNodeBounds(node);
      return {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
    } catch (error) {
      this.logger.error('Failed to get node center', { error, nodeId: node.id });
      return { x: 0, y: 0 };
    }
  }

  /**
   * Validate node data
   */
  validateNode(node: Node): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Check if node has a label
      const label = this.getNodeLabel(node);
      if (!label || label.trim().length === 0) {
        errors.push('Node must have a label');
      }

      // Check if node has valid dimensions
      const bounds = this.getNodeBounds(node);
      if (bounds.width <= 0 || bounds.height <= 0) {
        errors.push('Node must have valid dimensions');
      }

      // Check if node has valid position
      if (bounds.x < 0 || bounds.y < 0) {
        errors.push('Node position must be non-negative');
      }

      // Check node type specific validations
      const shape = node.shape;
      switch (shape) {
        case 'dfd-process':
          if (bounds.width < 80 || bounds.height < 40) {
            errors.push('Process node must be at least 80x40 pixels');
          }
          break;
        case 'dfd-datastore':
          if (bounds.width < 100 || bounds.height < 30) {
            errors.push('Data store node must be at least 100x30 pixels');
          }
          break;
        case 'dfd-external-entity':
          if (bounds.width < 80 || bounds.height < 60) {
            errors.push('External entity node must be at least 80x60 pixels');
          }
          break;
        default:
          errors.push(`Unknown node type: ${shape}`);
      }

      const valid = errors.length === 0;

      this.logger.info('Node validation completed', {
        nodeId: node.id,
        valid,
        errorCount: errors.length,
      });

      return { valid, errors };
    } catch (error) {
      this.logger.error('Failed to validate node', { error, nodeId: node.id });
      return { valid: false, errors: ['Validation failed due to error'] };
    }
  }

  /**
   * Setup node interaction behaviors
   */
  setupNodeInteractions(graph: Graph): void {
    // Handle node hover
    graph.on('node:mouseenter', ({ node }) => {
      this.highlightNode(node, true);
    });

    graph.on('node:mouseleave', ({ node }) => {
      // Only remove highlight if node is not selected
      if (!graph.isSelected(node)) {
        this.highlightNode(node, false);
      }
    });

    // Handle node selection
    graph.on('node:selected', ({ node }) => {
      this.highlightNode(node, true);
    });

    graph.on('node:unselected', ({ node }) => {
      this.highlightNode(node, false);
    });

    // Handle node double-click for label editing
    graph.on('node:dblclick', ({ node }) => {
      const currentLabel = this.getNodeLabel(node);
      const newLabel = prompt('Enter node label:', currentLabel);

      if (newLabel !== null && newLabel.trim()) {
        this.updateNodeLabel(node, newLabel.trim());
      }
    });

    // Handle node movement
    graph.on('node:moved', ({ node }) => {
      const position = node.getPosition();
      this.logger.info('Node moved', {
        nodeId: node.id,
        x: position.x,
        y: position.y,
      });
    });

    // Handle node resize
    graph.on('node:resized', ({ node }) => {
      const size = node.getSize();
      this.logger.info('Node resized', {
        nodeId: node.id,
        width: size.width,
        height: size.height,
      });
    });

    this.logger.info('Node interactions setup completed');
  }
}
