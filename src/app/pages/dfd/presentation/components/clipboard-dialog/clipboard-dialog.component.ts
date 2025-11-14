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
    this.clipboardJson = this._safeStringify(clipboardData, 2);
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
        if (value.length > 100) {
          return [...value.slice(0, 100), `[... ${value.length - 100} more items]`];
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
        if (keys.length > 50) {
          const limitedObj: any = {};
          keys.slice(0, 50).forEach(key => {
            limitedObj[key] = value[key];
          });
          limitedObj['...'] = `[${keys.length - 50} more properties]`;
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
      navigator.clipboard.writeText(this.clipboardJson).then(
        () => {
          // Success - could add a toast notification here if needed
        },
        (_error: unknown) => {
          // Fallback for older browsers
          this._fallbackCopyToClipboard(this.clipboardJson);
        },
      );
    } catch {
      // Fallback for older browsers
      this._fallbackCopyToClipboard(this.clipboardJson);
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
