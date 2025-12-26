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
import { CellOperation } from '../../../../core/types/websocket-message.types';
import {
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
} from '../../application/services/app-persistence-coordinator.service';
import { AppHistoryService } from '../../application/services/app-history.service';
import { HistoryOperationEvent } from '../../types/history.types';

@Injectable()
export class WebSocketPersistenceStrategy implements OnDestroy {
  readonly type = 'websocket' as const;

  private readonly destroy$ = new Subject<void>();
  private readonly batchTrigger$ = new Subject<void>();

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
  getConnectionStatus(): boolean {
    return this.webSocketAdapter.isConnected;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.batchTrigger$.complete();
  }

  /**
   * Initialize history-driven broadcasting
   * Listens to history operation events and broadcasts them to collaborators
   */
  private _initializeHistoryBroadcasting(): void {
    // Buffer 'add' operations for batching
    const addOperations$ = this.historyService.historyOperation$.pipe(
      filter(event => event.operationType === 'add' && event.success),
      takeUntil(this.destroy$),
    );

    // Batch buffer: collect operations until batchTrigger$ emits or 50ms passes
    const batchedAdds$ = addOperations$.pipe(
      buffer(merge(this.batchTrigger$, addOperations$.pipe(debounceTime(50)))),
      filter(events => events.length > 0),
    );

    // Subscribe to batched add operations
    batchedAdds$.subscribe(events => {
      this._broadcastAddOperations(events);
    });

    // Note: Undo/redo operations are NOT broadcast from history events
    // In collaboration mode, undo/redo buttons send WebSocket messages directly
    // The server responds with diagram_operation messages that are applied normally

    this.logger.debugComponent(
      'WebSocketPersistenceStrategy',
      'History-driven broadcasting initialized (add operations only)',
    );
  }

  /**
   * Broadcast batched add operations as diagram_operation
   * Only sends the cells that were actually added/modified, not the entire diagram state
   */
  private _broadcastAddOperations(events: HistoryOperationEvent[]): void {
    if (!this.webSocketAdapter.isConnected) {
      this.logger.debugComponent(
        'WebSocketPersistenceStrategy',
        'WebSocket not connected, skipping add broadcast',
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

      const { cells, previousCells, metadata } = event.entry;
      const previousCellIds = new Set(previousCells.map(c => c.id));

      // Find newly added cells (in cells but not in previousCells)
      const addedCells = cells.filter(cell => !previousCellIds.has(cell.id));

      // Also check metadata.affectedCellIds if available for additional context
      const affectedCellIds = new Set(metadata?.affectedCellIds || []);

      for (const cell of addedCells) {
        cellOperations.push({
          id: cell.id,
          operation: 'add',
          data: cell,
        });
      }

      // Log if there's a mismatch between diff and metadata
      if (affectedCellIds.size > 0 && addedCells.length !== affectedCellIds.size) {
        this.logger.debugComponent(
          'WebSocketPersistenceStrategy',
          'Cell diff vs metadata mismatch (using diff result)',
          {
            diffAddedCount: addedCells.length,
            diffAddedIds: addedCells.map(c => c.id),
            metadataAffectedIds: Array.from(affectedCellIds),
          },
        );
      }
    }

    if (cellOperations.length === 0) {
      this.logger.debugComponent(
        'WebSocketPersistenceStrategy',
        'No cells to broadcast in add operations (diff yielded no new cells)',
        { eventCount: events.length },
      );
      return;
    }

    this.logger.info('Broadcasting batched add operations', {
      eventCount: events.length,
      operationCount: cellOperations.length,
      cellIds: cellOperations.map(op => op.id),
    });

    // Send via collaboration adapter
    this.collaborationAdapter.sendDiagramOperation(cellOperations).subscribe({
      next: () => {
        this.logger.debugComponent(
          'WebSocketPersistenceStrategy',
          'Successfully broadcast add operations',
          {
            eventCount: events.length,
            operationCount: cellOperations.length,
          },
        );
      },
      error: error => {
        this.logger.error('Failed to broadcast add operations', {
          error,
          eventCount: events.length,
          operationCount: cellOperations.length,
        });
      },
    });
  }
}
