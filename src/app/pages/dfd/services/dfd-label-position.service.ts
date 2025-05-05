import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { Graph, Node } from '@antv/x6';
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
 * Service for handling label positioning in the DFD component
 */
@Injectable({
  providedIn: 'root',
})
export class DfdLabelPositionService {
  private _renderer: Renderer2;
  private _dragHandleElement: HTMLElement | null = null;
  private _placeholderRect: HTMLDivElement | null = null; // Placeholder rectangle for dragging
  private _isDragging = false;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _currentNode: Node | null = null;
  private _dragListeners: Array<() => void> = [];
  private _initialLabelPosition = { x: 0, y: 0 }; // Store initial position for calculating final position

  constructor(
    private logger: LoggerService,
    rendererFactory: RendererFactory2,
  ) {
    this._renderer = rendererFactory.createRenderer(null, null);
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

    this.logger.debug('[LabelPosition] Setting up drag events for node', {
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

        this.logger.info('[LabelPosition] Mouse down on drag handle', {
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

        this.logger.debug('[LabelPosition] Starting drag from position', {
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
        this.logger.debug('[LabelPosition] Label hidden during drag (opacity set to 0)', {
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

            this.logger.debug('[LabelPosition] Mouse move during drag', {
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

              this.logger.debug('[LabelPosition] Updated placeholder position', {
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

              this.logger.debug('[LabelPosition] Updated drag handle position', {
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

            this.logger.info('[LabelPosition] Mouse up, ending drag', {
              clientX: upEvent.clientX,
              clientY: upEvent.clientY,
              nodeId: node.id,
            });

            // Calculate the total delta from the initial position
            const totalDx = upEvent.clientX - event.clientX;
            const totalDy = upEvent.clientY - event.clientY;

            this.logger.debug('[LabelPosition] Calculated total position delta', {
              totalDx,
              totalDy,
              nodeId: node.id,
            });

            // Calculate the new position
            const newX = this._initialLabelPosition.x + totalDx;
            const newY = this._initialLabelPosition.y + totalDy;

            this.logger.debug('[LabelPosition] Calculated new label position', {
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
            this.logger.debug('[LabelPosition] Label made visible again (opacity set to 1)', {
              nodeId: node.id,
            });

            // Update the label position in the node data ONLY NOW at the end of dragging
            this.logger.info('[LabelPosition] Updating actual label position at end of drag', {
              nodeId: node.id,
              newX,
              newY,
              service: 'LabelPosition',
            });
            this.updateLabelPosition(node, newX, newY);

            // Remove the placeholder rectangle
            this.removePlaceholderRect();

            this._isDragging = false;

            // Remove the document listeners
            mousemoveListener();
            mouseupListener();
            this.logger.debug('[LabelPosition] Drag event listeners removed');
          },
        );

        // Add the listeners to the array for cleanup
        this._dragListeners.push(mousemoveListener, mouseupListener);
        this.logger.debug('[LabelPosition] Drag event listeners added');
      },
    );

    // Add the mousedown listener to the array for cleanup
    this._dragListeners.push(mousedownListener);
    this.logger.debug('[LabelPosition] Mouse down listener added to drag handle', {
      nodeId: node.id,
    });
  }

  /**
   * Creates a placeholder rectangle for dragging
   * @param rect The bounding rectangle of the label element
   */
  private createPlaceholderRect(rect: DOMRect): void {
    // Remove any existing placeholder
    this.removePlaceholderRect();

    this.logger.debug('[LabelPosition] Creating placeholder rectangle', {
      width: rect.width,
      height: rect.height,
      left: rect.left,
      top: rect.top,
      nodeId: this._currentNode?.id,
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

    this.logger.info('[LabelPosition] Created placeholder rectangle for label dragging', {
      nodeId: this._currentNode?.id,
    });
  }

  /**
   * Removes the placeholder rectangle
   */
  private removePlaceholderRect(): void {
    if (this._placeholderRect && this._placeholderRect.parentNode) {
      this._renderer.removeChild(this._placeholderRect.parentNode, this._placeholderRect);
      this._placeholderRect = null;

      this.logger.debug('[LabelPosition] Removed placeholder rectangle', {
        nodeId: this._currentNode?.id,
      });
    }
  }

  /**
   * Updates the label position in the node data and applies it to the node
   * @param node The node to update
   * @param x The new x position
   * @param y The new y position
   */
  private updateLabelPosition(node: Node, x: number, y: number): void {
    // Get the current node data
    const nodeData = node.getData<Record<string, unknown>>();
    const safeNodeData: NodeData = isNodeData(nodeData) ? nodeData : {};

    this.logger.debug('[LabelPosition] Current label position before update', {
      nodeId: node.id,
      currentPosition: safeNodeData.labelPosition,
    });

    // Update the label position
    const updatedData: NodeData = {
      ...safeNodeData,
      labelPosition: { x, y },
    };

    this.logger.debug('[LabelPosition] New label position calculated', {
      nodeId: node.id,
      newPosition: { x, y },
    });

    // Set the updated data
    node.setData(updatedData);
    this.logger.debug('[LabelPosition] Updated node data with new label position', {
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

    this.logger.info('[LabelPosition] Updated label position for node', {
      nodeId: node.id,
      position: { x, y },
      service: 'LabelPosition',
    });
  }

  /**
   * Applies the saved label position to a node
   * @param node The node to apply the position to
   */
  applyLabelPosition(node: Node): void {
    // Don't apply to TextboxShape
    if (node instanceof TextboxShape) {
      this.logger.debug('[LabelPosition] Skipping label position for TextboxShape', {
        nodeId: node.id,
      });
      return;
    }

    this.logger.debug('[LabelPosition] Applying saved label position to node', {
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

      this.logger.debug('[LabelPosition] Using saved label position', {
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

      this.logger.info('[LabelPosition] Applied saved label position to node', {
        nodeId: node.id,
        position: { x, y },
        service: 'LabelPosition',
      });
    } else {
      // If no saved position, use the center of the object
      this.logger.debug('[LabelPosition] No saved position, using center position', {
        nodeId: node.id,
        center: { x: centerX, y: centerY },
      });

      node.attr({
        label: {
          refX: centerX,
          refY: centerY,
        },
      });

      this.logger.info('[LabelPosition] Applied center position to node label', {
        nodeId: node.id,
        position: { x: centerX, y: centerY },
        service: 'LabelPosition',
      });
    }
  }
}
