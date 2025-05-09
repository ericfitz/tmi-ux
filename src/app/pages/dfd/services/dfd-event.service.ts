import { Injectable } from '@angular/core';
import { Graph, Node } from '@antv/x6';
import { History } from '@antv/x6-plugin-history';
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
import { TextboxShape } from '../models/textbox-shape.model';
import { NodeData } from '../models/node-data.interface';
import { DfdEventBusService } from './dfd-event-bus.service';

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
    private eventBus: DfdEventBusService,
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

    this.logger.debug('Starting z-index recalculation after embedding', {
      childId: childNode.id,
      parentId,
    });

    // Recalculate z-indices for all shapes in the graph
    this.recalculateAllZIndices(graph);
  }

  /**
   * Resets the z-index of a node and recursively adjusts its children
   * @param graph The X6 graph instance
   * @param node The node to reset
   */
  private resetNodeZIndices(graph: Graph, node: Node<Node.Properties>): void {
    this.logger.debug(`Resetting z-indices after un-embedding node ${node.id}`);

    // Set the un-embedded node's z-index to 0 (unless it's a security boundary)
    if (!(node instanceof SecurityBoundaryShape)) {
      node.setZIndex(0);
      this.logger.debug(`Reset z-index of un-embedded node ${node.id} to 0`);
    } else {
      node.setZIndex(-1);
      this.logger.debug(`Reset z-index of security boundary ${node.id} to -1`);
    }

    // Find all children of this node
    const children = graph.getNodes().filter(childNode => {
      return childNode.getParent()?.id === node.id;
    });

    if (children.length > 0) {
      this.logger.debug(`Adjusting z-indices for ${children.length} children of ${node.id}`);

      // Start with z-index 1 for the first child
      let nextZIndex = 1;

      // Adjust z-index for each child
      children.forEach(childNode => {
        childNode.setZIndex(nextZIndex);
        this.logger.debug(`Set z-index of child ${childNode.id} to ${nextZIndex}`);

        // Recursively adjust this child's children
        this.adjustChildrenZIndices(graph, childNode, nextZIndex);

        // Increment for next sibling
        nextZIndex++;
      });
    } else {
      // If no children, no need for further adjustments
      this.logger.debug(`Node ${node.id} has no children, no further z-index adjustments needed`);
    }
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
   * Recalculates z-indices for all shapes in the graph
   * Ensures security boundaries are below everything else,
   * and child shapes are above their parent
   * @param graph The X6 graph instance
   */
  private recalculateAllZIndices(graph: Graph): void {
    if (!graph) return;

    this.logger.debug('Recalculating all z-indices');

    // Step 1: Collect all nodes and identify security boundaries
    const allNodes = graph.getNodes();
    const securityBoundaries: Node<Node.Properties>[] = [];
    const regularNodes: Node<Node.Properties>[] = [];

    allNodes.forEach(node => {
      if (node instanceof SecurityBoundaryShape) {
        securityBoundaries.push(node);
      } else {
        regularNodes.push(node);
      }
    });

    // Step 2: Set security boundaries to z-index -1
    securityBoundaries.forEach(node => {
      node.setZIndex(-1);
      this.logger.debug(`Set security boundary ${node.id} z-index to -1`);
    });

    // Step 3: Build a hierarchy map of parent-child relationships
    const hierarchyMap = new Map<string, Node<Node.Properties>[]>();
    const rootNodes: Node<Node.Properties>[] = [];

    regularNodes.forEach(node => {
      const parent = node.getParent();
      if (parent) {
        const parentId = parent.id;
        if (!hierarchyMap.has(parentId)) {
          hierarchyMap.set(parentId, []);
        }
        hierarchyMap.get(parentId)?.push(node);
      } else {
        rootNodes.push(node);
      }
    });

    // Step 4: Set all root nodes (nodes without parents) to z-index 0
    rootNodes.forEach(node => {
      node.setZIndex(0);
      this.logger.debug(`Set root node ${node.id} z-index to 0`);
    });

    // Step 5: Process children of each root node
    rootNodes.forEach(node => {
      // Process children recursively starting from z-index 1
      this.setChildrenZIndices(node, 1, hierarchyMap);
    });

    this.logger.debug('Z-index recalculation complete');
  }

  /**
   * Sets z-indices for children of a node recursively
   * @param parentNode The parent node
   * @param startZIndex The starting z-index for children
   * @param hierarchyMap Map of parent-child relationships
   * @returns The next available z-index
   */
  private setChildrenZIndices(
    parentNode: Node<Node.Properties>,
    startZIndex: number,
    hierarchyMap: Map<string, Node<Node.Properties>[]>,
  ): number {
    let currentZIndex = startZIndex;
    const children = hierarchyMap.get(parentNode.id) || [];

    children.forEach(child => {
      child.setZIndex(currentZIndex);
      this.logger.debug(`Set child node ${child.id} z-index to ${currentZIndex}`);
      currentZIndex++;

      // Process this child's children
      currentZIndex = this.setChildrenZIndices(child, currentZIndex, hierarchyMap);
    });

    return currentZIndex;
  }

  /**
   * Counts the total number of descendants for a node
   * @param nodeId The node ID
   * @param hierarchyMap Map of parent-child relationships
   * @returns The number of descendants
   */
  private countDescendants(
    nodeId: string,
    hierarchyMap: Map<string, Node<Node.Properties>[]>,
  ): number {
    const children = hierarchyMap.get(nodeId) || [];
    let count = children.length;

    children.forEach(child => {
      count += this.countDescendants(child.id, hierarchyMap);
    });

    return count;
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
          const ports = dfdNode instanceof ActorShape || 
                     dfdNode instanceof ProcessShape || 
                     dfdNode instanceof StoreShape || 
                     dfdNode instanceof SecurityBoundaryShape 
                     ? dfdNode.getPortsByGroup(direction)
                     : [];
                    
          ports.forEach(port => {
            const portId = typeof port.id === 'string' ? port.id : String(port.id);
            const portNode = view.findPortElem(portId, 'portBody');
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

        // No need to remove label drag handle anymore
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

        // Add data attributes for shape types to enable CSS targeting
        this.addShapeTypeAttributes(cell);

        // No need to show label drag handle anymore
        
        // Publish event that a node was selected
        this.eventBus.publishNodeSelected(cell);
        this.logger.debug('Node selected', { nodeId: cell.id });
      }
    });

    // Handle background click to deselect nodes
    graph.on('blank:click', () => {
      if (this._selectedNode) {
        // Remove all tools from the selected node
        this._selectedNode.removeTools();

        // Remove selection styling
        this._selectedNode.attr('selected', false);

        // No need to remove label drag handle anymore
        
        // Publish event that a node was deselected
        this.eventBus.publishNodeDeselected();
        this.logger.debug('Node deselected');

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
   * Adds data attributes for shape types to enable CSS targeting
   * @param node The node to add attributes to
   */
  private addShapeTypeAttributes(node: Node): void {
    if (node instanceof ProcessShape) {
      node.attr('data-shape-type', 'process');
    } else if (node instanceof ActorShape) {
      node.attr('data-shape-type', 'actor');
    } else if (node instanceof StoreShape) {
      node.attr('data-shape-type', 'store');
    } else if (node instanceof SecurityBoundaryShape) {
      node.attr('data-shape-type', 'securityBoundary');
    } else if (node instanceof TextboxShape) {
      node.attr('data-shape-type', 'textbox');
    }
  }

  /**
   * Deselects all nodes in the graph
   * @param graph The X6 graph instance
   */
  deselectAll(graph: Graph): void {
    if (this._selectedNode) {
      // Remove tools from the selected node
      this._selectedNode.removeTools();
      
      // Remove selection styling
      this._selectedNode.attr('selected', false);
      
      // Clear selection
      this._selectedNode = null;
      
      // Publish event that nodes were deselected
      this.eventBus.publishNodeDeselected();
    }
    
    // Make sure no other nodes have selection styling
    graph.getNodes().forEach(node => {
      node.attr('selected', false);
      node.removeTools();
    });
    
    this.logger.debug('Deselected all nodes');
  }
  
  /**
   * Selects a specific node
   * @param node The node to select
   */
  selectNode(node: Node): void {
    if (!node) return;
    
    // Cast to proper type
    const dfdNode = node as ActorShape | ProcessShape | StoreShape | SecurityBoundaryShape;
    
    // Get node data to determine its real type
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const nodeData = node.getData();
    if (nodeData && typeof nodeData === 'object' && 'label' in nodeData) {
      // Looks like a DFD node based on data, even if its constructor doesn't match
      // This happens with nodes restored via undo/redo which can lose their specific shape type
      this.logger.debug('Node appears to be a DFD node based on data structure', { 
        nodeId: node.id, 
        nodeType: node.constructor.name,
        hasLabelProperty: 'label' in nodeData
      });
    } 
    // Only warn if node doesn't appear to be a DFD node at all
    else if (!this.nodeService.isDfdNode(node)) {
      this.logger.warn('Attempted to select a non-DFD node', {
        nodeId: node.id,
        nodeType: node.constructor.name
      });
      return;
    }
    
    // Set as selected node
    this._selectedNode = dfdNode;
    
    // Add selection styling
    node.attr('selected', true);
    
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
    
    node.addTools(tools);
    
    // Add data attributes for shape types to enable CSS targeting
    this.addShapeTypeAttributes(node);
    
    // Publish event that a node was selected
    this.eventBus.publishNodeSelected(node);
    
    this.logger.debug('Selected node', {
      nodeId: node.id,
      nodeType: node.constructor.name
    });
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
  
  /**
   * Notifies the event bus of history state changes
   * @param history The history plugin instance
   */
  notifyHistoryChange(history: History): void {
    if (!history) {
      return;
    }
    
    const canUndo = history.canUndo();
    const canRedo = history.canRedo();
    
    this.logger.debug(`Notifying history state change: canUndo=${canUndo}, canRedo=${canRedo}`);
    
    // Publish state change to event bus (but don't add it to history)
    // Use silent option to prevent recursive history entries
    this.eventBus.publishHistoryChange(canUndo, canRedo);
  }
}
