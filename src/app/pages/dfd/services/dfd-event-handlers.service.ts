import { Injectable, ElementRef, ChangeDetectorRef } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenuTrigger } from '@angular/material/menu';
import { Router } from '@angular/router';
import { Subscription, BehaviorSubject, Subject, Observable } from 'rxjs';
import { take } from 'rxjs/operators';
import { Cell } from '@antv/x6';
import { LoggerService } from '../../../core/services/logger.service';
import { X6SelectionAdapter } from '../infrastructure/adapters/x6-selection.adapter';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import { FrameworkService } from '../../../shared/services/framework.service';
import { CellDataExtractionService } from '../../../shared/services/cell-data-extraction.service';
import { Threat } from '../../tm/models/threat-model.model';
import {
  ThreatEditorDialogComponent,
  ThreatEditorDialogData,
  DiagramOption,
  CellOption,
} from '../../tm/components/threat-editor-dialog/threat-editor-dialog.component';
import {
  CellPropertiesDialogComponent,
  CellPropertiesDialogData,
} from '../components/cell-properties-dialog/cell-properties-dialog.component';

/**
 * Interface for label change events
 */
export interface LabelChangeEvent {
  cellId: string;
  oldLabel: string;
  newLabel: string;
  cellType: 'node' | 'edge';
}

/**
 * Interface for node info change events (for history integration)
 */
export interface NodeInfoChangeEvent {
  nodeId: string;
  oldData: { label: string };
  newData: { label: string };
}

/**
 * Interface for threat change events (for auto-save integration)
 */
export interface ThreatChangeEvent {
  action: 'added' | 'removed' | 'changed';
  threatId: string;
  diagramId: string;
}

/**
 * Service responsible for handling events in DFD diagrams
 * Includes cell label management functionality
 * Simplified to work directly with X6 without command bus
 */
@Injectable()
export class DfdEventHandlersService {
  private _rightClickedCell: Cell | null = null;
  private _selectedCells$ = new BehaviorSubject<Cell[]>([]);
  private _subscriptions = new Subscription();
  private _x6GraphAdapter: any = null;

  // Label change observables
  private _labelChanged$ = new Subject<LabelChangeEvent>();
  private _nodeInfoChanged$ = new Subject<NodeInfoChangeEvent>();

  // Threat change observable
  private _threatChanged$ = new Subject<ThreatChangeEvent>();

  // Context menu position
  contextMenuPosition = { x: '0px', y: '0px' };

  constructor(
    private logger: LoggerService,
    private x6SelectionAdapter: X6SelectionAdapter,
    private threatModelService: ThreatModelService,
    private frameworkService: FrameworkService,
    private dialog: MatDialog,
    private router: Router,
    private cellDataExtractionService: CellDataExtractionService,
  ) {}

