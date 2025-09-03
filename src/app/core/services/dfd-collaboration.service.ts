import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, throwError, Subscription, of, Subject } from 'rxjs';
import { map, catchError, tap, skip } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoggerService } from './logger.service';
import { AuthService } from '../../auth/services/auth.service';
import { ThreatModelService } from '../../pages/tm/services/threat-model.service';
import { WebSocketAdapter, WebSocketState, WebSocketErrorType } from './websocket.adapter';
import { DfdNotificationService } from '../../pages/dfd/services/dfd-notification.service';
import { environment } from '../../../environments/environment';
import { SessionTerminatedMessage, ChangePresenterMessage } from '../types/websocket-message.types';

/**
 * Represents a user in a collaboration session
 */
export interface CollaborationUser {
  name: string; // Display name to show in UI
  email: string; // Email address - primary identifier
  permission: 'writer' | 'reader'; // Based on threat model permissions
  status: 'active' | 'idle' | 'disconnected';
  cursorPosition?: { x: number; y: number };
  isPresenter?: boolean;
  isHost?: boolean; // True for the person who created the session
  lastActivity?: Date;
  // Presenter request state for UI
  presenterRequestState?: 'hand_down' | 'hand_raised' | 'presenter';
}

/**
 * User information from the API
 */
export interface ApiUser {
  user_id: string;
  email: string;
  displayName: string;
}

/**
 * Participant from the API
 */
export interface ApiParticipant {
  user: ApiUser;
  last_activity: string;
  permissions: 'reader' | 'writer' | 'owner';
}

/**
 * Represents a collaboration session from the API
 */
export interface CollaborationSession {
  session_id: string;
  threat_model_id: string;
  threat_model_name: string;
  diagram_id: string;
  diagram_name: string;
  participants: ApiParticipant[];
  websocket_url: string;
  host: string;
  presenter?: string;
}

/**
 * Unified collaboration state that combines all collaboration-related data
 */
export interface CollaborationState {
  isActive: boolean;
  users: CollaborationUser[];
  currentPresenterEmail: string | null;
  pendingPresenterRequests: string[];
  sessionInfo: CollaborationSession | null;
  existingSessionAvailable: CollaborationSession | null;
}

/**
 * Service for managing collaboration sessions in the DFD editor
 */
@Injectable({
  providedIn: 'root',
})
export class DfdCollaborationService implements OnDestroy {
  // Unified collaboration state
  private _collaborationState$ = new BehaviorSubject<CollaborationState>({
    isActive: false,
    users: [],
    currentPresenterEmail: null,
    pendingPresenterRequests: [],
    sessionInfo: null,
    existingSessionAvailable: null,
  });
  public collaborationState$ = this._collaborationState$.asObservable();

  // Derived observables for backward compatibility
  public isCollaborating$ = this.collaborationState$.pipe(map(state => state.isActive));
  public collaborationUsers$ = this.collaborationState$.pipe(map(state => state.users));
  public currentPresenterEmail$ = this.collaborationState$.pipe(
    map(state => state.currentPresenterEmail),
  );
  public pendingPresenterRequests$ = this.collaborationState$.pipe(
    map(state => state.pendingPresenterRequests),
  );
  public existingSessionAvailable$ = this.collaborationState$.pipe(
    map(state => state.existingSessionAvailable),
  );

  // Current session information
  private _currentSession: CollaborationSession | null = null;
  private _threatModelId: string | null = null;
  private _diagramId: string | null = null;

  // Subscription management
  private _subscriptions = new Subscription();
  private _webSocketListenersSetup = false;
  private _intentionalDisconnection = false;

  // Session end event - emits when collaboration ends (intentional or disconnection)
  private _sessionEndedSubject = new Subject<{ reason: 'user_ended' | 'disconnected' | 'error' }>();
  public sessionEnded$ = this._sessionEndedSubject.asObservable();

  // Periodic refresh removed - participants now managed through WebSocket messages only

  constructor(
    private _logger: LoggerService,
    private _authService: AuthService,
    private _threatModelService: ThreatModelService,
    private _webSocketAdapter: WebSocketAdapter,
    private _notificationService: DfdNotificationService,
    private _router: Router,
  ) {
    this._logger.info('DfdCollaborationService initialized');
    // WebSocket listeners will be set up when collaboration is actually started
  }

  /**
   * Helper method to update collaboration state atomically
   * @param updates Partial state updates to apply
   */
  private _updateState(updates: Partial<CollaborationState>): void {
    const currentState = this._collaborationState$.value;
    const newState = { ...currentState, ...updates };

    // Enhanced logging for debugging WebSocket flow
    this._logger.info('[DfdCollaborationService] Updating collaboration state', {
      timestamp: new Date().toISOString(),
      updates: Object.keys(updates),
      previousState: {
        isActive: currentState.isActive,
        userCount: currentState.users.length,
        presenter: currentState.currentPresenterEmail,
      },
      newState: {
        isActive: newState.isActive,
        userCount: newState.users.length,
        presenter: newState.currentPresenterEmail,
      },
      usersChanged: updates.users !== undefined,
      callStack: new Error().stack?.split('\n').slice(2, 5), // Log call stack for tracing
    });

    // Log before emitting to track timing
    this._logger.debug('[DfdCollaborationService] About to emit state update via BehaviorSubject');

    this._collaborationState$.next(newState);

    this._logger.debug('[DfdCollaborationService] State update complete - emitted to subscribers', {
      isActive: newState.isActive,
      userCount: newState.users.length,
      hasSession: !!newState.sessionInfo,
      users: newState.users,
    });
  }

  /**
   * Get the current collaboration state synchronously
   * This is useful for debugging and state verification
   * @returns The current collaboration state
   */
  public getCurrentState(): CollaborationState {
    const currentState = this._collaborationState$.value;
    this._logger.debug('[DfdCollaborationService] getCurrentState called', {
      isActive: currentState.isActive,
      userCount: currentState.users.length,
      hasSession: !!currentState.sessionInfo,
      timestamp: new Date().toISOString(),
    });
    return currentState;
  }

