import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoggerService } from './logger.service';
import { WebSocketAdapter } from './websocket.adapter';
import { DfdCollaborationService } from './dfd-collaboration.service';
import { DfdNotificationService } from '../../pages/dfd/services/dfd-notification.service';
import {
  ParticipantJoinedMessage,
  ParticipantLeftMessage,
  SessionTerminatedMessage,
  DiagramOperationMessage,
  PresenterRequestMessage,
  PresenterDeniedMessage,
  ChangePresenterMessage,
  CurrentPresenterMessage,
  PresenterCursorMessage,
  PresenterSelectionMessage,
  AuthorizationDeniedMessage,
  StateCorrectionMessage,
  ResyncRequestMessage,
  ResyncResponseMessage,
  HistoryOperationMessage,
  UndoRequestMessage,
  RedoRequestMessage,
} from '../types/websocket-message.types';
import { ApiParticipant } from './dfd-collaboration.service';

// Override the ParticipantsUpdateMessage to match the actual API response
// which uses ApiParticipant instead of Participant
interface ApiParticipantsUpdateMessage {
  message_type: 'participants_update';
  participants: ApiParticipant[];
  host?: string;
  current_presenter?: string | null;
}

/**
 * Service responsible for handling all TMI WebSocket messages
 *
 * This service sets up listeners for all TMI message types defined in the AsyncAPI
 * specification and provides centralized handling for each message type.
 */
@Injectable({
  providedIn: 'root',
})
export class TMIMessageHandlerService implements OnDestroy {
  private _subscriptions = new Subscription();
  private _isInitialized = false;

  constructor(
    private _logger: LoggerService,
    private _webSocketAdapter: WebSocketAdapter,
    private _collaborationService: DfdCollaborationService,
    private _notificationService: DfdNotificationService,
  ) {}

