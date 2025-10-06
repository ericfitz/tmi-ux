/**
 * WebSocket persistence strategy
 * Handles save/load operations via real-time WebSocket connections
 */

import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import { InfraWebsocketCollaborationAdapter } from '../adapters/infra-websocket-collaboration.adapter';
import { CellOperation } from '../../../../core/types/websocket-message.types';
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
    private readonly collaborationAdapter: InfraWebsocketCollaborationAdapter,
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
    this.logger.debug('WebSocket save (regular changes) - sending diagram_operation', {
      diagramId: operation.diagramId,
      hasData: !!operation.data,
    });

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
        this.logger.error('Failed to send diagram_operation', { error, diagramId: operation.diagramId });
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
          operation: 'update',  // All cells in save operation are updates
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
