/**
 * History Dialog Component
 *
 * This component provides a dialog for viewing the custom history system in a collapsible format.
 * It's primarily used for development and debugging purposes to inspect history state.
 *
 * Key functionality:
 * - Displays complete custom history state in collapsible sections
 * - Provides read-only view of undo/redo stacks for debugging
 * - Shows history entries with operation details
 * - Includes operation metadata and affected cells
 * - Uses native HTML details/summary for collapsible sections
 * - Supports copying history data for external analysis
 * - Helps developers understand custom history structure and state
 */

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { HistoryState, HistoryEntry } from '../../../types/history.types';

/**
 * Data interface for the history dialog
 */
export interface HistoryDialogData {
  historyState: Readonly<HistoryState>;
}

/**
 * Processed history entry with formatted data for display
 */
interface ProcessedHistoryEntry {
  index: number;
  id: string;
  timestamp: number;
  timestampFormatted: string;
  operationType: string;
  description: string;
  affectedCellCount: number;
  affectedCellIds: string[];
  userId?: string;
  operationId?: string;
  metadata?: Record<string, unknown>;
  cellsJson: string;
  previousCellsJson: string;
}

/**
 * Dialog component for displaying custom history in collapsible format
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-history-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './history-dialog.component.html',
  styleUrls: ['./history-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryDialogComponent {
  /**
   * Serialized JSON representation of the complete history (for copying)
   */
  readonly historyJson: string;

  /**
   * History summary information
   */
  readonly summary: {
    canUndo: boolean;
    canRedo: boolean;
    undoStackSize: number;
    redoStackSize: number;
    maxStackSize: number;
    currentIndex: number;
  };

  /**
   * Processed undo stack entries
   */
  readonly undoStack: ProcessedHistoryEntry[];

  /**
   * Processed redo stack entries
   */
  readonly redoStack: ProcessedHistoryEntry[];

  constructor(
    private _dialogRef: MatDialogRef<HistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: HistoryDialogData,
  ) {
    const historyState = data.historyState;

    // Build summary
    this.summary = {
      canUndo: historyState.undoStack.length > 0,
      canRedo: historyState.redoStack.length > 0,
      undoStackSize: historyState.undoStack.length,
      redoStackSize: historyState.redoStack.length,
      maxStackSize: historyState.maxStackSize,
      currentIndex: historyState.currentIndex,
    };

    // Process undo stack
    this.undoStack = historyState.undoStack.map((entry, index) =>
      this._processHistoryEntry(entry, index),
    );

    // Process redo stack
    this.redoStack = historyState.redoStack.map((entry, index) =>
      this._processHistoryEntry(entry, index),
    );

    // Create complete JSON for copying
    const historyData = this._extractHistoryData(historyState);
    this.historyJson = this._safeStringify(historyData, 2);
  }

  /**
   * Process a history entry for display
   */
  private _processHistoryEntry(entry: HistoryEntry, index: number): ProcessedHistoryEntry {
    return {
      index,
      id: entry.id,
      timestamp: entry.timestamp,
      timestampFormatted: new Date(entry.timestamp).toLocaleString(),
      operationType: entry.operationType,
      description: entry.description,
      affectedCellCount: entry.cells.length,
      affectedCellIds: entry.metadata?.affectedCellIds || [],
      userId: entry.userId,
      operationId: entry.operationId,
      metadata: entry.metadata,
      cellsJson: this._safeStringify(entry.cells, 2),
      previousCellsJson: this._safeStringify(entry.previousCells, 2),
    };
  }

  /**
   * Extract history data from the custom history state
   */
  private _extractHistoryData(historyState: Readonly<HistoryState>): any {
    try {
      // Extract history state information
      const historyData: any = {
        summary: {
          canUndo: historyState.undoStack.length > 0,
          canRedo: historyState.redoStack.length > 0,
          undoStackSize: historyState.undoStack.length,
          redoStackSize: historyState.redoStack.length,
          maxStackSize: historyState.maxStackSize,
          currentIndex: historyState.currentIndex,
        },
        undoStack: historyState.undoStack.map((entry, index) => ({
          index,
          id: entry.id,
          timestamp: entry.timestamp,
          timestampFormatted: new Date(entry.timestamp).toLocaleString(),
          operationType: entry.operationType,
          description: entry.description,
          affectedCellCount: entry.cells.length,
          affectedCellIds: entry.metadata?.affectedCellIds || [],
          userId: entry.userId,
          operationId: entry.operationId,
          metadata: entry.metadata,
          // Include full cells for detailed inspection
          cells: entry.cells,
          previousCells: entry.previousCells,
        })),
        redoStack: historyState.redoStack.map((entry, index) => ({
          index,
          id: entry.id,
          timestamp: entry.timestamp,
          timestampFormatted: new Date(entry.timestamp).toLocaleString(),
          operationType: entry.operationType,
          description: entry.description,
          affectedCellCount: entry.cells.length,
          affectedCellIds: entry.metadata?.affectedCellIds || [],
          userId: entry.userId,
          operationId: entry.operationId,
          metadata: entry.metadata,
          // Include full cells for detailed inspection
          cells: entry.cells,
          previousCells: entry.previousCells,
        })),
      };

      return historyData;
    } catch (error) {
      return {
        error: 'Failed to extract history data',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Safely stringify an object, handling circular references
   */
  private _safeStringify(obj: any, indent: number = 0): string {
    const seen = new WeakSet();

    const replacerFunction = (_key: string, value: any): any => {
      // Handle null and undefined
      if (value === null || value === undefined) {
        return value;
      }

      // Handle primitive types
      if (typeof value !== 'object') {
        return value;
      }

      // Handle circular references
      if (seen.has(value)) {
        return '[Circular Reference]';
      }

      seen.add(value);

      // Handle functions
      if (typeof value === 'function') {
        return `[Function: ${value.name || 'anonymous'}]`;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        // Limit array length to prevent massive output
        if (value.length > 10) {
          return [...value.slice(0, 10), `[... ${value.length - 10} more items]`];
        }
        return value;
      }

      // Handle DOM elements and complex objects
      if (value instanceof Element || value instanceof Node) {
        return `[DOM Element: ${value.constructor.name}]`;
      }

      // Handle objects with too many properties (to prevent huge output)
      if (typeof value === 'object' && value.constructor === Object) {
        const keys = Object.keys(value);
        if (keys.length > 20) {
          const limitedObj: any = {};
          keys.slice(0, 20).forEach(key => {
            limitedObj[key] = value[key];
          });
          limitedObj['...'] = `[${keys.length - 20} more properties]`;
          return limitedObj;
        }
      }

      return value;
    };

    try {
      return JSON.stringify(obj, replacerFunction, indent);
    } catch (error) {
      return JSON.stringify(
        {
          error: 'Failed to serialize object',
          message: error instanceof Error ? error.message : 'Unknown error',
          objectType: typeof obj,
          constructor: obj?.constructor?.name || 'unknown',
        },
        null,
        indent,
      );
    }
  }

  /**
   * Copy the JSON content to clipboard
   */
  onCopyToClipboard(): void {
    try {
      navigator.clipboard.writeText(this.historyJson).then(
        () => {
          // Success - could add a toast notification here if needed
        },
        (_error: unknown) => {
          // Fallback for older browsers
          this._fallbackCopyToClipboard(this.historyJson);
        },
      );
    } catch {
      // Fallback for older browsers
      this._fallbackCopyToClipboard(this.historyJson);
    }
  }

  /**
   * Fallback method to copy text to clipboard for older browsers
   */
  private _fallbackCopyToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
    } catch {
      // Last resort: show the text in an alert so user can manually copy
      alert('Please manually copy this text:\n\n' + text);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Close the dialog
   */
  onClose(): void {
    this._dialogRef.close();
  }
}
