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
import {
  AppOperationStateManager,
  OperationStateEvent,
} from './app-operation-state-manager.service';
import {
  AppWebSocketEventProcessor,
  ProcessedDiagramOperation,
  ProcessedStateCorrection,
  ProcessedDiagramSync,
  ProcessedResyncRequest,
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
  isApplyingUndoRedo: boolean;
  lastOperationId: string | null;
  conflictCount: number;
  readOnly: boolean;
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
    userId: string;
    operationId: string;
  }>();
  private readonly _applyBatchedOperationsEvent$ = new Subject<{
    operations: CellOperation[];
    userId: string;
    operationId: string;
  }>();
  private readonly _applyCorrectionEvent$ = new Subject<WSCell[]>();
  private readonly _requestResyncEvent$ = new Subject<{ method: string }>();
  private readonly _triggerResyncEvent$ = new Subject<void>();
  private readonly _diagramStateSyncEvent$ = new Subject<{
    diagram_id: string;
    update_vector: number | null;
    cells: WSCell[];
  }>();

  public readonly applyOperationEvents$ = this._applyOperationEvent$.asObservable();
  public readonly applyBatchedOperationsEvents$ = this._applyBatchedOperationsEvent$.asObservable();
  public readonly applyCorrectionEvents$ = this._applyCorrectionEvent$.asObservable();
  public readonly requestResyncEvents$ = this._requestResyncEvent$.asObservable();
  public readonly triggerResyncEvents$ = this._triggerResyncEvent$.asObservable();
  public readonly diagramStateSyncEvents$ = this._diagramStateSyncEvent$.asObservable();

  constructor(
    private _logger: LoggerService,
    private _webSocketService: InfraDfdWebsocketAdapter,
    private _collaborationService: DfdCollaborationService,
    private _threatModelService: ThreatModelService,
    private _historyCoordinator: AppOperationStateManager,
    private _eventProcessor: AppWebSocketEventProcessor,
  ) {
    // this._logger.info('AppStateService initialized');
  }

  /**
   * Initialize the state service and subscribe to WebSocket events
   */
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
      this._eventProcessor.stateCorrections$
        .pipe(takeUntil(this._destroy$))
        .subscribe(correction => this._handleProcessedStateCorrection(correction)),
    );

    this._subscriptions.add(
      this._eventProcessor.diagramSyncs$
        .pipe(takeUntil(this._destroy$))
        .subscribe(sync => this._handleProcessedDiagramSync(sync)),
    );

    this._subscriptions.add(
      this._eventProcessor.resyncRequests$
        .pipe(takeUntil(this._destroy$))
        .subscribe(request => this._handleProcessedResyncRequest(request)),
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
  getCurrentState(): DfdDiagramState {
    return this._diagramState$.value;
  }

  /**
   * Block or unblock user operations (used during rollback/resync)
   */
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
  areOperationsBlocked(): boolean {
    return this._operationsBlocked;
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
   * Set whether we're applying an undo/redo operation
   */
  setApplyingUndoRedo(isApplying: boolean): void {
    this._updateState({ isApplyingUndoRedo: isApplying });
  }

  /**
   * Set whether the diagram is in read-only mode
   */
  setReadOnly(readOnly: boolean): void {
    this._updateState({ readOnly });
    this._logger.debugComponent('AppStateService', 'Read-only mode state updated', { readOnly });
  }

  /**
   * Handle operation state events from AppOperationStateManager
   */
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
  private _processDomainEvent(event: WebSocketDomainEvent): void {
    this._logger.debugComponent('AppStateService', 'Processing domain event', { type: event.type });

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
   * Handle processed diagram operation from event processor
   */
  private _handleProcessedDiagramOperation(operation: ProcessedDiagramOperation): void {
    // Check if we've already processed this operation
    if (this.getCurrentState().lastOperationId === operation.operationId) {
      this._logger.debugComponent('AppStateService', 'Operation already processed', {
        operationId: operation.operationId,
      });
      return;
    }

    // Update state
    this._updateState({
      lastOperationId: operation.operationId,
      pendingRemoteOperations: [
        ...this.getCurrentState().pendingRemoteOperations,
        {
          operationId: operation.operationId,
          userId: operation.userId,
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
      userId: operation.userId,
      operationId: operation.operationId,
    });

    // Update sync state
    this._updateSyncState({
      pendingOperations: Math.max(0, this.getCurrentState().syncState.pendingOperations - 1),
      lastSyncTimestamp: Date.now(),
    });
  }

  /**
   * Handle processed state correction from event processor
   * Uses debounced resynchronization instead of applying the correction directly
   */
  private _handleProcessedStateCorrection(correction: ProcessedStateCorrection): void {
    this._logger.warn('Processing state correction - triggering debounced resync', {
      serverUpdateVector: correction.updateVector,
    });

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

    this._logger.debugComponent('AppStateService', 'State correction processed - resync triggered');
  }

  /**
   * Handle processed diagram state sync from event processor
   * This message is sent immediately upon WebSocket connection
   */
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
   * Handle processed resync request from event processor
   */
  private _handleProcessedResyncRequest(request: ProcessedResyncRequest): void {
    this._logger.info('Processing resync request', { method: request.method });

    this._updateSyncState({ isResyncing: true });
    this._requestResyncEvent$.next({ method: request.method });
  }

  /**
   * Handle processed participants update from event processor
   */
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