  /**
   * Initialize all TMI message handlers
   */
  initialize(): void {
    if (this._isInitialized) {
      this._logger.warn('TMI message handlers already initialized');
      return;
    }

    this._logger.info('Initializing TMI message handlers');
    this._logger.debugComponent('wsmsg', 'Starting TMI handler initialization', {
      timestamp: new Date().toISOString(),
    });

    // Session management messages
    this._logger.debugComponent('wsmsg', 'Setting up participant joined event handler', {});
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ParticipantJoinedMessage>('participant_joined')
        .subscribe(message => {
          this._handleParticipantJoinedEvent(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ParticipantLeftMessage>('participant_left')
        .subscribe(message => {
          this._handleParticipantLeftEvent(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<SessionTerminatedMessage>('session_terminated')
        .subscribe(message => {
          this._handleSessionTerminatedEvent(message);
        }),
    );

    // Diagram operation messages

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<DiagramOperationMessage>('diagram_operation')
        .subscribe(message => {
          this._handleDiagramOperation(message);
        }),
    );

    // Presenter mode messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterRequestMessage>('presenter_request')
        .subscribe(message => {
          this._handlePresenterRequest(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterDeniedMessage>('presenter_denied')
        .subscribe(message => {
          this._handlePresenterDenied(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ChangePresenterMessage>('change_presenter')
        .subscribe(message => {
          this._handleChangePresenter(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<CurrentPresenterMessage>('current_presenter')
        .subscribe(message => {
          this._handleCurrentPresenter(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterCursorMessage>('presenter_cursor')
        .subscribe(message => {
          this._handlePresenterCursor(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterSelectionMessage>('presenter_selection')
        .subscribe(message => {
          this._handlePresenterSelection(message);
        }),
    );

    // Authorization and state management
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<AuthorizationDeniedMessage>('authorization_denied')
        .subscribe(message => {
          this._handleAuthorizationDenied(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<StateCorrectionMessage>('state_correction')
        .subscribe(message => {
          this._handleStateCorrection(message);
        }),
    );

    // Synchronization messages
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ResyncRequestMessage>('resync_request')
        .subscribe(message => {
          this._handleResyncRequest(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<ResyncResponseMessage>('resync_response')
        .subscribe(message => {
          this._handleResyncResponse(message);
        }),
    );

    // History operations
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<HistoryOperationMessage>('history_operation')
        .subscribe(message => {
          this._handleHistoryOperation(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<UndoRequestMessage>('undo_request')
        .subscribe(message => {
          this._handleUndoRequest(message);
        }),
    );

    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<RedoRequestMessage>('redo_request')
        .subscribe(message => {
          this._handleRedoRequest(message);
        }),
    );

    // Participants update message
    // Using 'as any' for custom message structure with ApiParticipant[]
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
    this._subscriptions.add(
      (this._webSocketAdapter as any)
        .getTMIMessagesOfType('participants_update')
        .subscribe((message: ApiParticipantsUpdateMessage) => {
          this._handleParticipantsUpdate(message);
        }),
    );
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

    this._isInitialized = true;
    this._logger.info('TMI message handlers initialized successfully');
    this._logger.debugComponent('wsmsg', 'TMI handler initialization complete', {
      timestamp: new Date().toISOString(),
      handlersCount: 17,
    });
  }

  /**
   * Clean up all subscriptions
   */
  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
    this._isInitialized = false;
  }

  // Session management handlers

  private _handleParticipantJoinedEvent(message: ParticipantJoinedMessage): void {
    this._logger.info('TMI: Participant joined event received', {
      user: message.user,
      timestamp: message.timestamp,
      fullMessage: message,
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing participant joined event', {
      user: message.user,
      timestamp: message.timestamp,
      messageType: message.message_type,
    });

    // Validate message format
    if (!message || !message.user) {
      this._logger.warn('Invalid TMI participant joined message received', message);
      return;
    }

    // IMPORTANT: This message is ONLY for notifications, not for updating the participant list
    // The participants list is managed exclusively through participants_update messages
    this._logger.info('Participant joined - showing notification only', { user: message.user });

    // Show notification
    const displayName = message.user.displayName || message.user.email;
    this._notificationService.showSessionEvent('userJoined', displayName).subscribe();
  }

  private _handleParticipantLeftEvent(message: ParticipantLeftMessage): void {
    this._logger.info('TMI: Participant left event received', {
      user: message.user,
      timestamp: message.timestamp,
      fullMessage: message,
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing participant left event', {
      user: message.user,
      timestamp: message.timestamp,
      messageType: message.message_type,
    });

    // Validate message format
    if (!message || !message.user) {
      this._logger.warn('Invalid TMI participant left message received', message);
      return;
    }

    // IMPORTANT: This message is ONLY for notifications, not for updating the participant list
    // The participants list is managed exclusively through participants_update messages
    this._logger.info('Participant left - showing notification only', { user: message.user });

    // Show notification
    const displayName = message.user.displayName || message.user.email;
    this._notificationService.showSessionEvent('userLeft', displayName).subscribe();

    // Check if the current user left (shouldn't happen but handle gracefully)
    const currentUserEmail = this._collaborationService.getCurrentUserEmail();
    if (
      message.user.email === currentUserEmail &&
      !this._collaborationService.isCurrentUserHost()
    ) {
      this._logger.warn('Current user received leave event, session may have ended');
      // The collaboration service will handle cleanup and redirect
    }
  }

  private _handleSessionTerminatedEvent(message: SessionTerminatedMessage): void {
    this._logger.debug('TMI: Session terminated', {
      reason: message.reason,
      hostId: message.host_id,
      timestamp: message.timestamp,
    });
    // TODO: Implement session terminated handling
    // - Clean up local state
    // - Show notification
    // - Redirect or update UI
  }

  // Diagram operation handlers

  private _handleDiagramOperation(message: DiagramOperationMessage): void {
    this._logger.debug('TMI: Diagram operation', {
      user: message.user,
      operationId: message.operation_id,
      operationType: message.operation?.type,
      cellCount: message.operation?.cells?.length,
    });
    // TODO: Implement diagram operation handling
    // - Validate operation
    // - Apply to local state
    // - Update history
    // - Handle conflicts
  }

  // Presenter mode handlers

  private _handlePresenterRequest(message: PresenterRequestMessage): void {
    this._logger.debug('TMI: Presenter request', {
      user: message.user,
    });

    // Only hosts should handle presenter requests
    if (this._collaborationService.isCurrentUserHost()) {
      // Add to pending requests list
      this._collaborationService.addPresenterRequest(message.user.email);

      // Show notification about the request
      const displayName = message.user.displayName || message.user.email;
      this._notificationService.showPresenterEvent('requested', displayName).subscribe();
    }
  }

  private _handlePresenterDenied(message: PresenterDeniedMessage): void {
    this._logger.debug('TMI: Presenter request denied', {
      user: message.user,
      targetUser: message.target_user,
    });

    // Update the user's presenter request state back to hand_down
    const currentUserEmail = this._collaborationService.getCurrentUserEmail();
    if (message.target_user === currentUserEmail && currentUserEmail) {
      // Update local state to hand_down since request was denied
      this._collaborationService.updateUserPresenterRequestState(currentUserEmail, 'hand_down');

      // Show denial notification
      this._notificationService.showPresenterEvent('requestDenied').subscribe();
    }
  }

  private _handleChangePresenter(message: ChangePresenterMessage): void {
    this._logger.debug('TMI: Change presenter', {
      user: message.user,
      newPresenter: message.new_presenter,
    });

    // This message is sent by the host when they change the presenter
    // The server will follow up with a current_presenter message to all clients
    // For now, just log that we received it
    this._logger.info('host is changing presenter', {
      host: message.user.email,
      newPresenter: message.new_presenter,
    });
  }

  private _handleCurrentPresenter(message: CurrentPresenterMessage): void {
    this._logger.debug('TMI: Current presenter', {
      currentPresenter: message.current_presenter,
    });
    // TODO: Implement current presenter handling
    // - Update local presenter state
    // - Update UI to show presenter
    // - Enable/disable controls based on presenter status
  }

  private _handlePresenterCursor(message: PresenterCursorMessage): void {
    this._logger.debug('TMI: Presenter cursor', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      position: message.cursor_position,
    });
    // TODO: Implement presenter cursor handling
    // - Update cursor visualization
    // - Smooth cursor movement
  }

  private _handlePresenterSelection(message: PresenterSelectionMessage): void {
    this._logger.debug('TMI: Presenter selection', {
      userId: message.user.user_id,
      userEmail: message.user.email,
      selectedCells: message.selected_cells,
    });
    // TODO: Implement presenter selection handling
    // - Highlight selected cells
    // - Update selection state
  }

  // Authorization and state handlers

  private _handleAuthorizationDenied(message: AuthorizationDeniedMessage): void {
    this._logger.debug('TMI: Authorization denied', {
      operationId: message.original_operation_id,
      reason: message.reason,
    });
    // TODO: Implement authorization denied handling
    // - Revert local operation
    // - Show error notification
    // - Log for debugging
  }

  private _handleStateCorrection(message: StateCorrectionMessage): void {
    this._logger.debug('TMI: State correction', {
      cellCount: message.cells?.length,
    });
    // TODO: Implement state correction handling
    // - Apply corrected state
    // - Resolve conflicts
    // - Update local diagram
  }

  // Synchronization handlers

  private _handleResyncRequest(message: ResyncRequestMessage): void {
    this._logger.debug('TMI: Resync request', {
      userId: message.user.user_id,
      userEmail: message.user.email,
    });
    // TODO: Implement resync request handling
    // - Server should handle this
    // - Log for debugging
  }

  private _handleResyncResponse(message: ResyncResponseMessage): void {
    this._logger.debug('TMI: Resync response', {
      user: message.user,
      targetUser: message.target_user,
      method: message.method,
      diagramId: message.diagram_id,
    });
    // TODO: Implement resync response handling
    // - Fetch fresh state from REST API
    // - Replace local state
    // - Show notification
  }

  // History operation handlers

  private _handleHistoryOperation(message: HistoryOperationMessage): void {
    this._logger.debug('TMI: History operation', {
      operationType: message.operation_type,
      message: message.message,
    });
    // TODO: Implement history operation handling
    // - Update based on operation result
    // - Resync if required
    // - Show notification
  }

  private _handleUndoRequest(message: UndoRequestMessage): void {
    this._logger.debug('TMI: Undo request', {
      userId: message.user.user_id,
      userEmail: message.user.email,
    });
    // TODO: Implement undo request handling
    // - Server handles the undo
    // - Wait for response
  }

  private _handleRedoRequest(message: RedoRequestMessage): void {
    this._logger.debug('TMI: Redo request', {
      userId: message.user.user_id,
      userEmail: message.user.email,
    });
    // TODO: Implement redo request handling
    // - Server handles the redo
    // - Wait for response
  }

  // Participants update handler

  private _handleParticipantsUpdate(message: ApiParticipantsUpdateMessage): void {
    this._logger.info('TMI: Participants update received - START', {
      hasMessage: !!message,
      hasParticipants: !!message?.participants,
      participantCount: message?.participants?.length,
      host: message?.host,
      currentPresenter: message?.current_presenter,
    });

    this._logger.info('TMI: Participants details', {
      participants: message?.participants?.map((p: ApiParticipant) => ({
        userId: p.user?.user_id,
        displayName: p.user?.displayName,
        email: p.user?.email,
        permissions: p.permissions,
        lastActivity: p.last_activity,
      })),
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing participants update', {
      participantCount: message?.participants?.length,
      host: message?.host,
      currentPresenter: message?.current_presenter,
      fullMessage: message,
    });

    // Validate message format
    if (!message || !message.participants || !Array.isArray(message.participants)) {
      this._logger.warn('Invalid TMI participants update message received', message);
      return;
    }

    // Log the first participant to see all fields
    if (message.participants.length > 0) {
      this._logger.debug('First participant full data:', message.participants[0]);
    }

    try {
      this._logger.info('Calling updateAllParticipants with data', {
        participants: message.participants,
        host: message.host,
        current_presenter: message.current_presenter,
      });

      // Use the bulk update method from collaboration service
      this._collaborationService.updateAllParticipants(
        message.participants,
        message.host,
        message.current_presenter,
      );

      this._logger.info('updateAllParticipants call completed');
    } catch (error) {
      this._logger.error('Error in updateAllParticipants', error);
    }
  }

  // Helper methods

  /**
   * Get display name for a user ID
   * @param userId The user ID (usually an email)
   * @returns A display-friendly name
   */
  private _getUserDisplayName(userId: string): string {
    if (!userId) {
      return 'Unknown User';
    }

    // If it's an email, use the part before @ as the display name
    if (userId.includes('@')) {
      return userId.split('@')[0];
    }

    return userId;
  }
}
