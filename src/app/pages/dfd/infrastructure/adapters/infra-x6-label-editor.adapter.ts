import { Injectable } from '@angular/core';
import { Graph, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DFD_STYLING } from '../../constants/styling-constants';

/**
 * X6 Label Editor Adapter
 * Handles X6-specific label editing implementation
 * Manages inline text editing for nodes and edges
 */
@Injectable({ providedIn: 'root' })
// SEM@37adeab14e8697a45a5f79b768a0260e72d0a4f8: manage inline label editing lifecycle for DFD diagram cells (mutates shared state)
export class X6LabelEditorAdapter {
  private _isEditing = false;
  private _currentEditingCell: Cell | null = null;
  private _editingElement: HTMLElement | null = null;

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject logger dependency for the label editor adapter (pure)
  constructor(private logger: LoggerService) {}

  /**
   * Initialize label editing functionality
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: register graph event handlers to start, finish, or cancel label editing (mutates shared state)
  initializeLabelEditing(graph: Graph): void {
    this.logger.info('Initializing label editing functionality');

    // Set up double-click event for label editing
    graph.on('cell:dblclick', ({ cell }: { cell: Cell }) => {
      this.startLabelEditing(graph, cell);
    });

    // Set up click outside to finish editing
    graph.on('blank:click', () => {
      this.finishLabelEditing(graph);
    });

    // Set up escape key to cancel editing
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && this._isEditing) {
        this.cancelLabelEditing(graph);
      }
    });

    this.logger.info('Label editing event handlers set up');
  }

  /**
   * Start label editing for a cell
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: begin inline label editing for a diagram cell if it supports editing (mutates shared state)
  startLabelEditing(graph: Graph, cell: Cell): void {
    if (this._isEditing) {
      this.finishLabelEditing(graph);
    }

    // Check if the cell supports label editing
    if (!this.canEditLabel(cell)) {
      this.logger.info('Cell does not support label editing', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
      });
      return;
    }

    this._isEditing = true;
    this._currentEditingCell = cell;

    // Create editing element
    this.createEditingElement(graph, cell);

    this.logger.info('Started label editing', {
      cellId: cell.id,
      cellType: cell.isNode() ? 'node' : 'edge',
    });
  }

  /**
   * Finish label editing and save changes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: commit edited label text to the diagram cell and clean up the editor (mutates shared state)
  finishLabelEditing(graph: Graph): void {
    if (!this._isEditing || !this._currentEditingCell || !this._editingElement) {
      return;
    }

    const newText = this.getEditingText();
    const cell = this._currentEditingCell;

    // Batch all label changes into a single history command
    // This ensures that if multiple attributes are changed during label editing,
    // they are grouped together as a single undoable operation
    graph.batchUpdate(() => {
      this.updateCellLabel(cell, newText);
    });

    // Clean up
    this.cleanupEditing();

    this.logger.info('Finished label editing', {
      cellId: cell.id,
      newText,
    });
  }

  /**
   * Cancel label editing without saving changes
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: discard in-progress label edits and clean up the editor (mutates shared state)
  cancelLabelEditing(_graph: Graph): void {
    if (!this._isEditing) {
      return;
    }

    const cellId = this._currentEditingCell?.id;

    // Clean up without saving
    this.cleanupEditing();

    this.logger.info('Cancelled label editing', {
      cellId,
    });
  }

  /**
   * Check if currently editing
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return whether inline label editing is currently active (pure)
  isEditing(): boolean {
    return this._isEditing;
  }

  /**
   * Get currently editing cell
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the diagram cell currently being edited, or null (pure)
  getCurrentEditingCell(): Cell | null {
    return this._currentEditingCell;
  }

  /**
   * Programmatically start editing a specific cell
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: programmatically start label editing for a specific diagram cell (mutates shared state)
  editCell(graph: Graph, cell: Cell): void {
    this.startLabelEditing(graph, cell);
  }

  /**
   * Programmatically finish current editing
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: programmatically commit the current label edit and dismiss the editor (mutates shared state)
  finishCurrentEditing(graph: Graph): void {
    this.finishLabelEditing(graph);
  }

  /**
   * Programmatically cancel current editing
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: programmatically discard the current label edit and dismiss the editor (mutates shared state)
  cancelCurrentEditing(graph: Graph): void {
    this.cancelLabelEditing(graph);
  }

  /**
   * Check if a cell can have its label edited
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether a diagram cell supports inline label editing (pure)
  private canEditLabel(cell: Cell): boolean {
    // Get node type info if available
    const nodeTypeInfo = (cell as any).getNodeTypeInfo ? (cell as any).getNodeTypeInfo() : null;

    // All nodes and edges can have labels edited by default
    // Special handling for specific node types if needed
    if (nodeTypeInfo?.type === 'text-box') {
      return true; // text-box nodes are specifically for text editing
    }

    return true; // Allow editing for all cells by default
  }

  /**
   * Create the editing element (input/textarea)
   */
  // SEM@37adeab14e8697a45a5f79b768a0260e72d0a4f8: build and attach a positioned input element over the target diagram cell (mutates shared state)
  private createEditingElement(graph: Graph, cell: Cell): void {
    const container = graph.container;
    if (!container) {
      this.logger.error('Graph container not found for label editing');
      return;
    }

    // Get current label text
    const currentText = this.getCurrentLabelText(cell);

    // Calculate position and size
    const bounds = this.calculateEditingBounds(graph, cell);

    // Create input element
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('data-testid', 'dfd-label-editor');
    input.value = currentText;
    input.style.position = 'absolute';
    input.style.left = `${bounds.x}px`;
    input.style.top = `${bounds.y}px`;
    input.style.width = `${bounds.width}px`;
    input.style.height = `${bounds.height}px`;
    input.style.border = '2px solid #007bff';
    input.style.borderRadius = '4px';
    input.style.padding = '4px';
    input.style.fontSize = `${DFD_STYLING.DEFAULT_FONT_SIZE}px`;
    input.style.fontFamily = DFD_STYLING.TEXT_FONT_FAMILY;
    input.style.textAlign = 'center';
    input.style.backgroundColor = 'white';
    input.style.zIndex = '1000';

    // Add event listeners
    input.addEventListener('blur', () => {
      this.finishLabelEditing(graph);
    });

    input.addEventListener('keydown', event => {
      // Stop propagation for all keys to prevent them from triggering graph-level keyboard shortcuts
      event.stopPropagation();

      if (event.key === 'Enter') {
        event.preventDefault();
        this.finishLabelEditing(graph);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelLabelEditing(graph);
      }
    });

    // Add to container and focus
    container.appendChild(input);
    input.focus();
    input.select();

    this._editingElement = input;
  }

