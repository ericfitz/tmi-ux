/**
 * WebSocket persistence strategy
 * Handles save/load operations via real-time WebSocket connections
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, of, throwError, Subject, merge, buffer, debounceTime } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import { InfraWebsocketCollaborationAdapter } from '../adapters/infra-websocket-collaboration.adapter';
import { Cell, CellOperation } from '../../../../core/types/websocket-message.types';
import {
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
} from '../../application/services/app-persistence-coordinator.service';
import { AppHistoryService } from '../../application/services/app-history.service';
import { HistoryOperationEvent } from '../../types/history.types';
import { normalizeCells } from '../../utils/cell-normalization.util';

@Injectable()
// SEM@8c4e66777d474f43af6ac7642c96bc4c67e8c70e: persist diagram changes to collaborators via WebSocket using history-driven broadcasting (mutates shared state)
export class WebSocketPersistenceStrategy implements OnDestroy {
  readonly type = 'websocket' as const;

  private readonly destroy$ = new Subject<void>();
  private readonly batchTrigger$ = new Subject<void>();

  // SEM@64c6f90cbf08c65ffe52297dde996cced3996fc0: register dependencies and initialize history broadcast subscription (mutates shared state)
  constructor(
    private readonly logger: LoggerService,
    private readonly webSocketAdapter: WebSocketAdapter,
    private readonly collaborationAdapter: InfraWebsocketCollaborationAdapter,
    private readonly historyService: AppHistoryService,
  ) {
    this.logger.debugComponent(
      'WebSocketPersistenceStrategy',
      'WebSocketPersistenceStrategy initialized',
    );

    // Subscribe to history operations and broadcast them
    this._initializeHistoryBroadcasting();
  }

  // SEM@fa066b188f441910bbde00f2c9c56b2bf95ca618: acknowledge a save request as no-op; reject undo/redo and disconnected calls (pure)
  save(operation: SaveOperation): Observable<SaveResult> {
    const isUndo = operation.metadata?.['isUndo'] === true;
    const isRedo = operation.metadata?.['isRedo'] === true;

    this.logger.debugComponent('WebSocketPersistenceStrategy', 'WebSocket save operation started', {
      diagramId: operation.diagramId,
      isUndo,
      isRedo,
    });

    if (!this.webSocketAdapter.isConnected) {
      const error = 'WebSocket not connected';
      this.logger.warn(error, { diagramId: operation.diagramId });
      return throwError(() => new Error(error));
    }

    // For undo/redo in collaboration mode, these operations should be routed through
    // the collaboration adapter's requestUndo()/requestRedo() methods instead of this strategy
    if (isUndo || isRedo) {
      const error =
        'Undo/redo operations should use collaboration adapter, not persistence strategy';
      this.logger.error(error, {
        diagramId: operation.diagramId,
        isUndo,
        isRedo,
      });
      return throwError(() => new Error(error));
    }

    // For regular changes in collaboration mode, we use history-driven broadcasting
    // (via _initializeHistoryBroadcasting) which sends incremental changes only.
    // The save() method should NOT broadcast the entire diagram state, as that would
    // duplicate operations and send unchanged cells. Just return success to satisfy
    // the autosave mechanism - the actual broadcasting happens via historyOperation$.
    this.logger.debugComponent(
      'WebSocketPersistenceStrategy',
      'WebSocket save - using history-driven broadcasting (save() is no-op for regular changes)',
      {
        diagramId: operation.diagramId,
      },
    );

    return of({
      success: true,
      operationId: `ws-save-${Date.now()}`,
      diagramId: operation.diagramId,
      timestamp: Date.now(),
      metadata: {
        note: 'Changes broadcast via history-driven broadcasting',
        sentViaWebSocket: true,
      },
    });
  }

  /**
   * Convert diagram data to cell operations
   */
  // SEM@34c4f50e937666974ea302cc280f9d9cc6d6d294: convert diagram node and edge data to update cell operations (pure)
  private _convertDiagramDataToCellOperations(data: any): CellOperation[] {
    if (!data) {
      return [];
    }

    const operations: CellOperation[] = [];

    // Add operations for all nodes
    if (data.nodes && Array.isArray(data.nodes)) {
      for (const node of data.nodes) {
        operations.push({
          id: node.id,
          operation: 'update', // All cells in save operation are updates
          data: node,
        });
      }
    }

    // Add operations for all edges
    if (data.edges && Array.isArray(data.edges)) {
      for (const edge of data.edges) {
        operations.push({
          id: edge.id,
          operation: 'update',
          data: edge,
        });
      }
    }

    return operations;
  }

  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: reject a load request; WebSocket strategy does not support loading diagrams (pure)
  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debugComponent('WebSocketPersistenceStrategy', 'WebSocket load operation started', {
      diagramId: operation.diagramId,
    });

    if (!this.webSocketAdapter.isConnected) {
      const error = 'WebSocket not connected';
      this.logger.warn(error, { diagramId: operation.diagramId });
      return throwError(() => new Error(error));
    }

    // WebSocket doesn't support load - always use REST API for loading
    const errorMessage = 'WebSocket strategy does not support load operation - use REST';
    this.logger.warn(errorMessage, { diagramId: operation.diagramId });
    return throwError(() => new Error(errorMessage));
  }

  // Connection status methods
  // SEM@00558ec66867848e260e04954f555ab98f64f0e4: return the current WebSocket connection status (pure)
  getConnectionStatus(): boolean {
    return this.webSocketAdapter.isConnected;
  }

  // SEM@64c6f90cbf08c65ffe52297dde996cced3996fc0: complete destroy and batch subjects to unsubscribe all streams (mutates shared state)
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.batchTrigger$.complete();
  }

  /**
   * Initialize history-driven broadcasting
   * Listens to history operation events and broadcasts them to collaborators
   */
  // SEM@8c4e66777d474f43af6ac7642c96bc4c67e8c70e: subscribe to history add-operations and schedule batched broadcast to collaborators (mutates shared state)
  private _initializeHistoryBroadcasting(): void {
    // Buffer 'add' operations for batching (these contain all cell changes: adds, updates, deletes)
    const addOperations$ = this.historyService.historyOperation$.pipe(
      filter(event => event.operationType === 'add' && event.success),
      takeUntil(this.destroy$),
    );

    // Batch buffer: collect operations until batchTrigger$ emits or 50ms passes
    const batchedOperations$ = addOperations$.pipe(
      buffer(merge(this.batchTrigger$, addOperations$.pipe(debounceTime(50)))),
      filter(events => events.length > 0),
    );

    // Subscribe to batched operations
    batchedOperations$.subscribe(events => {
      this._broadcastCellOperations(events);
    });

    // Note: Undo/redo operations are NOT broadcast from history events
    // In collaboration mode, undo/redo buttons send WebSocket messages directly
    // The server responds with diagram_operation messages that are applied normally

    this.logger.debugComponent(
      'WebSocketPersistenceStrategy',
      'History-driven broadcasting initialized (add/update/remove operations)',
    );
  }

  /**
   * Broadcast batched cell operations as diagram_operation
   * Computes add/update/remove operations by diffing cells vs previousCells
   * Normalizes cells before comparison to filter out visual effects and other transient properties
   */
  // SEM@8c4e66777d474f43af6ac7642c96bc4c67e8c70e: diff batched history events and dispatch add/update/remove cell operations over WebSocket (mutates shared state)
  private _broadcastCellOperations(events: HistoryOperationEvent[]): void {
    if (!this.webSocketAdapter.isConnected) {
      this.logger.debugComponent(
        'WebSocketPersistenceStrategy',
        'WebSocket not connected, skipping broadcast',
        {
          eventCount: events.length,
        },
      );
      return;
    }

    // Compute cell operations by diffing cells vs previousCells for each event
    const cellOperations: CellOperation[] = [];

    for (const event of events) {
      if (!event.entry) continue;

      const { cells, previousCells } = event.entry;

      // Normalize both cell arrays to filter out visual effects, tools, zIndex, etc.
      // This ensures we only compare and broadcast persistable properties
      const normalizedCells = normalizeCells(cells);
      const normalizedPreviousCells = normalizeCells(previousCells);

      // Build maps for efficient lookup
      const previousCellMap = new Map<string, Cell>();
      for (const cell of normalizedPreviousCells) {
        previousCellMap.set(cell.id, cell);
      }

      const currentCellMap = new Map<string, Cell>();
      for (const cell of normalizedCells) {
        currentCellMap.set(cell.id, cell);
      }

      // Find added cells (in current but not in previous)
      for (const cell of normalizedCells) {
        if (!previousCellMap.has(cell.id)) {
          cellOperations.push({
            id: cell.id,
            operation: 'add',
            data: cell,
          });
        }
      }

      // Find removed cells (in previous but not in current)
      for (const cell of normalizedPreviousCells) {
        if (!currentCellMap.has(cell.id)) {
          cellOperations.push({
            id: cell.id,
            operation: 'remove',
            // No data needed for remove operations
          });
        }
      }

      // Find updated cells (in both, but content differs)
      for (const cell of normalizedCells) {
        const previousCell = previousCellMap.get(cell.id);
        if (previousCell && this._cellsAreDifferent(previousCell, cell)) {
          cellOperations.push({
            id: cell.id,
            operation: 'update',
            data: cell,
          });
        }
      }
    }

    if (cellOperations.length === 0) {
      this.logger.debugComponent(
        'WebSocketPersistenceStrategy',
        'No cell changes to broadcast (diff yielded no operations)',
        { eventCount: events.length },
      );
      return;
    }

    // Count operations by type for logging
    const addCount = cellOperations.filter(op => op.operation === 'add').length;
    const updateCount = cellOperations.filter(op => op.operation === 'update').length;
    const removeCount = cellOperations.filter(op => op.operation === 'remove').length;

    this.logger.info('Broadcasting batched cell operations', {
      eventCount: events.length,
      operationCount: cellOperations.length,
      addCount,
      updateCount,
      removeCount,
      cellIds: cellOperations.map(op => op.id),
    });

    // Send via collaboration adapter
    this.collaborationAdapter.sendDiagramOperation(cellOperations).subscribe({
      next: () => {
        this.logger.debugComponent(
          'WebSocketPersistenceStrategy',
          'Successfully broadcast cell operations',
          {
            eventCount: events.length,
            operationCount: cellOperations.length,
            addCount,
            updateCount,
            removeCount,
          },
        );
      },
      error: error => {
        this.logger.error('Failed to broadcast cell operations', {
          error,
          eventCount: events.length,
          operationCount: cellOperations.length,
        });
      },
    });
  }

  /**
   * Compare two normalized cells to determine if they are different
   * Uses JSON serialization for deep comparison
   */
  // SEM@8c4e66777d474f43af6ac7642c96bc4c67e8c70e: compare two normalized cells for deep equality using JSON serialization (pure)
  private _cellsAreDifferent(cellA: Cell, cellB: Cell): boolean {
    // Simple deep comparison using JSON serialization
    // Both cells are already normalized, so this comparison is consistent
    return JSON.stringify(cellA) !== JSON.stringify(cellB);
  }
}
