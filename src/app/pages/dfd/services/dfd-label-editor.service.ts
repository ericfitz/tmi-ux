import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Graph, Node, Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { NodeData } from '../models/node-data.interface';
import { TextboxShape } from '../models/textbox-shape.model';

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
  private _placeholderRect: HTMLDivElement | null = null; // Placeholder rectangle for dragging
  private _clickOutsideListener: (() => void) | null = null;
  private _keydownListener: ((event: KeyboardEvent) => void) | null = null;
  private _mouseMoveListener: ((event: MouseEvent) => void) | null = null;
  private _mouseUpListener: ((event: MouseEvent) => void) | null = null;
  private _isDragging = false;
  private _dragOffsetX = 0;
  private _dragOffsetY = 0;
  private _initialInputPosition = { x: 0, y: 0 }; // Store initial position for calculating final position

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
          this.updateLabelPosition(deltaX, deltaY);
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
   * Updates the label position on the cell
   * @param deltaX The change in X position
   * @param deltaY The change in Y position
   */
  private updateLabelPosition(deltaX: number, deltaY: number): void {
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

        this.logger.debug('[LabelEditor] Current label position before update', {
          nodeId: node.id,
          currentPosition,
        });

        // Calculate new position
        const newPosition = {
          x: currentPosition.x + deltaX,
          y: currentPosition.y + deltaY,
        };

        this.logger.debug('[LabelEditor] New label position calculated', {
          nodeId: node.id,
          newPosition,
          deltaX,
          deltaY,
        });

        // Update the label position in node data
        const updatedData: NodeData = {
          ...safeNodeData,
          labelPosition: newPosition,
        };

        // Set the updated data
        node.setData(updatedData);
        this.logger.debug('[LabelEditor] Updated node data with new label position', {
          nodeId: node.id,
        });

        // Apply the position to the label using refX and refY
        node.attr({
          label: {
            refX: newPosition.x,
            refY: newPosition.y,
          },
        });

        this.logger.info('[LabelEditor] Updated label position for node', {
          nodeId: node.id,
          position: newPosition,
          service: 'LabelEditor',
        });
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
}