  /**
   * Initialize event handlers
   */
  initialize(x6GraphAdapter: any): void {
    // Store reference to graph adapter for later use
    this._x6GraphAdapter = x6GraphAdapter;

    // Subscribe to selection state changes
    this._subscriptions.add(
      x6GraphAdapter.selectionChanged$.subscribe({
        next: () => {
          // Get selected cells directly from the adapter
          const selectedCells = x6GraphAdapter.getSelectedCells();
          this._selectedCells$.next(selectedCells);
        },
        error: (error: unknown) => {
          this.logger.error('Error in selection change subscription', error);
        },
      }),
    );

    // Subscribe to context menu events
    this._subscriptions.add(
      x6GraphAdapter.cellContextMenu$.subscribe(({ cell, x, y }: { cell: any; x: any; y: any }) => {
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
  onKeyDown(
    event: KeyboardEvent,
    _diagramId: string,
    isInitialized: boolean,
    x6GraphAdapter: any,
  ): void {
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
        this.onDeleteSelected(isInitialized, x6GraphAdapter);
        return;
      }
    }
  }

  /**
   * Handle window resize events to update the graph size
   */
  onWindowResize(
    graphContainer: ElementRef,
    resizeTimeout: number | null,
    x6GraphAdapter: any,
  ): number | null {
    // Handle resize events immediately
    if (resizeTimeout) {
      window.clearTimeout(resizeTimeout);
    }

    return window.setTimeout(() => {
      const graph = x6GraphAdapter.getGraph();
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
    }, 250); // Debounce resize events
  }

  /**
   * Deletes the currently selected cell(s) using the selection adapter
   */
  onDeleteSelected(isInitialized: boolean, x6GraphAdapter: any): void {
    if (!isInitialized) {
      this.logger.warn('Cannot delete: Graph is not initialized');
      return;
    }

    const graph = x6GraphAdapter.getGraph();

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
  openThreatEditor(
    threatModelId: string | null,
    dfdId: string | null,
    diagramName?: string | null,
  ): void {
    if (!threatModelId) {
      this.logger.warn('Cannot add threat: No threat model ID available');
      return;
    }

    // Get the selected cell to determine shape type
    const selectedCell = this._selectedCells$.value[0];
    let shapeType: string | undefined;

    if (selectedCell?.shape) {
      // Map DFD shape names to framework shape types
      const shapeMapping: Record<string, string> = {
        process: 'Process',
        store: 'Store',
        actor: 'Actor',
        edge: 'Flow',
        // security-boundary and text-box don't map to threat framework shapes
      };

      shapeType = shapeMapping[selectedCell.shape];

      this.logger.info('Selected cell shape type for threat editor', {
        dfdShape: selectedCell.shape,
        frameworkShapeType: shapeType || 'unmapped',
        cellId: selectedCell.id,
      });
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

        const currentFrameworkName = threatModel.threat_model_framework;

        // Find the framework model that matches the threat model's framework
        this.frameworkService
          .loadAllFrameworks()
          .pipe(take(1))
          .subscribe(frameworks => {
            const framework = frameworks.find(f => f.name === currentFrameworkName);

            if (!framework) {
              this.logger.warn('Framework not found for threat model', {
                threatModelFramework: currentFrameworkName,
                availableFrameworks: frameworks.map(f => f.name),
              });
            } else {
              this.logger.info('Using framework for DFD threat editor', {
                framework: framework.name,
                shapeType: shapeType || 'none',
                frameworkThreatTypes: framework.threatTypes.map(tt => tt.name),
              });
            }

            // Extract diagram and cell data using the utility service
            let diagrams: DiagramOption[] = [];
            let cells: CellOption[] = [];

            if (this._x6GraphAdapter && dfdId && diagramName) {
              try {
                const graph = this._x6GraphAdapter.getGraph();
                const cellData = this.cellDataExtractionService.extractFromX6Graph(
                  graph,
                  dfdId,
                  diagramName,
                );
                diagrams = cellData.diagrams;
                cells = cellData.cells;
              } catch (error) {
                this.logger.error('Error extracting cell data for threat editor', error);
                // Fallback: create basic diagram option
                if (dfdId && diagramName) {
                  diagrams = [{ id: dfdId, name: diagramName }];
                }
              }
            }

            const dialogData: ThreatEditorDialogData = {
              threatModelId: threatModelId,
              mode: 'create',
              diagramId: dfdId || '',
              cellId: selectedCell?.id || '',
              diagrams: diagrams,
              cells: cells,
              framework,
              shapeType,
            };

            const dialogRef = this.dialog.open(ThreatEditorDialogComponent, {
              width: '650px',
              maxHeight: '90vh',
              panelClass: 'threat-editor-dialog-650',
              data: dialogData,
            });

            this._subscriptions.add(
              dialogRef.afterClosed().subscribe(result => {
                if (result && threatModel) {
                  const now = new Date().toISOString();

                  // Type the result to avoid unsafe assignments
                  interface ThreatFormResult {
                    name: string;
                    description: string;
                    severity: 'Unknown' | 'None' | 'Low' | 'Medium' | 'High' | 'Critical';
                    threat_type: string;
                    diagram_id?: string;
                    cell_id?: string;
                    score?: number;
                    priority?: string;
                    mitigated?: boolean;
                    status?: string;
                    issue_url?: string;
                    metadata?: { key: string; value: string }[];
                  }

                  const formResult = result as ThreatFormResult;

                  const newThreat: Threat = {
                    id: crypto.randomUUID(),
                    threat_model_id: threatModelId,
                    name: formResult.name,
                    description: formResult.description || '',
                    created_at: now,
                    modified_at: now,
                    severity: formResult.severity || 'High',
                    threat_type: formResult.threat_type || 'Information Disclosure',
                    diagram_id: formResult.diagram_id || dfdId || '',
                    cell_id: formResult.cell_id || selectedCell?.id || '',
                    score: formResult.score || 10.0,
                    priority: formResult.priority || 'High',
                    issue_url: formResult.issue_url || '',
                    mitigated: formResult.mitigated || false,
                    status: formResult.status || 'Open',
                    metadata: formResult.metadata || [],
                  };

                  // Create the new threat using the proper API endpoint
                  this.threatModelService.createThreat(threatModelId, newThreat).subscribe({
                    next: () => {
                      this.logger.info('Threat added successfully from DFD', {
                        threatId: newThreat.id,
                        threatName: newThreat.name,
                        diagramId: dfdId,
                        cellId: newThreat.cell_id,
                        shapeType: shapeType || 'none',
                      });

                      // Trigger auto-save for threat addition
                      this._threatChanged$.next({
                        action: 'added',
                        threatId: newThreat.id,
                        diagramId: dfdId || '',
                      });
                    },
                    error: (error: unknown) => {
                      const errorMessage = error instanceof Error ? error.message : String(error);
                      this.logger.error('Failed to add threat from DFD', errorMessage);
                    },
                  });
                }
              }),
            );
          });
      });
  }

  /**
   * Closes the diagram and navigates back to the threat model editor page
   */
  closeDiagram(threatModelId: string | null, _dfdId: string | null): void {
    this.logger.info('Closing diagram', { threatModelId, dfdId: _dfdId });

    if (threatModelId) {
      // Navigate back to the threat model editor page
      // Use replaceUrl to avoid issues with browser history when coming from collaboration
      void this.router.navigate(['/tm', threatModelId], {
        replaceUrl: true,
        queryParams: { refresh: 'true' }, // Force resolver to refresh data
      });
    } else {
      // Fallback to the threat models list if no threat model ID is available
      void this.router.navigate(['/tm']);
    }
  }

  /**
   * Move selected cells forward in z-order
   */
  moveForward(x6GraphAdapter: any): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move forward operation');
      return;
    }

    this.logger.info('Moving cell forward', { cellId: this._rightClickedCell.id });
    x6GraphAdapter.moveSelectedCellsForward();
  }

