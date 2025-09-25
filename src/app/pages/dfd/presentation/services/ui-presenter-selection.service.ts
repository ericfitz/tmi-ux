import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { Graph, Cell } from '@antv/x6';
import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { CollaborativeOperationService } from '../../services/collaborative-operation.service';
import { InfraX6SelectionAdapter } from '../../infrastructure/adapters/infra-x6-selection.adapter';
import { UiPresenterCursorDisplayService } from './ui-presenter-cursor-display.service';

/**
 * Service responsible for broadcasting presenter selection changes
 * Listens to X6 selection events and sends selection updates when presenter mode is active
 * Also handles incoming selection messages from other presenters
 */
@Injectable({
  providedIn: 'root',
})
export class UiPresenterSelectionService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _graph: Graph | null = null;
  private _selectionAdapter: InfraX6SelectionAdapter | null = null;
  private _isInitialized = false;

  constructor(
    private logger: LoggerService,
    private collaborationService: DfdCollaborationService,
    private collaborativeOperationService: CollaborativeOperationService,
    private uiPresenterCursorDisplayService: UiPresenterCursorDisplayService,
  ) {}

  /**
   * Initialize selection broadcasting for the given graph
   * @param graph The X6 graph instance
   * @param selectionAdapter The X6 selection adapter instance
   */
  initialize(graph: Graph, selectionAdapter: InfraX6SelectionAdapter): void {
    this._graph = graph;
    this._selectionAdapter = selectionAdapter;

    // Set up selection change listener
    this._setupSelectionListener();

    this._isInitialized = true;
    this.logger.info('UiPresenterSelectionService initialized');
  }

  /**
   * Setup listener for X6 selection changes to broadcast when presenter mode is active
   */
  private _setupSelectionListener(): void {
    if (!this._graph) {
      this.logger.error('Cannot setup selection listener: graph not available');
      return;
    }

    // Listen to selection changes on the graph
    this._graph.on(
      'selection:changed',
      ({ added: _added, removed: _removed }: { added: Cell[]; removed: Cell[] }) => {
        // Only broadcast if current user is presenter and presenter mode is active
        if (this.collaborationService.isCurrentUserPresenterModeActive()) {
          this._broadcastSelectionChange();
        }
      },
    );

    this.logger.info('Selection change listener setup completed');
  }

  /**
   * Broadcast current selection state to all participants
   */
  private _broadcastSelectionChange(): void {
    if (!this._graph || !this._selectionAdapter) {
      return;
    }

    try {
      // Get currently selected cells
      const selectedCells = this._selectionAdapter.getSelectedCells(this._graph);
      const selectedCellIds = selectedCells.map(cell => cell.id);

      // Send selection update via collaborative operation service
      this.collaborativeOperationService.sendPresenterSelection(selectedCellIds).subscribe({
        next: () => {
          this.logger.debug('Broadcast presenter selection change', {
            selectedCellIds,
            count: selectedCellIds.length,
          });
        },
        error: error => {
          this.logger.error('Error broadcasting selection change', error);
        },
      });
    } catch (error) {
      this.logger.error('Error broadcasting selection change', error);
    }
  }

  /**
   * Handle incoming presenter selection update
   * Called when a PresenterSelectionMessage is received
   * @param selectedCellIds Array of cell IDs that should be selected
   */
  handlePresenterSelectionUpdate(selectedCellIds: string[]): void {
    // Only apply selection if current user is not the presenter
    if (this.collaborationService.isCurrentUserPresenter()) {
      return;
    }

    if (!this._graph || !this._selectionAdapter) {
      this.logger.error('Cannot handle selection update: graph or selection adapter not available');
      return;
    }

    try {
      // First, clear any existing selection
      this._selectionAdapter.clearSelection(this._graph);

      // Get all cells in the graph
      const allCells = this._graph.getCells();

      // Find cells that match the selected IDs
      const cellsToSelect = allCells.filter(cell => selectedCellIds.includes(cell.id));

      // Apply new selection using the selection adapter
      if (cellsToSelect.length > 0) {
        this._selectionAdapter.selectCells(this._graph, cellsToSelect);
      }

      // Also reset cursor timeout to keep presenter cursor active
      this.uiPresenterCursorDisplayService.handlePresenterSelectionUpdate();

      this.logger.debug('Applied presenter selection update', {
        selectedCellIds,
        foundCells: cellsToSelect.length,
      });
    } catch (error) {
      this.logger.error('Error handling presenter selection update', error);
    }
  }

  /**
   * Manually trigger selection broadcast (useful for testing or specific scenarios)
   */
  broadcastCurrentSelection(): void {
    if (this.collaborationService.isCurrentUserPresenterModeActive()) {
      this._broadcastSelectionChange();
    } else {
      this.logger.warn('Cannot broadcast selection: presenter mode not active');
    }
  }

  /**
   * Clear selection for non-presenter users (useful when presenter disables presenter mode)
   */
  clearSelectionForNonPresenters(): void {
    if (this.collaborationService.isCurrentUserPresenter()) {
      return; // Don't clear selection for the presenter
    }

    if (!this._graph || !this._selectionAdapter) {
      return;
    }

    try {
      this._selectionAdapter.clearSelection(this._graph);
      this.logger.debug('Cleared selection for non-presenter user');
    } catch (error) {
      this.logger.error('Error clearing selection for non-presenter', error);
    }
  }

  /**
   * Cleanup resources
   */
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._graph = null;
    this._selectionAdapter = null;
    this._isInitialized = false;
    this.logger.info('UiPresenterSelectionService destroyed');
  }

  /**
   * Check if the service is initialized
   */
  get isInitialized(): boolean {
    return this._isInitialized;
  }
}
