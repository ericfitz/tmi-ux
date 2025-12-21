/**
 * WebSocket persistence strategy
 * Handles save/load operations via real-time WebSocket connections
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, of, throwError, Subject, merge, buffer, debounceTime } from 'rxjs';
import { map, catchError, filter, takeUntil } from 'rxjs/operators';

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

    // For undo/redo in collaboration mode, send history operation message
    if (isUndo || isRedo) {
      const message: any = {
        message_type: 'history_operation',
        operation_type: isUndo ? 'undo' : 'redo',
        message: 'resync_required', // Default message value
      };

      this.logger.info('Sending WebSocket history operation', {
        operationType: message.operation_type,
        diagramId: operation.diagramId,
      });

      // Send via WebSocket
      this.webSocketAdapter.sendTMIMessage(message).subscribe();

      return of({
        success: true,
        operationId: `ws-history-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
        metadata: {
          sentViaWebSocket: true,
          operationType: message.operation_type,
        },
      });
    }

    // For regular changes in collaboration mode, send diagram_operation message
    this.logger.debugComponent(
      'WebSocketPersistenceStrategy',
      'WebSocket save (regular changes) - sending diagram_operation',
      {
        diagramId: operation.diagramId,
        hasData: !!operation.data,
      },
    );

    // Convert diagram data to cell operations
    const cellOperations = this._convertDiagramDataToCellOperations(operation.data);

    if (cellOperations.length === 0) {
      this.logger.warn('No cell operations to broadcast', { diagramId: operation.diagramId });
      return of({
        success: true,
        operationId: `ws-save-empty-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
        metadata: { note: 'No changes to broadcast' },
      });
    }

    this.logger.info('Sending diagram_operation via collaboration adapter', {
      diagramId: operation.diagramId,
      cellCount: cellOperations.length,
    });

    // Send diagram operation via WebSocket collaboration adapter
    return this.collaborationAdapter.sendDiagramOperation(cellOperations).pipe(
      map(() => ({
        success: true,
        operationId: `ws-save-${Date.now()}`,
        diagramId: operation.diagramId,
        timestamp: Date.now(),
        metadata: {
          sentViaWebSocket: true,
          cellOperations: cellOperations.length,
        },
      })),
      catchError(error => {
        this.logger.error('Failed to send diagram_operation', {
          error,
          diagramId: operation.diagramId,
        });
        return throwError(() => error);
      }),
    );
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
   */
  private _broadcastAddOperations(events: HistoryOperationEvent[]): void {
    if (!this.webSocketAdapter.isConnected) {
      this.logger.warn('WebSocket not connected, skipping add broadcast', {
        eventCount: events.length,
      });
      return;
    }

    // Collect all cells from all events (preserving atomic batches)
    const allCells = events.flatMap(event => event.entry?.cells || []);

    if (allCells.length === 0) {
      this.logger.warn('No cells to broadcast in add operations', { eventCount: events.length });
      return;
    }

    // Convert cells to cell operations
    const cellOperations: CellOperation[] = allCells.map(cell => ({
      id: cell.id,
      operation: 'update',
      data: cell,
    }));

    this.logger.info('Broadcasting batched add operations', {
      eventCount: events.length,
      cellCount: allCells.length,
      operationCount: cellOperations.length,
    });

    // Send via collaboration adapter
    this.collaborationAdapter.sendDiagramOperation(cellOperations).subscribe({
      next: () => {
        this.logger.debugComponent(
          'WebSocketPersistenceStrategy',
          'Successfully broadcast add operations',
          {
            eventCount: events.length,
            cellCount: allCells.length,
          },
        );
      },
      error: error => {
        this.logger.error('Failed to broadcast add operations', {
          error,
          eventCount: events.length,
          cellCount: allCells.length,
        });
      },
    });
  }
}