  /**
   * Move selected cells backward in z-order
   */
  moveBackward(x6GraphAdapter: any): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move backward operation');
      return;
    }

    this.logger.info('Moving cell backward', { cellId: this._rightClickedCell.id });
    x6GraphAdapter.moveSelectedCellsBackward();
  }

  /**
   * Move selected cells to front
   */
  moveToFront(x6GraphAdapter: any): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to front operation');
      return;
    }

    this.logger.info('Moving cell to front', { cellId: this._rightClickedCell.id });
    x6GraphAdapter.moveSelectedCellsToFront();
  }

  /**
   * Move selected cells to back
   */
  moveToBack(x6GraphAdapter: any): void {
    if (!this._rightClickedCell) {
      this.logger.warn('No cell selected for move to back operation');
      return;
    }

    this.logger.info('Moving cell to back', { cellId: this._rightClickedCell.id });
    x6GraphAdapter.moveSelectedCellsToBack();
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
  editCellText(x6GraphAdapter: any): void {
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
    x6GraphAdapter.startLabelEditing(this._rightClickedCell, mockEvent);
  }

  /**
   * Undo the last action using X6 history addon
   */
  undo(isInitialized: boolean, x6GraphAdapter: any): void {
    if (!isInitialized) {
      this.logger.warn('Cannot undo: Graph is not initialized');
      return;
    }

    this.logger.info('Undo requested');
    x6GraphAdapter.undo();
  }

  /**
   * Redo the last undone action using X6 history addon
   */
  redo(isInitialized: boolean, x6GraphAdapter: any): void {
    if (!isInitialized) {
      this.logger.warn('Cannot redo: Graph is not initialized');
      return;
    }

    this.logger.info('Redo requested');
    x6GraphAdapter.redo();
  }

  /**
   * Get the right-clicked cell
   */
  getRightClickedCell(): Cell | null {
    return this._rightClickedCell;
  }

  // ===============================
  // Cell Label Management Methods
  // ===============================

  /**
   * Observable for label change events
   */
  get labelChanged$(): Observable<LabelChangeEvent> {
    return this._labelChanged$.asObservable();
  }

  /**
   * Observable for node info change events (for history integration)
   */
  get nodeInfoChanged$(): Observable<NodeInfoChangeEvent> {
    return this._nodeInfoChanged$.asObservable();
  }

  /**
   * Observable for threat change events (for auto-save integration)
   */
  get threatChanged$(): Observable<ThreatChangeEvent> {
    return this._threatChanged$.asObservable();
  }

  /**
   * Get the label text for a cell
   */
  getCellLabel(cell: Cell): string {
    // Use X6 cell extensions for unified label handling
    return (cell as any).getLabel ? (cell as any).getLabel() : '';
  }

  /**
   * Set the label text for a cell with change detection and validation
   */
  setCellLabel(cell: Cell, text: string): boolean {
    const oldLabel = this.getCellLabel(cell);

    this.logger.debugComponent('DfdEventHandlers', 'Attempting to set label', {
      cellId: cell.id,
      isNode: cell.isNode(),
      currentLabel: oldLabel,
      newText: text,
    });

    // Validate the label change
    if (!this.isLabelChangeValid(cell, text, oldLabel)) {
      return false;
    }

    // Only proceed if the label actually changed
    if (oldLabel === text) {
      this.logger.debugComponent('DfdEventHandlers', 'Label unchanged, skipping update', {
        cellId: cell.id,
        label: text,
      });
      return false;
    }

    // Apply the label change using X6 cell extensions
    if ((cell as any).setLabel) {
      (cell as any).setLabel(text);
    } else {
      this.logger.warn('[CellLabelService] Cell does not support setLabel method', {
        cellId: cell.id,
        cellType: cell.isNode() ? 'node' : 'edge',
      });
      return false;
    }

    // Emit label change event
    this._labelChanged$.next({
      cellId: cell.id,
      oldLabel,
      newLabel: text,
      cellType: cell.isNode() ? 'node' : 'edge',
    });

    // For nodes, emit info change event for history integration
    if (cell.isNode()) {
      this.emitNodeInfoChangeForHistory(cell.id, oldLabel, text);
    }

    this.logger.info('[CellLabelService] Label updated successfully', {
      cellId: cell.id,
      oldLabel,
      newLabel: text,
    });

    return true;
  }

  /**
   * Check if a label change is valid
   */
  isLabelChangeValid(cell: Cell, newText: string, _oldText: string): boolean {
    // Basic validation rules
    if (typeof newText !== 'string') {
      this.logger.warn('[CellLabelService] Invalid label type', {
        cellId: cell.id,
        newText,
        type: typeof newText,
      });
      return false;
    }

    // Check for maximum length (reasonable limit for diagram labels)
    const maxLength = 100;
    if (newText.length > maxLength) {
      this.logger.warn('[CellLabelService] Label too long', {
        cellId: cell.id,
        length: newText.length,
        maxLength,
      });
      return false;
    }

    return true;
  }

  /**
   * Sanitize label text
   */
  sanitizeLabelText(text: string): string {
    if (typeof text !== 'string') {
      return '';
    }

    // Remove leading/trailing whitespace
    let sanitized = text.trim();

    // Replace multiple consecutive whitespaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');

    // Remove control characters but keep newlines for multi-line labels
    sanitized = sanitized.replace(/[\p{Cc}&&[^\n\r]]/gu, '');

    return sanitized;
  }

  /**
   * Check if a cell supports label editing
   */
  canEditCellLabel(cell: Cell): boolean {
    // Check if cell has the necessary extension methods
    return (
      typeof (cell as any).setLabel === 'function' && typeof (cell as any).getLabel === 'function'
    );
  }

  /**
   * Get label validation constraints for UI
   */
  getLabelConstraints(): { maxLength: number; allowedCharacters: string } {
    return {
      maxLength: 100,
      allowedCharacters: 'Alphanumeric characters, spaces, and common punctuation',
    };
  }

  /**
   * Batch update multiple cell labels
   */
  batchUpdateLabels(
    graph: any,
    updates: Array<{ cell: Cell; label: string }>,
  ): Array<{ cell: Cell; success: boolean }> {
    const results: Array<{ cell: Cell; success: boolean }> = [];

    if (graph && typeof graph.batchUpdate === 'function') {
      // Batch all label updates into a single history command
      graph.batchUpdate(() => {
        updates.forEach(update => {
          const success = this.setCellLabel(update.cell, update.label);
          results.push({ cell: update.cell, success });
        });
      });
    } else {
      // Fallback for when graph is not available
      updates.forEach(update => {
        const success = this.setCellLabel(update.cell, update.label);
        results.push({ cell: update.cell, success });
      });
    }

    this.logger.info('[CellLabelService] Batch label update completed', {
      totalUpdates: updates.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Emit node info change event for history system integration
   */
  private emitNodeInfoChangeForHistory(nodeId: string, oldLabel: string, newLabel: string): void {
    const oldData = { label: oldLabel };
    const newData = { label: newLabel };

    this.logger.info('[CellLabelService] Emitting node info change for history integration', {
      nodeId,
      oldData,
      newData,
    });

    this._nodeInfoChanged$.next({
      nodeId,
      oldData,
      newData,
    });
  }
}
