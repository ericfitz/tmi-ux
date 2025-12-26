/**
 * Infrastructure DFD WebSocket Adapter
 *
 * Handles all WebSocket message subscriptions for collaboration.
 * Transforms WebSocket messages into domain events and provides
 * typed observables for each message type.
 */

import { Injectable, OnDestroy, Optional, Inject } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { filter, map, takeUntil } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { WebSocketAdapter } from '../../../../core/services/websocket.adapter';
import {
  ICollaborationNotificationService,
  COLLABORATION_NOTIFICATION_SERVICE,
} from '../../../../core/interfaces/index';
import { DfdStateStore } from '../../state/dfd.state';
import {
  DiagramOperationMessage,
  DiagramOperationEventMessage,
  AuthorizationDeniedMessage,
  DiagramStateMessage,
  SyncStatusResponseMessage,
  CurrentPresenterMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  ParticipantsUpdateMessage,
  OperationRejectedMessage,
  Participant,
  Cell,
} from '../../../../core/types/websocket-message.types';

/**
 * Domain events emitted by the WebSocket service
 */
export interface DiagramOperationEvent {
  type: 'diagram-operation';
  message: DiagramOperationMessage;
}

export interface AuthorizationDeniedEvent {
  type: 'authorization-denied';
  operationId: string;
  reason: string;
}

export interface DiagramStateSyncEvent {
  type: 'diagram-state-sync';
  diagram_id: string;
  update_vector: number | null;
  cells: Cell[];
}

/**
 * Server response with current update vector (sync protocol)
 */
export interface SyncStatusResponseEvent {
  type: 'sync-status-response';
  update_vector: number;
}

export interface PresenterChangedEvent {
  type: 'presenter-changed';
  presenterEmail: string | null;
}

export interface PresenterCursorEvent {
  type: 'presenter-cursor';
  userId: string;
  position: { x: number; y: number };
}

export interface PresenterSelectionEvent {
  type: 'presenter-selection';
  userId: string;
  selectedCells: string[];
}

export interface PresenterRequestEvent {
  type: 'presenter-request';
  userId: string;
}

export interface PresenterDeniedEvent {
  type: 'presenter-denied';
  userId: string;
  targetUser: string;
}

export interface PresenterUpdateEvent {
  type: 'presenter-update';
  presenterEmail: string | null;
}

export interface ParticipantJoinedEvent {
  type: 'participant-joined';
  user: {
    user_id: string;
    email: string;
    displayName: string;
  };
  timestamp: string;
}

export interface ParticipantLeftEvent {
  type: 'participant-left';
  user: {
    user_id: string;
    email: string;
    displayName: string;
  };
  timestamp: string;
}

export interface ParticipantRemovedEvent {
  type: 'participant-removed';
  removedUser: {
    user_id: string;
    email: string;
    displayName: string;
  };
  removingUser: {
    user_id: string;
    email: string;
    displayName: string;
  };
}

export interface ParticipantsUpdatedEvent {
  type: 'participants-updated';
  participants: Participant[];
  host?: string;
  currentPresenter?: string | null;
}

export interface OperationRejectedEvent {
  type: 'operation-rejected';
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

export type WebSocketDomainEvent =
  | DiagramOperationEvent
  | AuthorizationDeniedEvent
  | DiagramStateSyncEvent
  | SyncStatusResponseEvent
  | PresenterChangedEvent
  | PresenterCursorEvent
  | PresenterSelectionEvent
  | PresenterUpdateEvent
  | ParticipantJoinedEvent
  | ParticipantLeftEvent
  | ParticipantRemovedEvent
  | ParticipantsUpdatedEvent
  | OperationRejectedEvent;

@Injectable({
  providedIn: 'root',
})
export class InfraDfdWebsocketAdapter implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _subscriptions = new Subscription();

  // Participant list tracking for join/leave detection
  private _previousParticipants: Participant[] = [];

  // Domain event streams
  private readonly _domainEvents$ = new Subject<WebSocketDomainEvent>();

  // Typed observables for specific events
  public readonly diagramOperations$ = this._domainEvents$.pipe(
    filter((event): event is DiagramOperationEvent => event.type === 'diagram-operation'),
    map(event => event.message),
  );

  public readonly authorizationDenied$ = this._domainEvents$.pipe(
    filter((event): event is AuthorizationDeniedEvent => event.type === 'authorization-denied'),
  );

