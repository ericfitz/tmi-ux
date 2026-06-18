/**
 * Infrastructure WebSocket Collaboration Adapter
 *
 * Handles WebSocket-based collaborative diagram operations for the DFD module.
 * Provides high-level API for sending diagram operations, managing operation IDs,
 * and coordinating with the server for real-time collaborative editing.
 */

import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../../core/services/logger.service';
import { AuthService } from '../../../../auth/services/auth.service';
import { WebSocketAdapter, WebSocketState } from '../../../../core/services/websocket.adapter';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { DfdStateStore } from '../../state/dfd.state';
import {
  DiagramOperationRequestMessage,
  CellOperation,
  CellPatchOperation,
  Cell,
  UndoRequestMessage,
  RedoRequestMessage,
  SyncRequestMessage,
  SyncStatusRequestMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  CursorPosition,
  CollaborativeOperationConfig,
} from '../../../../core/types/websocket-message.types';

/**
 * Queued operation for retry/fallback handling
 */
interface QueuedOperation {
  id: string;
  operation: DiagramOperationRequestMessage;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
// SEM@e7dd6955882ba4be469447e879cf0576655cd710: send collaborative diagram cell operations over WebSocket with queuing and retry
export class InfraWebsocketCollaborationAdapter {
  private _config: CollaborativeOperationConfig | null = null;

  // Operation queue for offline/error scenarios
  private _operationQueue: QueuedOperation[] = [];
  private _isProcessingQueue = false;

  // Pending operations tracking for conflict resolution
  private _pendingOperations = new Map<
    string,
    {
      operation: DiagramOperationRequestMessage;
      timestamp: number;
      resolve: (value: void) => void;
      reject: (error: any) => void;
    }
  >();

  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: wire dependencies and subscribe to connection state to drain the operation queue (mutates shared state)
  constructor(
    private webSocketAdapter: WebSocketAdapter,
    private authService: AuthService,
    private collaborationService: DfdCollaborationService,
    private dfdStateStore: DfdStateStore,
    private logger: LoggerService,
  ) {
    // Listen for connection state changes to process queued operations
    this.webSocketAdapter.connectionState$.subscribe(state => {
      if (state === WebSocketState.CONNECTED && this._operationQueue.length > 0) {
        this._processOperationQueue();
      }
    });
  }

  /**
   * Initialize the service with diagram and user context
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: store the diagram and user context required before sending operations (mutates shared state)
  initialize(config: CollaborativeOperationConfig): void {
    this._config = config;
    this.logger.debugComponent(
      'WebSocketCollaboration',
      'CollaborativeOperationService initialized',
      {
        diagramId: config.diagramId,
        threatModelId: config.threatModelId,
        providerId: config.providerId,
      },
    );
  }

  /**
   * Send a diagram operation via WebSocket with retry and queuing
   */
  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: authorize, deduplicate, and send cell operations to the server via WebSocket with retry
  sendDiagramOperation(cellOperations: CellOperation[]): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    // Check permissions
    if (this.collaborationService.isCollaborating()) {
      // In collaborative mode, check collaboration permissions
      const hasCollabEditPermission = this.collaborationService.hasPermission('edit');

      // If collaboration permissions are not yet loaded, fall back to threat model permission
      if (!hasCollabEditPermission) {
        const isLoadingUsers = !this.collaborationService.hasLoadedUsers();

        if (isLoadingUsers && this._config.threatModelPermission === 'writer') {
          // Assume threat model permission until collaboration permissions are loaded
          this.logger.info(
            'Using threat model permission as fallback while collaboration permissions load',
            {
              threatModelPermission: this._config.threatModelPermission,
              isLoadingUsers,
            },
          );
        } else {
          // Log additional context to help debug permission issues
          this.logger.warn('User does not have permission to send edit operations', {
            isCollaborating: this.collaborationService.isCollaborating(),
            currentUserEmail: this.authService.userEmail,
            hasEditPermission: hasCollabEditPermission,
            threatModelPermission: this._config.threatModelPermission,
            isHost: this.collaborationService.isCurrentUserHost(),
            isLoadingUsers,
          });
          return throwError(() => new Error('Insufficient permissions to edit diagram'));
        }
      }
    } else if (this._config.threatModelPermission === 'reader') {
      // Not collaborating - use threat model permission
      this.logger.warn('User has reader permission on threat model - cannot edit', {
        threatModelPermission: this._config.threatModelPermission,
      });
      return throwError(() => new Error('Insufficient permissions to edit diagram'));
    }