  /**
   * Get current label text from a cell
   */
  // SEM@30f828164ac850acd8c5327d89735462337b332b: fetch the current label text from a diagram cell (pure)
  private getCurrentLabelText(cell: Cell): string {
    // Use standardized getLabel method from x6-cell-extensions
    if ((cell as any).getLabel) {
      const labelText = (cell as any).getLabel();
      // Ensure we return a string, not undefined
      return typeof labelText === 'string' ? labelText : '';
    } else {
      this.logger.warn('Cell does not support getLabel method', { cellId: cell.id });
      return '';
    }
  }

  /**
   * Calculate bounds for the editing element
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: compute position and size for the inline editor overlay on a diagram cell (pure)
  private calculateEditingBounds(
    graph: Graph,
    cell: Cell,
  ): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    if (cell.isNode()) {
      const node = cell;
      const position = node.getPosition();
      const size = node.getSize();

      // Center the input on the node
      return {
        x: position.x + size.width / 4,
        y: position.y + size.height / 2 - 15,
        width: size.width / 2,
        height: 30,
      };
    } else if (cell.isEdge()) {
      const edge = cell;
      const sourcePoint = edge.getSourcePoint();
      const targetPoint = edge.getTargetPoint();

      // Position at the midpoint of the edge
      const midX = (sourcePoint.x + targetPoint.x) / 2;
      const midY = (sourcePoint.y + targetPoint.y) / 2;

      return {
        x: midX - 50,
        y: midY - 15,
        width: 100,
        height: 30,
      };
    }

    // Fallback
    return {
      x: 100,
      y: 100,
      width: 100,
      height: 30,
    };
  }

  /**
   * Get text from the editing element
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: return the current text value from the active label editor input (pure)
  private getEditingText(): string {
    if (!this._editingElement) {
      return '';
    }

    if (this._editingElement instanceof HTMLInputElement) {
      return this._editingElement.value;
    } else if (this._editingElement instanceof HTMLTextAreaElement) {
      return this._editingElement.value;
    }

    return '';
  }

  /**
   * Update cell label with new text
   */
  // SEM@30f828164ac850acd8c5327d89735462337b332b: store new label text on a diagram cell (mutates shared state)
  private updateCellLabel(cell: Cell, newText: string): void {
    // Use standardized setLabel method from x6-cell-extensions
    if ((cell as any).setLabel) {
      (cell as any).setLabel(newText);
    } else {
      this.logger.warn('Cell does not support setLabel method', { cellId: cell.id });
    }
  }

  /**
   * Clean up editing state
   */
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: remove the editor DOM element and reset editing state (mutates shared state)
  private cleanupEditing(): void {
    if (this._editingElement && this._editingElement.parentNode) {
      this._editingElement.parentNode.removeChild(this._editingElement);
    }

    this._isEditing = false;
    this._currentEditingCell = null;
    this._editingElement = null;
  }
}
