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

  // Label positioning properties
  private _dragHandleElement: HTMLElement | null = null;
  private _currentNode: Node | null = null;
  private _dragListeners: Array<() => void> = [];
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _initialLabelPosition = { x: 0, y: 0 }; // Store initial position for calculating final position

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
      // Always stop editing when any cell is removed, even if it's not the one being edited
      // This ensures the drag handle is removed when a shape is deleted while its label is being edited
      this.stopEditing(false);

      // Log the removal for debugging
      this.logger.info(`Cell removed, cleaning up any editing state`, {
        cellId: cell.id,
        editingCellId: this._editingCell?.id,
      });
    });

    // Add a handler for the delete tool click
    graph.on('node:delete', () => {
      this.cleanupEditing();
    });

    // Add a handler for the edge delete tool click
    graph.on('edge:delete', () => {
      this.cleanupEditing();
    });

    // Handle tools hiding events
    graph.on('node:tools:hide', () => {
      this.cleanupEditing();
      this.logger.info('Node tools hidden, cleaning up any editing state');
    });

    graph.on('edge:tools:hide', () => {
      this.cleanupEditing();
      this.logger.info('Edge tools hidden, cleaning up any editing state');
    });

    // Handle general tools events
    graph.on('tools:hide', () => {
      this.cleanupEditing();
      this.logger.info('Tools hidden, cleaning up any editing state');
    });

    graph.on('tools:hidden', () => {
      this.cleanupEditing();
      this.logger.info('Tools hidden event, cleaning up any editing state');
    });

    // Handle blank mousedown which might hide tools
    graph.on('blank:mousedown', () => {
      this.cleanupEditing();
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
    this._renderer.setStyle(input, 'left', `${cellBBox.x}px`);
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
      // For textbox nodes, use full height and align text to top-left
      this._renderer.setStyle(input, 'height', `${cellBBox.height}px`);
      this._renderer.setStyle(input, 'top', `${cellBBox.y}px`);
      this._renderer.setStyle(input, 'text-align', 'left');
      this._renderer.setStyle(input, 'vertical-align', 'top');
    } else {
      // For other nodes, use fixed height and center alignment
      this._renderer.setStyle(input, 'height', `${30}px`); // Fixed height for better usability
      this._renderer.setStyle(input, 'top', `${cellBBox.y + cellBBox.height / 2 - 15}px`); // Center vertically
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

            if (nodeData) {
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

    // Clear the editing cell reference
    this._editingCell = null;
  }

  /**
   * Shows a drag handle for the label of the selected node
   * @param node The selected node
   * @param graph The X6 graph instance
   */
  showLabelDragHandle(node: Node, graph: Graph): void {
    // Don't show drag handle for TextboxShape
    if (node instanceof TextboxShape) {
      return;
    }

    // Remove any existing drag handle
    this.removeLabelDragHandle();

    this._currentNode = node;

    // Get the node view and label element
    const nodeView = graph.findViewByCell(node);
    if (!nodeView) {
      return;
    }

    // Find the label element - try different selectors
    let labelElement = nodeView.findOne('text.joint-cell-label') as SVGTextElement;

    // If not found with the first selector, try a more general one
    if (!labelElement) {
      labelElement = nodeView.findOne('text') as SVGTextElement;
    }

    // If still not found, log and return
    if (!labelElement) {
      this.logger.debug(`Label element not found for node ${node.id}`, {
        nodeId: node.id,
        nodeType: node.constructor.name,
      });
      return;
    }

    this.logger.debug(`Label element found for node ${node.id}`, {
      nodeId: node.id,
      nodeType: node.constructor.name,
    });

    // Get the bounding box of the label
    const labelBBox = labelElement.getBBox();

    // Get the current label position from node data or use default (centered)
    const nodeData = node.getData<Record<string, unknown>>();
    const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};
    const labelPosition = safeNodeData.labelPosition || { x: 0, y: 0 };

    // Create the drag handle element - match the resize handle style exactly
    const dragHandle = this._renderer.createElement('div') as HTMLElement;
    this._renderer.setAttribute(dragHandle, 'class', 'label-drag-handle');
    this._renderer.setStyle(dragHandle, 'position', 'absolute');
    this._renderer.setStyle(dragHandle, 'width', '8px');
    this._renderer.setStyle(dragHandle, 'height', '8px');
    this._renderer.setStyle(dragHandle, 'border-radius', '0');
    this._renderer.setStyle(dragHandle, 'background-color', '#000000');
    this._renderer.setStyle(dragHandle, 'border', 'none');
    this._renderer.setStyle(dragHandle, 'outline', 'none');
    this._renderer.setStyle(dragHandle, 'cursor', 'move');
    this._renderer.setStyle(dragHandle, 'z-index', '1000');

    // Position the drag handle at the top-left corner of the label
    // Get the node's position and size
    const nodePosition = node.getPosition();
    const nodeSize = node.getSize();

    // Get the current refX and refY values from the node's attributes
    // If refX and refY don't exist yet, use the center of the object
    const centerX = nodeSize.width / 2;
    const centerY = nodeSize.height / 2;

    // Use the saved position if available, otherwise use the center
    const refX = labelPosition.x !== undefined ? labelPosition.x : centerX;
    const refY = labelPosition.y !== undefined ? labelPosition.y : centerY;

    // Calculate the absolute position of the drag handle in the document
    const graphRect = graph.container.getBoundingClientRect();

    // Check if the label has been moved yet
    const isLabelMoved =
      labelPosition.x !== undefined &&
      labelPosition.x !== 0 &&
      labelPosition.y !== undefined &&
      labelPosition.y !== 0;

    let x, y;

    if (isLabelMoved) {
      // If the label has been moved, position the drag handle at the top left of the label text
      // Use the bounding box of the label element to get its position
      const labelRect = labelElement.getBoundingClientRect();
      x = labelRect.left - 4; // 4px offset to position handle outside the label
      y = labelRect.top - 4; // 4px offset to position handle outside the label
    } else {
      // If the label has not been moved yet, position the drag handle at the center of the shape
      x = graphRect.left + nodePosition.x + centerX;
      y = graphRect.top + nodePosition.y + centerY;
    }

    this._renderer.setStyle(dragHandle, 'left', `${x}px`);
    this._renderer.setStyle(dragHandle, 'top', `${y}px`);

    // Log the position for debugging
    this.logger.debug(`Label drag handle positioned at (${x}, ${y})`, {
      nodeId: node.id,
      nodePosition,
      nodeSize,
      labelBBox: {
        x: labelBBox.x,
        y: labelBBox.y,
        width: labelBBox.width,
        height: labelBBox.height,
      },
      labelPosition: {
        refX,
        refY,
      },
    });

    // Add the drag handle to the document body
    this._renderer.appendChild(document.body, dragHandle);
    this._dragHandleElement = dragHandle;

    // Set up drag events
    this.setupDragEvents(node, graph, labelElement);
  }

  /**
   * Removes the label drag handle
   */
  removeLabelDragHandle(): void {
    // Remove drag event listeners
    this._dragListeners.forEach(removeListener => removeListener());
    this._dragListeners = [];

    // Remove the drag handle element
    if (this._dragHandleElement) {
      this._renderer.removeChild(this._dragHandleElement.parentNode, this._dragHandleElement);
      this._dragHandleElement = null;
    }

    // Remove the placeholder rectangle if it exists
    this.removePlaceholderRect();

    // If we have a current node and it's being dragged, restore its label opacity
    if (this._currentNode && this._isDragging) {
      this._currentNode.attr({
        label: {
          opacity: 1,
        },
      });
    }

    this._currentNode = null;
    this._isDragging = false;
  }

  /**
   * Sets up drag events for the label drag handle
   * @param node The node being edited
   * @param graph The X6 graph instance
   * @param labelElement The label SVG element
   */
  private setupDragEvents(node: Node, graph: Graph, labelElement: SVGElement): void {
    if (!this._dragHandleElement) {
      return;
    }

    this.logger.debug('[LabelEditor] Setting up drag events for node', {
      nodeId: node.id,
      nodeType: node.constructor.name,
    });

    // Mouse down event
    const mousedownListener = this._renderer.listen(
      this._dragHandleElement,
      'mousedown',
      (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this.logger.info('[LabelEditor] Mouse down on drag handle', {
          clientX: event.clientX,
          clientY: event.clientY,
          nodeId: node.id,
        });

        this._isDragging = true;
        this._dragStartX = event.clientX;
        this._dragStartY = event.clientY;

        // Get the current label position from node data
        const nodeData = node.getData<Record<string, unknown>>();
        const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};
        this._initialLabelPosition = safeNodeData.labelPosition || { x: 0, y: 0 };

        this.logger.debug('[LabelEditor] Starting drag from position', {
          initialPosition: this._initialLabelPosition,
          nodeId: node.id,
        });

        // Create placeholder rectangle for dragging
        const labelRect = labelElement.getBoundingClientRect();
        this.createPlaceholderRect(labelRect);

        // Hide the actual label during dragging by setting its opacity to 0
        node.attr({
          label: {
            opacity: 0,
          },
        });
        this.logger.debug('[LabelEditor] Label hidden during drag (opacity set to 0)', {
          nodeId: node.id,
        });

        // Add mousemove and mouseup listeners to document
        const mousemoveListener = this._renderer.listen(
          document,
          'mousemove',
          (moveEvent: MouseEvent) => {
            if (!this._isDragging || !this._placeholderRect) return;

            moveEvent.preventDefault();
            moveEvent.stopPropagation();

            // Calculate the new position
            const dx = moveEvent.clientX - this._dragStartX;
            const dy = moveEvent.clientY - this._dragStartY;

            this.logger.debug('[LabelEditor] Mouse move during drag', {
              clientX: moveEvent.clientX,
              clientY: moveEvent.clientY,
              dx,
              dy,
              nodeId: node.id,
            });

            // Update the placeholder rectangle position
            if (this._placeholderRect) {
              const left = parseInt(this._placeholderRect.style.left, 10) + dx;
              const top = parseInt(this._placeholderRect.style.top, 10) + dy;

              this._renderer.setStyle(this._placeholderRect, 'left', `${left}px`);
              this._renderer.setStyle(this._placeholderRect, 'top', `${top}px`);

              this.logger.debug('[LabelEditor] Updated placeholder position', {
                left,
                top,
              });
            }

            // Update the drag handle position
            if (this._dragHandleElement) {
              const left = parseInt(this._dragHandleElement.style.left, 10) + dx;
              const top = parseInt(this._dragHandleElement.style.top, 10) + dy;

              this._renderer.setStyle(this._dragHandleElement, 'left', `${left}px`);
              this._renderer.setStyle(this._dragHandleElement, 'top', `${top}px`);

              this.logger.debug('[LabelEditor] Updated drag handle position', {
                left,
                top,
              });
            }

            // Update drag start position
            this._dragStartX = moveEvent.clientX;
            this._dragStartY = moveEvent.clientY;
          },
        );

        const mouseupListener = this._renderer.listen(
          document,
          'mouseup',
          (upEvent: MouseEvent) => {
            if (!this._isDragging) {
              this._isDragging = false;
              return;
            }

            this.logger.info('[LabelEditor] Mouse up, ending drag', {
              clientX: upEvent.clientX,
              clientY: upEvent.clientY,
              nodeId: node.id,
            });

            // Calculate the total delta from the initial position
            const totalDx = upEvent.clientX - event.clientX;
            const totalDy = upEvent.clientY - event.clientY;

            this.logger.debug('[LabelEditor] Calculated total position delta', {
              totalDx,
              totalDy,
              nodeId: node.id,
            });

            // Calculate the new position
            const newX = this._initialLabelPosition.x + totalDx;
            const newY = this._initialLabelPosition.y + totalDy;

            this.logger.debug('[LabelEditor] Calculated new label position', {
              newX,
              newY,
              nodeId: node.id,
            });

            // Show the label again
            node.attr({
              label: {
                opacity: 1,
              },
            });
            this.logger.debug('[LabelEditor] Label made visible again (opacity set to 1)', {
              nodeId: node.id,
            });

            // Update the label position in the node data ONLY NOW at the end of dragging
            this.logger.info('[LabelEditor] Updating actual label position at end of drag', {
              nodeId: node.id,
              newX,
              newY,
              service: 'LabelEditor',
            });
            this.updateLabelPosition(node, newX, newY);

            // Remove the placeholder rectangle
            this.removePlaceholderRect();

            this._isDragging = false;

            // Remove the document listeners
            mousemoveListener();
            mouseupListener();
            this.logger.debug('[LabelEditor] Drag event listeners removed');
          },
        );

        // Add the listeners to the array for cleanup
        this._dragListeners.push(mousemoveListener, mouseupListener);
        this.logger.debug('[LabelEditor] Drag event listeners added');
      },
    );

    // Add the mousedown listener to the array for cleanup
    this._dragListeners.push(mousedownListener);
    this.logger.debug('[LabelEditor] Mouse down listener added to drag handle', {
      nodeId: node.id,
    });
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
   * Applies the saved label position to a node
   * @param node The node to apply the position to
   */
  applyLabelPosition(node: Node): void {
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
  }
}
