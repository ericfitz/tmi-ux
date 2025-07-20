import { Injectable, ElementRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Subscription, BehaviorSubject } from 'rxjs';
import { take } from 'rxjs/operators';
import { Cell } from '@antv/x6';
import { v4 as uuidv4 } from 'uuid';
import { LoggerService } from '../../../core/services/logger.service';
import { X6GraphAdapter } from '../infrastructure/adapters/x6-graph.adapter';
import { X6SelectionAdapter } from '../infrastructure/adapters/x6-selection.adapter';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
} from '../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  CellPropertiesDialogComponent,
  CellPropertiesDialogData,
} from '../components/cell-properties-dialog/cell-properties-dialog.component';

/**
 * Service responsible for handling events in DFD diagrams
 * Simplified to work directly with X6 without command bus
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
    private x6GraphAdapter: X6GraphAdapter,
    private x6SelectionAdapter: X6SelectionAdapter,
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
  onKeyDown(event: KeyboardEvent, _diagramId: string, isInitialized: boolean): void {
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
        this.onDeleteSelected(isInitialized);
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
   * Deletes the currently selected cell(s) using the selection adapter
   */
  onDeleteSelected(isInitialized: boolean): void {
    if (!isInitialized) {
      this.logger.warn('Cannot delete: Graph is not initialized');
      return;
    }

    const graph = this.x6GraphAdapter.getGraph();
    
    // Delegate to the selection adapter for proper batched deletion
    this.x6SelectionAdapter.deleteSelected(graph);
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
   * Shows the cell properties dialog with the serialized JSON object definition
   */
  showCellProperties(): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for showing properties');
      return;
    }

    this.logger.info('Opening cell properties dialog', {
      cellId: this._rightClickedCell.id,
    });

    const dialogData: CellPropertiesDialogData = {
      cell: this._rightClickedCell,
    };

    const dialogRef = this.dialog.open(CellPropertiesDialogComponent, {
      width: '800px',
      maxHeight: '90vh',
      data: dialogData,
    });

    // Log when dialog is closed (optional)
    this._subscriptions.add(
      dialogRef.afterClosed().subscribe(() => {
        this.logger.info('Cell properties dialog closed');
      }),
    );
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
  closeDiagram(threatModelId: string | null, _dfdId: string | null): void {
    this.logger.info('Closing diagram');

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
