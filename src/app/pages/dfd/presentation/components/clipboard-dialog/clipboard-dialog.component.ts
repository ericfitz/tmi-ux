/**
 * Clipboard Dialog Component
 *
 * This component provides a dialog for viewing the clipboard data in JSON format.
 * It's primarily used for development and debugging purposes to inspect clipboard state.
 *
 * Key functionality:
 * - Displays complete clipboard serialization as formatted JSON
 * - Provides read-only view of clipboard structure for debugging
 * - Shows cells currently in the clipboard
 * - Uses Material Design dialog with syntax highlighting
 * - Supports copying clipboard data for external analysis
 * - Helps developers understand clipboard structure and state
 */

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';
import { Graph } from '@antv/x6';
import { safeStringify } from '../../../../../shared/utils/safe-stringify.util';
import { copyToClipboard } from '../../../../../shared/utils/clipboard.util';

/**
 * Data interface for the clipboard dialog
 */
export interface ClipboardDialogData {
  graph: Graph;
}

/**
 * Dialog component for displaying clipboard data as JSON
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-clipboard-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    TranslocoModule,
  ],
  templateUrl: './clipboard-dialog.component.html',
  styleUrls: ['./clipboard-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipboardDialogComponent {
  /**
   * Serialized JSON representation of the clipboard
   */
  readonly clipboardJson: string;

  constructor(
    private _dialogRef: MatDialogRef<ClipboardDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ClipboardDialogData,
  ) {
    // Extract clipboard data
    const clipboardData = this._extractClipboardData(data.graph);

    // Serialize the clipboard to JSON with proper formatting and circular reference handling
    this.clipboardJson = safeStringify(clipboardData, 2);
  }

  /**
   * Extract clipboard data from the graph
   */
  private _extractClipboardData(graph: Graph): any {
    try {
      const clipboardData: any = {
        isEmpty: graph.isClipboardEmpty ? graph.isClipboardEmpty() : true,
        cellCount: 0,
        cells: [],
      };

      // Try to get cells from clipboard if available
      if (graph.getCellsInClipboard) {
        const cells = graph.getCellsInClipboard();
        clipboardData.cellCount = cells.length;
        clipboardData.cells = cells.map((cell: any) => ({
          id: cell.id,
          shape: cell.shape,
          type: cell.isNode?.() ? 'node' : cell.isEdge?.() ? 'edge' : 'unknown',
          data: cell.getData ? cell.getData() : {},
          position: cell.getPosition ? cell.getPosition() : null,
          size: cell.getSize ? cell.getSize() : null,
          source: cell.getSource ? cell.getSource() : null,
          target: cell.getTarget ? cell.getTarget() : null,
        }));
      }

      return clipboardData;
    } catch (error) {
      return {
        error: 'Failed to extract clipboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Copy the JSON content to clipboard
   */
  onCopyToClipboard(): void {
    copyToClipboard(this.clipboardJson);
  }

  /**
   * Clear the X6 graph clipboard
   */
  onClearClipboard(): void {
    if (this.data.graph.cleanClipboard) {
      this.data.graph.cleanClipboard();
    }
    this._dialogRef.close();
  }

  /**
   * Close the dialog
   */
  onClose(): void {
    this._dialogRef.close();
  }
}
