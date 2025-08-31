import { Injectable, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';
import { WebSocketAdapter } from '../infrastructure/adapters/websocket.adapter';
import { DfdCollaborationService } from './dfd-collaboration.service';
import { DfdNotificationService } from './dfd-notification.service';

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
    this._logger.debugComponent('wsmsg', 'Setting up join event handler', {});
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('join').subscribe(message => {
        this._handleJoinEvent(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('leave').subscribe(message => {
        this._handleLeaveEvent(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('session_ended').subscribe(message => {
        this._handleSessionEndedEvent(message);
      }),
    );

    // Diagram operation messages
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('update').subscribe(message => {
        this._handleUpdateEvent(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('diagram_operation').subscribe(message => {
        this._handleDiagramOperation(message);
      }),
    );

    // Presenter mode messages
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('presenter_request').subscribe(message => {
        this._handlePresenterRequest(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('presenter_denied').subscribe(message => {
        this._handlePresenterDenied(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('change_presenter').subscribe(message => {
        this._handleChangePresenter(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('current_presenter').subscribe(message => {
        this._handleCurrentPresenter(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('presenter_cursor').subscribe(message => {
        this._handlePresenterCursor(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('presenter_selection').subscribe(message => {
        this._handlePresenterSelection(message);
      }),
    );

    // Authorization and state management
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('authorization_denied').subscribe(message => {
        this._handleAuthorizationDenied(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('state_correction').subscribe(message => {
        this._handleStateCorrection(message);
      }),
    );

    // Synchronization messages
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('resync_request').subscribe(message => {
        this._handleResyncRequest(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('resync_response').subscribe(message => {
        this._handleResyncResponse(message);
      }),
    );

    // History operations
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('history_operation').subscribe(message => {
        this._handleHistoryOperation(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('undo_request').subscribe(message => {
        this._handleUndoRequest(message);
      }),
    );

    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('redo_request').subscribe(message => {
        this._handleRedoRequest(message);
      }),
    );

    // Participants update message
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('participants_update').subscribe(message => {
        this._handleParticipantsUpdate(message);
      }),
    );

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

  private _handleJoinEvent(message: any): void {
    this._logger.info('TMI: User joined event received', {
      userId: message.user_id,
      timestamp: message.timestamp,
      fullMessage: message,
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing join event', {
      userId: message.user_id,
      timestamp: message.timestamp,
      event: message.event,
      messageType: message.message_type,
    });

    // Validate message format
    if (!message || !message.user_id) {
      this._logger.warn('Invalid TMI join message received', message);
      return;
    }

    // Add the user to the participant list
    // Permission will be determined from the session data when we refresh
    this._logger.info('Adding participant to list', { userId: message.user_id });
    this._collaborationService.addParticipant(message.user_id);

    // Show notification
    const displayName = this._getUserDisplayName(message.user_id);
    this._notificationService.showSessionEvent('userJoined', displayName).subscribe();

    // Note: If the server sends a participants_update message after join,
    // it will provide the full participant list with accurate permissions
  }

  private _handleLeaveEvent(message: any): void {
    this._logger.info('TMI: User left event received', {
      userId: message.user_id,
      timestamp: message.timestamp,
      fullMessage: message,
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing leave event', {
      userId: message.user_id,
      timestamp: message.timestamp,
      event: message.event,
      messageType: message.message_type,
    });

    // Validate message format
    if (!message || !message.user_id) {
      this._logger.warn('Invalid TMI leave message received', message);
      return;
    }

    // Show notification first (before removing from list)
    const displayName = this._getUserDisplayName(message.user_id);
    this._notificationService.showSessionEvent('userLeft', displayName).subscribe();

    // Remove the user from the participant list
    this._logger.info('Removing participant from list', { userId: message.user_id });
    this._collaborationService.removeParticipant(message.user_id);

    // Check if the current user left (shouldn't happen but handle gracefully)
    const currentUserId = this._collaborationService.getCurrentUserId();
    if (message.user_id === currentUserId && !this._collaborationService.isCurrentUserHost()) {
      this._logger.warn('Current user received leave event, session may have ended');
      // The collaboration service will handle cleanup and redirect
    }
  }

  private _handleSessionEndedEvent(message: any): void {
    this._logger.debug('TMI: Session ended', {
      userId: message.user_id,
      message: message.message,
      timestamp: message.timestamp,
    });
    // TODO: Implement session ended handling
    // - Clean up local state
    // - Show notification
    // - Redirect or update UI
  }

  // Diagram operation handlers

  private _handleUpdateEvent(message: any): void {
    this._logger.debug('TMI: Diagram update', {
      userId: message.user_id,
      operation: message.operation,
      timestamp: message.timestamp,
    });
    // TODO: Implement update event handling
    // - Apply operation to local diagram
    // - Update visual state
    // - Handle conflicts if any
  }

  private _handleDiagramOperation(message: any): void {
    this._logger.debug('TMI: Diagram operation', {
      userId: message.user_id,
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

  private _handlePresenterRequest(message: any): void {
    this._logger.debug('TMI: Presenter request', {
      userId: message.user_id,
    });

    // Only hosts should handle presenter requests
    if (this._collaborationService.isCurrentUserHost()) {
      // Add to pending requests list
      this._collaborationService.addPresenterRequest(message.user_id);

      // Show notification about the request
      const displayName = this._getUserDisplayName(message.user_id);
      this._notificationService.showPresenterEvent('requested', displayName).subscribe();
    }
  }

  private _handlePresenterDenied(message: any): void {
    this._logger.debug('TMI: Presenter request denied', {
      userId: message.user_id,
      targetUser: message.target_user,
    });

    // Update the user's presenter request state back to hand_down
    const currentUserId = this._collaborationService.getCurrentUserId();
    if (message.target_user === currentUserId && currentUserId) {
      // Update local state to hand_down since request was denied
      this._collaborationService.updateUserPresenterRequestState(currentUserId, 'hand_down');

      // Show denial notification
      this._notificationService.showPresenterEvent('requestDenied').subscribe();
    }
  }

  private _handleChangePresenter(message: any): void {
    this._logger.debug('TMI: Change presenter', {
      userId: message.user_id,
      newPresenter: message.new_presenter,
    });

    // This message is sent by the host when they change the presenter
    // The server will follow up with a current_presenter message to all clients
    // For now, just log that we received it
    this._logger.info('host is changing presenter', {
      host: message.user_id,
      newPresenter: message.new_presenter,
    });
  }

  private _handleCurrentPresenter(message: any): void {
    this._logger.debug('TMI: Current presenter', {
      currentPresenter: message.current_presenter,
    });
    // TODO: Implement current presenter handling
    // - Update local presenter state
    // - Update UI to show presenter
    // - Enable/disable controls based on presenter status
  }

  private _handlePresenterCursor(message: any): void {
    this._logger.debug('TMI: Presenter cursor', {
      userId: message.user_id,
      position: message.cursor_position,
    });
    // TODO: Implement presenter cursor handling
    // - Update cursor visualization
    // - Smooth cursor movement
  }

  private _handlePresenterSelection(message: any): void {
    this._logger.debug('TMI: Presenter selection', {
      userId: message.user_id,
      selectedCells: message.selected_cells,
    });
    // TODO: Implement presenter selection handling
    // - Highlight selected cells
    // - Update selection state
  }

  // Authorization and state handlers

  private _handleAuthorizationDenied(message: any): void {
    this._logger.debug('TMI: Authorization denied', {
      operationId: message.original_operation_id,
      reason: message.reason,
    });
    // TODO: Implement authorization denied handling
    // - Revert local operation
    // - Show error notification
    // - Log for debugging
  }

  private _handleStateCorrection(message: any): void {
    this._logger.debug('TMI: State correction', {
      cellCount: message.cells?.length,
    });
    // TODO: Implement state correction handling
    // - Apply corrected state
    // - Resolve conflicts
    // - Update local diagram
  }

  // Synchronization handlers

  private _handleResyncRequest(message: any): void {
    this._logger.debug('TMI: Resync request', {
      userId: message.user_id,
    });
    // TODO: Implement resync request handling
    // - Server should handle this
    // - Log for debugging
  }

  private _handleResyncResponse(message: any): void {
    this._logger.debug('TMI: Resync response', {
      userId: message.user_id,
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

  private _handleHistoryOperation(message: any): void {
    this._logger.debug('TMI: History operation', {
      operationType: message.operation_type,
      message: message.message,
    });
    // TODO: Implement history operation handling
    // - Update based on operation result
    // - Resync if required
    // - Show notification
  }

  private _handleUndoRequest(message: any): void {
    this._logger.debug('TMI: Undo request', {
      userId: message.user_id,
    });
    // TODO: Implement undo request handling
    // - Server handles the undo
    // - Wait for response
  }

  private _handleRedoRequest(message: any): void {
    this._logger.debug('TMI: Redo request', {
      userId: message.user_id,
    });
    // TODO: Implement redo request handling
    // - Server handles the redo
    // - Wait for response
  }

  // Participants update handler

  private _handleParticipantsUpdate(message: any): void {
    this._logger.info('TMI: Participants update received', {
      participantCount: message.participants?.length,
      host: message.host,
      currentPresenter: message.current_presenter,
      participants: message.participants?.map((p: any) => ({
        userId: p.user_id,
        permissions: p.permissions,
        isPresenter: p.is_presenter,
        isHost: p.is_host,
      })),
    });

    // Log with component debugging
    this._logger.debugComponent('wsmsg', 'Processing participants update', {
      participantCount: message.participants?.length,
      host: message.host,
      currentPresenter: message.current_presenter,
      fullMessage: message,
    });

    // Validate message format
    if (!message || !message.participants || !Array.isArray(message.participants)) {
      this._logger.warn('Invalid TMI participants update message received', message);
      return;
    }

    // Use the bulk update method from collaboration service
    this._collaborationService.updateAllParticipants(
      message.participants,
      message.host,
      message.current_presenter,
    );
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
