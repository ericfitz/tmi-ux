/**
 * Graph Data Dialog Component
 *
 * This component provides a dialog for viewing the graph data in JSON format.
 * It's primarily used for development and debugging purposes to inspect graph state.
 *
 * Key functionality:
 * - Displays complete graph serialization as formatted JSON
 * - Provides read-only view of graph structure for debugging
 * - Shows nodes, edges, and graph configuration
 * - Uses Material Design dialog with syntax highlighting
 * - Supports copying graph data for external analysis
 * - Helps developers understand graph structure and state
 * - Configurable to allow easy modification of what data is included
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
 * Data interface for the graph data dialog
 */
export interface GraphDataDialogData {
  graph: Graph;
}

/**
 * Dialog component for displaying graph data as JSON
 * This is a development-only component for debugging purposes
 */
@Component({
  selector: 'app-graph-data-dialog',
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
  templateUrl: './graph-data-dialog.component.html',
  styleUrls: ['./graph-data-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphDataDialogComponent {
  /**
   * Serialized JSON representation of the graph
   */
  readonly graphJson: string;

  constructor(
    private _dialogRef: MatDialogRef<GraphDataDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: GraphDataDialogData,
  ) {
    // Extract graph data
    const graphData = this._extractGraphData(data.graph);

    // Serialize the graph to JSON with proper formatting and circular reference handling
    this.graphJson = safeStringify(graphData, 2);
  }

  /**
   * Extract graph data from the graph
   * This method can be easily modified to include/exclude specific data
   */
  private _extractGraphData(graph: Graph): any {
    try {
      // Use the graph's serialization method
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
   * Get the graph serialization using the graph's toJSON method
   * This method can be modified to customize what data is included
   */
  private _getGraphSerialization(graph: Graph): any {
    try {
      // The graph provides a toJSON method that serializes the graph
      return graph.toJSON();
    } catch (error) {
      return {
        error: 'Failed to serialize graph',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Copy the JSON content to clipboard
   */
  onCopyToClipboard(): void {
    copyToClipboard(this.graphJson);
  }

  /**
   * Close the dialog
   */
  onClose(): void {
    this._dialogRef.close();
  }
}
