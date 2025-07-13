import { Injectable, ElementRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Subscription, BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { Cell } from '@antv/x6';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../../../core/services/logger.service';
import { CommandBusService } from '../application/services/command-bus.service';
import { DiagramCommandFactory } from '../domain/commands/diagram-commands';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../tm/components/threat-editor-dialog/threat-editor-dialog.component';

/**
 * Service responsible for handling events in DFD diagrams
 */
@Injectable({
  providedIn: 'root',
})
export class DfdEventHandlersService {
  private _rightClickedCell: Cell | null = null;
  private _selectedCells$ = new BehaviorSubject<Cell[]>([]);
  private _subscriptions = new Subscription();

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private logger: LoggerService,
    private commandBus: CommandBusService,
    private x6GraphAdapter: X6GraphAdapter,
    private threatModelService: ThreatModelService,
    private dialog: MatDialog,
    private router: Router,
  ) {}

  /**
   * Initialize event handlers
   */
  initialize(): void {
    // Subscribe to selection state changes
    this._subscriptions.add(
      this.x6GraphAdapter.selectionChanged$.subscribe(() => {
        // Get selected cells directly from the adapter
        const selectedCells = this.x6GraphAdapter.getSelectedCells();
        this._selectedCells$.next(selectedCells);
      }),
    );

    // Subscribe to context menu events
    this._subscriptions.add(
      this.x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }) => {
        this.openCellContextMenu(cell, x, y);
      }),
    );
  }

  /**
   * Cleanup subscriptions
   */
  dispose(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Get selected cells observable
   */
  get selectedCells$(): BehaviorSubject<Cell[]> {
    return this._selectedCells$;
  }

  /**
   * Handle keyboard events for delete functionality and undo/redo
   */
  onKeyDown(event: KeyboardEvent, diagramId: string, isInitialized: boolean): void {
    // Only handle keys if the graph container has focus or if no input elements are focused
    const activeElement = document.activeElement;
    const isInputFocused =
      activeElement &&
      (activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        (activeElement as HTMLElement).contentEditable === 'true');

    if (!isInputFocused) {
      // Handle delete/backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        this.deleteSelected(diagramId, isInitialized);
        return;
      }

      // Note: Undo/redo functionality now handled by X6 history addon
    }
  }

  /**
   * Handle window resize events to update the graph size
   */
  onWindowResize(graphContainer: ElementRef, resizeTimeout: number | null): number | null {
    // Handle resize events immediately
    if (resizeTimeout) {
      window.clearTimeout(resizeTimeout);
    }

    return window.setTimeout(() => {
      const graph = this.x6GraphAdapter.getGraph();
      if (graph) {
        const container = graphContainer.nativeElement as HTMLElement;
        const width = container.clientWidth;
        const height = container.clientHeight;

        this.logger.info('Resizing graph due to window resize', { width, height });

        // Force the graph to resize with explicit dimensions
        graph.resize(width, height);

        // Update the graph's container size
        graph.container.style.width = `${width}px`;
        graph.container.style.height = `${height}px`;
      }
    }, 0); // Immediate execution
  }

  /**
   * Deletes the currently selected cell(s)
   */
  deleteSelected(diagramId: string, isInitialized: boolean): void {
    if (!isInitialized) {
      this.logger.warn('Cannot delete: Graph is not initialized');
      return;
    }

    const selectedCells = this._selectedCells$.value;
    if (selectedCells.length === 0) {
      this.logger.info('No cells selected for deletion');
      return;
    }

    this.logger.info('Deleting selected cells', {
      count: selectedCells.length,
      cellIds: selectedCells.map(cell => cell.id),
    });

    const userId = 'current-user'; // TODO: Get from auth service

    // Separate nodes and edges for different command handling
    const selectedNodes = selectedCells.filter(cell => cell.isNode());
    const selectedEdges = selectedCells.filter(cell => cell.isEdge());

    // Delete nodes first (this will also remove connected edges automatically)
    selectedNodes.forEach(node => {
      //  Check for connected edges before deletion
      // Note: We'll capture this information from the domain model after deletion
      this.logger.info(' Node deletion will cascade to connected edges', {
        nodeId: node.id,
        note: 'Connected edges will be automatically deleted by domain logic',
      });

      const command = DiagramCommandFactory.removeNode(diagramId, userId, node.id, true); // isLocalUserInitiated

      this.commandBus
        .execute<void>(command)
        .pipe(take(1))
        .subscribe({
          next: () => {
            this.logger.info('Node deleted successfully', { nodeId: node.id });

            // Remove from visual graph
            this.x6GraphAdapter.removeNode(node.id);
          },
          error: error => {
            this.logger.error('Error deleting node', error);
          },
        });
    });

    // Delete standalone edges (edges not connected to deleted nodes)
    selectedEdges.forEach(edge => {
      const sourceNodeId = edge.getSourceCellId();
      const targetNodeId = edge.getTargetCellId();

      // Check if this edge is connected to any of the nodes being deleted
      const isConnectedToDeletedNode = selectedNodes.some(
        node => node.id === sourceNodeId || node.id === targetNodeId,
      );

      // Only delete the edge if it's not connected to a node being deleted
      // (since deleting the node will automatically delete connected edges)
      if (!isConnectedToDeletedNode) {
        const command = DiagramCommandFactory.removeEdge(diagramId, userId, edge.id, true); // isLocalUserInitiated

        this.commandBus
          .execute<void>(command)
          .pipe(take(1))
          .subscribe({
            next: () => {
              this.logger.info('Edge deleted successfully', { edgeId: edge.id });

              // Remove from visual graph
              this.x6GraphAdapter.removeEdge(edge.id);
            },
            error: error => {
              this.logger.error('Error deleting edge', error);
            },
          });
      }
    });

    // Clear selection after deletion
    const graph = this.x6GraphAdapter.getGraph();
    if (graph && typeof graph.cleanSelection === 'function') {
      graph.cleanSelection();
    }
  }

  /**
   * Opens the context menu for a cell at the specified position
   */
  openCellContextMenu(
    cell: Cell,
    x: number,
    y: number,
    contextMenuTrigger?: MatMenuTrigger,
    cdr?: ChangeDetectorRef,
  ): void {
    // Store the right-clicked cell
    this._rightClickedCell = cell;

    // Set the position of the context menu
    this.contextMenuPosition = {
      x: `${x}px`,
      y: `${y}px`,
    };

    // Force change detection to update the position
    if (cdr) {
      cdr.detectChanges();
    }

    // Open the context menu
    if (contextMenuTrigger) {
      contextMenuTrigger.openMenu();
    }

    this.logger.info('Opened context menu for cell', { cellId: cell.id });
  }

  /**
   * Copies the complete definition of the right-clicked cell to the clipboard
   */
  copyCellDefinition(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for copying definition');
      return;
    }

    try {
      // Get the complete cell state including all properties
      const cellDefinition = this._rightClickedCell.toJSON();

      // Convert to formatted JSON string
      const jsonString = JSON.stringify(cellDefinition, null, 2);

      // Copy to clipboard
      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          this.logger.info('Cell definition copied to clipboard', {
            cellId: this._rightClickedCell?.id,
          });
        })
        .catch(error => {
          this.logger.error('Failed to copy cell definition to clipboard', error);
          // Fallback for older browsers
          this._fallbackCopyToClipboard(jsonString);
        });
    } catch (error) {
      this.logger.error('Error serializing cell definition', error);
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
      // Use the Clipboard API if available as a fallback
      if (navigator.clipboard && navigator.clipboard.writeText) {
        void navigator.clipboard.writeText(text).then(
          () => {
            this.logger.info('Text copied to clipboard (Clipboard API fallback)');
          },
          (err: unknown) => {
            this.logger.error('Clipboard API fallback failed', err);
          },
        );
      } else {
        // Last resort: show the text in an alert so user can manually copy
        this.logger.warn('No clipboard API available, showing text for manual copy');
        alert('Please manually copy this text:\n\n' + text);
      }
    } catch (error) {
      this.logger.error('Fallback copy to clipboard failed', error);
    }

    document.body.removeChild(textArea);
  }

  /**
   * Opens the threat editor dialog to create a new threat
   */
  openThreatEditor(threatModelId: string | null, dfdId: string | null): void {
    if (!threatModelId) {
      this.logger.warn('Cannot add threat: No threat model ID available');
      return;
    }

    // Get the threat model to add the threat to
    this.threatModelService
      .getThreatModelById(threatModelId)
      .pipe(take(1))
      .subscribe(threatModel => {
        if (!threatModel) {
          this.logger.error('Threat model not found', { id: threatModelId });
          return;
        }

        const dialogData: ThreatEditorDialogData = {
          threatModelId: threatModelId,
          mode: 'create',
          diagramId: dfdId || '',
          cellId: this._selectedCells$.value[0]?.id || '',
        };

        const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
          width: '900px',
          maxHeight: '90vh',
          data: dialogData,
        });

        this._subscriptions.add(
          dialogRef.afterClosed().subscribe(result => {
            if (result && threatModel) {
              const now = new Date().toISOString();

              interface ThreatFormResult {
                name: string;
                description: string;
                severity?: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
                threat_type?: string;
                diagram_id?: string;
                cell_id?: string;
                score?: number;
                priority?: string;
                issue_url?: string;
                metadata?: Array<{ key: string; value: string }>;
              }
              const formResult = result as ThreatFormResult;

              // Create a new threat
              const newThreat = {
                id: uuidv4(),
                threat_model_id: threatModel.id,
                name: formResult.name,
                description: formResult.description,
                created_at: now,
                modified_at: now,
                severity: formResult.severity || 'High',
                threat_type: formResult.threat_type || 'Information Disclosure',
                diagram_id: formResult.diagram_id || dfdId || '',
                cell_id: formResult.cell_id || this._selectedCells$.value[0]?.id || '',
                score: formResult.score || 10.0,
                priority: formResult.priority || 'High',
                issue_url: formResult.issue_url || 'n/a',
                metadata: formResult.metadata || [],
              };

              // Add the threat to the threat model
              if (!threatModel.threats) {
                threatModel.threats = [];
              }
              threatModel.threats.push(newThreat);

              // Update the threat model
              this._subscriptions.add(
                this.threatModelService.updateThreatModel(threatModel).subscribe(updatedModel => {
                  if (updatedModel) {
                    this.logger.info('Threat added successfully', { threatId: newThreat.id });
                  }
                }),
              );
            }
          }),
        );
      });
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(threatModelId: string | null, dfdId: string | null): void {
    this.logger.info('Closing diagram', { diagramId: dfdId });

    if (threatModelId) {
      // Navigate back to the threat model editor page
      void this.router.navigate(['/tm', threatModelId]);
    } else {
      // Fallback to the threat models list if no threat model ID is available
      void this.router.navigate(['/tm']);
    }
  }

  /**
   * Move selected cells forward in z-order
   */
  moveForward(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move forward operation');
      return;
    }

    this.logger.info('Moving cell forward', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsForward();
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move backward operation');
      return;
    }

    this.logger.info('Moving cell backward', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsBackward();
  }

  /**
   * Move selected cells to front
   */
  moveToFront(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to front operation');
      return;
    }

    this.logger.info('Moving cell to front', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsToFront();
  }

  /**
   * Move selected cells to back
   */
  moveToBack(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to back operation');
      return;
    }

    this.logger.info('Moving cell to back', { cellId: this._rightClickedCell.id });
    this.x6GraphAdapter.moveSelectedCellsToBack();
  }

  /**
   * Check if the right-clicked cell is an edge
   */
  isRightClickedCellEdge(): boolean {
    return this._rightClickedCell?.isEdge() ?? false;
  }

  /**
   * Edit the text/label of the right-clicked cell by invoking the label editor
   */
  editCellText(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for text editing');
      return;
    }

    this.logger.info('Invoking label editor for cell', { cellId: this._rightClickedCell.id });

    // Use the X6 graph adapter's label editing functionality
    // We need to simulate a double-click event to trigger the existing label editor
    const mockEvent = new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: 0,
      clientY: 0,
    });

    // Access the private method through the adapter to add the label editor
    // Since _addLabelEditor is private, we'll call it through a public method we'll add
    this.x6GraphAdapter.startLabelEditing(this._rightClickedCell, mockEvent);
  }

  /**
   * Undo the last action using X6 history addon
   */
  undo(isInitialized: boolean): void {
    if (!isInitialized) {
      this.logger.warn('Cannot undo: Graph is not initialized');
      return;
    }

    this.logger.info('Undo requested');
    this.x6GraphAdapter.undo();
  }

  /**
   * Redo the last undone action using X6 history addon
   */
  redo(isInitialized: boolean): void {
    if (!isInitialized) {
      this.logger.warn('Cannot redo: Graph is not initialized');
      return;
    }

    this.logger.info('Redo requested');
    this.x6GraphAdapter.redo();
  }

  /**
   * Get the right-clicked cell
   */
  getRightClickedCell(): Cell | null {
    return this._rightClickedCell;
  }
}
