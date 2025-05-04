import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Graph, Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { NodeData } from '../models/node-data.interface';

/**
 * Service for handling label editing in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdLabelEditorService {
  private _renderer: Renderer2;
  private _editingCell: Cell | null = null;
  private _inputElement: HTMLInputElement | null = null;
  private _clickOutsideListener: (() => void) | null = null;
  private _keydownListener: ((event: KeyboardEvent) => void) | null = null;

  constructor(
    private logger: LoggerService,
    rendererFactory: RendererFactory2,
  ) {
    this._renderer = rendererFactory.createRenderer(null, null);
  }

  /**
   * Sets up label editing event handlers for the graph
   * @param graph The X6 graph instance
   */
  setupLabelEditingHandlers(graph: Graph): void {
    if (!graph) {
      return;
    }

    // Handle double-click on nodes
    graph.on('node:dblclick', ({ node, e }) => {
      e.stopPropagation();
      this.startEditing(node, graph);
    });

    // Handle double-click on edges
    graph.on('edge:dblclick', ({ edge, e }) => {
      e.stopPropagation();
      this.startEditing(edge, graph);
    });

    // Handle double-click on ports
    graph.on('node:port:dblclick', ({ node, port, e }) => {
      e.stopPropagation();
      // For ports, we need to handle them differently since they're part of a node
      if (port) {
        this.startPortEditing(node, String(port), graph);
      }
    });

    // Handle blank click to cancel editing if clicking outside
    graph.on('blank:click', () => {
      this.stopEditing(true);
    });

    // Handle node click to cancel editing if clicking on another node
    graph.on('node:click', ({ node }) => {
      if (this._editingCell && this._editingCell !== node) {
        this.stopEditing(true);
      }
    });

    // Handle edge click to cancel editing if clicking on another edge
    graph.on('edge:click', ({ edge }) => {
      if (this._editingCell && this._editingCell !== edge) {
        this.stopEditing(true);
      }
    });
  }

  /**
   * Starts editing the label of a cell (node or edge)
   * @param cell The cell to edit
   * @param graph The X6 graph instance
   */
  private startEditing(cell: Cell, graph: Graph): void {
    // If already editing, stop the current editing session
    if (this._editingCell) {
      this.stopEditing(true);
    }

    this._editingCell = cell;

    // Get the current label text
    let labelText = '';
    if (cell.isNode()) {
      // For nodes, get the label from the node data or attrs
      const rawNodeData = cell.getData();
      const nodeData: NodeData | undefined =
        typeof rawNodeData === 'object' && rawNodeData !== null
          ? (rawNodeData as NodeData)
          : undefined;

      if (nodeData && typeof nodeData.label === 'string') {
        labelText = nodeData.label;
      } else {
        // If no label in data, get it from the attrs
        const attrLabel = cell.attr('label/text');
        labelText = typeof attrLabel === 'string' ? attrLabel : '';
      }
    } else if (cell.isEdge()) {
      // For edges, get the label from the edge attrs
      const attrLabel = cell.attr('label/text');
      labelText = typeof attrLabel === 'string' ? attrLabel : '';
    }

    // Create an input element for editing
    this.createInputElement(cell, labelText, graph);
  }

  /**
   * Starts editing the label of a port
   * @param node The node containing the port
   * @param portId The port ID
   * @param graph The X6 graph instance
   */
  private startPortEditing(node: Node, portId: string, graph: Graph): void {
    // If already editing, stop the current editing session
    if (this._editingCell) {
      this.stopEditing(true);
    }

    this._editingCell = node;

    // Get the current port label
    const port = node.getPort(portId);
    let labelText = '';
    if (port && port.attrs && port.attrs['text']) {
      const textAttr = port.attrs['text'];
      labelText = typeof textAttr['text'] === 'string' ? textAttr['text'] : '';
    }

    // Create an input element for editing the port label
    this.createPortInputElement(node, portId, labelText, graph);
  }

  /**
   * Creates an input element for editing a cell label
   * @param cell The cell being edited
   * @param initialText The initial text for the input
   * @param graph The X6 graph instance
   */
  private createInputElement(cell: Cell, initialText: string, graph: Graph): void {
    // Get the position and size of the cell
    const cellView = graph.findViewByCell(cell);
    if (!cellView) {
      return;
    }

    const cellBBox = cellView.getBBox();
    const graphContainer = graph.container;

    // Create the input element
    const input = this._renderer.createElement('input') as HTMLInputElement;
    this._renderer.setStyle(input, 'position', 'absolute');
    this._renderer.setStyle(input, 'z-index', '1000');
    this._renderer.setStyle(input, 'width', `${cellBBox.width}px`);
    this._renderer.setStyle(input, 'height', `${30}px`); // Fixed height for better usability
    this._renderer.setStyle(input, 'left', `${cellBBox.x}px`);
    this._renderer.setStyle(input, 'top', `${cellBBox.y + cellBBox.height / 2 - 15}px`); // Center vertically
    this._renderer.setStyle(input, 'font-size', '12px');
    this._renderer.setStyle(input, 'font-family', 'Arial, sans-serif');
    this._renderer.setStyle(input, 'text-align', 'center');
    this._renderer.setStyle(input, 'padding', '2px');
    this._renderer.setStyle(input, 'border', '1px solid #1890ff');
    this._renderer.setStyle(input, 'border-radius', '2px');
    this._renderer.setStyle(input, 'outline', 'none');
    this._renderer.setStyle(input, 'background', 'white');
    this._renderer.setAttribute(input, 'value', initialText);

    // Add the input to the graph container
    this._renderer.appendChild(graphContainer, input);
    this._inputElement = input;

    // Focus the input and select all text
    input.focus();
    input.select();

    // Add event listeners
    this.setupEventListeners();
  }

  /**
   * Creates an input element for editing a port label
   * @param node The node containing the port
   * @param portId The port ID
   * @param initialText The initial text for the input
   * @param graph The X6 graph instance
   */
  private createPortInputElement(
    node: Node,
    portId: string,
    initialText: string,
    graph: Graph,
  ): void {
    // Get the position of the port
    const nodeView = graph.findViewByCell(node);
    if (!nodeView) {
      return;
    }

    // Get the node's bounding box as a fallback
    const nodeBBox = nodeView.getBBox();

    // Since we can't directly access the port element with findPortElem,
    // we'll position the input near the node based on the port ID
    let portX = nodeBBox.x;
    let portY = nodeBBox.y;

    // Adjust position based on port direction (inferred from ID)
    if (portId.includes('top')) {
      portX = nodeBBox.x + nodeBBox.width / 2;
      portY = nodeBBox.y;
    } else if (portId.includes('right')) {
      portX = nodeBBox.x + nodeBBox.width;
      portY = nodeBBox.y + nodeBBox.height / 2;
    } else if (portId.includes('bottom')) {
      portX = nodeBBox.x + nodeBBox.width / 2;
      portY = nodeBBox.y + nodeBBox.height;
    } else if (portId.includes('left')) {
      portX = nodeBBox.x;
      portY = nodeBBox.y + nodeBBox.height / 2;
    }

    // Create a virtual port bounding box
    const portBBox = {
      x: portX - 5, // Assuming port radius is 5px
      y: portY - 5,
      width: 10,
      height: 10,
    };
    const graphContainer = graph.container;

    // Create the input element
    const input = this._renderer.createElement('input') as HTMLInputElement;
    this._renderer.setStyle(input, 'position', 'absolute');
    this._renderer.setStyle(input, 'z-index', '1000');
    this._renderer.setStyle(input, 'width', '80px'); // Fixed width for port labels
    this._renderer.setStyle(input, 'height', '24px'); // Fixed height for better usability
    this._renderer.setStyle(input, 'left', `${portBBox.x - 40 + portBBox.width / 2}px`); // Center horizontally
    this._renderer.setStyle(input, 'top', `${portBBox.y - 12 + portBBox.height / 2}px`); // Center vertically
    this._renderer.setStyle(input, 'font-size', '10px');
    this._renderer.setStyle(input, 'font-family', 'Arial, sans-serif');
    this._renderer.setStyle(input, 'text-align', 'center');
    this._renderer.setStyle(input, 'padding', '2px');
    this._renderer.setStyle(input, 'border', '1px solid #1890ff');
    this._renderer.setStyle(input, 'border-radius', '2px');
    this._renderer.setStyle(input, 'outline', 'none');
    this._renderer.setStyle(input, 'background', 'white');
    this._renderer.setAttribute(input, 'value', initialText);
    this._renderer.setAttribute(input, 'data-port-id', portId);

    // Add the input to the graph container
    this._renderer.appendChild(graphContainer, input);
    this._inputElement = input;

    // Focus the input and select all text
    input.focus();
    input.select();

    // Add event listeners
    this.setupEventListeners();
  }

  /**
   * Sets up event listeners for the input element
   */
  private setupEventListeners(): void {
    if (!this._inputElement) {
      return;
    }

    // Handle Enter key to save and Escape key to cancel
    this._keydownListener = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        this.stopEditing(true);
      } else if (event.key === 'Escape') {
        this.stopEditing(false);
      }
    };

    this._inputElement.addEventListener('keydown', this._keydownListener);

    // Handle click outside to save
    this._clickOutsideListener = () => {
      this.stopEditing(true);
    };

    // Use setTimeout to avoid immediate triggering
    setTimeout(() => {
      if (this._clickOutsideListener) {
        document.addEventListener('click', this._clickOutsideListener);
      }
    }, 0);

    // Prevent the click on the input from triggering the click outside handler
    this._inputElement.addEventListener('click', event => {
      event.stopPropagation();
    });
  }

  /**
   * Stops editing and optionally saves the changes
   * @param save Whether to save the changes
   */
  private stopEditing(save: boolean): void {
    if (!this._editingCell || !this._inputElement) {
      return;
    }

    // Get the new label text
    const newText = this._inputElement.value;

    // Save the changes if requested
    if (save) {
      this.saveLabel(newText);
    }

    // Clean up
    this.cleanupEditing();
  }

  /**
   * Saves the label text to the cell
   * @param newText The new label text
   */
  private saveLabel(newText: string): void {
    if (!this._editingCell) {
      return;
    }

    try {
      if (this._editingCell.isNode()) {
        const node = this._editingCell;

        // Check if we're editing a port
        const portId = this._inputElement?.getAttribute('data-port-id');
        if (portId) {
          // Update port label
          node.setPortProp(portId, 'attrs/text/text', newText);
          this.logger.info(`Updated port label for port ${portId} on node ${node.id}`, {
            nodeId: node.id,
            portId,
            newText,
          });
        } else {
          // Update node label
          node.attr('label/text', newText);

          // Also update the label in the node data
          const rawNodeData = node.getData();
          const nodeData: NodeData | undefined =
            typeof rawNodeData === 'object' && rawNodeData !== null
              ? (rawNodeData as NodeData)
              : undefined;

          if (nodeData) {
            const updatedData: NodeData = { ...nodeData, label: newText };
            node.setData(updatedData);
          }

          this.logger.info(`Updated node label for node ${node.id}`, {
            nodeId: node.id,
            newText,
          });
        }
      } else if (this._editingCell.isEdge()) {
        const edge = this._editingCell;

        // Update edge label
        edge.attr('label/text', newText);

        this.logger.info(`Updated edge label for edge ${edge.id}`, {
          edgeId: edge.id,
          newText,
        });
      }
    } catch (error) {
      this.logger.error('Error saving label:', error);
    }
  }

  /**
   * Cleans up the editing session
   */
  private cleanupEditing(): void {
    // Remove event listeners
    if (this._keydownListener && this._inputElement) {
      this._inputElement.removeEventListener('keydown', this._keydownListener);
      this._keydownListener = null;
    }

    if (this._clickOutsideListener) {
      document.removeEventListener('click', this._clickOutsideListener);
      this._clickOutsideListener = null;
    }

    // Remove the input element
    if (this._inputElement && this._inputElement.parentNode) {
      this._renderer.removeChild(this._inputElement.parentNode, this._inputElement);
      this._inputElement = null;
    }

    // Clear the editing cell reference
    this._editingCell = null;
  }
}
