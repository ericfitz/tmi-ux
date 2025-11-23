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
  AuthorizationDeniedMessage,
  StateCorrectionMessage,
  DiagramStateSyncMessage,
  HistoryOperationMessage,
  ResyncResponseMessage,
  CurrentPresenterMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  ParticipantJoinedMessage,
  ParticipantLeftMessage,
  RemoveParticipantMessage,
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

export interface StateCorrectionEvent {
  type: 'state-correction';
  update_vector: number;
}

export interface DiagramStateSyncEvent {
  type: 'diagram-state-sync';
  diagram_id: string;
  update_vector: number | null;
  cells: Cell[];
}

export interface HistoryOperationEvent {
  type: 'history-operation';
  operationType: string;
  message: string;
}

export interface ResyncRequestedEvent {
  type: 'resync-requested';
  method: string;
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
  | StateCorrectionEvent
  | DiagramStateSyncEvent
  | HistoryOperationEvent
  | ResyncRequestedEvent
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

  public readonly stateCorrections$ = this._domainEvents$.pipe(
    filter((event): event is StateCorrectionEvent => event.type === 'state-correction'),
  );

  public readonly diagramStateSyncs$ = this._domainEvents$.pipe(
    filter((event): event is DiagramStateSyncEvent => event.type === 'diagram-state-sync'),
  );

  public readonly historyOperations$ = this._domainEvents$.pipe(
    filter((event): event is HistoryOperationEvent => event.type === 'history-operation'),
  );

