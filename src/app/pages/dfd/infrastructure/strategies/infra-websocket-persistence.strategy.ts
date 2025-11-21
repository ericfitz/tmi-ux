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
  SaveOperation,
  SaveResult,
  LoadOperation,
  LoadResult,
} from '../../application/services/app-persistence-coordinator.service';

@Injectable()
export class WebSocketPersistenceStrategy {
  readonly type = 'websocket' as const;

  constructor(
    private readonly logger: LoggerService,
    private readonly webSocketAdapter: WebSocketAdapter,
    private readonly collaborationAdapter: InfraWebsocketCollaborationAdapter,
  ) {
    // this.logger.debug('WebSocketPersistenceStrategy initialized');
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
    this.logger.debug('WebSocket load operation started', {
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
}
