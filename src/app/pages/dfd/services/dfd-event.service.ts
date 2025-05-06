import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { HighlighterConfig } from '../models/highlighter-config.interface';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdHighlighterService } from './dfd-highlighter.service';
import { DfdPortService } from './dfd-port.service';
import { DfdNodeService } from './dfd-node.service';
import { DfdLabelEditorService } from './dfd-label-editor.service';
import { ActorShape } from '../models/actor-shape.model';
import { ProcessShape } from '../models/process-shape.model';
import { StoreShape } from '../models/store-shape.model';
import { SecurityBoundaryShape } from '../models/security-boundary-shape.model';
import { NodeData } from '../models/node-data.interface';

// Type guard function to check if an object is a NodeData
function isNodeData(data: unknown): data is NodeData {
  return data !== null && typeof data === 'object' && data !== undefined;
}

/**
 * Service for managing events in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdEventService {
  // Reference to the currently selected node
  private _selectedNode: ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape | null =
    null;

  constructor(
    private logger: LoggerService,
    private highlighterService: DfdHighlighterService,
    private portService: DfdPortService,
    private nodeService: DfdNodeService,
    private labelEditorService: DfdLabelEditorService,
  ) {}

  /**
   * Sets up event handlers for the graph
   * @param graph The X6 graph instance
   */
  setupEventHandlers(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Create highlighters for nodes and edges
    const nodeHighlighter = this.highlighterService.createNodeHighlighter();
    const edgeHighlighter = this.highlighterService.createEdgeHighlighter();

    // Handle node:change:parent event to update nodes when they're embedded or un-embedded
    this.setupEmbeddingEvents(graph);

    // Handle node hover events
    this.setupNodeHoverEvents(graph, nodeHighlighter);

    // Handle node click events
    this.setupNodeClickEvents(graph);

    // Handle edge events
    this.setupEdgeEvents(graph, edgeHighlighter);

    // Handle port events
    this.setupPortEvents(graph);
  }

  /**
   * Sets up embedding events
   * @param graph The X6 graph instance
   */
  private setupEmbeddingEvents(graph: Graph): void {
    graph.on('node:change:parent', ({ node, current, previous }) => {
      if (current && !previous) {
        // Node was embedded
        this.logger.info('Node embedded:', node.id);

        // Add a visual indicator for embedded nodes
        if (this.nodeService.isDfdNode(node)) {
          // Change the fill color to indicate it's embedded
          node.attr('body/fill', '#e6f7ff');

          // Add a data attribute to mark it as embedded
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const existingData = node.getData();
          // Use type guard to check if existingData is a valid NodeData object

          const safeData: NodeData = isNodeData(existingData) ? existingData : {};
          // Create a new NodeData object with the embedded flag
          const newData: NodeData = {
            ...safeData,
            embedded: true,
            parentId: current,
          };
          node.setData(newData);

          // Manage z-index for parent and child
          this.manageZIndexForEmbedding(graph, node, current);
        }
      } else if (!current && previous) {
        // Node was un-embedded
        this.logger.info('Node un-embedded:', node.id);

        if (this.nodeService.isDfdNode(node)) {
          // Restore original fill color
          node.attr('body/fill', '#FFFFFF');

          // Update data to remove embedded flag
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const data = node.getData();
          // Use type guard to check if data is a valid NodeData object

          const safeData: NodeData = isNodeData(data) ? data : {};
          // Create a new NodeData object without the embedded flag
          const updatedData: NodeData = { ...safeData };
          delete updatedData.embedded;
          delete updatedData.parentId;
          // Set the data with the properly typed object
          node.setData(updatedData);

          // Reset z-index to default and adjust all children
          this.resetNodeZIndices(graph, node);
        }
      }
    });
  }

  /**
   * Manages z-index for parent and child nodes during embedding
   * @param graph The X6 graph instance
   * @param childNode The child node being embedded
   * @param parentId The ID of the parent node
   */
  private manageZIndexForEmbedding(
    graph: Graph,
    childNode: Node<Node.Properties>,
    parentId: string,
  ): void {
    const parentNode = graph.getCellById(parentId);
    if (!parentNode || !(parentNode instanceof Node)) return;

    // Get current z-indices
    const childZIndex = childNode.getZIndex() || 0;
    const parentZIndex = parentNode.getZIndex() || 0;

    this.logger.debug('Z-index before adjustment:', {
      childId: childNode.id,
      childZIndex,
      parentId,
      parentZIndex,
    });

    // Set parent below child
    let newParentZIndex = childZIndex - 1;
    let newChildZIndex = childZIndex;

    // If parent would go below z=0, adjust both to keep them near z=0
    if (newParentZIndex < 0) {
      // Move child up to keep the relative positioning
      newChildZIndex = 1;
      newParentZIndex = 0;
    }

    // Apply the new z-indices
    parentNode.setZIndex(newParentZIndex);
    childNode.setZIndex(newChildZIndex);

    // Recursively adjust z-indices for all children of the child node
    this.adjustChildrenZIndices(graph, childNode, newChildZIndex);

    this.logger.debug('Z-index after adjustment:', {
      childId: childNode.id,
      childZIndex: newChildZIndex,
      parentId,
      parentZIndex: newParentZIndex,
    });
  }

  /**
   * Resets the z-index of a node and recursively adjusts its children
   * @param graph The X6 graph instance
   * @param node The node to reset
   */
  private resetNodeZIndices(graph: Graph, node: Node<Node.Properties>): void {
    // Reset this node's z-index to 0
    node.setZIndex(0);

    this.logger.debug(`Reset z-index of ${node.id} to 0`);

    // Find all children of this node
    const children = graph.getNodes().filter(childNode => {
      return childNode.getParent()?.id === node.id;
    });

    if (children.length === 0) return;

    this.logger.debug(`Resetting z-indices for ${children.length} children of ${node.id}`);

    // Start with 1 for the first child
    let nextZIndex = 1;

    // Adjust z-index for each child
    children.forEach(childNode => {
      childNode.setZIndex(nextZIndex);

      this.logger.debug(`Set z-index of ${childNode.id} to ${nextZIndex}`);

      // Recursively adjust this child's children
      this.adjustChildrenZIndices(graph, childNode, nextZIndex);

      // Increment for next sibling
      nextZIndex++;
    });
  }

  /**
   * Recursively adjusts z-indices for all children of a node
   * @param graph The X6 graph instance
   * @param parentNode The parent node
   * @param parentZIndex The parent's z-index
   */
  private adjustChildrenZIndices(
    graph: Graph,
    parentNode: Node<Node.Properties>,
    parentZIndex: number,
  ): void {
    // Find all children of this node
    const children = graph.getNodes().filter(node => {
      return node.getParent()?.id === parentNode.id;
    });

    if (children.length === 0) return;

    this.logger.debug(`Adjusting z-indices for ${children.length} children of ${parentNode.id}`);

    // Start with parent z-index + 1 for the first child
    let nextZIndex = parentZIndex + 1;

    // Adjust z-index for each child
    children.forEach(childNode => {
      childNode.setZIndex(nextZIndex);

      this.logger.debug(`Set z-index of ${childNode.id} to ${nextZIndex}`);

      // Recursively adjust this child's children
      this.adjustChildrenZIndices(graph, childNode, nextZIndex);

      // Increment for next sibling
      nextZIndex++;
    });
  }

  /**
   * Sets up node hover events
   * @param graph The X6 graph instance
   * @param nodeHighlighter The node highlighter configuration
   */
  private setupNodeHoverEvents(graph: Graph, nodeHighlighter: HighlighterConfig): void {
    // Handle node hover
    graph.on('node:mouseenter', ({ view }) => {
      // Highlight the node using the view
      view.highlight(null, {
        highlighter: nodeHighlighter,
      });

      // Show ports when hovering over the node
      if (this.nodeService.isDfdNode(view.cell)) {
        const node = view.cell;
        const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
          'top',
          'right',
          'bottom',
          'left',
        ];

        directions.forEach(direction => {
          const dfdNode = node as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;
          dfdNode.getPortsByDirection(direction).forEach(port => {
            const portNode = view.findPortElem(port.id, 'portBody');
            if (portNode) {
              portNode.setAttribute('visibility', 'visible');
            }
          });
        });
      }
    });

    // Handle node leave
    graph.on('node:mouseleave', ({ cell, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: nodeHighlighter,
      });

      // Only remove tools if the node is not selected
      if (cell !== this._selectedNode) {
        cell.removeTools();
      }

      // Hide ports when not hovering, except for ports that are in use
      if (this.nodeService.isDfdNode(cell)) {
        this.portService.hideUnusedPortsOnAllNodes(graph);
      }
    });
  }

  /**
   * Sets up node click events
   * @param graph The X6 graph instance
   */
  private setupNodeClickEvents(graph: Graph): void {
    graph.on('node:click', ({ cell, e }) => {
      // Prevent event propagation to avoid deselection
      e.stopPropagation();

      // Check if the clicked node is already selected
      const isAlreadySelected = this._selectedNode === cell;

      // If there's a previously selected node, deselect it
      if (this._selectedNode && this._selectedNode !== cell) {
        // Remove tools from the previously selected node
        this._selectedNode.removeTools();

        // Remove selection styling
        this._selectedNode.attr('selected', false);

        // Remove label drag handle
        this.labelEditorService.removeLabelDragHandle();
      }

      // If the node is already selected, do nothing (keep it selected)
      if (!isAlreadySelected) {
        // Select the clicked node
        this._selectedNode = cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;

        // Add selection styling
        cell.attr('selected', true);

        // Add tools to the selected node (remove button and boundary)
        const tools = [
          {
            name: 'button-remove',
            args: {
              x: '100%',
              y: 0,
              offset: { x: -10, y: 10 },
            },
          },
          {
            name: 'boundary',
            args: {
              padding: 10,
              attrs: {
                fill: '#47C769',
                stroke: 'none',
                'fill-opacity': 0.2,
              },
            },
          },
        ];

        cell.addTools(tools);

        // Add a custom attribute to the node to indicate its type
        if (cell instanceof ProcessShape) {
          cell.attr('data-shape-type', 'process');
        } else {
          cell.attr('data-shape-type', 'rect');
        }

        // Add resize handle styles if they don't exist yet
        this.addResizeHandleStyles();

        // Show label drag handle for the selected node
        this.labelEditorService.showLabelDragHandle(cell, graph);
      }
    });

    // Handle background click to deselect nodes
    graph.on('blank:click', () => {
      if (this._selectedNode) {
        // Remove all tools from the selected node
        this._selectedNode.removeTools();

        // Remove selection styling
        this._selectedNode.attr('selected', false);

        // Remove label drag handle
        this.labelEditorService.removeLabelDragHandle();

        this._selectedNode = null;
      }
    });
  }

  /**
   * Sets up edge events
   * @param graph The X6 graph instance
   * @param edgeHighlighter The edge highlighter configuration
   */
  private setupEdgeEvents(graph: Graph, edgeHighlighter: HighlighterConfig): void {
    // Handle edge hover
    graph.on('edge:mouseenter', ({ edge, view }) => {
      // Highlight the edge using the view
      view.highlight(null, {
        highlighter: edgeHighlighter,
      });

      // Add tools (target arrowhead, vertices, and remove button)
      edge.addTools([
        'target-arrowhead',
        {
          name: 'vertices',
          args: {
            attrs: {
              fill: '#666',
              stroke: '#A2B1C3',
              strokeWidth: 1,
            },
          },
        },
        {
          name: 'button-remove',
          args: {
            distance: -30,
          },
        },
      ]);
    });

    // Handle edge leave
    graph.on('edge:mouseleave', ({ edge, view }) => {
      // Remove the highlight using the view
      view.unhighlight(null, {
        highlighter: edgeHighlighter,
      });

      // Remove tools
      edge.removeTools();
    });

    // Handle edge removal
    graph.on('edge:removed', ({ edge, options }) => {
      if (!options['ui'] || !graph) {
        return;
      }

      // Get both source and target cells
      const source = edge.getSourceCell();
      const target = edge.getTargetCell();

      // Log edge deletion
      const sourceId = edge.getSourcePortId();
      const targetId = edge.getTargetPortId();
      this.logger.info(
        `Edge deleted: from ${source?.id}:${sourceId} to ${target?.id}:${targetId}`,
        { edgeId: edge.id },
      );

      // Hide all unused ports on all nodes
      this.portService.hideUnusedPortsOnAllNodes(graph);
    });
  }

  /**
   * Sets up port events
   * @param graph The X6 graph instance
   */
  private setupPortEvents(graph: Graph): void {
    // Show all ports when starting to create an edge
    graph.on('edge:mousedown', () => {
      this.portService.showAllPorts(graph);
    });

    // Show all ports when starting to create an edge from a port
    graph.on('node:port:mousedown', ({ node, port }) => {
      // Log when user starts creating an edge from a port
      this.logger.info(`Starting edge creation from node port`, {
        nodeId: node?.id,
        portId: String(port),
      });

      // Show all ports on all nodes when starting to create an edge
      this.portService.showAllPorts(graph);
    });

    // Show ports when creating a new edge
    graph.on('edge:connected', ({ edge }) => {
      // Log edge connection
      const sourceId = edge.getSourcePortId();
      const targetId = edge.getTargetPortId();
      const sourceCell = edge.getSourceCell();
      const targetCell = edge.getTargetCell();

      this.logger.info(
        `Edge connected: from ${sourceCell?.id}:${sourceId} to ${targetCell?.id}:${targetId}`,
        { edgeId: edge.id },
      );

      // Hide unused ports
      this.portService.hideUnusedPortsOnAllNodes(graph);
    });
  }

  /**
   * Adds resize handle styles to the document
   */
  private addResizeHandleStyles(): void {
    // Add a style element to the document if it doesn't exist yet
    if (!document.getElementById('resize-handles-style')) {
      const style = document.createElement('style');
      style.id = 'resize-handles-style';
      style.textContent = `
        /* Style the resize handles as smaller, solid black squares */
        .x6-widget-transform {
          border: none !important;
        }
        /* Base style for all resize handles */
        .x6-widget-transform-resize {
          width: 8px !important;
          height: 8px !important;
          border-radius: 0 !important;
          background-color: #000000 !important;
          border: none !important;
          outline: none !important;
          position: absolute !important;
        }
        
        /* Position the handles using nth-child selectors */
        /* Top-left handle */
        .x6-widget-transform-resize:nth-child(1) {
          top: -4px !important;
          left: -4px !important;
        }
        
        /* Top-middle handle */
        .x6-widget-transform-resize:nth-child(2) {
          top: -4px !important;
        }
        
        /* Top-right handle */
        .x6-widget-transform-resize:nth-child(3) {
          top: -4px !important;
          right: -6px !important;
        }
        
        /* Middle-right handle */
        .x6-widget-transform-resize:nth-child(4) {
          right: -6px !important;
        }
        
        /* Bottom-right handle */
        .x6-widget-transform-resize:nth-child(5) {
          bottom: -6px !important;
          right: -6px !important;
        }
        
        /* Bottom-middle handle */
        .x6-widget-transform-resize:nth-child(6) {
          bottom: -6px !important;
        }
        
        /* Bottom-left handle */
        .x6-widget-transform-resize:nth-child(7) {
          bottom: -6px !important;
          left: -4px !important;
        }
        
        /* Middle-left handle */
        .x6-widget-transform-resize:nth-child(8) {
          left: -4px !important;
        }
        /* Ensure circular nodes maintain aspect ratio during resize */
        [data-shape-type="process"] {
          aspect-ratio: 1 / 1;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Gets the currently selected node
   * @returns The currently selected node
   */
  getSelectedNode(): ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape | null {
    return this._selectedNode;
  }

  /**
   * Sets the currently selected node
   * @param node The node to select
   */
  setSelectedNode(
    node: ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape | null,
  ): void {
    this._selectedNode = node;
  }
}