    // Deduplicate operations by cell ID, keeping the latest operation for each cell
    const deduplicatedOperations = this._deduplicateOperations(cellOperations);

    this.logger.debugComponent('WebSocketCollaboration', 'Deduplicated cell operations', {
      originalCount: cellOperations.length,
      deduplicatedCount: deduplicatedOperations.length,
    });

    const operation: CellPatchOperation = {
      type: 'patch',
      cells: deduplicatedOperations,
    };

    // Get current update_vector for conflict detection
    const baseVector = this.dfdStateStore.updateVector;

    // Client-to-server request - no initiating_user field (server uses authenticated context)
    const message: DiagramOperationRequestMessage = {
      message_type: 'diagram_operation_request',
      operation_id: uuid(),
      base_vector: baseVector,
      operation: operation,
    };

    this.logger.debugComponent('WebSocketCollaboration', 'Sending diagram operation request', {
      operationId: message.operation_id,
      baseVector: baseVector,
      cellCount: deduplicatedOperations.length,
      operations: deduplicatedOperations.map(op => ({ id: op.id, operation: op.operation })),
    });

    return this._sendOperationWithRetry(message);
  }

  /**
   * Send a single cell add operation
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: send an add operation for a single cell via WebSocket
  addCell(cell: Cell): Observable<void> {
    const cellOperation: CellOperation = {
      id: cell.id,
      operation: 'add',
      data: cell,
    };

    return this.sendDiagramOperation([cellOperation]);
  }

  /**
   * Send a single cell update operation
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: send an update operation for a single cell's properties via WebSocket
  updateCell(cellId: string, updates: Partial<Cell>): Observable<void> {
    const cellOperation: CellOperation = {
      id: cellId,
      operation: 'update',
      data: updates as Cell,
    };

    return this.sendDiagramOperation([cellOperation]);
  }

  /**
   * Send a single cell remove operation
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: dispatch a diagram cell removal operation over WebSocket
  removeCell(cellId: string): Observable<void> {
    const cellOperation: CellOperation = {
      id: cellId,
      operation: 'remove',
    };

    return this.sendDiagramOperation([cellOperation]);
  }

  /**
   * Send multiple cell operations as a batch
   */
  // SEM@57394346339d21b4055bda04efd4d869626327c2: dispatch multiple diagram cell operations as a single batch over WebSocket
  sendBatchOperation(operations: CellOperation[]): Observable<void> {
    return this.sendDiagramOperation(operations);
  }

