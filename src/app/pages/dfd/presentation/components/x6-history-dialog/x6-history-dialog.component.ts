/**
 * X6 History Dialog Component
 *
 * This component provides a dialog for viewing the X6 graph history in JSON format.
 * It's primarily used for development and debugging purposes to inspect graph history state.
 *
 * Key functionality:
 * - Displays complete X6 graph history object as formatted JSON
 * - Provides read-only view of history stack for debugging
 * - Shows undo/redo stack state and available operations
 * - Includes history metadata and operation details
 * - Uses Material Design dialog with syntax highlighting
 * - Supports copying history data for external analysis
 * - Helps developers understand X6 history structure and state
 */

import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Graph } from '@antv/x6';

/**
 * Data interface for the X6 history dialog
 */
export interface X6HistoryDialogData {
  graph: Graph;
}

/**
 * Dialog component for displaying X6 history as JSON
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-x6-history-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './x6-history-dialog.component.html',
  styleUrls: ['./x6-history-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class X6HistoryDialogComponent {
  /**
   * Serialized JSON representation of the X6 history
   */
  readonly historyJson: string;

  constructor(
    private _dialogRef: MatDialogRef<X6HistoryDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: X6HistoryDialogData,
  ) {
    // Extract history data from the graph
    const historyData = this._extractHistoryData(data.graph);

    // Serialize the history to JSON with proper formatting and circular reference handling
    this.historyJson = this._safeStringify(historyData, 2);
  }

  /**
   * Extract history data from the X6 graph
   */
  private _extractHistoryData(graph: Graph): any {
    try {
      // Use the same method as the existing codebase to get the history plugin
      const historyPlugin = graph.getPlugin('history');

      if (!historyPlugin) {
        return {
          error: 'History plugin not available',
          message: 'The X6 history plugin is not enabled for this graph',
        };
      }

      // Extract available history data
      const graphWithHistory = graph as any;
      const historyData: any = {
        canUndo: graphWithHistory.canUndo ? graphWithHistory.canUndo() : false,
        canRedo: graphWithHistory.canRedo ? graphWithHistory.canRedo() : false,
        enabled:
          (historyPlugin as any).enabled !== undefined ? (historyPlugin as any).enabled : true,
      };

      // Try to extract undo/redo stacks if available
      if ((historyPlugin as any).undoStack) {
        historyData.undoStack = (historyPlugin as any).undoStack;
      }

      if ((historyPlugin as any).redoStack) {
        historyData.redoStack = (historyPlugin as any).redoStack;
      }

      // Add other history properties if available
      if ((historyPlugin as any).index !== undefined) {
        historyData.index = (historyPlugin as any).index;
      }

      if ((historyPlugin as any).maxSize !== undefined) {
        historyData.maxSize = (historyPlugin as any).maxSize;
      }

      // Include selected history plugin properties for debugging (avoid complex nested objects)
      const safeProperties = [
        'enabled',
        'index',
        'maxSize',
        'ignoreChange',
        'beforeAddCommand',
        'afterAddCommand',
      ];
      historyData.pluginProperties = {};
      safeProperties.forEach(prop => {
        if ((historyPlugin as any)[prop] !== undefined) {
          historyData.pluginProperties[prop] = (historyPlugin as any)[prop];
        }
      });

      // Add method names for debugging
      historyData.availableMethods = Object.keys(historyPlugin as any).filter(
        key => typeof (historyPlugin as any)[key] === 'function',
      );

      // Add summary information about stacks
      if ((historyPlugin as any).undoStack) {
        historyData.undoStackLength = (historyPlugin as any).undoStack.length;
        historyData.undoStackSummary = (historyPlugin as any).undoStack.map(
          (item: any, index: number) => ({
            index,
            type: item?.constructor?.name || 'unknown',
            hasData: !!item?.data,
            hasOptions: !!item?.options,
          }),
        );
      }

      if ((historyPlugin as any).redoStack) {
        historyData.redoStackLength = (historyPlugin as any).redoStack.length;
        historyData.redoStackSummary = (historyPlugin as any).redoStack.map(
          (item: any, index: number) => ({
            index,
            type: item?.constructor?.name || 'unknown',
            hasData: !!item?.data,
            hasOptions: !!item?.options,
          }),
        );
      }

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
