import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Graph, Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { NodeData } from '../models/node-data.interface';
import { TextboxShape } from '../models/textbox-shape.model';

/**
 * Type guard function to check if an object is a NodeData
 * @param data The data to check
 * @returns True if the data is a NodeData
 */
function isNodeData(data: unknown): data is NodeData {
  return data !== null && typeof data === 'object' && data !== undefined;
}

/**
 * Service for handling label editing and positioning in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdLabelEditorService {
  private _renderer: Renderer2;
  // Label editing properties
  private _editingCell: Cell | null = null;
  private _editingGraph: Graph | null = null; // Store the graph for recreating bounding boxes
  private _inputElement: HTMLInputElement | null = null;
  private _placeholderRect: HTMLDivElement | null = null; // Placeholder rectangle for dragging
  private _clickOutsideListener: (() => void) | null = null;
  private _keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private _mouseMoveListener: ((event: MouseEvent) => void) | null = null;
  private _mouseUpListener: ((event: MouseEvent) => void) | null = null;
  private _isDragging = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _initialInputPosition = { x: 0, y: 0 }; // Store initial position for calculating final position

  // Label selection properties
  private _selectedLabel: SVGTextElement | null = null;
  private _labelBoundingBox: HTMLDivElement | null = null;
  private _initialPosition = { x: 0, y: 0 }; // Store initial position for calculating final position

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
      this.deselectLabel();
    });

    // Handle node click to cancel editing if clicking on another node
    graph.on('node:click', ({ node, e }) => {
      if (this._editingCell && this._editingCell !== node) {
        this.stopEditing(true);
      }

      // Check if the click was on a label
      const target = e.target as Element;
      if (target.tagName === 'text' || target.tagName === 'tspan') {
        e.stopPropagation();
        this.selectLabel(node, target as SVGTextElement, graph);
      } else {
        this.deselectLabel();
      }
    });

    // Handle edge click to cancel editing if clicking on another edge
    graph.on('edge:click', ({ edge, e }) => {
      if (this._editingCell && this._editingCell !== edge) {
        this.stopEditing(true);
      }

      // Check if the click was on a label
      const target = e.target as Element;
      if (target.tagName === 'text' || target.tagName === 'tspan') {
        e.stopPropagation();
        this.selectLabel(edge, target as SVGTextElement, graph);
      } else {
        this.deselectLabel();
      }
    });

    // Handle node unselection to cancel editing
    graph.on('node:unselected', ({ node }: { node: Node }) => {
      if (this._editingCell === node) {
        this.stopEditing(true);
      }
    });

    // Handle edge unselection to cancel editing
    graph.on('edge:unselected', ({ edge }: { edge: Cell }) => {
      if (this._editingCell === edge) {
        this.stopEditing(true);
      }
    });

    // Handle cell removal to cancel editing
    graph.on('cell:removed', ({ cell }: { cell: Cell }) => {
      // Always stop editing when any cell is removed
      this.stopEditing(false);
      this.deselectLabel();

      // Log the removal for debugging
      this.logger.info(`Cell removed, cleaning up any editing state`, {
        cellId: cell.id,
        editingCellId: this._editingCell?.id,
      });
    });

    // Handle blank mousedown which might hide tools
    graph.on('blank:mousedown', () => {
      this.cleanupEditing();
      this.deselectLabel();
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
    this._editingGraph = graph; // Store the graph for later use

    // Get the current label text
    let labelText = '';
    if (cell.isNode()) {
      // For nodes, get the label from the node data or attrs
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
    this._editingGraph = graph; // Store the graph for later use

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

    // If we have a selected label with a bounding box, use that for positioning
    let position = { x: 0, y: 0, width: 0, height: 0 };

    if (this._labelBoundingBox) {
      const rect = this._labelBoundingBox.getBoundingClientRect();
      position = {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };

      // Hide the bounding box during editing
      this._renderer.setStyle(this._labelBoundingBox, 'visibility', 'hidden');
    } else {
      // Otherwise, use the cell's bounding box
      const cellBBox = cellView.getBBox();
      position = {
        x: cellBBox.x,
        y: cellBBox.y + cellBBox.height / 2 - 15, // Center vertically
        width: cellBBox.width,
        height: 30, // Fixed height for better usability
      };
    }

    const graphContainer = graph.container;

    // Create the input element
    const input = this._renderer.createElement('input') as HTMLInputElement;
    this._renderer.setStyle(input, 'position', 'absolute');
    this._renderer.setStyle(input, 'z-index', '1000');
    this._renderer.setStyle(input, 'width', `${position.width}px`);
    this._renderer.setStyle(input, 'height', `${position.height}px`);
    this._renderer.setStyle(input, 'left', `${position.x}px`);
    this._renderer.setStyle(input, 'top', `${position.y}px`);
    this._renderer.setStyle(input, 'font-size', '12px');
    this._renderer.setStyle(input, 'font-family', '"Roboto Condensed", Arial, sans-serif');
    this._renderer.setStyle(input, 'padding', '2px');
    this._renderer.setStyle(input, 'border', '1px solid #1890ff');
    this._renderer.setStyle(input, 'border-radius', '2px');
    this._renderer.setStyle(input, 'outline', 'none');
    this._renderer.setStyle(input, 'background', 'white');
    this._renderer.setAttribute(input, 'value', initialText);

    // Check if the cell is a TextboxShape
    if (cell instanceof TextboxShape) {
      // For textbox nodes, align text to top-left
      this._renderer.setStyle(input, 'text-align', 'left');
      this._renderer.setStyle(input, 'vertical-align', 'top');
    } else {
      // For other nodes, use center alignment
      this._renderer.setStyle(input, 'text-align', 'center');
    }

    // Add the input to the graph container
    this._renderer.appendChild(graphContainer, input);
    this._inputElement = input;

    // Focus the input and select all text
    input.focus();
    input.select();

    // Add event listeners
    this.setupEventListeners();

    // Make the input auto-resize as the user types
    input.addEventListener('input', () => {
      // Create a temporary span to measure the text width
      const tempSpan = document.createElement('span');
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.style.whiteSpace = 'nowrap';
      tempSpan.style.fontSize = '12px';
      tempSpan.style.fontFamily = '"Roboto Condensed", Arial, sans-serif';
      tempSpan.textContent = input.value;
      document.body.appendChild(tempSpan);

      // Get the width of the text plus some padding
      const textWidth = tempSpan.offsetWidth + 20;

      // Remove the temporary span
      document.body.removeChild(tempSpan);

      // Update the input width, but don't make it smaller than the original width
      const newWidth = Math.max(textWidth, position.width);
      this._renderer.setStyle(input, 'width', `${newWidth}px`);
    });
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
    this._renderer.setStyle(input, 'font-size', '12px'); // Match font size with other objects
    this._renderer.setStyle(input, 'font-family', '"Roboto Condensed", Arial, sans-serif');
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

    // Make the input auto-resize as the user types
    input.addEventListener('input', () => {
      // Create a temporary span to measure the text width
      const tempSpan = document.createElement('span');
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.position = 'absolute';
      tempSpan.style.whiteSpace = 'nowrap';
      tempSpan.style.fontSize = '12px';
      tempSpan.style.fontFamily = '"Roboto Condensed", Arial, sans-serif';
      tempSpan.textContent = input.value;
      document.body.appendChild(tempSpan);

      // Get the width of the text plus some padding
      const textWidth = tempSpan.offsetWidth + 20;

      // Remove the temporary span
      document.body.removeChild(tempSpan);

      // Update the input width, but don't make it smaller than 80px
      const newWidth = Math.max(textWidth, 80);
      this._renderer.setStyle(input, 'width', `${newWidth}px`);

      // Recenter the input
      this._renderer.setStyle(input, 'left', `${portBBox.x - newWidth / 2 + portBBox.width / 2}px`);
    });
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

    // Add mousedown event listener for dragging the label handle
    this._inputElement.addEventListener('mousedown', (event: MouseEvent) => {
      // Only handle left mouse button
      if (event.button !== 0) return;

      // Prevent default to avoid text selection during drag
      event.preventDefault();

      // Stop propagation to prevent other handlers from interfering
      event.stopPropagation();

      this.logger.info('[LabelEditor] Mouse down on label editor input', {
        clientX: event.clientX,
        clientY: event.clientY,
        cellId: this._editingCell?.id,
      });

      // Set dragging flag
      this._isDragging = true;

      // Get the current position and dimensions of the input element
      if (!this._inputElement) return;

      const rect = this._inputElement.getBoundingClientRect();

      // Store initial position for calculating the final position
      this._initialInputPosition = {
        x: rect.left,
        y: rect.top,
      };

      this.logger.debug('[LabelEditor] Starting drag from position', {
        initialPosition: this._initialInputPosition,
        cellId: this._editingCell?.id,
      });

      // Hide the input element during dragging
      this._renderer.setStyle(this._inputElement, 'visibility', 'hidden');
      this.logger.debug('[LabelEditor] Input element hidden during drag');

      // Create placeholder rectangle for dragging
      this.createPlaceholderRect(rect);

      // Calculate the offset between mouse position and input element position
      // This ensures the drag handle doesn't jump when clicked
      this._dragOffsetX = event.clientX - rect.left;
      this._dragOffsetY = event.clientY - rect.top;

      // Add mousemove and mouseup listeners to document
      this._mouseMoveListener = (moveEvent: MouseEvent) => {
        if (!this._isDragging || !this._placeholderRect) return;

        // Update placeholder rectangle position to follow mouse cursor with the original offset
        const x = moveEvent.clientX - this._dragOffsetX;
        const y = moveEvent.clientY - this._dragOffsetY;

        this._renderer.setStyle(this._placeholderRect, 'left', `${x}px`);
        this._renderer.setStyle(this._placeholderRect, 'top', `${y}px`);

        this.logger.debug('[LabelEditor] Mouse move during drag', {
          clientX: moveEvent.clientX,
          clientY: moveEvent.clientY,
          placeholderPosition: { x, y },
        });
      };

      this._mouseUpListener = (upEvent: MouseEvent) => {
        if (!this._isDragging) {
          this._isDragging = false;
          return;
        }

        this.logger.info('[LabelEditor] Mouse up, ending drag', {
          clientX: upEvent.clientX,
          clientY: upEvent.clientY,
          cellId: this._editingCell?.id,
        });

        // Calculate the final position
        const finalX = upEvent.clientX - this._dragOffsetX;
        const finalY = upEvent.clientY - this._dragOffsetY;

        // Calculate the delta from the initial position
        const deltaX = finalX - this._initialInputPosition.x;
        const deltaY = finalY - this._initialInputPosition.y;

        this.logger.debug('[LabelEditor] Calculated position delta', {
          deltaX,
          deltaY,
          cellId: this._editingCell?.id,
        });

        // Make the input element visible again
        if (this._inputElement) {
          this._renderer.setStyle(this._inputElement, 'visibility', 'visible');
          this.logger.debug('[LabelEditor] Input element made visible again');

          // Update the input element position to match the placeholder's final position
          this._renderer.setStyle(this._inputElement, 'left', `${finalX}px`);
          this._renderer.setStyle(this._inputElement, 'top', `${finalY}px`);
          this.logger.debug('[LabelEditor] Input element position updated', {
            finalX,
            finalY,
          });
        }

        // If we have a cell being edited, update its label position ONLY NOW at the end of dragging
        if (this._editingCell && this._editingCell.isNode()) {
          this.logger.info('[LabelEditor] Updating actual label position at end of drag', {
            cellId: this._editingCell.id,
            deltaX,
            deltaY,
          });
          this.updateLabelPositionByDelta(deltaX, deltaY);
        }

        // Remove the placeholder rectangle
        this.removePlaceholderRect();

        // Reset dragging state
        this._isDragging = false;

        // Remove mousemove and mouseup listeners
        if (this._mouseMoveListener) {
          document.removeEventListener('mousemove', this._mouseMoveListener);
          this._mouseMoveListener = null;
        }

        if (this._mouseUpListener) {
          document.removeEventListener('mouseup', this._mouseUpListener);
          this._mouseUpListener = null;
        }

        this.logger.debug('[LabelEditor] Drag event listeners removed');
      };

      document.addEventListener('mousemove', this._mouseMoveListener);
      document.addEventListener('mouseup', this._mouseUpListener);
      this.logger.debug('[LabelEditor] Drag event listeners added');
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

    // Store the cell and graph for later use
    const cell = this._editingCell;
    const graph = this._editingGraph;

    // Clean up
    this.cleanupEditing();

    // If we have a cell and graph, recreate the bounding box
    if (cell && graph) {
      // Get the node view
      const nodeView = graph.findViewByCell(cell);
      if (nodeView) {
        // Find the label element
        let labelElement = nodeView.findOne('text.joint-cell-label') as SVGTextElement;

        // If not found with the first selector, try a more general one
        if (!labelElement) {
          labelElement = nodeView.findOne('text') as SVGTextElement;
        }

        // If found, create a bounding box
        if (labelElement) {
          this.selectLabel(cell, labelElement, graph);
        }
      }
    }
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
          // Check if the node is a TextboxShape
          if (node instanceof TextboxShape) {
            // Update the HTML content for TextboxShape
            node.updateHtml(newText);

            // Also update the label in the node data
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const rawNodeData = node.getData();
            const nodeData: NodeData | undefined =
              typeof rawNodeData === 'object' && rawNodeData !== null
                ? (rawNodeData as NodeData)
                : undefined;

            if (nodeData) {
              const updatedData: NodeData = { ...nodeData, label: newText };
              node.setData(updatedData);
            }

            this.logger.info(`Updated textbox content for node ${node.id}`, {
              nodeId: node.id,
              newText,
            });
          } else {
            // Update node label for other shape types
            node.attr('label/text', newText);

            // Also update the label in the node data
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const rawNodeData = node.getData();
            const nodeData: NodeData | undefined =
              typeof rawNodeData === 'object' && rawNodeData !== null
                ? (rawNodeData as NodeData)
                : undefined;

            // Check if the label already has a position
            const hasPosition =
              nodeData?.labelPosition &&
              (nodeData.labelPosition.x !== 0 || nodeData.labelPosition.y !== 0);

            // If the label doesn't have a position, center it in the shape
            if (!hasPosition && this._selectedLabel) {
              // Get the node size
              const nodeSize = node.getSize();
              const centerX = nodeSize.width / 2;
              const centerY = nodeSize.height / 2;

              // Calculate the centered position
              // We don't need to adjust for the label's width/height here because
              // the refX/refY coordinates are relative to the node's center
              const updatedData: NodeData = {
                ...nodeData,
                label: newText,
                labelPosition: { x: centerX, y: centerY },
              };

              // Set the data and update the label position
              node.setData(updatedData);

              // Apply the position to the label
              node.attr({
                label: {
                  refX: centerX,
                  refY: centerY,
                },
              });

              this.logger.info(`Centered label for node ${node.id}`, {
                nodeId: node.id,
                position: { x: centerX, y: centerY },
              });
            } else if (nodeData) {
              // Just update the text without changing position
              const updatedData: NodeData = { ...nodeData, label: newText };
              node.setData(updatedData);
            }

            this.logger.info(`Updated node label for node ${node.id}`, {
              nodeId: node.id,
              newText,
            });
          }
        }
      } else if (this._editingCell.isEdge()) {
        const edge = this._editingCell;

        // Update edge label in both attr and labels array
        edge.attr('label/text', newText);

        // Update the label in the labels array
        const labels = edge.getLabels();
        if (labels && labels.length > 0) {
          edge.setLabels(
            labels.map(label => ({
              ...label,
              attrs: {
                ...label.attrs,
                text: {
                  ...label.attrs?.['text'],
                  text: newText,
                },
              },
            })),
          );
        }

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
   * Creates a placeholder rectangle for dragging
   * @param rect The bounding rectangle of the input element
   */
  private createPlaceholderRect(rect: DOMRect): void {
    // Remove any existing placeholder
    this.removePlaceholderRect();

    this.logger.debug('[LabelEditor] Creating placeholder rectangle', {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      cellId: this._editingCell?.id,
    });

    // Create the placeholder rectangle - append to document.body for maximum visibility
    const placeholder = this._renderer.createElement('div') as HTMLDivElement;
    this._renderer.setStyle(placeholder, 'position', 'fixed'); // Use fixed positioning to ensure visibility
    this._renderer.setStyle(placeholder, 'z-index', '9999'); // Very high z-index to ensure visibility
    this._renderer.setStyle(placeholder, 'width', `${rect.width}px`);
    this._renderer.setStyle(placeholder, 'height', `${rect.height}px`);
    this._renderer.setStyle(placeholder, 'left', `${rect.left}px`);
    this._renderer.setStyle(placeholder, 'top', `${rect.top}px`);
    this._renderer.setStyle(placeholder, 'border', '2px dashed #ff3366'); // More visible border
    this._renderer.setStyle(placeholder, 'background-color', 'rgba(255, 51, 102, 0.2)'); // More visible background
    this._renderer.setStyle(placeholder, 'pointer-events', 'none'); // Allow events to pass through

    // Add the placeholder to the document body for maximum visibility
    this._renderer.appendChild(document.body, placeholder);
    this._placeholderRect = placeholder;

    this.logger.info('[LabelEditor] Created placeholder rectangle for label dragging', {
      cellId: this._editingCell?.id,
    });
  }

  /**
   * Updates the label position by delta values (used during editing)
   * @param deltaX The change in X position
   * @param deltaY The change in Y position
   */
  private updateLabelPositionByDelta(deltaX: number, deltaY: number): void {
    if (!this._editingCell || !this._editingCell.isNode()) return;

    const node = this._editingCell;

    try {
      // Check if we're editing a port
      const portId = this._inputElement?.getAttribute('data-port-id');
      if (portId) {
        // For ports, we would need to implement port label positioning
        // This is more complex and might require additional work
        this.logger.info('[LabelEditor] Port label positioning not yet implemented', {
          nodeId: node.id,
          portId,
        });
      } else {
        // For regular node labels, update the position
        // Get the current node data
        const nodeData = node.getData<Record<string, unknown>>();
        const safeNodeData: NodeData =
          typeof nodeData === 'object' && nodeData !== null ? (nodeData as NodeData) : {};

        // Get current label position from node data
        const currentPosition = safeNodeData.labelPosition || { x: 0, y: 0 };

        // Calculate new position
        const newX = currentPosition.x + deltaX;
        const newY = currentPosition.y + deltaY;

        // Use the public method to update the position
        this.updateLabelPosition(node, newX, newY);
      }
    } catch (error) {
      this.logger.error('[LabelEditor] Error updating label position:', error);
    }
  }

  /**
   * Removes the placeholder rectangle
   */
  private removePlaceholderRect(): void {
    if (this._placeholderRect && this._placeholderRect.parentNode) {
      this._renderer.removeChild(this._placeholderRect.parentNode, this._placeholderRect);
      this._placeholderRect = null;

      this.logger.debug('[LabelEditor] Removed placeholder rectangle', {
        cellId: this._editingCell?.id,
      });
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

    // Remove mouse event listeners for dragging
    if (this._mouseMoveListener) {
      document.removeEventListener('mousemove', this._mouseMoveListener);
      this._mouseMoveListener = null;
    }

    if (this._mouseUpListener) {
      document.removeEventListener('mouseup', this._mouseUpListener);
      this._mouseUpListener = null;
    }

    // Reset dragging state
    this._isDragging = false;

    // Remove the placeholder rectangle
    this.removePlaceholderRect();

    // Remove the input element
    if (this._inputElement && this._inputElement.parentNode) {
      this._renderer.removeChild(this._inputElement.parentNode, this._inputElement);
      this._inputElement = null;
    }

    // Clear the editing cell and graph references
    this._editingCell = null;
    this._editingGraph = null;

    // Also deselect any selected label
    this.deselectLabel();
  }

  /**
   * Selects a label for potential dragging or editing
   * @param cell The cell containing the label
   * @param labelElement The SVG text element of the label
   * @param graph The X6 graph instance
   */
  private selectLabel(cell: Cell, labelElement: SVGTextElement, graph: Graph): void {
    // Deselect any previously selected label
    this.deselectLabel();

    this._selectedLabel = labelElement;

    // Create a bounding box around the label
    this.createLabelBoundingBox(cell, labelElement, graph);

    this.logger.info(`Label selected for cell ${cell.id}`);
  }

  /**
   * Creates a bounding box around the selected label
   * @param cell The cell containing the label
   * @param labelElement The SVG text element of the label
   * @param graph The X6 graph instance
   */
  private createLabelBoundingBox(cell: Cell, labelElement: SVGTextElement, graph: Graph): void {
    // Check if the label needs to be centered (only for nodes, not edges)
    if (cell.isNode()) {
      const node = cell;

      // Get the node data to check if the label has a position
      const rawNodeData = node.getData<Record<string, unknown>>();
      const nodeData: NodeData | undefined =
        typeof rawNodeData === 'object' && rawNodeData !== null
          ? (rawNodeData as NodeData)
          : undefined;

      // Check if the label already has a position
      const hasPosition =
        nodeData?.labelPosition &&
        (nodeData.labelPosition.x !== 0 || nodeData.labelPosition.y !== 0);

      // If the label doesn't have a position, center it in the shape
      if (!hasPosition) {
        // Get the node size
        const nodeSize = node.getSize();
        const centerX = nodeSize.width / 2;
        const centerY = nodeSize.height / 2;

        // Apply the centered position to the label
        node.attr({
          label: {
            refX: centerX,
            refY: centerY,
          },
        });

        // Update the node data
        if (nodeData) {
          const updatedData: NodeData = {
            ...nodeData,
            labelPosition: { x: centerX, y: centerY },
          };
          node.setData(updatedData);
        }

        this.logger.info(`Centered label for node ${node.id}`, {
          nodeId: node.id,
          position: { x: centerX, y: centerY },
        });
      }
    }

    // Get the bounding rectangle of the label
    const labelRect = labelElement.getBoundingClientRect();

    // Create the bounding box element
    const boundingBox = this._renderer.createElement('div') as HTMLDivElement;
    this._renderer.setStyle(boundingBox, 'position', 'absolute');
    this._renderer.setStyle(boundingBox, 'z-index', '1000');
    this._renderer.setStyle(boundingBox, 'width', `${labelRect.width + 10}px`); // Add padding
    this._renderer.setStyle(boundingBox, 'height', `${labelRect.height + 6}px`); // Add padding
    this._renderer.setStyle(boundingBox, 'left', `${labelRect.left - 5}px`); // Center horizontally
    this._renderer.setStyle(boundingBox, 'top', `${labelRect.top - 3}px`); // Center vertically
    this._renderer.setStyle(boundingBox, 'border', '2px dashed #ff0000');
    this._renderer.setStyle(boundingBox, 'background-color', 'rgba(255, 0, 0, 0.1)');
    this._renderer.setStyle(boundingBox, 'cursor', 'move');

    // Add the bounding box to the document body
    this._renderer.appendChild(document.body, boundingBox);
    this._labelBoundingBox = boundingBox;

    // Set up event listeners for dragging
    this.setupLabelDragEvents(cell, labelElement, graph);

    // Set up double-click to edit
    boundingBox.addEventListener('dblclick', e => {
      e.stopPropagation();
      this.startEditing(cell, graph);
    });
  }

  /**
   * Sets up drag events for the label bounding box
   * @param cell The cell containing the label
   * @param labelElement The SVG text element of the label
   * @param graph The X6 graph instance
   */
  private setupLabelDragEvents(cell: Cell, labelElement: SVGTextElement, _graph: Graph): void {
    if (!this._labelBoundingBox) return;

    // Mouse down event for starting drag
    this._labelBoundingBox.addEventListener('mousedown', e => {
      // Only handle left mouse button
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      this._isDragging = true;

      // Calculate the offset between mouse position and bounding box position
      const rect = this._labelBoundingBox!.getBoundingClientRect();
      this._dragOffsetX = e.clientX - rect.left;
      this._dragOffsetY = e.clientY - rect.top;

      // Store initial position for calculating the final position
      this._initialPosition = { x: e.clientX, y: e.clientY };

      // Get current label position from node data
      if (cell.isNode()) {
        const nodeData = cell.getData<Record<string, unknown>>();
        const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};
        const currentPosition = safeNodeData.labelPosition || { x: 0, y: 0 };
        this._initialPosition = { ...currentPosition };
      }

      // Add mousemove and mouseup listeners to document
      this._mouseMoveListener = (moveEvent: MouseEvent) => {
        if (!this._isDragging || !this._labelBoundingBox) return;

        // Update bounding box position to follow mouse cursor with the original offset
        const x = moveEvent.clientX - this._dragOffsetX;
        const y = moveEvent.clientY - this._dragOffsetY;

        this._renderer.setStyle(this._labelBoundingBox, 'left', `${x}px`);
        this._renderer.setStyle(this._labelBoundingBox, 'top', `${y}px`);
      };

      this._mouseUpListener = (upEvent: MouseEvent) => {
        if (!this._isDragging) return;

        this._isDragging = false;

        // Calculate the delta from the initial position
        const deltaX = upEvent.clientX - this._initialPosition.x;
        const deltaY = upEvent.clientY - this._initialPosition.y;

        // Update the label position
        if (cell.isNode()) {
          const node = cell;
          this.updateNodeLabelPosition(node, deltaX, deltaY);
        } else if (cell.isEdge()) {
          // For edges, we would need to implement edge label positioning
          this.logger.info('Edge label positioning not yet implemented');
        }

        // Remove mousemove and mouseup listeners
        document.removeEventListener('mousemove', this._mouseMoveListener!);
        document.removeEventListener('mouseup', this._mouseUpListener!);
        this._mouseMoveListener = null;
        this._mouseUpListener = null;

        // Update the bounding box position to match the new label position
        this.updateBoundingBoxPosition(cell, labelElement);
      };

      document.addEventListener('mousemove', this._mouseMoveListener);
      document.addEventListener('mouseup', this._mouseUpListener);
    });
  }

  /**
   * Updates the position of the bounding box to match the label
   * @param cell The cell containing the label
   * @param labelElement The SVG text element of the label
   */
  private updateBoundingBoxPosition(cell: Cell, labelElement: SVGTextElement): void {
    if (!this._labelBoundingBox) return;

    // Get the updated position of the label
    const labelRect = labelElement.getBoundingClientRect();

    // Update the bounding box position
    this._renderer.setStyle(this._labelBoundingBox, 'left', `${labelRect.left - 5}px`);
    this._renderer.setStyle(this._labelBoundingBox, 'top', `${labelRect.top - 3}px`);
  }

  /**
   * Deselects the currently selected label
   */
  private deselectLabel(): void {
    // Remove the bounding box
    if (this._labelBoundingBox && this._labelBoundingBox.parentNode) {
      this._renderer.removeChild(this._labelBoundingBox.parentNode, this._labelBoundingBox);
      this._labelBoundingBox = null;
    }

    this._selectedLabel = null;

    // Remove event listeners
    if (this._mouseMoveListener) {
      document.removeEventListener('mousemove', this._mouseMoveListener);
      this._mouseMoveListener = null;
    }

    if (this._mouseUpListener) {
      document.removeEventListener('mouseup', this._mouseUpListener);
      this._mouseUpListener = null;
    }

    this._isDragging = false;
  }

  /**
   * Updates the node label position by delta values
   * @param node The node to update
   * @param deltaX The change in X position
   * @param deltaY The change in Y position
   */
  private updateNodeLabelPosition(node: Node, deltaX: number, deltaY: number): void {
    // Get the current node data
    const nodeData = node.getData<Record<string, unknown>>();
    const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};

    // Get current label position from node data
    const currentPosition = safeNodeData.labelPosition || { x: 0, y: 0 };

    // Calculate new position
    const newX = currentPosition.x + deltaX;
    const newY = currentPosition.y + deltaY;

    // Update the label position
    this.updateLabelPosition(node, newX, newY);
  }

  /**
   * Updates the label position in the node data and applies it to the node
   * @param node The node to update
   * @param x The new x position
   * @param y The new y position
   */
  updateLabelPosition(node: Node, x: number, y: number): void {
    // Get the current node data
    const nodeData = node.getData<Record<string, unknown>>();
    const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};

    this.logger.debug('[LabelEditor] Current label position before update', {
      nodeId: node.id,
      currentPosition: safeNodeData.labelPosition,
    });

    // Update the label position
    const updatedData: NodeData = {
      ...safeNodeData,
      labelPosition: { x, y },
    };

    this.logger.debug('[LabelEditor] New label position calculated', {
      nodeId: node.id,
      newPosition: { x, y },
    });

    // Set the updated data
    node.setData(updatedData);
    this.logger.debug('[LabelEditor] Updated node data with new label position', {
      nodeId: node.id,
    });

    // Apply the position to the label using refX and refY
    // This is the correct way to position labels in AntV/X6
    node.attr({
      label: {
        refX: x,
        refY: y,
      },
    });

    this.logger.info('[LabelEditor] Updated label position for node', {
      nodeId: node.id,
      position: { x, y },
      service: 'LabelEditor',
    });
  }

  /**
   * Applies the saved label position to a node and creates a bounding box
   * @param node The node to apply the position to
   * @param graph The X6 graph instance
   */
  applyLabelPosition(node: Node, graph?: Graph): void {
    // Don't apply to TextboxShape
    if (node instanceof TextboxShape) {
      this.logger.debug('[LabelEditor] Skipping label position for TextboxShape', {
        nodeId: node.id,
      });
      return;
    }

    this.logger.debug('[LabelEditor] Applying saved label position to node', {
      nodeId: node.id,
      nodeType: node.constructor.name,
    });

    // Get the node data
    const nodeData = node.getData<Record<string, unknown>>();
    const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};

    // Get the node size to calculate center if needed
    const nodeSize = node.getSize();
    const centerX = nodeSize.width / 2;
    const centerY = nodeSize.height / 2;

    // If there's a saved label position, apply it
    if (safeNodeData.labelPosition) {
      const { x, y } = safeNodeData.labelPosition;

      this.logger.debug('[LabelEditor] Using saved label position', {
        nodeId: node.id,
        position: { x, y },
      });

      // Apply the position to the label using refX and refY
      node.attr({
        label: {
          refX: x,
          refY: y,
        },
      });

      this.logger.info('[LabelEditor] Applied saved label position to node', {
        nodeId: node.id,
        position: { x, y },
        service: 'LabelEditor',
      });
    } else {
      // If no saved position, use the center of the object
      this.logger.debug('[LabelEditor] No saved position, using center position', {
        nodeId: node.id,
        center: { x: centerX, y: centerY },
      });

      node.attr({
        label: {
          refX: centerX,
          refY: centerY,
        },
      });

      this.logger.info('[LabelEditor] Applied center position to node label', {
        nodeId: node.id,
        position: { x: centerX, y: centerY },
        service: 'LabelEditor',
      });
    }

    // Create a bounding box for the label if graph is provided
    if (graph) {
      this.createLabelBoundingBoxForNode(node, graph);
    }
  }

  /**
   * Creates a bounding box for the label of a node
   * @param node The node to create a bounding box for
   * @param graph The X6 graph instance
   */
  createLabelBoundingBoxForNode(node: Node, graph: Graph): void {
    // Don't apply to TextboxShape
    if (node instanceof TextboxShape) {
      return;
    }

    // Get the node view
    const nodeView = graph.findViewByCell(node);
    if (!nodeView) {
      return;
    }

    // Find the label element
    let labelElement = nodeView.findOne('text.joint-cell-label') as SVGTextElement;

    // If not found with the first selector, try a more general one
    if (!labelElement) {
      labelElement = nodeView.findOne('text') as SVGTextElement;
    }

    // If still not found, return
    if (!labelElement) {
      this.logger.debug(`Label element not found for node ${node.id}`, {
        nodeId: node.id,
        nodeType: node.constructor.name,
      });
      return;
    }

    // Select the label to create a bounding box
    this.selectLabel(node, labelElement, graph);
  }
}
