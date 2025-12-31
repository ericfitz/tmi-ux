/**
 * AppOperationRejectionHandler - Handles operation_rejected messages from server
 *
 * This service coordinates the complete rejection handling flow:
 * - Receives operation_rejected messages from WebSocket
 * - Rolls back local operations using history service
 * - Queues incoming operations during rollback
 * - Forces resync when history entry cannot be found
 * - Implements circuit breaker to exit collaboration on repeated failures
 * - Shows notifications to user with optional resync action
 */

import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription, of, throwError } from 'rxjs';
import { switchMap, tap, takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { AppHistoryService } from './app-history.service';
import { AppDiagramResyncService } from './app-diagram-resync.service';
import { AppStateService } from './app-state.service';
import { InfraDfdWebsocketAdapter } from '../../infrastructure/adapters/infra-dfd-websocket.adapter';
import { DiagramOperationMessage } from '../../../../core/types/websocket-message.types';

interface RejectionEvent {
  operation_id: string;
  sequence_number?: number;
  update_vector: number; // Current server update_vector when rejection occurred
  reason: string;
  message: string;
  details?: string;
  affected_cells?: string[];
  requires_resync: boolean;
  timestamp: string;
}

interface RejectionRecord {
  timestamp: number;
  reason: string;
}

/** Lookup map for rejection reason to notification severity */
const REJECTION_SEVERITY_MAP: Record<string, 'info' | 'warning' | 'error'> = {
  no_state_change: 'info',
  conflict_detected: 'warning',
  validation_failed: 'error',
  permission_denied: 'error',
};

/** Lookup map for rejection reason to notification title */
const REJECTION_TITLE_MAP: Record<string, string> = {
  conflict_detected: 'Operation Conflict',
  validation_failed: 'Invalid Operation',
  permission_denied: 'Permission Denied',
  no_state_change: 'No Changes',
  diagram_not_found: 'Diagram Not Found',
  invalid_operation_type: 'Invalid Operation Type',
  empty_operation: 'Empty Operation',
};

@Injectable()
export class AppOperationRejectionHandler implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private _subscription = new Subscription();

  // Track rejections for circuit breaker
  private _recentRejections: RejectionRecord[] = [];
  private _recentResyncs = 0;
  private _lastResyncWindowStart = Date.now();
  private readonly MAX_REJECTIONS_PER_MINUTE = 5;
  private readonly MAX_RESYNCS_PER_MINUTE = 3;
  private readonly REJECTION_WINDOW_MS = 60000; // 1 minute

  // Queue for holding incoming operations during rollback
  private _operationQueue: DiagramOperationMessage[] = [];
  private _isRollingBack = false;
  private _initialized = false;

  // Batch rejection notifications
  private _pendingNotifications: RejectionEvent[] = [];
  private _notificationTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly NOTIFICATION_BATCH_DELAY_MS = 2000; // 2 seconds

  constructor(
    private logger: LoggerService,
    private historyService: AppHistoryService,
    private websocketAdapter: InfraDfdWebsocketAdapter,
    private resyncService: AppDiagramResyncService,
    private collaborationService: DfdCollaborationService,
    private appStateService: AppStateService,
  ) {
    // this.logger.debugComponent('AppOperationRejectionHandler', 'AppOperationRejectionHandler constructed');
  }

  /**
   * Initialize the rejection handler
   */
  initialize(): void {
    if (this._initialized) {
      this.logger.warn('AppOperationRejectionHandler already initialized');
      return;
    }

    // Subscribe to operation_rejected messages
    this._subscription.add(
      this.websocketAdapter.operationRejected$.pipe(takeUntil(this._destroy$)).subscribe({
        next: event => this._handleOperationRejected(event),
        error: error => {
          this.logger.error('Error in operation rejected subscription', { error });
        },
      }),
    );

    // Subscribe to diagram operations to queue them during rollback
    this._subscription.add(
      this.websocketAdapter.diagramOperations$.pipe(takeUntil(this._destroy$)).subscribe({
        next: op => this._handleIncomingOperation(op),
        error: error => {
          this.logger.error('Error in diagram operations subscription', { error });
        },
      }),
    );

    this._initialized = true;
    // this.logger.info('AppOperationRejectionHandler initialized');
  }

  /**
   * Cleanup
   */
  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._subscription.unsubscribe();

    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
    }

    this.logger.debugComponent('AppOperationRejectionHandler', 'destroyed');
  }

  /**
   * Handle operation_rejected message from server
   */
  private _handleOperationRejected(event: RejectionEvent): void {
    this.logger.warn('Operation rejected by server', {
      operation_id: event.operation_id,
      update_vector: event.update_vector,
      reason: event.reason,
      requires_resync: event.requires_resync,
    });

    // Track rejection for circuit breaker
    this._recentRejections.push({ timestamp: Date.now(), reason: event.reason });
    this._cleanupOldRejections();

    // Check circuit breaker
    if (this._shouldTripCircuitBreaker()) {
      this._tripCircuitBreaker();
      return;
    }

    // Add to pending notifications (will be batched)
    this._addPendingNotification(event);

    // Block new operations during rollback
    this.appStateService.setBlockOperations(true);
    this._isRollingBack = true;

    // Attempt to rollback
    this._performRollback(event).subscribe({
      next: undoCount => {
        this.logger.info('Successfully rolled back operations', { undoCount });

        // Apply queued operations
        this._applyQueuedOperations();

        // Unblock operations
        this._isRollingBack = false;
        this.appStateService.setBlockOperations(false);
      },
      error: error => {
        this.logger.error('Failed to rollback operations', { error });

        // Force resync on rollback failure
        this._forceResync('Rollback failed').subscribe();
      },
    });
  }

  /**
   * Perform rollback of rejected operation
   */
  private _performRollback(event: RejectionEvent): Observable<number> {
    // Check if history entry exists
    const entry = this.historyService.findEntryByOperationId(event.operation_id);

    if (!entry) {
      // Cannot find history entry - must resync
      this.logger.error('Cannot find history entry for rejected operation', {
        operation_id: event.operation_id,
      });
      return this._forceResync('Cannot find operation in history').pipe(switchMap(() => of(0)));
    }

    // Undo operations
    return this.historyService.undoUntilOperationId(event.operation_id).pipe(
      tap(result => {
        if (!result.success) {
          throw new Error('Undo operation failed');
        }
      }),
      switchMap(result => of(result.undoCount)),
    );
  }

  /**
   * Handle incoming diagram operation - queue if rolling back
   */
  private _handleIncomingOperation(operation: DiagramOperationMessage): void {
    if (this._isRollingBack) {
      // Queue operation to apply after rollback
      this._operationQueue.push(operation);
      this.logger.debugComponent(
        'AppOperationRejectionHandler',
        'Queued operation during rollback',
        {
          operation_id: operation.operation_id,
          queueLength: this._operationQueue.length,
        },
      );
    }
    // Otherwise, normal handling by other services
  }

  /**
   * Clear queued operations after rollback completes
   * Note: Operations are discarded as they will be handled by the normal WebSocket flow
   */
  private _applyQueuedOperations(): void {
    if (this._operationQueue.length === 0) {
      return;
    }

    this.logger.info('Clearing queued operations after rollback', {
      queueLength: this._operationQueue.length,
    });

    // Clear the queue - the WebSocket adapter will handle incoming operations normally
    // now that we're no longer in rollback mode
    this._operationQueue = [];
  }

  /**
   * Add rejection to pending notifications for batching
   */
  private _addPendingNotification(event: RejectionEvent): void {
    this._pendingNotifications.push(event);

    // Clear existing timer
    if (this._notificationTimer) {
      clearTimeout(this._notificationTimer);
    }

    // Set new timer to show batched notifications
    this._notificationTimer = setTimeout(() => {
      this._showBatchedNotifications();
    }, this.NOTIFICATION_BATCH_DELAY_MS);
  }

  /**
   * Show batched rejection notifications
   */
  private _showBatchedNotifications(): void {
    if (this._pendingNotifications.length === 0) {
      return;
    }

    const count = this._pendingNotifications.length;
    const firstEvent = this._pendingNotifications[0];
    const requiresResync = this._pendingNotifications.some(e => e.requires_resync);

    this.logger.info('Showing batched rejection notifications', { count });

    const notification = this._buildNotification(count, firstEvent, requiresResync);

    this.logger.warn('Rejection notification', notification);

    // Clear pending notifications
    this._pendingNotifications = [];
    this._notificationTimer = null;

    // TODO: Integrate with actual notification service when available
  }

  /**
   * Build notification object from rejection events
   */
  private _buildNotification(
    count: number,
    firstEvent: RejectionEvent,
    requiresResync: boolean,
  ): { title: string; message: string; severity: string; requiresResync: boolean; action: string } {
    const severity = this._getSeverity(firstEvent.reason);
    const baseTitle = this._getTitle(firstEvent.reason);

    const title = count === 1 ? baseTitle : `${count} Operations Rejected: ${baseTitle}`;

    const message =
      count === 1
        ? `${firstEvent.message}\n\nRolled back 1 operation.`
        : `Multiple operations were rejected.\n\nRolled back ${count} operations.`;

    return {
      title,
      message,
      severity,
      requiresResync,
      action: requiresResync ? 'Resync Diagram' : 'None',
    };
  }

  /**
   * User-initiated resync from notification
   */
  private _userInitiatedResync(): void {
    this.logger.info('User initiated resync after rejection');

    // Clear all history
    this.historyService.clear();

    // Block operations during resync
    this.appStateService.setBlockOperations(true);

    // Trigger resync (returns void, completion will be handled by resync service events)
    this.resyncService.triggerResync();

    // Note: Resync service triggers diagram reload which will unblock operations
    // No need to subscribe - the service handles this internally
    this.logger.info('Resync triggered');
  }

  /**
   * Force immediate resync (not user-initiated)
   */
  private _forceResync(reason: string): Observable<void> {
    this.logger.warn('Forcing immediate resync', { reason });

    // Track resync for circuit breaker
    const now = Date.now();
    if (now - this._lastResyncWindowStart > this.REJECTION_WINDOW_MS) {
      // Reset window
      this._lastResyncWindowStart = now;
      this._recentResyncs = 0;
    }

    this._recentResyncs++;

    // Check if too many resyncs
    if (this._recentResyncs > this.MAX_RESYNCS_PER_MINUTE) {
      this._tripCircuitBreaker();
      return throwError(() => new Error('Too many resyncs - circuit breaker tripped'));
    }

    // Clear history
    this.historyService.clear();

    // Note: In real implementation, show notification
    this.logger.warn('Diagram resynchronizing', { reason });

    // Trigger resync (returns void)
    this.resyncService.triggerResync();

    // Clean up state
    this._isRollingBack = false;
    this.appStateService.setBlockOperations(false);

    // Clear queued operations
    this._applyQueuedOperations();

    // Return completed observable
    return of(void 0);
  }

  /**
   * Check if circuit breaker should trip
   */
  private _shouldTripCircuitBreaker(): boolean {
    return (
      this._recentRejections.length > this.MAX_REJECTIONS_PER_MINUTE ||
      this._recentResyncs > this.MAX_RESYNCS_PER_MINUTE
    );
  }

  /**
   * Trip circuit breaker - exit collaboration due to repeated failures
   */
  private _tripCircuitBreaker(): void {
    this.logger.error('Circuit breaker tripped - too many rejections or resyncs', {
      rejectionCount: this._recentRejections.length,
      resyncCount: this._recentResyncs,
    });

    // Note: In real implementation, show error notification
    this.logger.error(
      'Collaboration error: Too many conflicts detected. Leaving collaboration session.',
    );

    // Exit collaboration
    this.collaborationService.endCollaboration().subscribe({
      next: () => {
        this.logger.info('Successfully left collaboration session');
      },
      error: error => {
        this.logger.error('Failed to end collaboration', { error });
      },
    });
  }

  /**
   * Clean up old rejections outside the time window
   */
  private _cleanupOldRejections(): void {
    const cutoff = Date.now() - this.REJECTION_WINDOW_MS;
    this._recentRejections = this._recentRejections.filter(r => r.timestamp > cutoff);
  }

  /**
   * Get notification severity based on rejection reason
   */
  private _getSeverity(reason: string): 'info' | 'warning' | 'error' {
    return REJECTION_SEVERITY_MAP[reason] ?? 'warning';
  }

  /**
   * Get notification title based on rejection reason
   */
  private _getTitle(reason: string): string {
    return REJECTION_TITLE_MAP[reason] ?? 'Operation Rejected';
  }
}