  public readonly diagramStateSyncs$ = this._domainEvents$.pipe(
    filter((event): event is DiagramStateSyncEvent => event.type === 'diagram-state-sync'),
  );

  /** Server responds with current update_vector (sync protocol) */
  public readonly syncStatusResponses$ = this._domainEvents$.pipe(
    filter((event): event is SyncStatusResponseEvent => event.type === 'sync-status-response'),
  );

  public readonly presenterChanges$ = this._domainEvents$.pipe(
    filter((event): event is PresenterChangedEvent => event.type === 'presenter-changed'),
  );

  public readonly presenterCursors$ = this._domainEvents$.pipe(
    filter((event): event is PresenterCursorEvent => event.type === 'presenter-cursor'),
  );

  public readonly presenterSelections$ = this._domainEvents$.pipe(
    filter((event): event is PresenterSelectionEvent => event.type === 'presenter-selection'),
  );

  public readonly presenterUpdates$ = this._domainEvents$.pipe(
    filter((event): event is PresenterUpdateEvent => event.type === 'presenter-update'),
  );

  public readonly participantJoined$ = this._domainEvents$.pipe(
    filter((event): event is ParticipantJoinedEvent => event.type === 'participant-joined'),
  );

  public readonly participantLeft$ = this._domainEvents$.pipe(
    filter((event): event is ParticipantLeftEvent => event.type === 'participant-left'),
  );

  public readonly participantRemoved$ = this._domainEvents$.pipe(
    filter((event): event is ParticipantRemovedEvent => event.type === 'participant-removed'),
  );

  public readonly participantsUpdated$ = this._domainEvents$.pipe(
    filter((event): event is ParticipantsUpdatedEvent => event.type === 'participants-updated'),
  );

  public readonly operationRejected$ = this._domainEvents$.pipe(
    filter((event): event is OperationRejectedEvent => event.type === 'operation-rejected'),
  );

  // General event stream for components that want all events
  public readonly domainEvents$ = this._domainEvents$.asObservable();

  constructor(
    private _logger: LoggerService,
    private _webSocketAdapter: WebSocketAdapter,
    private _dfdStateStore: DfdStateStore,
    @Optional()
    @Inject(COLLABORATION_NOTIFICATION_SERVICE)
    private _notificationService: ICollaborationNotificationService | null,
  ) {
    this._logger.info('WebSocketService initialized');
  }

