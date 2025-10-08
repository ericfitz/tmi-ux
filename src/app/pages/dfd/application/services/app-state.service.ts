/**
 * Application State Service
 *
 * Orchestrates the state management of the DFD diagram including cells, operations,
 * synchronization status, and conflict resolution. Coordinates between domain events
 * from the WebSocket service and application state updates.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { DfdCollaborationService } from '../../../../core/services/dfd-collaboration.service';
import { ThreatModelService } from '../../../tm/services/threat-model.service';
import {
  CellOperation,
  CellPatchOperation,
  Cell as WSCell,
  DiagramOperationMessage,
} from '../../../../core/types/websocket-message.types';
import {
  InfraDfdWebsocketAdapter,
  WebSocketDomainEvent,
  StateCorrectionEvent,
  HistoryOperationEvent,
  ResyncRequestedEvent,
  ParticipantsUpdatedEvent,
} from '../../infrastructure/adapters/infra-dfd-websocket.adapter';

/**
 * Represents the synchronization state of the diagram
 */
export interface SyncState {
  isSynced: boolean;
  pendingOperations: number;
  lastSyncTimestamp: number;
  isResyncing: boolean;
}

/**
 * Represents a pending remote operation
 */
export interface PendingRemoteOperation {
  operationId: string;
  userId: string;
  operation: CellPatchOperation;
  timestamp: number;
}

/**
 * The complete state of the DFD diagram
 */
export interface DfdDiagramState {
  syncState: SyncState;
  pendingRemoteOperations: PendingRemoteOperation[];
  isApplyingRemoteChange: boolean;
  lastOperationId: string | null;
  conflictCount: number;
}

