/**
 * WebSocket persistence strategy
 * Handles save/load operations via real-time WebSocket connections
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import {
  PersistenceStrategy,
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
  SyncOperation,
  SyncResult,
} from '../../application/services/app-persistence-coordinator.service';

@Injectable()
export class WebSocketPersistenceStrategy implements PersistenceStrategy {
  readonly type = 'websocket' as const;
  readonly priority = 200; // Higher priority than REST for real-time operations

  constructor(
    private readonly logger: LoggerService,
    private readonly webSocketAdapter: WebSocketAdapter,
  ) {
    this.logger.debug('WebSocketPersistenceStrategy initialized');
  }

  save(operation: SaveOperation): Observable<SaveResult> {
    const isUndo = operation.metadata?.['isUndo'] === true;
    const isRedo = operation.metadata?.['isRedo'] === true;

    this.logger.debug('WebSocket save operation started', {
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
      const message = {
        type: 'history-operation',
        operation_type: isUndo ? 'undo' : 'redo',
        diagram_id: operation.diagramId,
        user_id: operation.metadata?.['userId'],
        timestamp: Date.now(),
      };

      this.logger.info('Sending WebSocket history operation', {
        operationType: message.operation_type,
        diagramId: operation.diagramId,
      });

      // Send via WebSocket
      this.webSocketAdapter.send(message);

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

    // For regular changes in collaboration mode, changes are already
    // broadcast via other WebSocket messages (cell-added, cell-changed, etc.)
    // so we just acknowledge success without additional action
    this.logger.debug('WebSocket save (non-undo/redo) - changes already broadcast', {
      diagramId: operation.diagramId,
    });

    return of({
      success: true,
      operationId: `ws-save-${Date.now()}`,
      diagramId: operation.diagramId,
      timestamp: Date.now(),
      metadata: {
        note: 'Changes broadcast via real-time WebSocket events',
      },
    });
  }

  load(operation: LoadOperation): Observable<LoadResult> {
    this.logger.debug('WebSocket load operation started', {
      diagramId: operation.diagramId,
      forceRefresh: operation.forceRefresh,
    });

    if (!this.webSocketAdapter.isConnected) {
      const error = 'WebSocket not connected';
      this.logger.warn(error, { diagramId: operation.diagramId });
      return throwError(() => new Error(error));
    }

    // For now, return empty diagram data
    // In a real implementation, this would request via WebSocket and wait for response
    return of({
      success: true,
      diagramId: operation.diagramId,
      data: {
        nodes: [],
        edges: [],
        metadata: {
          diagramId: operation.diagramId,
          version: 1,
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
        },
      },
      source: 'websocket' as const,
      timestamp: Date.now(),
    }).pipe(
      map(result => {
        this.logger.debug('WebSocket load completed successfully', {
          diagramId: operation.diagramId,
          hasData: !!result.data,
        });
        return result;
      }),
      catchError(error => {
        const errorMessage = `WebSocket load failed: ${error.message || 'Unknown error'}`;
        this.logger.error(errorMessage, {
          diagramId: operation.diagramId,
          error,
        });
        return of({
          success: false,
          diagramId: operation.diagramId,
          source: 'websocket' as const,
          timestamp: Date.now(),
          error: errorMessage,
        });
      }),
    );
  }

  sync(operation: SyncOperation): Observable<SyncResult> {
    this.logger.debug('WebSocket sync operation started', { diagramId: operation.diagramId });

    if (!this.webSocketAdapter.isConnected) {
      const error = 'WebSocket not connected';
      return throwError(() => new Error(error));
    }

    // For now, simulate successful sync
    return of({
      success: true,
      diagramId: operation.diagramId,
      conflicts: 0,
      timestamp: Date.now(),
    });
  }

  // Connection status methods
  getConnectionStatus(): boolean {
    return this.webSocketAdapter.isConnected;
  }
}
