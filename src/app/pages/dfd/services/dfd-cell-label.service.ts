import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';

/**
 * Interface for label change events
 */
export interface LabelChangeEvent {
  cellId: string;
  oldLabel: string;
  newLabel: string;
  cellType: 'node' | 'edge';
}

/**
 * Interface for node info change events (for history integration)
 */
export interface NodeInfoChangeEvent {
  nodeId: string;
  oldData: { label: string };
  newData: { label: string };
}

/**
 * Service for managing cell label operations
 * Handles label validation, change detection, and history integration
 */
@Injectable()
export class DfdCellLabelService {
  private _labelChanged$ = new Subject<LabelChangeEvent>();
  private _nodeInfoChanged$ = new Subject<NodeInfoChangeEvent>();

  constructor(private logger: LoggerService) {}

  /**
   * Observable for label change events
   */
  get labelChanged$(): Observable<LabelChangeEvent> {
    return this._labelChanged$.asObservable();
  }

  /**
   * Observable for node info change events (for history integration)
   */
  get nodeInfoChanged$(): Observable<NodeInfoChangeEvent> {
    return this._nodeInfoChanged$.asObservable();
  }

  /**
   * Get the label text for a cell
   */
  getCellLabel(cell: Cell): string {
    // Use X6 cell extensions for unified label handling
    return (cell as any).getLabel ? (cell as any).getLabel() : '';
  }

  /**
   * Set the label text for a cell with change detection and validation
   */
  setCellLabel(cell: Cell, text: string): boolean {
    const oldLabel = this.getCellLabel(cell);
    
    this.logger.debugComponent('DFD', '[CellLabelService] Attempting to set label', {
      cellId: cell.id,
      isNode: cell.isNode(),
      currentLabel: oldLabel,
      newText: text,
    });

    // Validate the label change
    if (!this.isLabelChangeValid(cell, text, oldLabel)) {
      return false;
    }

    // Only proceed if the label actually changed
    if (oldLabel === text) {
      this.logger.debugComponent('DFD', '[CellLabelService] Label unchanged, skipping update', {
        cellId: cell.id,
        label: text,
      });
      return false;
    }

    // Apply the label change using X6 cell extensions
    if ((cell as any).setLabel) {
      (cell as any).setLabel(text);
    } else {
      this.logger.warn('[CellLabelService] Cell does not support setLabel method', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
      });
      return false;
    }

    // Emit label change event
    this._labelChanged$.next({
      cellId: cell.id,
      oldLabel,
      newLabel: text,
      cellType: cell.isNode() ? 'node' : 'edge',
    });

    // For nodes, emit info change event for history integration
    if (cell.isNode()) {
      this.emitNodeInfoChangeForHistory(cell.id, oldLabel, text);
    }

    this.logger.info('[CellLabelService] Label updated successfully', {
      cellId: cell.id,
      oldLabel,
      newLabel: text,
    });

    return true;
  }

  /**
   * Check if a label change is valid
   */
  isLabelChangeValid(cell: Cell, newText: string, _oldText: string): boolean {
    // Basic validation rules
    if (typeof newText !== 'string') {
      this.logger.warn('[CellLabelService] Invalid label type', {
        cellId: cell.id,
        newText,
        type: typeof newText,
      });
      return false;
    }

    // Check for maximum length (reasonable limit for diagram labels)
    const maxLength = 100;
    if (newText.length > maxLength) {
      this.logger.warn('[CellLabelService] Label too long', {
        cellId: cell.id,
        length: newText.length,
        maxLength,
      });
      return false;
    }

    // Additional validation rules can be added here
    // For example: profanity filtering, special character restrictions, etc.

    return true;
  }

  /**
   * Sanitize label text
   */
  sanitizeLabelText(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }

    // Remove leading/trailing whitespace
    let sanitized = text.trim();

    // Replace multiple consecutive whitespaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove control characters but keep newlines for multi-line labels
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    return sanitized;
  }

  /**
   * Check if a cell supports label editing
   */
  canEditCellLabel(cell: Cell): boolean {
    // Check if cell has the necessary extension methods
    return typeof (cell as any).setLabel === 'function' && typeof (cell as any).getLabel === 'function';
  }

  /**
   * Get label validation constraints for UI
   */
  getLabelConstraints(): { maxLength: number; allowedCharacters: string } {
    return {
      maxLength: 100,
      allowedCharacters: 'Alphanumeric characters, spaces, and common punctuation',
    };
  }

  /**
   * Batch update multiple cell labels
   * @param graph - Graph instance for batching history updates
   * @param updates - Array of cell/label pairs to update
   */
  batchUpdateLabels(
    graph: any, 
    updates: Array<{ cell: Cell; label: string }>
  ): Array<{ cell: Cell; success: boolean }> {
    const results: Array<{ cell: Cell; success: boolean }> = [];

    if (graph && typeof graph.batchUpdate === 'function') {
      // Batch all label updates into a single history command
      graph.batchUpdate(() => {
        updates.forEach(update => {
          const success = this.setCellLabel(update.cell, update.label);
          results.push({ cell: update.cell, success });
        });
      });
    } else {
      // Fallback for when graph is not available
      updates.forEach(update => {
        const success = this.setCellLabel(update.cell, update.label);
        results.push({ cell: update.cell, success });
      });
    }

    this.logger.info('[CellLabelService] Batch label update completed', {
      totalUpdates: updates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Emit node info change event for history system integration
   */
  private emitNodeInfoChangeForHistory(nodeId: string, oldLabel: string, newLabel: string): void {
    const oldData = { label: oldLabel };
    const newData = { label: newLabel };

    this.logger.info('[CellLabelService] Emitting node info change for history integration', {
      nodeId,
      oldData,
      newData,
    });

    this._nodeInfoChanged$.next({
      nodeId,
      oldData,
      newData,
    });
  }
}