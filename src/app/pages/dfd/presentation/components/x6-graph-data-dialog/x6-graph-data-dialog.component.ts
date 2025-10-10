/**
 * X6 Graph Data Dialog Component
 *
 * This component provides a dialog for viewing the X6 graph data in JSON format.
 * It's primarily used for development and debugging purposes to inspect graph state.
 *
 * Key functionality:
 * - Displays complete X6 graph serialization as formatted JSON
 * - Provides read-only view of graph structure for debugging
 * - Shows nodes, edges, and graph configuration
 * - Uses Material Design dialog with syntax highlighting
 * - Supports copying graph data for external analysis
 * - Helps developers understand X6 graph structure and state
 * - Configurable to allow easy modification of what data is included
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
 * Data interface for the X6 graph data dialog
 */
export interface X6GraphDataDialogData {
  graph: Graph;
}

/**
 * Dialog component for displaying X6 graph data as JSON
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-x6-graph-data-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './x6-graph-data-dialog.component.html',
  styleUrls: ['./x6-graph-data-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class X6GraphDataDialogComponent {
  /**
   * Serialized JSON representation of the X6 graph
   */
  readonly graphJson: string;

  constructor(
    private _dialogRef: MatDialogRef<X6GraphDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: X6GraphDataDialogData,
  ) {
    // Extract graph data
    const graphData = this._extractGraphData(data.graph);

    // Serialize the graph to JSON with proper formatting and circular reference handling
    this.graphJson = this._safeStringify(graphData, 2);
  }

  /**
   * Extract graph data from the X6 graph
   * This method can be easily modified to include/exclude specific data
   */
  private _extractGraphData(graph: Graph): any {
    try {
      // For now, use the raw X6 serialization
      // This can be easily modified later to include/exclude specific data
      return this._getGraphSerialization(graph);
    } catch (error) {
      return {
        error: 'Failed to extract graph data',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      };
    }
  }

  /**
   * Get the graph serialization using X6's toJSON method
   * This method can be modified to customize what data is included
   */
  private _getGraphSerialization(graph: Graph): any {
    try {
      // X6 provides a toJSON method that serializes the graph
      return graph.toJSON();
    } catch (error) {
      return {
        error: 'Failed to serialize graph',
        message: error instanceof Error ? error.message : 'Unknown error',
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
      navigator.clipboard.writeText(this.graphJson).then(
        () => {
          // Success - could add a toast notification here if needed
        },
        (_error: unknown) => {
          // Fallback for older browsers
          this._fallbackCopyToClipboard(this.graphJson);
        },
      );
    } catch {
      // Fallback for older browsers
      this._fallbackCopyToClipboard(this.graphJson);
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
