import { Injectable } from '@angular/core';
import { Graph } from '@antv/x6';
import { HighlighterConfig } from '../models/highlighter-config.interface';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdHighlighterService } from './dfd-highlighter.service';
import { DfdPortService } from './dfd-port.service';
import { DfdNodeService } from './dfd-node.service';
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
    // Magnet availability highlighter is created but not used in this service
    this.highlighterService.createMagnetAvailabilityHighlighter();

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
        }
      }
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
        const nodeView = view;
        if (nodeView) {
          const directions: Array<'top' | 'right' | 'bottom' | 'left'> = [
            'top',
            'right',
            'bottom',
            'left',
          ];

          directions.forEach(direction => {
            const dfdNode = node as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;
            dfdNode.getPortsByDirection(direction).forEach(port => {
              const portNode = nodeView.findPortElem(port.id, 'portBody');
              if (portNode) {
                portNode.setAttribute('visibility', 'visible');
              }
            });
          });
        }
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

      // If there's a previously selected node, deselect it
      if (this._selectedNode && this._selectedNode !== cell) {
        // Remove tools from the previously selected node
        this._selectedNode.removeTools();
      }

      // Select the clicked node
      this._selectedNode = cell as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;

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
    });

    // Handle background click to deselect nodes
    graph.on('blank:click', () => {
      if (this._selectedNode) {
        // Remove all tools from the selected node
        this._selectedNode.removeTools();
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
