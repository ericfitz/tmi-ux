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
} from '../../../../core/types/websocket-message.types';
import {
  InfraDfdWebsocketAdapter,
  WebSocketDomainEvent,
} from '../../infrastructure/adapters/infra-dfd-websocket.adapter';
import { DfdStateStore } from '../../state/dfd.state';
import {
  AppOperationStateManager,
  OperationStateEvent,
} from './app-operation-state-manager.service';
import {
  AppWebSocketEventProcessor,
  ProcessedDiagramOperation,
  ProcessedSyncStatusResponse,
  ProcessedDiagramSync,
  ProcessedParticipantsUpdate,
} from './app-websocket-event-processor.service';

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
  email: string;
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
  isApplyingUndoRedo: boolean;
  lastOperationId: string | null;
  conflictCount: number;
  readOnly: boolean;
}

@Injectable()
// SEM@e7dd6955882ba4be469447e879cf0576655cd710: manage diagram sync state and dispatch WebSocket-driven operation events (mutates shared state)
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
    isApplyingUndoRedo: false,
    lastOperationId: null,
    conflictCount: 0,
    readOnly: false,
  });

  // Operation blocking flag
  private _operationsBlocked = false;

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
    email: string;
    operationId: string;
  }>();
  private readonly _applyBatchedOperationsEvent$ = new Subject<{
    operations: CellOperation[];
    email: string;
    displayName: string;
    operationId: string;
  }>();
  private readonly _applyCorrectionEvent$ = new Subject<WSCell[]>();
  private readonly _triggerResyncEvent$ = new Subject<void>();
  private readonly _diagramStateSyncEvent$ = new Subject<{
    diagram_id: string;
    update_vector: number | null;
    cells: WSCell[];
  }>();

  public readonly applyOperationEvents$ = this._applyOperationEvent$.asObservable();
  public readonly applyBatchedOperationsEvents$ = this._applyBatchedOperationsEvent$.asObservable();
  public readonly applyCorrectionEvents$ = this._applyCorrectionEvent$.asObservable();
  public readonly triggerResyncEvents$ = this._triggerResyncEvent$.asObservable();
  public readonly diagramStateSyncEvents$ = this._diagramStateSyncEvent$.asObservable();

  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: inject dependencies for diagram state and WebSocket event coordination (pure)
  constructor(
    private _logger: LoggerService,
    private _webSocketService: InfraDfdWebsocketAdapter,
    private _collaborationService: DfdCollaborationService,
    private _threatModelService: ThreatModelService,
    private _dfdStateStore: DfdStateStore,
    private _historyCoordinator: AppOperationStateManager,
    private _eventProcessor: AppWebSocketEventProcessor,
  ) {
    // this._logger.info('AppStateService initialized');
  }

  /**
   * Initialize the state service and subscribe to WebSocket events
   */
  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: subscribe to WebSocket and operation-state streams to drive diagram state (mutates shared state)
  initialize(): void {
    // this._logger.info('Initializing DFD state management');

    // Subscribe to operation state events from AppOperationStateManager
    this._subscriptions.add(
      this._historyCoordinator.stateEvents$
        .pipe(takeUntil(this._destroy$))
        .subscribe(event => this._handleOperationStateEvent(event)),
    );

    // Subscribe to domain events from WebSocket service
    this._subscriptions.add(
      this._webSocketService.domainEvents$
        .pipe(takeUntil(this._destroy$))
        .subscribe((event: any) => this._processDomainEvent(event)),
    );

    // Initialize event processor
    this._eventProcessor.initialize();

    // Subscribe to processed events from event processor
    this._subscriptions.add(
      this._eventProcessor.diagramOperations$
        .pipe(takeUntil(this._destroy$))
        .subscribe(operation => this._handleProcessedDiagramOperation(operation)),
    );

    this._subscriptions.add(
      this._eventProcessor.diagramSyncs$
        .pipe(takeUntil(this._destroy$))
        .subscribe(sync => this._handleProcessedDiagramSync(sync)),
    );

    this._subscriptions.add(
      this._eventProcessor.syncStatusResponses$
        .pipe(takeUntil(this._destroy$))
        .subscribe(response => this._handleProcessedSyncStatusResponse(response)),
    );

    this._subscriptions.add(
      this._eventProcessor.participantsUpdates$
        .pipe(takeUntil(this._destroy$))
        .subscribe(update => this._handleProcessedParticipantsUpdate(update)),
    );

    // this._logger.info('DFD state management initialized successfully');
  }

  /**
   * Get the current state synchronously
   */
  // SEM@a9340b4ff80dfccfb6d08dd681f0b0becbdc0dba: return the current diagram state snapshot synchronously (pure)
  getCurrentState(): DfdDiagramState {
    return this._diagramState$.value;
  }

  /**
   * Block or unblock user operations (used during rollback/resync)
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: block or unblock user operations during rollback or resync (mutates shared state)
  setBlockOperations(blocked: boolean): void {
    this._operationsBlocked = blocked;
    this._logger.debugComponent(
      'AppStateService',
      `Operations ${blocked ? 'blocked' : 'unblocked'}`,
    );
  }

  /**
   * Check if operations are currently blocked
   */
  // SEM@0016eca28248334bbfa1ef6a9471800cd54d3122: return whether user operations are currently blocked (pure)
  areOperationsBlocked(): boolean {
    return this._operationsBlocked;
  }

  /**
   * Update the state
   */
  // SEM@f2bb57ba89c5cc48041879bbe8d95d96f6f7ac5d: merge partial updates into the diagram state and emit the new value (mutates shared state)
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
  // SEM@a9340b4ff80dfccfb6d08dd681f0b0becbdc0dba: flag the diagram state as currently applying a remote change (mutates shared state)
  setApplyingRemoteChange(isApplying: boolean): void {
    this._updateState({ isApplyingRemoteChange: isApplying });
  }

  /**
   * Set whether we're applying an undo/redo operation
   */
  // SEM@a097ef91b09029135bba8168c0735f2e996f28f1: flag the diagram state as currently applying an undo or redo operation (mutates shared state)
  setApplyingUndoRedo(isApplying: boolean): void {
    this._updateState({ isApplyingUndoRedo: isApplying });
  }

  /**
   * Set whether the diagram is in read-only mode
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: set the diagram's read-only mode flag (mutates shared state)
  setReadOnly(readOnly: boolean): void {
    this._updateState({ readOnly });
    this._logger.debugComponent('AppStateService', 'Read-only mode state updated', { readOnly });
  }

  /**
   * Handle operation state events from AppOperationStateManager
   */
  // SEM@254cd80b3579505276e9bbec070cbfc56fb169e6: toggle the remote-change flag in response to operation-state lifecycle events (mutates shared state)
  private _handleOperationStateEvent(event: OperationStateEvent): void {
    switch (event.type) {
      case 'remote-operation-start':
        // Only set flag if it's not already set
        if (!this.getCurrentState().isApplyingRemoteChange) {
          this.setApplyingRemoteChange(true);
        }
        break;

      case 'remote-operation-end':
        // Only clear flag if it was set by remote operation
        if (this.getCurrentState().isApplyingRemoteChange) {
          this.setApplyingRemoteChange(false);
        }
        break;
    }
  }

  /**
   * Process a domain event from the WebSocket service
   */
  // SEM@5363e7c4d0b545fa288ba6d19aab2853773b39dc: update sync counters and conflict count from an incoming WebSocket domain event (mutates shared state)
  private _processDomainEvent(event: WebSocketDomainEvent): void {
    this._logger.debugComponent('AppStateService', 'Processing domain event', { type: event.type });

    // Update sync state based on event type
    switch (event.type) {
      case 'diagram-operation':
        this._updateSyncState({
          pendingOperations: this.getCurrentState().syncState.pendingOperations + 1,
        });
        break;

      case 'authorization-denied':
        this._updateState({ conflictCount: this.getCurrentState().conflictCount + 1 });
        break;
    }
  }

  /**
   * Handle processed diagram operation from event processor
   */
  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: apply a processed remote diagram operation, update vector and pending-ops queue (mutates shared state)
  private _handleProcessedDiagramOperation(operation: ProcessedDiagramOperation): void {
    // Check if we've already processed this operation
    if (this.getCurrentState().lastOperationId === operation.operationId) {
      this._logger.debugComponent('AppStateService', 'Operation already processed', {
        operationId: operation.operationId,
      });
      return;
    }

    // Update local updateVector from the operation event
    const currentVector = this._dfdStateStore.updateVector;
    if (operation.updateVector > currentVector) {
      this._logger.debugComponent('AppStateService', 'Updating local updateVector from operation', {
        previousVector: currentVector,
        newVector: operation.updateVector,
        operationId: operation.operationId,
      });
      this._dfdStateStore.updateState({ updateVector: operation.updateVector }, 'remote-operation');
    }

    // Update state
    this._updateState({
      lastOperationId: operation.operationId,
      pendingRemoteOperations: [
        ...this.getCurrentState().pendingRemoteOperations,
        {
          operationId: operation.operationId,
          email: operation.email,
          operation: {
            type: 'patch',
            cells: operation.operations,
          },
          timestamp: Date.now(),
        },
      ],
    });

    // Emit batched operation event to preserve semantic grouping
    this._applyBatchedOperationsEvent$.next({
      operations: operation.operations,
      email: operation.email,
      displayName: operation.displayName,
      operationId: operation.operationId,
    });

    // Update sync state
    this._updateSyncState({
      pendingOperations: Math.max(0, this.getCurrentState().syncState.pendingOperations - 1),
      lastSyncTimestamp: Date.now(),
    });
  }

  /**
   * Handle processed diagram state sync from event processor
   * This message is sent immediately upon WebSocket connection
   */
  // SEM@254cd80b3579505276e9bbec070cbfc56fb169e6: emit a diagram state sync event for the persistence layer to reconcile (mutates shared state)
  private _handleProcessedDiagramSync(sync: ProcessedDiagramSync): void {
    this._logger.info('Processing diagram state sync', {
      diagramId: sync.diagramId,
      serverUpdateVector: sync.updateVector,
      cellCount: sync.cells.length,
    });

    // Emit the state sync event for the persistence layer to handle
    this._diagramStateSyncEvent$.next({
      diagram_id: sync.diagramId,
      update_vector: sync.updateVector,
      cells: sync.cells,
    });

    this._logger.debugComponent(
      'AppStateService',
      'Diagram state sync event emitted for persistence layer',
    );
  }

  /**
   * Handle processed sync status response from event processor
   * Compare server's update_vector with local state to determine if resync is needed
   */
  // SEM@b929c01a4e6fe149a79e0d6a37b9398c67fb1d0e: compare server update vector to local and trigger resync if out of sync (mutates shared state)
  private _handleProcessedSyncStatusResponse(response: ProcessedSyncStatusResponse): void {
    const localVector = this._dfdStateStore.updateVector;

    this._logger.info('Processing sync status response', {
      serverUpdateVector: response.updateVector,
      localUpdateVector: localVector,
    });

    if (response.updateVector === localVector) {
      // Client is synchronized
      this._logger.debugComponent('AppStateService', 'Client is synchronized with server');
      this._updateSyncState({
        isSynced: true,
        isResyncing: false,
        lastSyncTimestamp: Date.now(),
      });
    } else {
      // Client is out of sync - trigger resync
      this._logger.warn('Client out of sync - triggering resync', {
        serverUpdateVector: response.updateVector,
        localUpdateVector: localVector,
      });
      this._updateSyncState({
        isSynced: false,
        isResyncing: true,
      });
      this._triggerResyncEvent$.next();
    }
  }

  /**
   * Handle processed participants update from event processor
   */
  // SEM@254cd80b3579505276e9bbec070cbfc56fb169e6: delegate a participants update to the collaboration service (mutates shared state)
  private _handleProcessedParticipantsUpdate(update: ProcessedParticipantsUpdate): void {
    this._logger.debugComponent('AppStateService', 'Processing participants update', {
      participantCount: update.participants?.length,
      host: update.host,
      currentPresenter: update.currentPresenter,
    });

    // Delegate to the collaboration service to update participants
    try {
      this._collaborationService.updateAllParticipants(
        update.participants,
        update.host,
        update.currentPresenter,
      );
      this._logger.debugComponent('AppStateService', 'Participants update processed successfully');
    } catch (error) {
      this._logger.error('Error processing participants update', error);
    }
  }

  /**
   * Mark resync as complete
   */
  // SEM@f2bb57ba89c5cc48041879bbe8d95d96f6f7ac5d: mark resync as finished and reset sync state and pending operations queue (mutates shared state)
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
  // SEM@a9340b4ff80dfccfb6d08dd681f0b0becbdc0dba: merge partial updates into the sync sub-state of diagram state (mutates shared state)
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
  // SEM@f2bb57ba89c5cc48041879bbe8d95d96f6f7ac5d: remove a completed operation from the pending remote operations queue (mutates shared state)
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
  // SEM@4bb91c7e90f5fe785639bc0673bd800dcfb4628b: complete the destroy subject and unsubscribe all subscriptions on teardown (mutates shared state)
  ngOnDestroy(): void {
    this._logger.info('Destroying AppStateService');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }
}