@Injectable()
export class AppStateService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  // State management
  private readonly _diagramState$ = new BehaviorSubject<DfdDiagramState>({
    syncState: {
      isSynced: true,
      pendingOperations: 0,
      lastSyncTimestamp: Date.now(),
      isResyncing: false,
    },
    pendingRemoteOperations: [],
    isApplyingRemoteChange: false,
    lastOperationId: null,
    conflictCount: 0,
  });

  // Public observables
  public readonly diagramState$ = this._diagramState$.asObservable();
  public readonly syncState$ = this._diagramState$.pipe(
    filter(state => !!state.syncState),
    map(state => state.syncState),
  );
  public readonly isApplyingRemoteChange$ = this._diagramState$.pipe(
    map(state => state.isApplyingRemoteChange),
  );

  // Event emitters for operations that need to be applied to the graph
  private readonly _applyOperationEvent$ = new Subject<{
    operation: CellOperation;
    userId: string;
    operationId: string;
  }>();
  private readonly _applyCorrectionEvent$ = new Subject<WSCell[]>();
  private readonly _requestResyncEvent$ = new Subject<{ method: string }>();
  private readonly _triggerResyncEvent$ = new Subject<void>();

  public readonly applyOperationEvents$ = this._applyOperationEvent$.asObservable();
  public readonly applyCorrectionEvents$ = this._applyCorrectionEvent$.asObservable();
  public readonly requestResyncEvents$ = this._requestResyncEvent$.asObservable();
  public readonly triggerResyncEvents$ = this._triggerResyncEvent$.asObservable();

  constructor(
    private _logger: LoggerService,
    private _webSocketService: InfraDfdWebsocketAdapter,
    private _collaborationService: DfdCollaborationService,
    private _threatModelService: ThreatModelService,
  ) {
    this._logger.info('AppStateService initialized');
  }

  /**
   * Initialize the state service and subscribe to WebSocket events
   */
  initialize(): void {
    this._logger.info('Initializing DFD state management');

    // Subscribe to domain events from WebSocket service
    this._subscriptions.add(
      this._webSocketService.domainEvents$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processDomainEvent(event)),
    );

    // Subscribe to specific events for targeted handling
    this._subscriptions.add(
      this._webSocketService.diagramOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe((message: any) => this._processDiagramOperation(message)),
    );

    this._subscriptions.add(
      this._webSocketService.stateCorrections$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processStateCorrection(event)),
    );

    this._subscriptions.add(
      this._webSocketService.historyOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processHistoryOperation(event)),
    );

    this._subscriptions.add(
      this._webSocketService.resyncRequests$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processResyncRequest(event)),
    );

    // Subscribe to participant management events
    this._subscriptions.add(
      this._webSocketService.participantsUpdated$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processParticipantsUpdate(event)),
    );

    this._logger.info('DFD state management initialized successfully');
  }

  /**
   * Get the current state synchronously
   */
  getCurrentState(): DfdDiagramState {
    return this._diagramState$.value;
  }

  /**
   * Update the state
   */
  private _updateState(updates: Partial<DfdDiagramState>): void {
    const currentState = this._diagramState$.value;
    const newState = { ...currentState, ...updates };

    if (updates.syncState) {
      newState.syncState = {
        ...currentState.syncState,
        ...(updates.syncState as Partial<SyncState>),
      };
    }

    this._diagramState$.next(newState);
  }

  /**
   * Set whether we're applying a remote change
   */
  setApplyingRemoteChange(isApplying: boolean): void {
    this._updateState({ isApplyingRemoteChange: isApplying });
  }

  /**
   * Process a domain event from the WebSocket service
   */
  private _processDomainEvent(event: WebSocketDomainEvent): void {
    this._logger.debug('Processing domain event', { type: event.type });

    // Update sync state based on event type
    switch (event.type) {
      case 'diagram-operation':
        this._updateSyncState({
          pendingOperations: this.getCurrentState().syncState.pendingOperations + 1,
        });
        break;

      case 'state-correction':
        this._updateState({
          syncState: { ...this.getCurrentState().syncState, isSynced: false },
          conflictCount: this.getCurrentState().conflictCount + 1,
        });
        break;

      case 'authorization-denied':
        this._updateState({ conflictCount: this.getCurrentState().conflictCount + 1 });
        break;
    }
  }

  /**
   * Process a diagram operation from another user
   */
  private _processDiagramOperation(message: DiagramOperationMessage): void {
    // Skip our own operations
    const currentUserEmail = this._collaborationService.getCurrentUserEmail();
    if (message.initiating_user.email === currentUserEmail) {
      this._logger.debug('Skipping own operation', { operationId: message.operation_id });
      return;
    }

    // Check if we've already processed this operation
    if (this.getCurrentState().lastOperationId === message.operation_id) {
      this._logger.debug('Operation already processed', { operationId: message.operation_id });
      return;
    }

    this._logger.info('Processing remote diagram operation', {
      userId: message.initiating_user.user_id,
      userEmail: message.initiating_user.email,
      operationId: message.operation_id,
      operationType: message.operation?.type,
    });

    // Update state
    this._updateState({
      lastOperationId: message.operation_id,
      pendingRemoteOperations: [
        ...this.getCurrentState().pendingRemoteOperations,
        {
          operationId: message.operation_id,
          userId: message.initiating_user.user_id,
          operation: message.operation,
          timestamp: Date.now(),
        },
      ],
    });

    // Emit events for each cell operation in the patch
    if (message.operation && message.operation.cells) {
      message.operation.cells.forEach(cellOp => {
        this._applyOperationEvent$.next({
          operation: cellOp,
          userId: message.initiating_user.user_id,
          operationId: message.operation_id,
        });
      });
    }

    // Update sync state
    this._updateSyncState({
      pendingOperations: Math.max(0, this.getCurrentState().syncState.pendingOperations - 1),
      lastSyncTimestamp: Date.now(),
    });
  }

  /**
   * Process a state correction from the server
   * Uses debounced resynchronization instead of applying the correction directly
   */
  private _processStateCorrection(event: StateCorrectionEvent): void {
    this._logger.warn('Processing state correction - triggering debounced resync', {
      serverUpdateVector: event.update_vector,
    });

    // Note: update_vector tracking removed with simplified autosave

    // Update sync state to indicate we're out of sync
    this._updateSyncState({
      isSynced: false,
      isResyncing: true,
    });

    // Increment conflict count to track corrections
    this._updateState({
      conflictCount: this.getCurrentState().conflictCount + 1,
    });

    // Trigger debounced resynchronization instead of applying cells directly
    this._triggerResyncEvent$.next();

    this._logger.debug('State correction processed - resync triggered');
  }

  /**
   * Process a history operation response
   */
  private _processHistoryOperation(event: HistoryOperationEvent): void {
    this._logger.debug('Processing history operation', event);

    if (event.message === 'resync_required') {
      this._updateSyncState({ isSynced: false, isResyncing: true });
      this._requestResyncEvent$.next({ method: 'rest_api' });
    }
  }

  /**
   * Process a resync request
   */
  private _processResyncRequest(event: ResyncRequestedEvent): void {
    this._logger.info('Processing resync request', { method: event.method });

    this._updateSyncState({ isResyncing: true });
    this._requestResyncEvent$.next({ method: event.method });
  }

  private _processParticipantsUpdate(event: ParticipantsUpdatedEvent): void {
    this._logger.info('Processing participants update', {
      participantCount: event.participants?.length,
      host: event.host,
      currentPresenter: event.currentPresenter,
    });

    // Delegate to the collaboration service to update participants
    try {
      this._collaborationService.updateAllParticipants(
        event.participants,
        event.host,
        event.currentPresenter,
      );
      this._logger.debug('Participants update processed successfully');
    } catch (error) {
      this._logger.error('Error processing participants update', error);
    }
  }

  /**
   * Mark resync as complete
   */
  resyncComplete(): void {
    this._logger.info('Resync complete');

    this._updateSyncState({
      isSynced: true,
      isResyncing: false,
      pendingOperations: 0,
      lastSyncTimestamp: Date.now(),
    });

    this._updateState({
      pendingRemoteOperations: [],
      conflictCount: 0,
    });
  }

  /**
   * Update sync state
   */
  private _updateSyncState(updates: Partial<SyncState>): void {
    const currentState = this._diagramState$.value;
    this._updateState({
      syncState: {
        ...currentState.syncState,
        ...updates,
      },
    });
  }

  /**
   * Clear a processed operation
   */
  clearProcessedOperation(operationId: string): void {
    const currentState = this.getCurrentState();
    this._updateState({
      pendingRemoteOperations: currentState.pendingRemoteOperations.filter(
        op => op.operationId !== operationId,
      ),
    });
  }

  /**
   * Clean up
   */
  ngOnDestroy(): void {
    this._logger.info('Destroying AppStateService');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }
}
