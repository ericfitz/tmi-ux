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
import { TranslocoModule } from '@jsverse/transloco';
import { HistoryState, HistoryEntry } from '../../../types/history.types';
import { AppHistoryService } from '../../../application/services/app-history.service';
import { safeStringify } from '../../../../../shared/utils/safe-stringify.util';
import { copyToClipboard } from '../../../../../shared/utils/clipboard.util';

/**
 * Data interface for the history dialog
 */
export interface HistoryDialogData {
  historyState: Readonly<HistoryState>;
  historyService: AppHistoryService;
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
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslocoModule],
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
    this.historyJson = safeStringify(historyData, 2, { maxArrayLength: 10, maxProperties: 20 });
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
      cellsJson: safeStringify(entry.cells, 2, { maxArrayLength: 10, maxProperties: 20 }),
      previousCellsJson: safeStringify(entry.previousCells, 2, {
        maxArrayLength: 10,
        maxProperties: 20,
      }),
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
   * Copy the JSON content to clipboard
   */
  onCopyToClipboard(): void {
    copyToClipboard(this.historyJson);
  }

  /**
   * Clear all history (undo and redo stacks)
   */
  onClearHistory(): void {
    this.data.historyService.clearHistory();
    this._dialogRef.close();
  }

  /**
   * Close the dialog
   */
  onClose(): void {
    this._dialogRef.close();
  }
}