  /**
   * Initialize WebSocket subscriptions for DFD-related messages
   */
  initialize(): void {
    // this._logger.info('Initializing DFD WebSocket subscriptions');

    // Subscribe to diagram operation events (server broadcasts)
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramOperationEventMessage>('diagram_operation_event')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleDiagramOperation(message),
          error: error => this._logger.error('Error in diagram operation subscription', error),
        }),
    );

    // Subscribe to authorization denied messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<AuthorizationDeniedMessage>('authorization_denied')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleAuthorizationDenied(message),
          error: error => this._logger.error('Error in authorization denied subscription', error),
        }),
    );

    // Subscribe to diagram_state messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramStateMessage>('diagram_state')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleDiagramState(message),
          error: error => this._logger.error('Error in diagram state subscription', error),
        }),
    );

    // Subscribe to sync_status_response messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<SyncStatusResponseMessage>('sync_status_response')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleSyncStatusResponse(message),
          error: error => this._logger.error('Error in sync status response subscription', error),
        }),
    );

    // Subscribe to presenter messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<CurrentPresenterMessage>('current_presenter')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleCurrentPresenter(message),
          error: error => this._logger.error('Error in current presenter subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterCursorMessage>('presenter_cursor')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterCursor(message),
          error: error => this._logger.error('Error in presenter cursor subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterSelectionMessage>('presenter_selection')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handlePresenterSelection(message),
          error: error => this._logger.error('Error in presenter selection subscription', error),
        }),
    );

    // Note: presenter_request and presenter_denied messages are handled by DfdCollaborationService
    // to avoid duplication and maintain proper separation of concerns

    // Note: participant_joined and participant_left messages are deprecated
    // Joins and leaves are now detected by comparing participant lists in participants_update

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ParticipantsUpdateMessage>('participants_update')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleParticipantsUpdate(message),
          error: error => this._logger.error('Error in participants update subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<OperationRejectedMessage>('operation_rejected')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleOperationRejected(message),
          error: error => this._logger.error('Error in operation rejected subscription', error),
        }),
    );

    // this._logger.info('DFD WebSocket subscriptions initialized successfully');
  }

  /**
   * Clean up subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('Destroying WebSocketService');
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
  }

  // Message handlers that transform WebSocket messages to domain events

  private _handleDiagramOperation(message: DiagramOperationEventMessage): void {
    // Extract user identifier with fallback (user_id primary, email fallback)
    const userId = message.initiating_user.user_id || message.initiating_user.email || 'unknown';

    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Received diagram operation', {
      userId: userId,
      userEmail: message.initiating_user.email,
      displayName: message.initiating_user.displayName,
      operationId: message.operation_id,
      operationType: message.operation?.type,
    });

    this._domainEvents$.next({
      type: 'diagram-operation',
      message,
    });
  }

  private _handleAuthorizationDenied(message: AuthorizationDeniedMessage): void {
    this._logger.warn('Authorization denied', {
      operationId: message.original_operation_id,
      reason: message.reason,
    });

    this._domainEvents$.next({
      type: 'authorization-denied',
      operationId: message.original_operation_id,
      reason: message.reason,
    });
  }

  /**
   * Handle diagram_state message - full diagram state from server
   */
  private _handleDiagramState(message: DiagramStateMessage): void {
    const currentUpdateVector = this._dfdStateStore.updateVector;

    this._logger.info('Diagram state received', {
      diagramId: message.diagram_id,
      serverUpdateVector: message.update_vector,
      currentUpdateVector,
      cellCount: message.cells.length,
    });

    this._domainEvents$.next({
      type: 'diagram-state-sync',
      diagram_id: message.diagram_id,
      update_vector: message.update_vector,
      cells: message.cells,
    });
  }

  /**
   * Handle sync_status_response message - server's current update vector
   */
  private _handleSyncStatusResponse(message: SyncStatusResponseMessage): void {
    this._logger.info('Sync status response received', {
      serverUpdateVector: message.update_vector,
    });

    this._domainEvents$.next({
      type: 'sync-status-response',
      update_vector: message.update_vector,
    });
  }

  private _handleCurrentPresenter(message: CurrentPresenterMessage): void {
    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Current presenter update', {
      presenter: message.current_presenter,
      initiatingUser: message.initiating_user,
    });

    // Extract user_id from User object (with email fallback)
    const presenterUserId =
      message.current_presenter?.user_id || message.current_presenter?.email || null;

    this._domainEvents$.next({
      type: 'presenter-changed',
      presenterEmail: presenterUserId,
    });
  }

  private _handlePresenterCursor(message: PresenterCursorMessage): void {
    // Per AsyncAPI spec, presenter_cursor does not include user field
    // The presenter is tracked separately via current_presenter message
    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Presenter cursor update', {
      position: message.cursor_position,
    });

    // Use empty string for userId since spec doesn't include it
    // The presenter tracking is handled by current_presenter message
    this._domainEvents$.next({
      type: 'presenter-cursor',
      userId: '', // Schema doesn't include user field
      position: message.cursor_position,
    });
  }

  private _handlePresenterSelection(message: PresenterSelectionMessage): void {
    // Per AsyncAPI spec, presenter_selection does not include user field
    // The presenter is tracked separately via current_presenter message
    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Presenter selection update', {
      cellCount: message.selected_cells.length,
    });

    // Use empty string for userId since spec doesn't include it
    // The presenter tracking is handled by current_presenter message
    this._domainEvents$.next({
      type: 'presenter-selection',
      userId: '', // Schema doesn't include user field
      selectedCells: message.selected_cells,
    });
  }

  private _handleParticipantsUpdate(message: ParticipantsUpdateMessage): void {
    this._logger.info('Participants update received', {
      participantCount: message?.participants?.length,
      host: message?.host,
      currentPresenter: message?.current_presenter,
      initiatingUser: message?.initiating_user,
    });

    // Validate message format
    if (!message || !message.participants || !Array.isArray(message.participants)) {
      this._logger.warn('Invalid participants update message received', message);
      return;
    }

    // Compare with previous participant list to detect changes
    const currentUserIds = new Set(message.participants.map(p => p.user.user_id));
    const previousUserIds = new Set(this._previousParticipants.map(p => p.user.user_id));

    // Detect newly joined users
    const joinedUsers = message.participants.filter(p => !previousUserIds.has(p.user.user_id));

    // Detect users who left
    const leftUsers = this._previousParticipants.filter(p => !currentUserIds.has(p.user.user_id));

    // Handle based on initiating_user field
    if (message.initiating_user === null) {
      // System event (join/leave) - show notifications and emit synthetic events
      joinedUsers.forEach(participant => {
        // Handle both 'name' (AsyncAPI) and 'display_name' (OpenAPI) field names
        const displayName =
          participant.user.name || participant.user.display_name || participant.user.email;

        if (this._notificationService) {
          this._logger.debugComponent(
            'InfraDfdWebsocketAdapter',
            'Showing participant joined notification',
            { displayName },
          );
          this._notificationService.showSessionEvent('userJoined', displayName).subscribe({
            error: err => this._logger.error('Failed to show participant joined notification', err),
          });
        }

        // Emit synthetic domain event for backward compatibility
        this._domainEvents$.next({
          type: 'participant-joined',
          user: {
            user_id: participant.user.user_id,
            email: participant.user.email,
            displayName: displayName,
          },
          timestamp: new Date().toISOString(),
        });
      });

      leftUsers.forEach(participant => {
        // Handle both 'name' (AsyncAPI) and 'display_name' (OpenAPI) field names
        const displayName =
          participant.user.name || participant.user.display_name || participant.user.email;

        if (this._notificationService) {
          this._logger.debugComponent(
            'InfraDfdWebsocketAdapter',
            'Showing participant left notification',
            { displayName },
          );
          this._notificationService.showSessionEvent('userLeft', displayName).subscribe({
            error: err => this._logger.error('Failed to show participant left notification', err),
          });
        }

        // Emit synthetic domain event
        this._domainEvents$.next({
          type: 'participant-left',
          user: {
            user_id: participant.user.user_id,
            email: participant.user.email,
            displayName: displayName,
          },
          timestamp: new Date().toISOString(),
        });
      });
    } else {
      // User-initiated event (kick) - emit participant-removed event and show notification
      if (leftUsers.length > 0) {
        const kickedUser = leftUsers[0];
        // Handle both 'name' (AsyncAPI) and 'display_name' (OpenAPI) field names
        const displayName =
          kickedUser.user.name || kickedUser.user.display_name || kickedUser.user.email;

        this._logger.info('Participant removed by host', {
          removedUser: kickedUser.user.user_id,
          initiatingUser: message.initiating_user.user_id,
        });

        // Show notification for removed user
        if (this._notificationService) {
          this._logger.debugComponent(
            'InfraDfdWebsocketAdapter',
            'Showing participant removed notification',
            { displayName },
          );
          this._notificationService.showSessionEvent('userRemoved', displayName).subscribe({
            error: err =>
              this._logger.error('Failed to show participant removed notification', err),
          });
        }

        this._domainEvents$.next({
          type: 'participant-removed',
          removedUser: {
            user_id: kickedUser.user.user_id,
            email: kickedUser.user.email,
            displayName: displayName,
          },
          removingUser: {
            user_id: message.initiating_user.user_id,
            email: message.initiating_user.email || '',
            displayName: message.initiating_user.displayName || 'Host',
          },
        });
      }
    }

    // Store current participants for next comparison
    this._previousParticipants = [...message.participants];

    // Emit participants updated event
    this._domainEvents$.next({
      type: 'participants-updated',
      participants: message.participants,
      host: message.host,
      currentPresenter: message.current_presenter,
    });
  }

  private _handleOperationRejected(message: OperationRejectedMessage): void {
    this._logger.warn('Operation rejected', {
      operation_id: message.operation_id,
      update_vector: message.update_vector,
      reason: message.reason,
      message: message.message,
      requires_resync: message.requires_resync,
    });

    this._domainEvents$.next({
      type: 'operation-rejected',
      operation_id: message.operation_id,
      sequence_number: message.sequence_number,
      update_vector: message.update_vector,
      reason: message.reason,
      message: message.message,
      details: message.details,
      affected_cells: message.affected_cells,
      requires_resync: message.requires_resync,
      timestamp: message.timestamp,
    });
  }
}