  public readonly resyncRequests$ = this._domainEvents$.pipe(
    filter((event): event is ResyncRequestedEvent => event.type === 'resync-requested'),
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

    // Subscribe to diagram operations
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramOperationMessage>('diagram_operation')
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

    // Subscribe to state correction messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<StateCorrectionMessage>('state_correction')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleStateCorrection(message),
          error: error => this._logger.error('Error in state correction subscription', error),
        }),
    );

    // Subscribe to diagram state sync messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramStateSyncMessage>('diagram_state_sync')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleDiagramStateSync(message),
          error: error => this._logger.error('Error in diagram state sync subscription', error),
        }),
    );

    // Subscribe to history operation messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<HistoryOperationMessage>('history_operation')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleHistoryOperation(message),
          error: error => this._logger.error('Error in history operation subscription', error),
        }),
    );

    // Subscribe to resync response messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ResyncResponseMessage>('resync_response')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleResyncResponse(message),
          error: error => this._logger.error('Error in resync response subscription', error),
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

    // Subscribe to participant management messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ParticipantJoinedMessage>('participant_joined')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleParticipantJoined(message),
          error: error => this._logger.error('Error in participant joined subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ParticipantLeftMessage>('participant_left')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleParticipantLeft(message),
          error: error => this._logger.error('Error in participant left subscription', error),
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<RemoveParticipantMessage>('remove_participant')
        .pipe(takeUntil(this._destroy$))
        .subscribe({
          next: message => this._handleRemoveParticipant(message),
          error: error => this._logger.error('Error in remove participant subscription', error),
        }),
    );

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

  private _handleDiagramOperation(message: DiagramOperationMessage): void {
    // Extract user identifier with fallback (User fields are optional per schema)
    const userId = message.initiating_user.email || 'unknown';

    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Received diagram operation', {
      userId: userId,
      userEmail: message.initiating_user.email,
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

  private _handleStateCorrection(message: StateCorrectionMessage): void {
    const currentUpdateVector = this._dfdStateStore.updateVector;

    this._logger.info('State correction received', {
      serverUpdateVector: message.update_vector,
      currentUpdateVector,
    });

    // If our local copy has the same update vector as the server, we don't need to update
    if (currentUpdateVector === message.update_vector) {
      this._logger.debugComponent(
        'InfraDfdWebsocketAdapter',
        'Local diagram is already up to date, ignoring state correction',
        {
          updateVector: message.update_vector,
        },
      );
      return;
    }

    // If the server's update vector is higher, we need to resync
    if (message.update_vector > currentUpdateVector) {
      this._logger.info('Server has newer version, triggering resync', {
        serverUpdateVector: message.update_vector,
        currentUpdateVector,
      });

      this._domainEvents$.next({
        type: 'state-correction',
        update_vector: message.update_vector,
      });
    } else {
      // Server's update vector is lower than ours - this shouldn't normally happen
      this._logger.warn('Received state correction with older update vector', {
        serverUpdateVector: message.update_vector,
        currentUpdateVector,
      });
    }
  }

  private _handleDiagramStateSync(message: DiagramStateSyncMessage): void {
    const currentUpdateVector = this._dfdStateStore.updateVector;

    this._logger.info('Diagram state sync received', {
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

  private _handleHistoryOperation(message: HistoryOperationMessage): void {
    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'History operation', {
      operationType: message.operation_type,
      message: message.message,
    });

    this._domainEvents$.next({
      type: 'history-operation',
      operationType: message.operation_type,
      message: message.message,
    });
  }

  private _handleResyncResponse(message: ResyncResponseMessage): void {
    this._logger.info('Resync response received', {
      method: message.method,
    });

    this._domainEvents$.next({
      type: 'resync-requested',
      method: message.method,
    });
  }

  private _handleCurrentPresenter(message: CurrentPresenterMessage): void {
    this._logger.debugComponent('InfraDfdWebsocketAdapter', 'Current presenter update', {
      presenter: message.current_presenter,
    });

    // Extract email from User object (schema returns User, not string)
    const presenterUserId = message.current_presenter?.email || null;

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

  private _handleParticipantJoined(message: ParticipantJoinedMessage): void {
    this._logger.info('Participant joined event received', {
      user: message.joined_user,
      timestamp: message.timestamp,
    });

    // Validate message format
    if (!message || !message.joined_user) {
      this._logger.warn('Invalid participant joined message received', message);
      return;
    }

    // Show notification with both display name and email
    const userIdentifier = message.joined_user.display_name
      ? `${message.joined_user.display_name} (${message.joined_user.email})`
      : message.joined_user.email || 'Unknown user';

    if (this._notificationService) {
      this._logger.debugComponent(
        'InfraDfdWebsocketAdapter',
        'Showing participant joined notification',
        { userIdentifier },
      );
      this._notificationService.showSessionEvent('userJoined', userIdentifier).subscribe({
        error: err => this._logger.error('Failed to show participant joined notification', err),
      });
    } else {
      this._logger.warn(
        'Cannot show participant joined notification - notification service not available',
      );
    }

    // Create domain event with required fields (User fields are optional per schema)
    this._domainEvents$.next({
      type: 'participant-joined',
      user: {
        user_id: message.joined_user.email || 'unknown',
        email: message.joined_user.email || 'unknown',
        displayName: message.joined_user.display_name || 'Unknown User',
      },
      timestamp: message.timestamp,
    });
  }

  private _handleParticipantLeft(message: ParticipantLeftMessage): void {
    this._logger.info('Participant left event received', {
      user: message.departed_user,
      timestamp: message.timestamp,
    });

    // Validate message format
    if (!message || !message.departed_user) {
      this._logger.warn('Invalid participant left message received', message);
      return;
    }

    // Show notification with both display name and email
    const userIdentifier = message.departed_user.display_name
      ? `${message.departed_user.display_name} (${message.departed_user.email})`
      : message.departed_user.email || 'Unknown user';

    if (this._notificationService) {
      this._logger.debugComponent(
        'InfraDfdWebsocketAdapter',
        'Showing participant left notification',
        { userIdentifier },
      );
      this._notificationService.showSessionEvent('userLeft', userIdentifier).subscribe({
        error: err => this._logger.error('Failed to show participant left notification', err),
      });
    } else {
      this._logger.warn(
        'Cannot show participant left notification - notification service not available',
      );
    }

    // Create domain event with required fields (User fields are optional per schema)
    this._domainEvents$.next({
      type: 'participant-left',
      user: {
        user_id: message.departed_user.email || 'unknown',
        email: message.departed_user.email || 'unknown',
        displayName: message.departed_user.display_name || 'Unknown User',
      },
      timestamp: message.timestamp,
    });
  }

  private _handleRemoveParticipant(message: RemoveParticipantMessage): void {
    this._logger.info('Remove participant request received', {
      removedUser: message.removed_user,
    });

    // Validate message format
    if (!message || !message.removed_user) {
      this._logger.warn('Invalid remove participant message received', message);
      return;
    }

    // Show notification if current user is being removed
    // Note: We need collaboration service to check current user - will add this later
    this._logger.info('Participant being removed by host', {
      removedUser: message.removed_user.email,
    });

    // Note: Schema does not include initiating_user in this message
    // The domain event type expects removingUser, but we don't have that info from schema-compliant messages
    // Create domain event with required fields (User fields are optional per schema)
    this._domainEvents$.next({
      type: 'participant-removed',
      removedUser: {
        user_id: message.removed_user.email || 'unknown',
        email: message.removed_user.email || 'unknown',
        displayName: message.removed_user.display_name || 'Unknown User',
      },
      removingUser: {
        user_id: 'system',
        email: 'system@host',
        displayName: 'System',
      },
    });
  }

  private _handleParticipantsUpdate(message: ParticipantsUpdateMessage): void {
    this._logger.info('Participants update received', {
      participantCount: message?.participants?.length,
      host: message?.host,
      currentPresenter: message?.current_presenter,
    });

    // Validate message format
    if (!message || !message.participants || !Array.isArray(message.participants)) {
      this._logger.warn('Invalid participants update message received', message);
      return;
    }

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
      reason: message.reason,
      message: message.message,
      requires_resync: message.requires_resync,
    });

    this._domainEvents$.next({
      type: 'operation-rejected',
      operation_id: message.operation_id,
      sequence_number: message.sequence_number,
      reason: message.reason,
      message: message.message,
      details: message.details,
      affected_cells: message.affected_cells,
      requires_resync: message.requires_resync,
      timestamp: message.timestamp,
    });
  }
}