  /**
   * Get the current WebSocket URL for the active collaboration session
   * @returns The WebSocket URL or null if no session is active
   */
  get currentWebSocketUrl(): string | null {
    return this._currentSession?.websocket_url || null;
  }

  /**
   * Set the diagram context for collaboration
   * @param threatModelId The threat model ID
   * @param diagramId The diagram ID
   */
  setDiagramContext(threatModelId: string, diagramId: string): void {
    this._threatModelId = threatModelId;
    this._diagramId = diagramId;
    this._logger.info('Diagram context set for collaboration', { threatModelId, diagramId });
  }

  /**
   * Check if there is an existing collaboration session for the current diagram
   * This should be called on startup to determine UI state
   * @returns Observable<CollaborationSession | null> the existing session or null
   */
  public checkForExistingSession(): Observable<CollaborationSession | null> {
    this._logger.info('Checking for existing collaboration session');

    if (!this._threatModelId || !this._diagramId) {
      this._logger.error('Cannot check for existing session: diagram context not set');
      return throwError(
        () => new Error('Diagram context not set. Call setDiagramContext() first.'),
      );
    }

    if (this._collaborationState$.value.isActive) {
      this._logger.warn('Already collaborating - returning current session');
      return new Observable<CollaborationSession | null>(observer => {
        observer.next(this._currentSession);
        observer.complete();
      });
    }

    return this._threatModelService
      .getDiagramCollaborationSession(this._threatModelId, this._diagramId)
      .pipe(
        tap((session: CollaborationSession | null) => {
          // Update the existing session state for UI components to react to
          this._updateState({ existingSessionAvailable: session });

          if (session) {
            this._logger.info('Found existing collaboration session', {
              sessionId: session.session_id,
              host: session.host,
              participantCount: session.participants.length,
            });
          } else {
            this._logger.info('No existing collaboration session found');
          }
        }),
        catchError((error: unknown) => {
          this._logger.error('Failed to check for existing collaboration session', error);
          // Return null instead of throwing - this is not a critical error
          this._updateState({ existingSessionAvailable: null });
          return new Observable<CollaborationSession | null>(observer => {
            observer.next(null);
            observer.complete();
          });
        }),
      );
  }

  /**
   * Check if current user would be the host of the existing session
   * @returns boolean indicating if current user is the host of existing session
   */
  public isCurrentUserManagerOfExistingSession(): boolean {
    const existingSession = this._collaborationState$.value.existingSessionAvailable;
    if (!existingSession) {
      return false;
    }
    const currentUserEmail = this.getCurrentUserEmail();
    return currentUserEmail === existingSession.host;
  }

  /**
   * Join an existing collaboration session using PUT method
   * @returns Observable<boolean> indicating success or failure
   */
  public joinCollaboration(): Observable<boolean> {
    this._logger.info('Joining existing collaboration session using PUT method');

    if (!this._threatModelId || !this._diagramId) {
      this._logger.error('Cannot join collaboration: diagram context not set');
      return throwError(
        () => new Error('Diagram context not set. Call setDiagramContext() first.'),
      );
    }

    if (this._collaborationState$.value.isActive) {
      this._logger.warn('Collaboration session already active');
      return throwError(() => new Error('Collaboration session is already active'));
    }

    // Use PUT method to join existing collaboration session
    return this._threatModelService
      .joinDiagramCollaborationSession(this._threatModelId, this._diagramId)
      .pipe(
        tap((session: CollaborationSession) => {
          this._logger.info('Successfully joined existing collaboration session', {
            sessionId: session.session_id,
            threatModelId: session.threat_model_id,
            diagramId: session.diagram_id,
            websocketUrl: session.websocket_url,
          });

          // Store the session
          this._currentSession = session;

          // Initialize with current user immediately to ensure UI shows at least one participant
          const currentUserEmail = this.getCurrentUserEmail();
          const isCurrentUserPresenter = currentUserEmail === session.presenter;
          const initialUser: CollaborationUser = {
            name: this._authService.userProfile?.name || '',
            email: currentUserEmail || '',
            permission: 'writer',
            status: 'active',
            isHost: currentUserEmail === session.host, // Check if current user is the host from session data
            isPresenter: isCurrentUserPresenter, // Check if current user is the presenter from session data
            lastActivity: new Date(),
            presenterRequestState: isCurrentUserPresenter ? 'presenter' : 'hand_down',
          };

          // Update collaboration state atomically
          this._updateState({
            isActive: true,
            users: [initialUser],
            sessionInfo: session,
            existingSessionAvailable: null,
            currentPresenterEmail: session.presenter || null,
          });

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket immediately - no delay needed with unified state
          this._connectToWebSocket(session.websocket_url);
        }),
        // Participants will be updated through WebSocket messages only
        tap(() => {
          // Show session joined notification only after user is verified in list
          this._notificationService.showSessionEvent('userJoined').subscribe();

          // Participants will be updated through WebSocket messages only
        }),
        map(() => true),
        catchError((error: unknown) => {
          this._logger.error('Failed to join collaboration session via PUT', error);

          // Check if this is a 403 error - reader trying to join
          const httpError = error as { status?: number };
          if (httpError?.status === 403) {
            // Check if a session already exists that we can connect to directly
            const existingSession = this._collaborationState$.value.existingSessionAvailable;
            if (existingSession) {
              this._logger.info(
                'Reader received 403 on PUT, but session exists - connecting directly to WebSocket',
                {
                  sessionId: existingSession.session_id,
                  websocketUrl: existingSession.websocket_url,
                },
              );

              // Store the session
              this._currentSession = existingSession;

              // Initialize with current user immediately to ensure UI shows at least one participant
              const currentUserEmail = this.getCurrentUserEmail();
              const initialUser: CollaborationUser = {
                name: this._authService.userProfile?.name || '',
                email: currentUserEmail || '',
                permission: 'reader', // Reader permission for this fallback case
                status: 'active',
                isHost: false,
                isPresenter: false,
                lastActivity: new Date(),
                presenterRequestState: 'hand_down',
              };

              // Update collaboration state atomically
              this._updateState({
                isActive: true,
                users: [initialUser],
                sessionInfo: existingSession,
                existingSessionAvailable: null,
                currentPresenterEmail: existingSession.presenter || null,
              });

              // Set up WebSocket listeners before connecting
              this._setupWebSocketListeners();

              // Connect to WebSocket immediately - no delay needed with unified state
              this._connectToWebSocket(existingSession.websocket_url);

              // Show session joined notification
              this._notificationService.showSessionEvent('userJoined').subscribe();

              return of(true);
            } else {
              // No existing session - reader cannot create one
              this._logger.warn(
                'Reader cannot create collaboration session - no existing session found',
              );
              this._notificationService
                .showError('You need writer permissions to start a collaboration session')
                .subscribe();
              return of(false);
            }
          }

          return throwError(() => error);
        }),
      );
  }

