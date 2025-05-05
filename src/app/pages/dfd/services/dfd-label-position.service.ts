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
  private _isDragging = false;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _currentNode: Node | null = null;
  private _dragListeners: Array<() => void> = [];

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

    this._currentNode = null;
    this._isDragging = false;
  }

  /**
   * Sets up drag events for the label drag handle
   * @param node The node being edited
   * @param graph The X6 graph instance
   * @param labelElement The label SVG element
   */
  private setupDragEvents(node: Node, graph: Graph, _labelElement: SVGElement): void {
    if (!this._dragHandleElement) {
      return;
    }

    // Mouse down event
    const mousedownListener = this._renderer.listen(
      this._dragHandleElement,
      'mousedown',
      (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();

        this._isDragging = true;
        this._dragStartX = event.clientX;
        this._dragStartY = event.clientY;

        // We don't need to get the initial position here since we'll get the latest in mousemove
        // Just initialize the drag start coordinates

        // Add mousemove and mouseup listeners to document
        const mousemoveListener = this._renderer.listen(
          document,
          'mousemove',
          (moveEvent: MouseEvent) => {
            if (!this._isDragging) return;

            moveEvent.preventDefault();
            moveEvent.stopPropagation();

            // Calculate the new position
            const dx = moveEvent.clientX - this._dragStartX;
            const dy = moveEvent.clientY - this._dragStartY;

            // Get the current label position (to ensure we're always using the latest)
            const latestNodeData = node.getData<Record<string, unknown>>();
            const latestSafeNodeData: NodeData = isNodeData(latestNodeData) ? latestNodeData : {};
            const latestPosition = latestSafeNodeData.labelPosition || { x: 0, y: 0 };

            const newX = latestPosition.x + dx;
            const newY = latestPosition.y + dy;

            // Update the label position in the node data
            this.updateLabelPosition(node, newX, newY);

            // Update the drag handle position
            if (this._dragHandleElement) {
              // Check if we're moving from the center position (first move) or from an already moved position
              const isFirstMove = latestPosition.x === 0 && latestPosition.y === 0;

              if (isFirstMove) {
                // If this is the first move from center, we need to update the position of the drag handle
                // to be at the top left of the label text
                const labelRect = _labelElement.getBoundingClientRect();
                const left = labelRect.left - 4; // 4px offset
                const top = labelRect.top - 4; // 4px offset

                this._renderer.setStyle(this._dragHandleElement, 'left', `${left}px`);
                this._renderer.setStyle(this._dragHandleElement, 'top', `${top}px`);
              } else {
                // If the label has already been moved, update the position based on the drag delta
                const left = parseInt(this._dragHandleElement.style.left, 10) + dx;
                const top = parseInt(this._dragHandleElement.style.top, 10) + dy;

                this._renderer.setStyle(this._dragHandleElement, 'left', `${left}px`);
                this._renderer.setStyle(this._dragHandleElement, 'top', `${top}px`);
              }
            }

            // Update drag start position
            this._dragStartX = moveEvent.clientX;
            this._dragStartY = moveEvent.clientY;
          },
        );

        const mouseupListener = this._renderer.listen(document, 'mouseup', () => {
          this._isDragging = false;

          // Remove the document listeners
          mousemoveListener();
          mouseupListener();
        });

        // Add the listeners to the array for cleanup
        this._dragListeners.push(mousemoveListener, mouseupListener);
      },
    );

    // Add the mousedown listener to the array for cleanup
    this._dragListeners.push(mousedownListener);
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

    // Update the label position
    const updatedData: NodeData = {
      ...safeNodeData,
      labelPosition: { x, y },
    };

    // Set the updated data
    node.setData(updatedData);

    // Apply the position to the label using refX and refY
    // This is the correct way to position labels in AntV/X6
    node.attr({
      label: {
        refX: x,
        refY: y,
      },
    });

    this.logger.debug(`Updated label position for node ${node.id}`, {
      nodeId: node.id,
      labelPosition: { x, y },
    });
  }

  /**
   * Applies the saved label position to a node
   * @param node The node to apply the position to
   */
  applyLabelPosition(node: Node): void {
    // Don't apply to TextboxShape
    if (node instanceof TextboxShape) {
      return;
    }

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

      // Apply the position to the label using refX and refY
      node.attr({
        label: {
          refX: x,
          refY: y,
        },
      });
    } else {
      // If no saved position, use the center of the object
      node.attr({
        label: {
          refX: centerX,
          refY: centerY,
        },
      });
    }
  }
}