  /**
   * Request undo operation from server
   */
  // SEM@669c7f6fde976a12f0c634c95e5eff802d8934aa: send an undo request to the server; requires edit permission
  requestUndo(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    if (!this.collaborationService.hasPermission('edit')) {
      return throwError(() => new Error('Insufficient permissions to undo'));
    }

    // Client-to-server request - no initiating_user field (server uses authenticated context)
    const message: UndoRequestMessage = {
      message_type: 'undo_request',
    };

    this.logger.debugComponent('WebSocketCollaboration', 'Requesting undo operation');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request redo operation from server
   */
  // SEM@669c7f6fde976a12f0c634c95e5eff802d8934aa: send a redo request to the server; requires edit permission
  requestRedo(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    if (!this.collaborationService.hasPermission('edit')) {
      return throwError(() => new Error('Insufficient permissions to redo'));
    }

    // Client-to-server request - no initiating_user field (server uses authenticated context)
    const message: RedoRequestMessage = {
      message_type: 'redo_request',
    };

    this.logger.debugComponent('WebSocketCollaboration', 'Requesting redo operation');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request full diagram state from server
   * If updateVector is provided and matches server's, server sends SyncStatusResponse instead
   * If updateVector differs or is omitted, server sends DiagramStateMessage
   */
  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: request full diagram state or sync status from server via WebSocket
  sendSyncRequest(updateVector?: number): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    const message: SyncRequestMessage = {
      message_type: 'sync_request',
      ...(updateVector !== undefined && { update_vector: updateVector }),
    };

    this.logger.info('Sending sync request', { updateVector });
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request sync status check from server (new sync protocol)
   * Server responds with current update_vector only
   */
  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: request current diagram update vector from server via WebSocket
  sendSyncStatusRequest(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    const message: SyncStatusRequestMessage = {
      message_type: 'sync_status_request',
    };

    this.logger.info('Sending sync status request');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send presenter cursor position (presenter only)
   */
  // SEM@f2bb57ba89c5cc48041879bbe8d95d96f6f7ac5d: broadcast presenter cursor position to collaborators; presenter only
  sendPresenterCursor(position: CursorPosition): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    // Only send if user is actually the presenter
    if (!this.collaborationService.isCurrentUserPresenter()) {
      return throwError(() => new Error('Only presenter can send cursor updates'));
    }

    const userProfile = this.authService.userProfile;
    if (!userProfile) {
      return throwError(() => new Error('User not authenticated'));
    }

    const message: PresenterCursorMessage = {
      message_type: 'presenter_cursor',
      cursor_position: position,
    };

    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send presenter selection (presenter only)
   */
  // SEM@f2bb57ba89c5cc48041879bbe8d95d96f6f7ac5d: broadcast presenter cell selection to collaborators; presenter only
  sendPresenterSelection(selectedCellIds: string[]): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    // Only send if user is actually the presenter
    if (!this.collaborationService.isCurrentUserPresenter()) {
      return throwError(() => new Error('Only presenter can send selection updates'));
    }

    const userProfile = this.authService.userProfile;
    if (!userProfile) {
      return throwError(() => new Error('User not authenticated'));
    }

    const message: PresenterSelectionMessage = {
      message_type: 'presenter_selection',
      selected_cells: selectedCellIds,
    };

    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send operation with retry and queuing mechanisms
   */
  // SEM@669c7f6fde976a12f0c634c95e5eff802d8934aa: send a diagram operation with retry and offline queuing (mutates shared state)
  private _sendOperationWithRetry(
    message: DiagramOperationRequestMessage,
    maxRetries: number = 3,
  ): Observable<void> {
    return new Observable(observer => {
      // If WebSocket is not connected, queue the operation
      if (!this.webSocketAdapter.isConnected) {
        this._queueOperation(message, maxRetries);
        observer.next(); // Consider queued operation as "sent"
        observer.complete();
        return;
      }

      // Track pending operation for conflict resolution
      this._pendingOperations.set(message.operation_id, {
        operation: message,
        timestamp: Date.now(),
        resolve: () => observer.next(),
        reject: error => observer.error(error),
      });

      // Send via WebSocket directly as TMI message
      this.webSocketAdapter.sendTMIMessage(message).subscribe({
        next: () => {
          this._pendingOperations.delete(message.operation_id);
          observer.next();
          observer.complete();
        },
        error: error => {
          this._pendingOperations.delete(message.operation_id);

          // If error is retryable and we haven't exceeded retries, queue for later
          if (this._isRetryableOperationError(error) && maxRetries > 0) {
            this.logger.warn('Operation failed, queuing for retry', {
              operationId: message.operation_id,
              error,
            });
            this._queueOperation(message, maxRetries - 1);
            observer.next(); // Consider queued operation as "sent"
            observer.complete();
          } else {
            this.logger.error('Operation failed permanently', {
              operationId: message.operation_id,
              error,
            });
            observer.error(error);
          }
        },
      });

      // Set timeout for operation acknowledgment
      setTimeout(() => {
        const pending = this._pendingOperations.get(message.operation_id);
        if (pending) {
          this._pendingOperations.delete(message.operation_id);
          this.logger.warn('Operation timeout - no acknowledgment received', {
            operationId: message.operation_id,
          });
          observer.error(new Error('Operation timeout'));
        }
      }, 10000); // 10 second timeout
    });
  }

  /**
   * Queue operation for later retry
   */
  // SEM@669c7f6fde976a12f0c634c95e5eff802d8934aa: store a pending diagram operation for later retry (mutates shared state)
  private _queueOperation(message: DiagramOperationRequestMessage, maxRetries: number): void {
    const queuedOp: QueuedOperation = {
      id: message.operation_id,
      operation: message,
      retryCount: 0,
      maxRetries,
      timestamp: Date.now(),
    };

    this._operationQueue.push(queuedOp);
    this.logger.info('Operation queued for retry', {
      operationId: message.operation_id,
      queueLength: this._operationQueue.length,
    });
  }

  /**
   * Process queued operations when connection is restored
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: drain queued diagram operations over WebSocket when connection restores (mutates shared state)
  private _processOperationQueue(): void {
    if (this._isProcessingQueue || this._operationQueue.length === 0) {
      return;
    }

    this._isProcessingQueue = true;
    this.logger.info('Processing operation queue', { queueLength: this._operationQueue.length });

    // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: send and retry the next queued diagram operation recursively (mutates shared state)
    const processNext = () => {
      if (this._operationQueue.length === 0) {
        this._isProcessingQueue = false;
        this.logger.info('Operation queue processing complete');
        return;
      }

      const queuedOp = this._operationQueue.shift()!;

      // Check if operation is too old (older than 5 minutes)
      if (Date.now() - queuedOp.timestamp > 300000) {
        this.logger.warn('Discarding old queued operation', {
          operationId: queuedOp.id,
          age: Date.now() - queuedOp.timestamp,
        });
        processNext();
        return;
      }

      // Try to send the operation
      this.webSocketAdapter.sendTMIMessage(queuedOp.operation).subscribe({
        next: () => {
          this.logger.info('Queued operation sent successfully', { operationId: queuedOp.id });
          processNext();
        },
        error: error => {
          queuedOp.retryCount++;

          if (queuedOp.retryCount < queuedOp.maxRetries && this._isRetryableOperationError(error)) {
            // Re-queue for another retry
            this._operationQueue.unshift(queuedOp);
            this.logger.warn('Queued operation failed, will retry', {
              operationId: queuedOp.id,
              retryCount: queuedOp.retryCount,
              maxRetries: queuedOp.maxRetries,
            });
          } else {
            this.logger.error('Queued operation failed permanently', {
              operationId: queuedOp.id,
              error,
            });
          }

          processNext();
        },
      });
    };

    processNext();
  }

  /**
   * Check if an operation error is retryable
   */
  // SEM@dc5902cbca2aba1397d5a67c7ab5a112f19b62ae: determine if a WebSocket operation error is safe to retry (pure)
  private _isRetryableOperationError(error: any): boolean {
    return (
      !error.message?.includes('401') &&
      !error.message?.includes('403') &&
      !error.message?.includes('permission') &&
      this.webSocketAdapter.isConnected // Use isConnected instead of connectionHealth
    );
  }

  /**
   * Clear operation queue (call when ending collaboration)
   */
  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: discard all pending and queued diagram operations (mutates shared state)
  clearOperationQueue(): void {
    const queueLength = this._operationQueue.length;
    this._operationQueue = [];
    this._pendingOperations.clear();
    this._isProcessingQueue = false;

    if (queueLength > 0) {
      this.logger.info('Operation queue cleared', { discardedOperations: queueLength });
    }
  }

  /**
   * Check if service is properly initialized
   */
  // SEM@57394346339d21b4055bda04efd4d869626327c2: return whether the collaboration service has been configured (pure)
  isInitialized(): boolean {
    return this._config !== null;
  }

  /**
   * Get current configuration
   */
  // SEM@57394346339d21b4055bda04efd4d869626327c2: return the current collaboration operation configuration or null (pure)
  getConfig(): CollaborativeOperationConfig | null {
    return this._config;
  }

  /**
   * Reset service state
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: clear operation queue and configuration to restore initial state (mutates shared state)
  reset(): void {
    this.clearOperationQueue();
    this._config = null;
    this.logger.debugComponent('WebSocketCollaboration', 'CollaborativeOperationService reset');
  }

  /**
   * Deduplicate operations by cell ID, keeping the most recent operation for each cell.
   * For update operations on the same cell, merge the data together.
   */
  // SEM@5838478bfe3b4f257f0c29809d0a2f43e89b5c1b: collapse duplicate cell operations by ID, merging updates and prioritizing removes (pure)
  private _deduplicateOperations(operations: CellOperation[]): CellOperation[] {
    const operationMap = new Map<string, CellOperation>();

    for (const operation of operations) {
      const existingOperation = operationMap.get(operation.id);

      if (!existingOperation) {
        // First operation for this cell ID
        operationMap.set(operation.id, { ...operation });
      } else {
        // Handle duplicate operations for the same cell
        if (operation.operation === 'remove') {
          // Remove operations always take precedence
          operationMap.set(operation.id, operation);
        } else if (operation.operation === 'add') {
          // Add operations should not be duplicated, but if they are, use the latest
          operationMap.set(operation.id, operation);
        } else if (operation.operation === 'update' && existingOperation.operation === 'update') {
          // Merge update operations by combining their data
          const mergedData = { ...existingOperation.data, ...operation.data } as Cell;
          operationMap.set(operation.id, {
            ...operation,
            data: mergedData,
          });
        } else if (operation.operation === 'update' && existingOperation.operation === 'add') {
          // Update after add - merge the update data into the add operation
          const mergedData = { ...existingOperation.data, ...operation.data } as Cell;
          operationMap.set(operation.id, {
            ...existingOperation,
            data: mergedData,
          });
        } else {
          // For other cases, use the latest operation
          operationMap.set(operation.id, operation);
        }
      }
    }

    return Array.from(operationMap.values());
  }
}