  /**
   * Smart collaboration starter: Try to create a session, if it exists then join it
   * This implements the pattern recommended in CLIENT_INTEGRATION_GUIDE.md
   * @returns Observable<boolean> indicating success or failure
   */
  public startOrJoinCollaboration(): Observable<boolean> {
    this._logger.info('Smart collaboration starter: attempting to create or join session');

    if (!this._threatModelId || !this._diagramId) {
      this._logger.error('Cannot start/join collaboration: diagram context not set');
      return throwError(
        () => new Error('Diagram context not set. Call setDiagramContext() first.'),
      );
    }

    if (this._collaborationState$.value.isActive) {
      this._logger.warn('Collaboration session already active');
      return throwError(() => new Error('Collaboration session is already active'));
    }

    // Use smart session handler that tries POST first, then PUT on 409
    return this._threatModelService
      .startOrJoinDiagramCollaborationSession(this._threatModelId, this._diagramId)
      .pipe(
        tap((result: { session: CollaborationSession; isNewSession: boolean }) => {
          const session = result.session;

          this._logger.info('Smart collaboration handler succeeded', {
            sessionId: session.session_id,
            threatModelId: session.threat_model_id,
            diagramId: session.diagram_id,
            websocketUrl: session.websocket_url,
            isNewSession: result.isNewSession,
          });

          // Store the session
          this._currentSession = session;

          // Initialize with current user immediately to ensure UI shows at least one participant
          const currentUserEmail = this.getCurrentUserEmail();
          const isCurrentUserPresenter = currentUserEmail === session.presenter;
          const initialUser: CollaborationUser = {
            name: this._authService.userProfile?.name || '',
            email: currentUserEmail || '',
            permission: 'writer',
            status: 'active',
            isHost: currentUserEmail === session.host, // Check if current user is the host from session data
            isPresenter: isCurrentUserPresenter, // Check if current user is the presenter from session data
            lastActivity: new Date(),
            presenterRequestState: isCurrentUserPresenter ? 'presenter' : 'hand_down',
          };

          // Update collaboration state atomically
          this._updateState({
            isActive: true,
            users: [initialUser],
            sessionInfo: session,
            existingSessionAvailable: null,
            currentPresenterEmail: session.presenter || null,
          });

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket immediately - no delay needed with unified state
          this._connectToWebSocket(session.websocket_url);

          // Store whether this was a new session for later
          return { isNewSession: result.isNewSession };
        }),
        // No longer ensuring user in participant list via REST API
        // Participants will be managed through WebSocket messages only
        tap(result => {
          // Show appropriate notification based on whether session was created or joined
          if (result.isNewSession) {
            this._notificationService.showSessionEvent('started').subscribe();
          } else {
            this._notificationService.showSessionEvent('userJoined').subscribe();
          }

          // Participants will be updated through WebSocket messages only
        }),
        map(() => true),
        catchError((error: unknown) => {
          this._logger.error('Smart collaboration starter failed', error);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Start a new collaboration session (host only) - DEPRECATED
   * Use startOrJoinCollaboration() instead for better UX
   * @returns Observable<boolean> indicating success or failure
   */
  public startCollaboration(): Observable<boolean> {
    this._logger.info('Starting collaboration session');

    if (!this._threatModelId || !this._diagramId) {
      this._logger.error('Cannot start collaboration: diagram context not set');
      return throwError(
        () => new Error('Diagram context not set. Call setDiagramContext() first.'),
      );
    }

    if (this._collaborationState$.value.isActive) {
      this._logger.warn('Collaboration session already active');
      return throwError(() => new Error('Collaboration session is already active'));
    }

    // Make API call to start collaboration session
    return this._threatModelService
      .startDiagramCollaborationSession(this._threatModelId, this._diagramId)
      .pipe(
        tap((session: CollaborationSession) => {
          this._logger.info('Collaboration session started successfully', {
            sessionId: session.session_id,
            threatModelId: session.threat_model_id,
            diagramId: session.diagram_id,
            websocketUrl: session.websocket_url,
          });

          // Store the session
          this._currentSession = session;

          // Initialize with current user immediately to ensure UI shows at least one participant
          const currentUserEmail = this.getCurrentUserEmail();
          const isCurrentUserPresenter = currentUserEmail === session.presenter;
          const initialUser: CollaborationUser = {
            name: this._authService.userProfile?.name || '',
            email: currentUserEmail || '',
            permission: 'writer',
            status: 'active',
            isHost: currentUserEmail === session.host, // Check if current user is the host from session data
            isPresenter: isCurrentUserPresenter, // Check if current user is the presenter from session data
            lastActivity: new Date(),
            presenterRequestState: isCurrentUserPresenter ? 'presenter' : 'hand_down',
          };

          // Update collaboration state atomically
          this._updateState({
            isActive: true,
            users: [initialUser],
            sessionInfo: session,
            existingSessionAvailable: null,
            currentPresenterEmail: session.presenter || null,
          });

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket immediately - no delay needed with unified state
          this._connectToWebSocket(session.websocket_url);
        }),
        // No longer ensuring user in participant list via REST API
        // Participants will be managed through WebSocket messages only
        tap(() => {
          // Show session started notification only after user is verified in list
          this._notificationService.showSessionEvent('started').subscribe();

          // Participants will be updated through WebSocket messages only
        }),
        map(() => true),
        catchError((error: unknown) => {
          this._logger.error('Failed to start collaboration session', error);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Leave the current collaboration session (for non-owners)
   * @returns Observable<boolean> indicating success or failure
   */
  public leaveSession(): Observable<boolean> {
    this._logger.info('Leaving collaboration session');

    if (!this._currentSession) {
      this._logger.warn('No active collaboration session to leave');
      return throwError(() => new Error('No active collaboration session'));
    }

    if (this.isCurrentUserHost()) {
      this._logger.info('host leaving - this will end the session for all users');
      return this.endCollaboration();
    }

    // The server handles participant tracking when the WebSocket disconnects
    // Client should not send leave messages

    // Mark as intentional disconnection to suppress notification
    this._intentionalDisconnection = true;

    // Clean up local state and redirect
    this._cleanupSessionState();
    this._redirectToDashboard();

    return new Observable<boolean>(observer => {
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * End the current collaboration session (for owners)
   * @returns Observable<boolean> indicating success or failure
   */
  public endCollaboration(): Observable<boolean> {
    this._logger.info('Ending collaboration session');

    if (!this._currentSession) {
      this._logger.warn('No active collaboration session to end');
      return throwError(() => new Error('No active collaboration session'));
    }

    // The server handles participant tracking when the WebSocket disconnects
    // Client should not send leave messages

    // Make API call to end collaboration session
    return this._threatModelService
      .endDiagramCollaborationSession(
        this._currentSession.threat_model_id,
        this._currentSession.diagram_id,
      )
      .pipe(
        tap(() => {
          this._logger.info('Collaboration session ended successfully', {
            sessionId: this._currentSession?.session_id,
            threatModelId: this._currentSession?.threat_model_id,
            diagramId: this._currentSession?.diagram_id,
          });

          // Mark as intentional disconnection to suppress notification
          this._intentionalDisconnection = true;

          // No periodic refresh to stop - using WebSocket messages only

          // Disconnect WebSocket
          this._disconnectFromWebSocket();

          // Clear session state
          this._currentSession = null;
          this._updateState({
            isActive: false,
            users: [],
            currentPresenterEmail: null,
            pendingPresenterRequests: [],
            sessionInfo: null,
            existingSessionAvailable: null,
          });

          // Show session ended notification
          this._notificationService.showSessionEvent('ended').subscribe();
        }),
        map(() => true),
        catchError((error: unknown) => {
          this._logger.error('Failed to end collaboration session', error);

          // Even if API call fails, clean up local state
          // Mark as intentional disconnection to suppress notification
          this._intentionalDisconnection = true;

          // No periodic refresh to stop - using WebSocket messages only

          this._disconnectFromWebSocket();
          this._currentSession = null;
          this._updateState({
            isActive: false,
            users: [],
            currentPresenterEmail: null,
            pendingPresenterRequests: [],
            sessionInfo: null,
            existingSessionAvailable: null,
          });

          // Show session ended notification even on error
          this._notificationService.showSessionEvent('ended').subscribe();

          return throwError(() => error);
        }),
      );
  }

  /**
   * Invite a user to the collaboration session
   * @param email The email of the user to invite
   * @param permission The permission to assign to the user
   * @returns Observable<boolean> indicating success or failure
   */
  public inviteUser(email: string, permission: 'writer' | 'reader'): Observable<boolean> {
    this._logger.info('Inviting user to collaboration session', { email, permission });

    // In a real implementation, this would send an invitation to the server
    // The server would then update the participants list via WebSocket
    // We should NOT modify the local state here

    return new Observable<boolean>(observer => {
      // Simulate API call to invite user
      setTimeout(() => {
        // Just return success - the participants list will be updated via WebSocket
        observer.next(true);
        observer.complete();
      }, 500);
    });
  }

  /**
   * Remove a user from the collaboration session
   * @param userEmail The email of the user to remove
   * @returns Observable<boolean> indicating success or failure
   */
  public removeUser(userEmail: string): Observable<boolean> {
    this._logger.info('Removing user from collaboration session', { userEmail });

    // In a real implementation, this would notify the server to remove the user
    // The server would then update the participants list via WebSocket
    // We should NOT modify the local state here

    return new Observable<boolean>(observer => {
      // Simulate API call to remove user
      // Just return success - the participants list will be updated via WebSocket
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Update a user's permission in the collaboration session (host only)
   * @param userEmail The email of the user to update
   * @param permission The new permission to assign
   * @returns Observable<boolean> indicating success or failure
   */
  public updateUserPermission(
    userEmail: string,
    permission: 'writer' | 'reader',
  ): Observable<boolean> {
    this._logger.info('Updating user permission in collaboration session', {
      userEmail,
      permission,
    });

    if (!this.isCurrentUserHost()) {
      return throwError(() => new Error('Only host can update user permissions'));
    }

    // In a real implementation, this would notify the server to update the user's permission
    // The server would then update the participants list via WebSocket
    // We should NOT modify the local state here

    return new Observable<boolean>(observer => {
      // Simulate API call to update permission
      // Just return success - the participants list will be updated via WebSocket
      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Add a participant to the collaboration session
   * @param userEmail The user email
   * @param permission The user's permission level
   * @deprecated This method should not be used - participants are managed via WebSocket messages only
   */
  public addParticipant(userEmail: string, permission: 'reader' | 'writer' = 'reader'): void {
    this._logger.warn(
      'addParticipant called but participants should only be updated via WebSocket messages',
      {
        userEmail,
        permission,
      },
    );
    // Do not modify local state - wait for server update
  }

  /**
   * Remove a participant from the collaboration session
   * @param userEmail The user email to remove
   * @deprecated This method should not be used - participants are managed via WebSocket messages only
   */
  public removeParticipant(userEmail: string): void {
    this._logger.warn(
      'removeParticipant called but participants should only be updated via WebSocket messages',
      {
        userEmail,
      },
    );
    // Do not modify local state - wait for server update
  }

  /**
   * Update all participants from a bulk update message
   * This replaces the entire participant list with the new data
   * @param participants Array of participant information
   * @param host Optional host ID
   * @param currentPresenter Optional current presenter ID
   */
  public updateAllParticipants(
    participants: Array<{
      user: {
        user_id: string;
        displayName: string;
        email: string;
      };
      permissions: 'reader' | 'writer' | 'owner';
      last_activity: string;
    }>,
    host?: string,
    currentPresenter?: string | null,
  ): void {
    // Log current user info for debugging
    const currentUserEmail = this.getCurrentUserEmail();

    this._logger.info('updateAllParticipants called', {
      participantCount: participants.length,
      participants: participants,
      host,
      currentPresenter,
      isCollaborating: this._collaborationState$.value.isActive,
      currentUserEmail,
    });

    // Build the new participant list
    const updatedUsers: CollaborationUser[] = participants.map(participant => {
      const isHost = participant.user.email === host;
      const isPresenter = participant.user.email === currentPresenter;

      this._logger.debug('Participant comparison', {
        participantEmail: participant.user.email,
        host,
        currentPresenter,
        isHost,
        isPresenter,
      });

      return {
        name: participant.user.displayName,
        email: participant.user.email,
        permission: participant.permissions === 'owner' ? 'writer' : participant.permissions, // Map owner to writer for UI
        status: 'active' as const,
        isPresenter,
        isHost,
        lastActivity: new Date(participant.last_activity),
        presenterRequestState: isPresenter ? 'presenter' : ('hand_down' as const),
      };
    });

    // Update the participant list and presenter state atomically
    const stateUpdate: Partial<CollaborationState> = {
      users: updatedUsers,
      // Ensure collaboration is marked as active when we have participants
      isActive: true,
    };

    if (currentPresenter !== undefined) {
      stateUpdate.currentPresenterEmail = currentPresenter;
    }

    this._updateState(stateUpdate);

    this._logger.debug('DfdCollaborationService: Updated collaboration state', {
      userCount: updatedUsers.length,
      users: updatedUsers,
      isActive: this._collaborationState$.value.isActive,
      currentPresenter,
    });

    this._logger.info('Bulk participant update applied', {
      participantCount: participants.length,
      host,
      currentPresenter,
      updatedUsers: updatedUsers.map(u => ({
        name: u.name,
        email: u.email,
        permission: u.permission,
        isHost: u.isHost,
        isPresenter: u.isPresenter,
      })),
    });
  }

  /**
   * Get the current user's permission in the collaboration session
   * @returns The current user's permission, or null if not in a session
   */
  public getCurrentUserPermission(): 'writer' | 'reader' | null {
    if (!this._collaborationState$.value.isActive) {
      return null;
    }

    const users = this._collaborationState$.value.users;
    const currentUserEmail = this.getCurrentUserEmail();
    const currentUser = users.find(user => user.email === currentUserEmail);

    this._logger.debug('Getting current user permission', {
      currentUserEmail,
      users: users.map(u => ({ email: u.email, permission: u.permission })),
      currentUser: currentUser
        ? { email: currentUser.email, permission: currentUser.permission }
        : null,
      isCollaborating: this._collaborationState$.value.isActive,
    });

    return currentUser ? currentUser.permission : null;
  }

  /**
   * Check if collaboration users have been loaded
   * @returns boolean indicating if user list has been populated
   */
  public hasLoadedUsers(): boolean {
    return this._collaborationState$.value.users.length > 0;
  }

  /**
   * Check if the current user has a specific permission
   * @param permission The permission to check
   * @returns boolean indicating if the user has the permission
   */
  public hasPermission(permission: 'edit' | 'manageSession'): boolean {
    const userPermission = this.getCurrentUserPermission();

    if (!userPermission) {
      // If we're collaborating but don't have permission info yet, check if we're still loading
      if (
        this._collaborationState$.value.isActive &&
        this._collaborationState$.value.users.length === 0
      ) {
        this._logger.warn(
          'Permission check attempted before user list loaded - will use threat model permission as fallback',
          {
            permission,
            isCollaborating: this._collaborationState$.value.isActive,
            userCount: this._collaborationState$.value.users.length,
          },
        );
      }
      return false;
    }

    switch (permission) {
      case 'edit':
        return userPermission === 'writer'; // Only writers can edit
      case 'manageSession':
        return this.isCurrentUserHost(); // Only host can manage session
      default:
        return false;
    }
  }

  /**
   * Check if the current user is the host (created the session)
   * @returns boolean indicating if the current user is the host
   */
  public isCurrentUserHost(): boolean {
    // Check the users list directly without requiring isActive
    // This allows the host status to be determined even during session initialization
    const users = this._collaborationState$.value.users;
    const currentUserEmail = this.getCurrentUserEmail();

    if (!currentUserEmail) {
      return false;
    }

    const currentUser = users.find(user => user.email === currentUserEmail);
    return currentUser?.isHost || false;
  }

  /**
   * Check if a specific user is the current user
   * @param userEmail The user email to check
   * @returns boolean indicating if this is the current user
   */
  public isCurrentUser(userEmail: string): boolean {
    const currentUserEmail = this.getCurrentUserEmail();
    return !!currentUserEmail && userEmail === currentUserEmail;
  }

  /**
   * Get the current user's email
   * @returns The current user's email or null if not authenticated
   */
  public getCurrentUserEmail(): string | null {
    return this._authService.userEmail || null;
  }

  /**
   * Check if the current user is the presenter
   * @returns boolean indicating if current user is presenter
   */
  public isCurrentUserPresenter(): boolean {
    const users = this._collaborationState$.value.users;
    const currentUserEmail = this.getCurrentUserEmail();
    const currentUser = users.find(user => user.email === currentUserEmail);

    return currentUser?.isPresenter || false;
  }

  /**
   * Get current collaboration status
   * @returns boolean indicating if currently collaborating
   */
  public isCollaborating(): boolean {
    return this._collaborationState$.value.isActive;
  }

  /**
   * Get the current presenter's email
   * @returns The presenter's email or null if no presenter
   */
  public getCurrentPresenterEmail(): string | null {
    return this._collaborationState$.value.currentPresenterEmail;
  }

  /**
   * Request presenter privileges (for non-owners)
   * @returns Observable<boolean> indicating if request was sent successfully
   */
  public requestPresenterPrivileges(): Observable<boolean> {
    const currentUserEmail = this.getCurrentUserEmail();
    if (!currentUserEmail) {
      return throwError(() => new Error('Current user not identified'));
    }

    if (this.isCurrentUserHost()) {
      // hosts can become presenter immediately
      return this.setPresenter(currentUserEmail);
    }

    this._logger.info('Requesting presenter privileges', { userEmail: currentUserEmail });

    // Update local state to hand_raised
    this.updateUserPresenterRequestState(currentUserEmail, 'hand_raised');

    // Send presenter request via WebSocket
    const userProfile = this._authService.userProfile;
    if (!userProfile) {
      return throwError(() => new Error('User profile not available'));
    }
    return this._webSocketAdapter
      .sendTMIMessage({
        message_type: 'presenter_request',
        user: {
          user_id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.name,
        },
      })
      .pipe(
        map(() => {
          // Show request sent notification
          this._notificationService.showPresenterEvent('requestSent').subscribe();
          return true;
        }),
        catchError((error: unknown) => {
          this._logger.error('Failed to send presenter request', error);
          // Revert state on error
          this.updateUserPresenterRequestState(currentUserEmail, 'hand_down');
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this._notificationService
            .showOperationError('send presenter request', errorMessage)
            .subscribe();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Approve a presenter request (owner only)
   * @param userEmail The user email to approve as presenter
   * @returns Observable<boolean> indicating success
   */
  public approvePresenterRequest(userEmail: string): Observable<boolean> {
    if (!this.isCurrentUserHost()) {
      return throwError(() => new Error('Only host can approve presenter requests'));
    }

    this._logger.info('Approving presenter request', { userEmail });

    // Remove from pending requests
    const pendingRequests = this._collaborationState$.value.pendingPresenterRequests;
    this._updateState({
      pendingPresenterRequests: pendingRequests.filter(email => email !== userEmail),
    });

    return this.setPresenter(userEmail);
  }

  /**
   * Deny a presenter request (owner only)
   * @param userEmail The user email to deny presenter privileges
   * @returns Observable<boolean> indicating success
   */
  public denyPresenterRequest(userEmail: string): Observable<boolean> {
    if (!this.isCurrentUserHost()) {
      return throwError(() => new Error('Only host can deny presenter requests'));
    }

    this._logger.info('Denying presenter request', { userEmail });

    // Remove from pending requests
    const pendingRequests = this._collaborationState$.value.pendingPresenterRequests;
    this._updateState({
      pendingPresenterRequests: pendingRequests.filter(email => email !== userEmail),
    });

    // Send denial via WebSocket
    const userProfile = this._authService.userProfile;
    if (!userProfile) {
      return throwError(() => new Error('User profile not available'));
    }
    return this._webSocketAdapter
      .sendTMIMessage({
        message_type: 'presenter_denied',
        user: {
          user_id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.name,
        },
        target_user: userEmail,
      })
      .pipe(
        map(() => {
          // Show denial notification (for owner)
          this._notificationService.showPresenterEvent('requestDenied').subscribe();
          return true;
        }),
        catchError((error: unknown) => {
          this._logger.error('Failed to send presenter denial', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          this._notificationService
            .showOperationError('deny presenter request', errorMessage)
            .subscribe();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Set presenter (owner only)
   * @param userEmail The user email to set as presenter, or null to clear presenter
   * @returns Observable<boolean> indicating success
   */
  public setPresenter(userEmail: string | null): Observable<boolean> {
    if (!this.isCurrentUserHost()) {
      return throwError(() => new Error('Only host can set presenter'));
    }

    this._logger.info('Setting presenter', { userEmail });

    // Update local state
    this._updateState({ currentPresenterEmail: userEmail });
    this._updateUsersPresenterStatus(userEmail);

    // Send presenter change via WebSocket
    const userProfile = this._authService.userProfile;
    if (!userProfile) {
      return throwError(() => new Error('No user profile available'));
    }

    const message: ChangePresenterMessage = {
      message_type: 'change_presenter',
      user: {
        user_id: userProfile.id,
        email: userProfile.email,
        displayName: userProfile.name,
      },
      new_presenter: userEmail || '', // Empty string if no presenter
    };

    return this._webSocketAdapter.sendTMIMessage(message).pipe(
      map(() => {
        // Show presenter assigned notification
        const currentUserEmail = this.getCurrentUserEmail();
        if (userEmail === currentUserEmail) {
          this._notificationService.showPresenterEvent('assigned').subscribe();
        } else if (userEmail) {
          const user = this._collaborationState$.value.users.find(u => u.email === userEmail);
          this._notificationService
            .showPresenterEvent('assigned', user?.name || userEmail)
            .subscribe();
        } else {
          this._notificationService.showPresenterEvent('cleared').subscribe();
        }
        return true;
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to send presenter update', error);
        // Revert local state on error
        this._updateState({ currentPresenterEmail: null });
        this._updateUsersPresenterStatus(null);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this._notificationService.showOperationError('update presenter', errorMessage).subscribe();
        return throwError(() => error);
      }),
    );
  }

  /**
   * Take back presenter privileges (owner only)
   * @returns Observable<boolean> indicating success
   */
  public takeBackPresenterPrivileges(): Observable<boolean> {
    const currentUserEmail = this.getCurrentUserEmail();
    if (!currentUserEmail) {
      return throwError(() => new Error('Current user not identified'));
    }

    return this.setPresenter(currentUserEmail);
  }

  /**
   * Add a presenter request to pending list
   * @param userEmail The user email requesting presenter privileges
   */
  public addPresenterRequest(userEmail: string): void {
    const pendingRequests = this._collaborationState$.value.pendingPresenterRequests;
    if (!pendingRequests.includes(userEmail)) {
      this._updateState({
        pendingPresenterRequests: [...pendingRequests, userEmail],
      });
    }
  }

  /**
   * Update the current presenter email (for external updates)
   * @param presenterEmail The email of the current presenter
   */
  public updatePresenterEmail(presenterEmail: string | null): void {
    this._updateState({ currentPresenterEmail: presenterEmail });
    this._updateUsersPresenterStatus(presenterEmail);
  }

  /**
   * Update users' presenter status based on current presenter
   * @param presenterEmail The email of the current presenter
   */
  private _updateUsersPresenterStatus(presenterEmail: string | null): void {
    const users = this._collaborationState$.value.users;
    const updatedUsers = users.map(user => ({
      ...user,
      isPresenter: user.email === presenterEmail,
      // Update presenter request state based on new presenter
      presenterRequestState:
        user.email === presenterEmail ? ('presenter' as const) : ('hand_down' as const),
    }));
    this._updateState({ users: updatedUsers });
  }

  /**
   * Update a user's presenter request state
   * @param userEmail The user email to update
   * @param state The new presenter request state
   */
  public updateUserPresenterRequestState(
    userEmail: string,
    state: 'hand_down' | 'hand_raised' | 'presenter',
  ): void {
    const users = this._collaborationState$.value.users;
    const updatedUsers = users.map(user => {
      if (user.email === userEmail) {
        return { ...user, presenterRequestState: state };
      }
      return user;
    });
    this._updateState({ users: updatedUsers });
  }

  /**
   * Connect to WebSocket for real-time collaboration
   * @param websocketUrl The WebSocket URL provided by the API
   */
  private _connectToWebSocket(websocketUrl: string): void {
    const fullWebSocketUrl = this._getFullWebSocketUrl(websocketUrl);
    this._logger.info('Connecting to collaboration WebSocket', {
      originalUrl: websocketUrl,
      fullUrl: fullWebSocketUrl,
    });

    this._webSocketAdapter.connect(fullWebSocketUrl).subscribe({
      next: () => {
        this._logger.info('WebSocket connection established successfully');
        // The server handles participant tracking when the WebSocket connection is established
        // Client should not send join messages
      },
      error: (error: unknown) => {
        this._logger.error('Failed to connect to WebSocket', error);

        // Type guard for error object
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to connect to collaboration server';
        const errorObj = error as { type?: string; message?: string } | undefined;

        this._notificationService
          .showWebSocketError(
            {
              type: (errorObj?.type as WebSocketErrorType) || 'connection_failed',
              message: errorMessage,
              originalError: error,
              isRecoverable: true,
              retryable: true,
            },
            () => this._retryWebSocketConnection(),
          )
          .subscribe();
      },
    });
  }

  /**
   * Convert relative WebSocket URL from server to absolute URL pointing to API server
   * @param websocketUrl The WebSocket URL (may be relative or absolute)
   * @returns Full WebSocket URL with JWT token as query parameter
   */
  private _getFullWebSocketUrl(websocketUrl: string): string {
    let fullUrl: string;

    // If already absolute, use as-is
    if (websocketUrl.startsWith('ws://') || websocketUrl.startsWith('wss://')) {
      fullUrl = websocketUrl;
    } else {
      // Convert HTTP API URL to WebSocket URL
      const apiUrl = environment.apiUrl;
      let wsUrl: string;

      if (apiUrl.startsWith('https://')) {
        wsUrl = apiUrl.replace('https://', 'wss://');
      } else if (apiUrl.startsWith('http://')) {
        wsUrl = apiUrl.replace('http://', 'ws://');
      } else {
        // Default to ws:// for local development
        wsUrl = `ws://${apiUrl}`;
      }

      // Ensure websocketUrl starts with / for proper URL construction
      const path = websocketUrl.startsWith('/') ? websocketUrl : `/${websocketUrl}`;

      fullUrl = `${wsUrl}${path}`;
    }

    // Add JWT token as query parameter for authentication
    const token = this._authService.getStoredToken();
    if (token && token.token) {
      const separator = fullUrl.includes('?') ? '&' : '?';
      fullUrl = `${fullUrl}${separator}token=${encodeURIComponent(token.token)}`;
    } else {
      this._logger.warn('No JWT token available for WebSocket authentication');
    }

    return fullUrl;
  }

  /**
   * Disconnect from WebSocket
   */
  private _disconnectFromWebSocket(): void {
    this._logger.info('Disconnecting from collaboration WebSocket');

    try {
      this._webSocketAdapter.disconnect();
      this._webSocketListenersSetup = false; // Reset flag for next collaboration session
      this._logger.info('WebSocket disconnected and listeners reset');
    } catch (error) {
      this._logger.error('Error disconnecting from WebSocket', error);
    }
  }

  /**
   * Setup WebSocket listeners for connection state and collaboration events
   * Only sets up listeners once and only when collaboration is actually starting
   */
  private _setupWebSocketListeners(): void {
    if (this._webSocketListenersSetup) {
      this._logger.debug('WebSocket listeners already set up, skipping');
      return;
    }

    this._logger.info('Setting up WebSocket listeners for active collaboration session');

    // Listen to connection state changes
    // Skip the initial state (DISCONNECTED) that's emitted immediately upon subscription
    this._subscriptions.add(
      this._webSocketAdapter.connectionState$
        .pipe(
          skip(1), // Skip the initial BehaviorSubject value
        )
        .subscribe((state: WebSocketState) => {
          this._handleWebSocketStateChange(state);
        }),
    );

    // Listen to connection errors
    this._subscriptions.add(
      this._webSocketAdapter.errors$.subscribe(error => {
        this._notificationService
          .showWebSocketError(error, () => this._retryWebSocketConnection())
          .subscribe();
      }),
    );

    // Note: We no longer listen to individual user events here
    // All participant updates come through the TMI participants_update message
    // which is handled by TMIMessageHandlerService

    // Listen to session ended events
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<SessionTerminatedMessage>('session_terminated')
        .subscribe(message => {
          this._handleSessionEnded(message);
        }),
    );

    // NOTE: TMI join/leave events are now handled by TMIMessageHandlerService
    // to avoid duplicate handling and conflicts with local state updates

    // Listen to TMI presenter change events
    this._subscriptions.add(
      this._webSocketAdapter.getTMIMessagesOfType('current_presenter').subscribe(message => {
        this._handleTMIPresenterChanged(
          message as { message_type: string; current_presenter: string },
        );
      }),
    );

    this._webSocketListenersSetup = true;
  }

  /**
   * Handle WebSocket state changes and show appropriate notifications
   * Only shows notifications when there's an active collaboration session
   */
  private _handleWebSocketStateChange(state: WebSocketState): void {
    this._logger.debug('WebSocket state changed', {
      state,
      hasActiveSession: !!this._currentSession,
      intentionalDisconnection: this._intentionalDisconnection,
    });

    // Only show notifications if there's an active collaboration session
    if (!this._currentSession) {
      this._logger.debug(
        'No active collaboration session - suppressing WebSocket state notifications',
      );
      return;
    }

    switch (state) {
      case WebSocketState.CONNECTING:
        this._notificationService.showWebSocketStatus(state).subscribe();
        break;
      case WebSocketState.CONNECTED: {
        this._notificationService.showWebSocketStatus(state).subscribe();
        // The server handles participant tracking when the WebSocket reconnects
        // Client should not send join messages
        break;
      }
      case WebSocketState.DISCONNECTED:
        // Don't show disconnection notification if it was intentional (user leaving/ending session)
        if (this._intentionalDisconnection) {
          this._logger.debug('Intentional disconnection - suppressing notification');
          // Emit session ended event
          this._sessionEndedSubject.next({ reason: 'user_ended' });
          // Reset the flag for next session
          this._intentionalDisconnection = false;
          return;
        }
        // Show notification for unexpected disconnections
        this._notificationService
          .showWebSocketStatus(state, () => this._retryWebSocketConnection())
          .subscribe();
        // Emit session ended event for unexpected disconnection
        this._sessionEndedSubject.next({ reason: 'disconnected' });
        break;
      case WebSocketState.ERROR:
      case WebSocketState.FAILED:
        this._notificationService
          .showWebSocketStatus(state, () => this._retryWebSocketConnection())
          .subscribe();
        // Emit session ended event for errors
        if (this._collaborationState$.value.isActive) {
          this._sessionEndedSubject.next({ reason: 'error' });
        }
        break;
      case WebSocketState.RECONNECTING:
        this._notificationService.showWebSocketStatus(state).subscribe();
        break;
    }
  }

  /**
   * Retry WebSocket connection
   */
  private _retryWebSocketConnection(): void {
    if (this._currentSession?.websocket_url) {
      this._logger.info('Retrying WebSocket connection');
      this._connectToWebSocket(this._currentSession.websocket_url);
    } else {
      this._logger.warn('Cannot retry WebSocket connection - no session URL available');
      this._notificationService
        .showError('Cannot retry connection - no active session')
        .subscribe();
    }
  }

  // Duplicate participant update handlers removed
  // All participant updates now come through updateAllParticipants()
  // which is called by TMIMessageHandlerService when it receives participants_update messages

  /**
   * Handle session ended messages from WebSocket
   */
  private _handleSessionEnded(message: {
    message_type?: string;
    user_id?: string;
    message?: string;
  }): void {
    this._logger.debug('Session ended via WebSocket', message);

    // If current user is not the host and session was ended, redirect to dashboard
    if (!this.isCurrentUserHost() && this._currentSession) {
      this._logger.info('Session ended by host, redirecting other users to dashboard');
      this._cleanupSessionState();
      this._redirectToDashboard();
    }
  }

  // TMI join/leave handlers removed - now handled by TMIMessageHandlerService

  /**
   * Handle TMI presenter changed event
   * Calls REST API to get updated session status and refresh participants list
   */
  private _handleTMIPresenterChanged(message: {
    message_type: string;
    current_presenter: string;
  }): void {
    this._logger.debug('TMI presenter changed event received', message);

    if (!message || !message.current_presenter) {
      this._logger.warn('Invalid TMI presenter changed message received', message);
      return;
    }

    // Update local presenter state
    this._updateState({ currentPresenterEmail: message.current_presenter });
    this._updateUsersPresenterStatus(message.current_presenter);

    // Show notification about presenter change
    const currentUserEmail = this.getCurrentUserEmail();

    if (message.current_presenter === currentUserEmail) {
      this._notificationService.showPresenterEvent('assigned').subscribe();
    } else {
      // Find the user in the participants list to get their display name
      const presenterUser = this._collaborationState$.value.users.find(
        user => user.email === message.current_presenter,
      );
      const displayName = presenterUser?.name || message.current_presenter;
      this._notificationService.showPresenterEvent('assigned', displayName).subscribe();
    }

    // Presenter info will be updated through participants_update WebSocket message
  }

  // REST API refresh methods removed - participants now managed through WebSocket messages only

  /**
   * Clean up session state without API calls
   */
  private _cleanupSessionState(): void {
    // No periodic refresh to stop - using WebSocket messages only

    this._disconnectFromWebSocket();
    this._currentSession = null;
    this._updateState({
      isActive: false,
      users: [],
      currentPresenterEmail: null,
      pendingPresenterRequests: [],
      sessionInfo: null,
    });
  }

  /**
   * Redirect user to dashboard
   */
  private _redirectToDashboard(): void {
    this._router
      .navigate(['/tm'])
      .then(() => {
        this._logger.info('Redirected to dashboard');
      })
      .catch(error => {
        this._logger.error('Failed to redirect to dashboard', error);
      });
  }

  /**
   * Clean up resources and subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('DfdCollaborationService destroying');

    // No periodic refresh to stop - using WebSocket messages only

    this._subscriptions.unsubscribe();

    // End collaboration if active
    if (this._collaborationState$.value.isActive) {
      this.endCollaboration().subscribe({
        error: error => this._logger.error('Error ending collaboration on destroy', error),
      });
    }

    // Complete the session ended subject
    this._sessionEndedSubject.complete();
  }
}
