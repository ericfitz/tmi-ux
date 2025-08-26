/**
 * Collaborative Operation Service
 *
 * Handles WebSocket-based collaborative diagram operations for the DFD module.
 * Provides high-level API for sending diagram operations, managing operation IDs,
 * and coordinating with the server for real-time collaborative editing.
 */

import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { v4 as uuid } from 'uuid';

import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { WebSocketAdapter, WebSocketState } from '../infrastructure/adapters/websocket.adapter';
import { DfdCollaborationService } from './dfd-collaboration.service';
import {
  DiagramOperationMessage,
  CellOperation,
  CellPatchOperation,
  Cell,
  UndoRequestMessage,
  RedoRequestMessage,
  ResyncRequestMessage,
  PresenterRequestMessage,
  ChangePresenterMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  CursorPosition,
  CollaborativeOperationConfig,
} from '../models/websocket-message.types';

/**
 * Queued operation for retry/fallback handling
 */
interface QueuedOperation {
  id: string;
  operation: DiagramOperationMessage;
  retryCount: number;
  maxRetries: number;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class CollaborativeOperationService {
  private _config: CollaborativeOperationConfig | null = null;

  // Operation queue for offline/error scenarios
  private _operationQueue: QueuedOperation[] = [];
  private _isProcessingQueue = false;

  // Pending operations tracking for conflict resolution
  private _pendingOperations = new Map<
    string,
    {
      operation: DiagramOperationMessage;
      timestamp: number;
      resolve: (value: void) => void;
      reject: (error: any) => void;
    }
  >();

  constructor(
    private webSocketAdapter: WebSocketAdapter,
    private authService: AuthService,
    private collaborationService: DfdCollaborationService,
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
  initialize(config: CollaborativeOperationConfig): void {
    this._config = config;
    this.logger.info('CollaborativeOperationService initialized', {
      diagramId: config.diagramId,
      threatModelId: config.threatModelId,
      userId: config.userId,
    });
  }

  /**
   * Send a diagram operation via WebSocket with retry and queuing
   */
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
            isSessionManager: this.collaborationService.isCurrentUserSessionManager(),
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

    const operation: CellPatchOperation = {
      type: 'patch',
      cells: cellOperations,
    };

    const message: DiagramOperationMessage = {
      message_type: 'diagram_operation',
      user_id: this._config.userId,
      operation_id: uuid(),
      operation: operation,
    };

    this.logger.debug('Sending diagram operation', {
      operationId: message.operation_id,
      cellCount: cellOperations.length,
      operations: cellOperations.map(op => ({ id: op.id, operation: op.operation })),
    });

    return this._sendOperationWithRetry(message);
  }

  /**
   * Send a single cell add operation
   */
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
  sendBatchOperation(operations: CellOperation[]): Observable<void> {
    return this.sendDiagramOperation(operations);
  }

  /**
   * Request undo operation from server
   */
  requestUndo(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    if (!this.collaborationService.hasPermission('edit')) {
      return throwError(() => new Error('Insufficient permissions to undo'));
    }

    const message: UndoRequestMessage = {
      message_type: 'undo_request',
      user_id: this._config.userId,
    };

    this.logger.debug('Requesting undo operation');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request redo operation from server
   */
  requestRedo(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    if (!this.collaborationService.hasPermission('edit')) {
      return throwError(() => new Error('Insufficient permissions to redo'));
    }

    const message: RedoRequestMessage = {
      message_type: 'redo_request',
      user_id: this._config.userId,
    };

    this.logger.debug('Requesting redo operation');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request full diagram resync from server
   */
  requestResync(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    const message: ResyncRequestMessage = {
      message_type: 'resync_request',
      user_id: this._config.userId,
    };

    this.logger.info('Requesting diagram resync');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Request presenter mode
   */
  requestPresenterMode(): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    const message: PresenterRequestMessage = {
      message_type: 'presenter_request',
      user_id: this._config.userId,
    };

    this.logger.debug('Requesting presenter mode');
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Change presenter (owner only)
   */
  changePresenter(newPresenterUserId: string): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    if (!this.collaborationService.isCurrentUserSessionManager()) {
      return throwError(() => new Error('Only session manager can change presenter'));
    }

    const message: ChangePresenterMessage = {
      message_type: 'change_presenter',
      user_id: this._config.userId,
      new_presenter: newPresenterUserId,
    };

    this.logger.debug('Changing presenter', { newPresenter: newPresenterUserId });
    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send presenter cursor position (presenter only)
   */
  sendPresenterCursor(position: CursorPosition): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    // Only send if user is actually the presenter
    if (!this.collaborationService.isCurrentUserPresenter()) {
      return throwError(() => new Error('Only presenter can send cursor updates'));
    }

    const message: PresenterCursorMessage = {
      message_type: 'presenter_cursor',
      user_id: this._config.userId,
      cursor_position: position,
    };

    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send presenter selection (presenter only)
   */
  sendPresenterSelection(selectedCellIds: string[]): Observable<void> {
    if (!this._config) {
      return throwError(() => new Error('CollaborativeOperationService not initialized'));
    }

    // Only send if user is actually the presenter
    if (!this.collaborationService.isCurrentUserPresenter()) {
      return throwError(() => new Error('Only presenter can send selection updates'));
    }

    const message: PresenterSelectionMessage = {
      message_type: 'presenter_selection',
      user_id: this._config.userId,
      selected_cells: selectedCellIds,
    };

    return this.webSocketAdapter.sendTMIMessage(message);
  }

  /**
   * Send operation with retry and queuing mechanisms
   */
  private _sendOperationWithRetry(
    message: DiagramOperationMessage,
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

      // Send via WebSocket with retry
      this.webSocketAdapter
        .sendMessageWithRetry(
          {
            type: 'COMMAND_EXECUTE' as any, // Map to internal message type
            data: message as unknown as Record<string, unknown>,
          },
          maxRetries,
        )
        .subscribe({
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
  private _queueOperation(message: DiagramOperationMessage, maxRetries: number): void {
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
  private _processOperationQueue(): void {
    if (this._isProcessingQueue || this._operationQueue.length === 0) {
      return;
    }

    this._isProcessingQueue = true;
    this.logger.info('Processing operation queue', { queueLength: this._operationQueue.length });

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
  private _isRetryableOperationError(error: any): boolean {
    return (
      !error.message?.includes('401') &&
      !error.message?.includes('403') &&
      !error.message?.includes('permission') &&
      this.webSocketAdapter.connectionHealth > 0
    );
  }

  /**
   * Clear operation queue (call when ending collaboration)
   */
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
  isInitialized(): boolean {
    return this._config !== null;
  }

  /**
   * Get current configuration
   */
  getConfig(): CollaborativeOperationConfig | null {
    return this._config;
  }

  /**
   * Reset service state
   */
  reset(): void {
    this.clearOperationQueue();
    this._config = null;
    this.logger.debug('CollaborativeOperationService reset');
  }
}
