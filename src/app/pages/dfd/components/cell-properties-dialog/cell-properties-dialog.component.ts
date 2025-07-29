/**
 * Cell Properties Dialog Component
 *
 * This component provides a dialog for viewing and debugging X6 cell properties in JSON format.
 * It's primarily used for development and debugging purposes to inspect cell state.
 *
 * Key functionality:
 * - Displays complete X6 cell object as formatted JSON
 * - Provides read-only view of cell properties for debugging
 * - Shows cell ID, shape, position, size, and other attributes
 * - Includes cell metadata, styling, and configuration data
 * - Uses Material Design dialog with syntax highlighting
 * - Supports copying cell data for external analysis
 * - Helps developers understand X6 cell structure and state
 */

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Cell } from '@antv/x6';

/**
 * Data interface for the cell properties dialog
 */
export interface CellPropertiesDialogData {
  cell: Cell;
}

/**
 * Dialog component for displaying cell properties as JSON
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-cell-properties-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './cell-properties-dialog.component.html',
  styleUrls: ['./cell-properties-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellPropertiesDialogComponent {
  /**
   * Serialized JSON representation of the cell
   */
  readonly cellJson: string;

  constructor(
    private _dialogRef: MatDialogRef<CellPropertiesDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CellPropertiesDialogData,
  ) {
    // Serialize the cell to JSON with proper formatting
    this.cellJson = JSON.stringify(data.cell.toJSON(), null, 2);
  }

  /**
   * Copy the JSON content to clipboard
   */
  onCopyToClipboard(): void {
    try {
      navigator.clipboard.writeText(this.cellJson).then(
        () => {
          // Success - could add a toast notification here if needed
        },
        (_error: unknown) => {
          // Fallback for older browsers
          this._fallbackCopyToClipboard(this.cellJson);
        },
      );
    } catch {
      // Fallback for older browsers
      this._fallbackCopyToClipboard(this.cellJson);
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
