import { Injectable, OnDestroy, Optional, Inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError, Subscription, Subject } from 'rxjs';
import { map, catchError, tap, skip, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoggerService } from './logger.service';
import { WebSocketAdapter, WebSocketState, WebSocketErrorType } from './websocket.adapter';
import {
  ICollaborationNotificationService,
  COLLABORATION_NOTIFICATION_SERVICE,
  IAuthService,
  IThreatModelService,
  AUTH_SERVICE,
  THREAT_MODEL_SERVICE,
} from '../interfaces';
import { environment } from '../../../environments/environment';
import {
  ChangePresenterRequestMessage,
  RemoveParticipantRequestMessage,
  PresenterRequestMessage,
  PresenterRequestMessageWithUser,
  PresenterDeniedMessage,
  CurrentPresenterMessage,
  Participant,
  User,
  WebSocketErrorMessage,
} from '../types/websocket-message.types';

/**
 * Represents a user in a collaboration session
 */
export interface CollaborationUser {
  provider: string; // OAuth provider (e.g., "google", "github")
  provider_id: string; // Provider-specific user ID - PART OF COMPOSITE KEY
  name: string; // Display name to show in UI
  email: string; // Email address
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
 * User information from the API (Principal-based)
 */
export interface ApiUser {
  principal_type: 'user';
  provider: string;
  provider_id: string;
  display_name: string;
  email?: string;
}

/**
 * Participant from the API
 */
export interface ApiParticipant {
  user: ApiUser;
  last_activity: string;
  role: 'reader' | 'writer' | 'owner';
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
  host: ApiUser;
  presenter?: ApiUser;
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
  isDiagramContextReady: boolean;
  isPresenterModeActive: boolean;
}

/**
 * Service for managing collaboration sessions in the DFD editor
 */
@Injectable({
  providedIn: 'root',
})
export class DfdCollaborationService implements OnDestroy {
  // Instance ID for debugging
  private readonly _instanceId = Math.random().toString(36).substring(7);
  // Unified collaboration state
  private _collaborationState$ = new BehaviorSubject<CollaborationState>({
    isActive: false,
    users: [],
    currentPresenterEmail: null,
    pendingPresenterRequests: [],
    sessionInfo: null,
    existingSessionAvailable: null,
    isPresenterModeActive: false,
    isDiagramContextReady: false, // Always start with false
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
    @Inject(AUTH_SERVICE) private _authService: IAuthService,
    @Inject(THREAT_MODEL_SERVICE) private _threatModelService: IThreatModelService,
    private _webSocketAdapter: WebSocketAdapter,
    @Optional()
    @Inject(COLLABORATION_NOTIFICATION_SERVICE)
    private _notificationService: ICollaborationNotificationService | null,
    private _router: Router,
  ) {
    // this._logger.info('DfdCollaborationService initialized', {
    //   instanceId: this._instanceId,
    // });
    // WebSocket listeners will be set up when collaboration is actually started
  }

  /**
   * Helper method to update collaboration state atomically
   * @param updates Partial state updates to apply
   */
  private _updateState(updates: Partial<CollaborationState>): void {
    const currentState = this._collaborationState$.value;

    // Special handling for isDiagramContextReady - validate it matches actual context
    if ('isDiagramContextReady' in updates) {
      const actuallyReady = !!(this._threatModelId && this._diagramId);
      if (updates.isDiagramContextReady && !actuallyReady) {
        this._logger.warn(
          'Preventing isDiagramContextReady=true when context is not actually set',
          {
            instanceId: this._instanceId,
            requestedReady: updates.isDiagramContextReady,
            actuallyReady,
            threatModelId: this._threatModelId,
            diagramId: this._diagramId,
          },
        );
        updates.isDiagramContextReady = false;
      }
    }

    const newState = { ...currentState, ...updates };

    // Enhanced logging for debugging WebSocket flow
    this._logger.debugComponent('DfdCollaborationService', 'Updating collaboration state', {
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
    this._logger.debugComponent(
      'DfdCollaborationService',
      'About to emit state update via BehaviorSubject',
    );

    // Log detailed user changes if users were updated
    if (updates.users) {
      this._logger.debugComponent('DfdCollaborationService', 'User list updated', {
        timestamp: new Date().toISOString(),
        previousUsers: currentState.users.map(u => ({ email: u.email, name: u.name })),
        newUsers: newState.users.map(u => ({ email: u.email, name: u.name })),
        userCountChange: `${currentState.users.length} -> ${newState.users.length}`,
      });
    }

    this._collaborationState$.next(newState);

    this._logger.debugComponent(
      'DfdCollaborationService',
      'State update complete - emitted to subscribers',
      {
        isActive: newState.isActive,
        userCount: newState.users.length,
        hasSession: !!newState.sessionInfo,
        users: newState.users,
      },
    );
  }

  /**
   * Get the current collaboration state synchronously
   * This is useful for debugging and state verification
   * @returns The current collaboration state
   */
  public getCurrentState(): CollaborationState {
    const currentState = this._collaborationState$.value;
    // this._logger.debugComponent('DfdCollaborationService', 'getCurrentState called', {
    //   isActive: currentState.isActive,
    //   userCount: currentState.users.length,
    //   hasSession: !!currentState.sessionInfo,
    //   timestamp: new Date().toISOString(),
    // });
    return currentState;
  }

  /**
   * Maps AuthService user profile to AsyncAPI User object
   * @param userProfile User profile from AuthService
   * @returns AsyncAPI-compliant User object
   */
  private _mapToAsyncApiUser(userProfile: {
    provider: string;
    provider_id: string;
    email: string;
    display_name: string;
  }): User {
    return {
      principal_type: 'user',
      provider: userProfile.provider,
      provider_id: userProfile.provider_id,
      email: userProfile.email,
      display_name: userProfile.display_name,
    };
  }

  /**
   * Matches a User object from server with current user
   * Uses provider + provider_id first, falls back to email
   * @param user User object from server
   * @returns true if user matches current authenticated user
   */
  private _isCurrentUser(user: User): boolean {
    const currentProfile = this._authService.userProfile;
    if (!currentProfile) {
      return false;
    }

    // Primary: match by provider + provider_id
    if (
      user.provider &&
      user.provider_id &&
      user.provider === currentProfile.provider &&
      user.provider_id === currentProfile.provider_id
    ) {
      return true;
    }

    // Fallback: match by email
    if (user.email && user.email === currentProfile.email) {
      return true;
    }

    return false;
  }

  /**
   * Extracts identifier for user (provider_id with email fallback)
   * @param user User object from server
   * @returns User identifier string
   */
  private _getUserIdentifier(user: User): string {
    return user.provider_id || user.email || 'unknown';
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
    // this._logger.info('setDiagramContext called', {
    //   instanceId: this._instanceId,
    //   newThreatModelId: threatModelId,
    //   newDiagramId: diagramId,
    //   previousThreatModelId: this._threatModelId,
    //   previousDiagramId: this._diagramId,
    //   currentContextReady: this._collaborationState$.value.isDiagramContextReady,
    // });

    this._threatModelId = threatModelId;
    this._diagramId = diagramId;

    // Update state to indicate context is ready
    if (threatModelId && diagramId) {
      // this._logger.info('Setting isDiagramContextReady to true');
      this._updateState({ isDiagramContextReady: true });
    } else {
      this._logger.warn('Context values are null/empty, not setting ready flag', {
        threatModelId,
        diagramId,
      });
    }
  }

  /**
   * Check if the diagram context is set
   * @returns true if both threatModelId and diagramId are set
   */
  isDiagramContextSet(): boolean {
    const isSet = !!(this._threatModelId && this._diagramId);
    const stateReady = this._collaborationState$.value.isDiagramContextReady;

    // Log any mismatch between actual context and state
    if (isSet !== stateReady) {
      this._logger.warn('Context mismatch detected in isDiagramContextSet', {
        instanceId: this._instanceId,
        isSet,
        stateReady,
        threatModelId: this._threatModelId,
        diagramId: this._diagramId,
      });
    }

    return isSet;
  }

  /**
   * Get the current diagram context
   * @returns object with threatModelId and diagramId
   */
  getDiagramContext(): { threatModelId: string | null; diagramId: string | null } {
    return {
      threatModelId: this._threatModelId,
      diagramId: this._diagramId,
    };
  }

  /**
   * Check if the diagram context is ready (from state)
   * @returns true if the state indicates context is ready
   */
  isDiagramContextReady(): boolean {
    return this._collaborationState$.value.isDiagramContextReady;
  }

  /**
   * Clear the diagram context
   * This should be called when navigating away from the DFD editor
   */
  clearDiagramContext(): void {
    this._logger.info('clearDiagramContext called', {
      instanceId: this._instanceId,
      previousThreatModelId: this._threatModelId,
      previousDiagramId: this._diagramId,
    });

    this._threatModelId = null;
    this._diagramId = null;

    // Update state to indicate context is no longer ready
    this._updateState({ isDiagramContextReady: false });
  }

  /**
   * Reset the entire collaboration state
   * This ensures a clean state when needed
   */
  resetState(): void {
    this._logger.info('resetState called', {
      instanceId: this._instanceId,
    });

    this._threatModelId = null;
    this._diagramId = null;
    this._currentSession = null;

    // Reset to initial state
    this._collaborationState$.next({
      isActive: false,
      users: [],
      currentPresenterEmail: null,
      pendingPresenterRequests: [],
      sessionInfo: null,
      existingSessionAvailable: null,
      isPresenterModeActive: false,
      isDiagramContextReady: false,
    });
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
    return currentUserEmail === existingSession.host?.email;
  }

  /**
   * Join an existing collaboration session by connecting to WebSocket
   * @returns Observable<boolean> indicating success or failure
   */
  public joinCollaboration(): Observable<boolean> {
    this._logger.info('Joining existing collaboration session by connecting to WebSocket');

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

    // Get existing session from state (should have been set by checkForExistingSession)
    const existingSession = this._collaborationState$.value.existingSessionAvailable;
    if (!existingSession) {
      this._logger.error('No existing session available to join');
      return throwError(() => new Error('No existing session available to join'));
    }

    this._logger.info('Joining existing session', {
      sessionId: existingSession.session_id,
      threatModelId: existingSession.threat_model_id,
      diagramId: existingSession.diagram_id,
      websocketUrl: existingSession.websocket_url,
    });

    // Store the session
    this._currentSession = existingSession;

    // Initialize with current user immediately to ensure UI shows at least one participant
    const currentUserEmail = this.getCurrentUserEmail();
    const currentUserProvider = this._authService.userIdp;
    const currentUserProviderId = this._authService.providerId;
    const isCurrentUserPresenter = currentUserEmail === existingSession.presenter?.email;
    const initialUser: CollaborationUser = {
      provider: currentUserProvider,
      provider_id: currentUserProviderId,
      name: this._authService.userProfile?.display_name || '',
      email: currentUserEmail || '',
      permission: 'writer', // Will be updated from WebSocket messages
      status: 'active',
      isHost: currentUserEmail === existingSession.host?.email,
      isPresenter: isCurrentUserPresenter,
      lastActivity: new Date(),
      presenterRequestState: isCurrentUserPresenter ? 'presenter' : 'hand_down',
    };

    // Update collaboration state atomically
    this._updateState({
      isActive: true,
      users: [initialUser],
      sessionInfo: existingSession,
      existingSessionAvailable: null,
      currentPresenterEmail: existingSession.presenter?.email || null,
    });

    // Set up WebSocket listeners before connecting
    this._setupWebSocketListeners();

    // Connect to WebSocket and wait for connection to be established
    return this._connectToWebSocket(existingSession.websocket_url).pipe(
      tap(() => {
        // Show session joined notification
        this._notificationService?.showSessionEvent('userJoined').subscribe();
      }),
      map(() => true),
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

          this._logger.debugComponent(
            'DfdCollaborationService',
            'Smart collaboration handler succeeded',
            {
              sessionId: session.session_id,
              threatModelId: session.threat_model_id,
              diagramId: session.diagram_id,
              websocketUrl: session.websocket_url,
              isNewSession: result.isNewSession,
            },
          );

          // Store the session
          this._currentSession = session;

          // Initialize with current user immediately to ensure UI shows at least one participant
          const currentUserEmail = this.getCurrentUserEmail();
          const currentUserProvider = this._authService.userIdp;
          const currentUserProviderId = this._authService.providerId;
          const isCurrentUserPresenter = currentUserEmail === session.presenter?.email;
          const initialUser: CollaborationUser = {
            provider: currentUserProvider,
            provider_id: currentUserProviderId,
            name: this._authService.userProfile?.display_name || '',
            email: currentUserEmail || '',
            permission: 'writer',
            status: 'active',
            isHost: currentUserEmail === session.host?.email, // Check if current user is the host from session data
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
            currentPresenterEmail: session.presenter?.email || null,
          });

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();
        }),
        // Connect to WebSocket and wait for connection to be established
        switchMap((result: { session: CollaborationSession; isNewSession: boolean }) => {
          return this._connectToWebSocket(result.session.websocket_url).pipe(map(() => result));
        }),
        // No longer ensuring user in participant list via REST API
        // Participants will be managed through WebSocket messages only
        tap((result: { isNewSession: boolean }) => {
          // Show appropriate notification based on whether session was created or joined
          if (result.isNewSession) {
            this._notificationService?.showSessionEvent('started').subscribe();
          } else {
            this._notificationService?.showSessionEvent('userJoined').subscribe();
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
            isPresenterModeActive: false,
          });

          // Show session ended notification
          this._notificationService?.showSessionEvent('ended').subscribe();

          // Navigate back to threat model edit page (as specified in requirements)
          this._redirectToThreatModel();
        }),
        map(() => true),
        catchError((error: unknown) => {
          this._logger.error('Failed to end collaboration session', error);

          // Even if API call fails, clean up local state
          // Mark as intentional disconnection to suppress notification
          this._intentionalDisconnection = true;

          this._disconnectFromWebSocket();
          this._currentSession = null;
          this._updateState({
            isActive: false,
            users: [],
            currentPresenterEmail: null,
            pendingPresenterRequests: [],
            sessionInfo: null,
            existingSessionAvailable: null,
            isPresenterModeActive: false,
          });

          // Show session ended notification even on error
          this._notificationService?.showSessionEvent('ended').subscribe();

          // Navigate back to threat model edit page even on error
          this._redirectToThreatModel();

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
   * @param user The user to remove (must include provider_id and email)
   * @returns Observable<boolean> indicating success or failure
   */
  public removeUser(user: {
    provider_id: string;
    email: string;
    name?: string;
    provider?: string;
  }): Observable<boolean> {
    this._logger.info('Removing user from collaboration session', {
      provider_id: user.provider_id,
      email: user.email,
    });

    // Only the host can remove users
    if (!this.isCurrentUserHost()) {
      return throwError(() => new Error('Only host can remove users from session'));
    }

    // Send remove participant request message via WebSocket
    // Client-to-server request - no initiating_user field (server uses authenticated context)
    const removeMessage: RemoveParticipantRequestMessage = {
      message_type: 'remove_participant_request',
      removed_user: {
        principal_type: 'user',
        provider: user.provider || 'unknown',
        provider_id: user.provider_id,
        email: user.email,
        display_name: user.name || user.email,
      },
    };

    return this._webSocketAdapter.sendTMIMessage(removeMessage).pipe(
      map(() => {
        this._logger.info('Remove participant message sent successfully', {
          provider_id: user.provider_id,
          email: user.email,
        });
        return true;
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to send remove participant message', {
          error,
          provider_id: user.provider_id,
          email: user.email,
        });
        return throwError(() => error);
      }),
    );
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
   * Update all participants from a bulk update message
   * This replaces the entire participant list with the new data
   * @param participants Array of participant information
   * @param host Optional host User object
   * @param currentPresenter Optional current presenter User object (null if no presenter)
   */
  public updateAllParticipants(
    participants: Participant[],
    host?: User,
    currentPresenter?: User | null,
  ): void {
    // Log current user info for debugging
    const currentUserEmail = this.getCurrentUserEmail();

    this._logger.debugComponent('DfdCollaborationService', 'updateAllParticipants called', {
      participantCount: participants.length,
      participants: participants,
      host,
      currentPresenter,
      isCollaborating: this._collaborationState$.value.isActive,
      currentUserEmail,
    });

    // Build the new participant list
    const updatedUsers: CollaborationUser[] = participants.map(participant => {
      // Compare using user_id (both should have provider info but user_id is the primary key)
      const isHost = host ? this._usersMatch(participant.user, host) : false;
      const isPresenter = currentPresenter
        ? this._usersMatch(participant.user, currentPresenter)
        : false;
      // Handle both 'name' (AsyncAPI) and 'display_name' (OpenAPI) field names for compatibility
      const displayName =
        participant.user.name || participant.user.display_name || participant.user.email;

      this._logger.debugComponent('DfdCollaborationService', 'Participant comparison', {
        participantProviderId: participant.user.provider_id,
        participantProvider: participant.user.provider,
        participantEmail: participant.user.email,
        participantName: participant.user.name,
        participantDisplayName: participant.user.display_name,
        resolvedDisplayName: displayName,
        hostProviderId: host?.provider_id,
        hostProvider: host?.provider,
        presenterProviderId: currentPresenter?.provider_id,
        presenterProvider: currentPresenter?.provider,
        isHost,
        isPresenter,
      });

      return {
        provider: participant.user.provider || 'unknown', // Fallback for missing provider
        provider_id: participant.user.provider_id, // AsyncAPI spec uses provider_id in participants_update
        name: displayName, // Use resolved display name with fallback
        email: participant.user.email,
        permission: participant.permissions,
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

    // Store presenter email for backwards compatibility with UI
    if (currentPresenter !== undefined) {
      stateUpdate.currentPresenterEmail = currentPresenter?.email ?? null;
    }

    this._updateState(stateUpdate);

    this._logger.debugComponent('DfdCollaborationService', 'Updated collaboration state', {
      userCount: updatedUsers.length,
      users: updatedUsers,
      isActive: this._collaborationState$.value.isActive,
      currentPresenterEmail: currentPresenter?.email,
    });

    this._logger.debugComponent('DfdCollaborationService', 'Bulk participant update applied', {
      participantCount: participants.length,
      host: host
        ? { provider_id: host.provider_id, provider: host.provider, email: host.email }
        : null,
      currentPresenter: currentPresenter
        ? {
            provider_id: currentPresenter.provider_id,
            provider: currentPresenter.provider,
            email: currentPresenter.email,
          }
        : null,
      updatedUsers: updatedUsers.map(u => ({
        compositeKey: `${u.provider}:${u.provider_id}`,
        name: u.name,
        email: u.email,
        permission: u.permission,
        isHost: u.isHost,
        isPresenter: u.isPresenter,
      })),
    });
  }

  /**
   * Compare two user objects for identity
   * Uses provider + provider_id as primary key, falls back to email comparison
   */
  private _usersMatch(
    user1: { provider?: string; provider_id?: string; email?: string },
    user2: { provider?: string; provider_id?: string; email?: string },
  ): boolean {
    // Primary comparison: provider + provider_id
    if (user1.provider && user2.provider && user1.provider_id && user2.provider_id) {
      return user1.provider === user2.provider && user1.provider_id === user2.provider_id;
    }
    // Fallback: just provider_id comparison (for cases where provider might be missing)
    if (user1.provider_id && user2.provider_id) {
      return user1.provider_id === user2.provider_id;
    }
    // Last resort: email comparison
    if (user1.email && user2.email) {
      return user1.email === user2.email;
    }
    return false;
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
    const currentUserProvider = this._authService.userIdp;
    const currentUserProviderId = this._authService.providerId;
    const currentUserEmail = this._authService.userEmail;

    // Try multiple matching strategies to find the current user
    // 1. Try exact match on provider AND provider_id (ideal case)
    let currentUser = users.find(
      user => user.provider === currentUserProvider && user.provider_id === currentUserProviderId,
    );

    // 2. Fall back to matching just provider_id (handles edge cases)
    if (!currentUser && currentUserProviderId) {
      currentUser = users.find(user => user.provider_id === currentUserProviderId);
    }

    // 3. Last resort: match by email
    if (!currentUser && currentUserEmail) {
      currentUser = users.find(user => user.email === currentUserEmail);
    }

    this._logger.debugComponent('DfdCollaborationService', 'Getting current user permission', {
      currentUserKey: `${currentUserProvider}:${currentUserProviderId}`,
      users: users.map(u => ({
        compositeKey: `${u.provider}:${u.provider_id}`,
        email: u.email,
        permission: u.permission,
      })),
      foundCurrentUser: currentUser
        ? {
            compositeKey: `${currentUser.provider}:${currentUser.provider_id}`,
            email: currentUser.email,
            permission: currentUser.permission,
          }
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
    const currentUserProvider = this._authService.userIdp;
    const currentUserProviderId = this._authService.providerId;
    const currentUserEmail = this._authService.userEmail;

    if (!currentUserProviderId && !currentUserEmail) {
      return false;
    }

    // Try multiple matching strategies to find the current user
    // 1. Try exact match on provider AND provider_id (ideal case)
    let currentUser = users.find(
      user => user.provider === currentUserProvider && user.provider_id === currentUserProviderId,
    );

    // 2. Fall back to matching just provider_id (handles edge cases)
    if (!currentUser && currentUserProviderId) {
      currentUser = users.find(user => user.provider_id === currentUserProviderId);
    }

    // 3. Last resort: match by email
    if (!currentUser && currentUserEmail) {
      currentUser = users.find(user => user.email === currentUserEmail);
    }

    return currentUser?.isHost || false;
  }

  /**
   * Check if a specific user is the current user (by composite key)
   * @param userId The user ID to check
   * @returns boolean indicating if this is the current user
   */
  public isCurrentUser(userId: string): boolean {
    const currentUserId = this.getCurrentUserId();
    return !!currentUserId && userId === currentUserId;
  }

  /**
   * Get the current user's ID
   * @returns The current user's ID or null if not authenticated
   */
  public getCurrentUserId(): string | null {
    return this._authService.userProfile?.provider_id || null;
  }

  /**
   * Get the current user's email
   * @returns The current user's email or null if not authenticated
   */
  public getCurrentUserEmail(): string | null {
    return this._authService.userEmail || null;
  }

  /**
   * Get current collaboration status
   * @returns boolean indicating if currently collaborating
   */
  public isCollaborating(): boolean {
    return this._collaborationState$.value.isActive;
  }

  /**
   * Toggle collaboration: start/join if not active, end (host) or leave (participant) if active.
   * Returns Observable<boolean> indicating success. Emits an error if the diagram context is not set.
   */
  public toggleCollaboration(): Observable<boolean> {
    if (!this.isDiagramContextSet()) {
      this._logger.error('Cannot toggle collaboration: diagram context not ready', {
        context: this.getDiagramContext(),
      });
      return throwError(() => new Error('Diagram context not ready'));
    }

    if (this.isCollaborating()) {
      return this.isCurrentUserHost() ? this.endCollaboration() : this.leaveSession();
    }

    return this.startOrJoinCollaboration();
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
    // Per AsyncAPI schema, presenter_request should not include user field when sent by client
    // The server will add it when broadcasting to host
    const requestMessage: PresenterRequestMessage = {
      message_type: 'presenter_request',
    };
    return this._webSocketAdapter.sendTMIMessage(requestMessage).pipe(
      map(() => {
        // Show request sent notification
        this._notificationService?.showPresenterEvent('requestSent').subscribe();
        return true;
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to send presenter request', error);
        // Revert state on error
        this.updateUserPresenterRequestState(currentUserEmail, 'hand_down');
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this._notificationService
          ?.showOperationError('send presenter request', errorMessage)
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
    // Per AsyncAPI schema, presenter_denied should include current_presenter User object
    const denyMessage: PresenterDeniedMessage = {
      message_type: 'presenter_denied',
      current_presenter: this._mapToAsyncApiUser(userProfile),
    };
    return this._webSocketAdapter.sendTMIMessage(denyMessage).pipe(
      map(() => {
        // Show denial notification (for owner)
        this._notificationService?.showPresenterEvent('requestDenied').subscribe();
        return true;
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to send presenter denial', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this._notificationService
          ?.showOperationError('deny presenter request', errorMessage)
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

    // Send presenter change request via WebSocket
    // Client-to-server request - no initiating_user field (server uses authenticated context)
    const newPresenterUser = userEmail
      ? this._collaborationState$.value.users.find(u => u.email === userEmail)
      : null;

    const message: ChangePresenterRequestMessage = {
      message_type: 'change_presenter_request',
      new_presenter: newPresenterUser
        ? {
            principal_type: 'user',
            provider: newPresenterUser.provider,
            provider_id: newPresenterUser.provider_id,
            email: newPresenterUser.email,
            display_name: newPresenterUser.name,
          }
        : undefined,
    };

    return this._webSocketAdapter.sendTMIMessage(message).pipe(
      map(() => {
        // Show presenter assigned notification
        const currentUserEmail = this.getCurrentUserEmail();
        if (userEmail === currentUserEmail) {
          this._notificationService?.showPresenterEvent('assigned').subscribe();
        } else if (userEmail) {
          const user = this._collaborationState$.value.users.find(u => u.email === userEmail);
          this._notificationService
            ?.showPresenterEvent('assigned', user?.name || userEmail)
            .subscribe();
        } else {
          this._notificationService?.showPresenterEvent('cleared').subscribe();
        }
        return true;
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to send presenter update', error);
        // Revert local state on error
        this._updateState({ currentPresenterEmail: null });
        this._updateUsersPresenterStatus(null);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this._notificationService?.showOperationError('update presenter', errorMessage).subscribe();
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
   * Toggle presenter mode on/off for the current presenter
   * Only the current presenter can toggle their own presenter mode
   * When turning off presenter mode, sends an empty selection message to clear all participants' selections
   * @returns true if presenter mode is now active, false if deactivated
   */
  public togglePresenterMode(): boolean {
    const currentState = this._collaborationState$.value;
    const currentUserEmail = this.getCurrentUserEmail();

    // Only allow current presenter to toggle presenter mode
    if (currentState.currentPresenterEmail !== currentUserEmail) {
      this._logger.warn('Only the current presenter can toggle presenter mode', {
        currentPresenter: currentState.currentPresenterEmail,
        currentUser: currentUserEmail,
      });
      return currentState.isPresenterModeActive;
    }

    const newPresenterModeState = !currentState.isPresenterModeActive;
    this._updateState({ isPresenterModeActive: newPresenterModeState });

    // When turning off presenter mode, clear all participants' selections
    if (!newPresenterModeState) {
      const userProfile = this._authService.userProfile;
      if (userProfile) {
        const clearSelectionMessage = {
          message_type: 'presenter_selection' as const,
          selected_cells: [], // Empty array clears all participants' selections
        };

        this._webSocketAdapter.sendTMIMessage(clearSelectionMessage).subscribe({
          next: () => {
            this._logger.info('Sent clear selection message to all participants');
          },
          error: error => {
            this._logger.error('Failed to send clear selection message', error);
          },
        });
      }
    }

    this._logger.info('Presenter mode toggled', {
      isActive: newPresenterModeState,
      presenter: currentUserEmail,
    });

    return newPresenterModeState;
  }

  /**
   * Check if the current user is the presenter and presenter mode is active
   * @returns true if current user is presenter and presenter mode is active
   */
  public isCurrentUserPresenterModeActive(): boolean {
    const currentState = this._collaborationState$.value;
    const currentUserEmail = this.getCurrentUserEmail();

    return (
      currentState.currentPresenterEmail === currentUserEmail && currentState.isPresenterModeActive
    );
  }

  /**
   * Check if the current user is the presenter (regardless of presenter mode state)
   * @returns true if current user is the presenter
   */
  public isCurrentUserPresenter(): boolean {
    const currentState = this._collaborationState$.value;
    const currentUserEmail = this.getCurrentUserEmail();

    return currentState.currentPresenterEmail === currentUserEmail;
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
  private _connectToWebSocket(websocketUrl: string): Observable<void> {
    const fullWebSocketUrl = this._getFullWebSocketUrl(websocketUrl);
    this._logger.debugComponent(
      'DfdCollaborationService',
      'Connecting to collaboration WebSocket',
      {
        originalUrl: websocketUrl,
        fullUrl: fullWebSocketUrl,
      },
    );

    return this._webSocketAdapter.connect(fullWebSocketUrl).pipe(
      tap(() => {
        this._logger.info('WebSocket connection established successfully');
        // The server handles participant tracking when the WebSocket connection is established
        // Client should not send join messages
      }),
      catchError((error: unknown) => {
        this._logger.error('Failed to connect to WebSocket', error);

        // Type guard for error object
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to connect to collaboration server';
        const errorObj = error as { type?: string; message?: string } | undefined;

        this._notificationService
          ?.showWebSocketError(
            {
              type: (errorObj?.type as WebSocketErrorType) || 'connection_failed',
              message: errorMessage,
              originalError: error,
              isRecoverable: true,
              retryable: true,
            },
            // () => this._retryWebSocketConnection(), // COMMENTED OUT
          )
          .subscribe();

        return throwError(() => error);
      }),
    );
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
      this._logger.debugComponent(
        'DfdCollaborationService',
        'WebSocket listeners already set up, skipping',
      );
      return;
    }

    this._logger.debugComponent(
      'DfdCollaborationService',
      'Setting up WebSocket listeners for active collaboration session',
    );

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
          ?.showWebSocketError(error) // , () => this._retryWebSocketConnection()) // COMMENTED OUT
          .subscribe();
      }),
    );

    // All participant updates come through the participants_update message
    // which is handled by WebSocketService

    // Note: session_terminated message has been removed from the spec
    // Session termination is now handled via WebSocket disconnection events

    // Listen to error messages from server
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<WebSocketErrorMessage>('error')
        .subscribe(message => {
          this._handleWebSocketError(message);
        }),
    );

    // NOTE: join/leave events are now handled by WebSocketService
    // to avoid duplicate handling and conflicts with local state updates

    // Listen to TMI presenter change events
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<CurrentPresenterMessage>('current_presenter')
        .subscribe(message => {
          this._handlePresenterChanged(message);
        }),
    );

    // Listen to presenter request events (for host/owner)
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterRequestMessageWithUser>('presenter_request')
        .subscribe(message => {
          this._handlePresenterRequest(message);
        }),
    );

    // Listen to presenter denied events (for participants)
    this._subscriptions.add(
      this._webSocketAdapter
        .getTMIMessagesOfType<PresenterDeniedMessage>('presenter_denied')
        .subscribe(message => {
          this._handlePresenterDenied(message);
        }),
    );

    this._webSocketListenersSetup = true;
  }

  /**
   * Handle WebSocket state changes and show appropriate notifications
   * Only shows notifications when there's an active collaboration session
   */
  private _handleWebSocketStateChange(state: WebSocketState): void {
    this._logger.debugComponent('DfdCollaborationService', 'WebSocket state changed', {
      state,
      hasActiveSession: !!this._currentSession,
      intentionalDisconnection: this._intentionalDisconnection,
    });

    // Only show notifications if there's an active collaboration session
    if (!this._currentSession) {
      this._logger.debugComponent(
        'DfdCollaborationService',
        'No active collaboration session - suppressing WebSocket state notifications',
      );
      return;
    }

    switch (state) {
      case WebSocketState.CONNECTING:
        this._notificationService?.showWebSocketStatus(state).subscribe();
        break;
      case WebSocketState.CONNECTED: {
        this._notificationService?.showWebSocketStatus(state).subscribe();
        // The server handles participant tracking when the WebSocket reconnects
        // Client should not send join messages
        break;
      }
      case WebSocketState.DISCONNECTED:
        // Don't show disconnection notification if it was intentional (user leaving/ending session)
        if (this._intentionalDisconnection) {
          this._logger.debugComponent(
            'DfdCollaborationService',
            'Intentional disconnection - suppressing notification',
          );
          // Emit session ended event
          this._sessionEndedSubject.next({ reason: 'user_ended' });
          // Reset the flag for next session
          this._intentionalDisconnection = false;
          return;
        }
        // Show notification for unexpected disconnections
        this._notificationService
          ?.showWebSocketStatus(state) // , () => this._retryWebSocketConnection()) // COMMENTED OUT
          .subscribe();

        // Clean up collaboration state for unexpected disconnection
        this._logger.info('Unexpected disconnection - cleaning up collaboration state');
        this._cleanupSessionState();

        // Navigate based on user role - host goes to TM editor, participant goes to dashboard
        if (this.isCurrentUserHost()) {
          this._logger.info('Host disconnected unexpectedly - redirecting to threat model editor');
          this._redirectToThreatModel();
        } else {
          this._logger.info('Participant disconnected unexpectedly - redirecting to dashboard');
          this._redirectToDashboard();
        }

        // Emit session ended event for unexpected disconnection
        this._sessionEndedSubject.next({ reason: 'disconnected' });
        break;
      case WebSocketState.ERROR:
      case WebSocketState.FAILED:
        this._notificationService
          ?.showWebSocketStatus(state) // , () => this._retryWebSocketConnection()) // COMMENTED OUT
          .subscribe();

        // Clean up collaboration state for errors
        if (this._collaborationState$.value.isActive) {
          this._logger.info('WebSocket error/failed - cleaning up collaboration state');
          this._cleanupSessionState();

          // Navigate based on user role - host goes to TM editor, participant goes to dashboard
          if (this.isCurrentUserHost()) {
            this._logger.info('Host connection error - redirecting to threat model editor');
            this._redirectToThreatModel();
          } else {
            this._logger.info('Participant connection error - redirecting to dashboard');
            this._redirectToDashboard();
          }

          // Emit session ended event for errors
          this._sessionEndedSubject.next({ reason: 'error' });
        }
        break;
      case WebSocketState.RECONNECTING:
        this._notificationService?.showWebSocketStatus(state).subscribe();
        break;
    }
  }

  /**
   * Retry WebSocket connection
   */
  // MANUAL RETRY METHOD COMMENTED OUT
  // private _retryWebSocketConnection(): void {
  //   if (this._currentSession?.websocket_url) {
  //     this._logger.info('Retrying WebSocket connection');
  //     this._connectToWebSocket(this._currentSession.websocket_url);
  //   } else {
  //     this._logger.warn('Cannot retry WebSocket connection - no session URL available');
  //     this._notificationService
  //       ?.showError('Cannot retry connection - no active session')
  //       .subscribe();
  //   }
  // }

  // Duplicate participant update handlers removed
  // All participant updates now come through updateAllParticipants()
  // which is called by WebSocketService when it receives participants_update messages

  /**
   * Handle error messages from WebSocket
   * Differentiates between fatal errors (require ending session) and non-fatal errors (just notify)
   */
  private _handleWebSocketError(message: WebSocketErrorMessage): void {
    this._logger.error('Collaboration error from server', {
      errorType: message.error,
      errorMessage: message.message,
    });

    // Non-fatal errors: show notification but don't end the session
    // These are errors from operations that failed but don't affect the session itself
    const nonFatalErrors = [
      'invalid_participant', // User not in session (already left, or never joined)
      'permission_denied', // User doesn't have permission for an operation
      'validation_error', // Invalid message format
    ];

    if (nonFatalErrors.includes(message.error)) {
      this._logger.warn('Non-fatal collaboration error - showing notification only', {
        errorType: message.error,
        errorMessage: message.message,
      });

      // Show error notification but keep session active
      this._notificationService
        ?.showOperationError('collaboration', message.message || 'Operation failed')
        .subscribe();
      return;
    }

    // Fatal errors: end the session
    this._logger.error('Fatal collaboration error - ending session', {
      errorType: message.error,
      errorMessage: message.message,
    });

    // Mark as intentional disconnection to prevent "unexpected disconnection" handling
    this._intentionalDisconnection = true;

    // Clean up collaboration state
    this._cleanupSessionState();

    // Show error notification to user
    this._notificationService
      ?.showOperationError('start collaboration', message.message || 'Unknown error')
      .subscribe();

    // Navigate back to threat model editor (user stays in context)
    this._redirectToThreatModel();

    // Emit session ended event
    this._sessionEndedSubject.next({ reason: 'error' });
  }

  // join/leave handlers removed - now handled by WebSocketService

  /**
   * Handle presenter changed event
   * Calls REST API to get updated session status and refresh participants list
   */
  private _handlePresenterChanged(message: CurrentPresenterMessage): void {
    this._logger.debugComponent(
      'DfdCollaborationService',
      'Presenter changed event received',
      message,
    );

    if (!message || !message.current_presenter) {
      this._logger.warn('Invalid presenter changed message received', message);
      return;
    }

    // Extract user_id with email fallback
    const presenterUserId = this._getUserIdentifier(message.current_presenter);
    const initiatingUserId = message.initiating_user
      ? this._getUserIdentifier(message.initiating_user)
      : null;

    this._logger.info('Presenter changed', {
      newPresenter: presenterUserId,
      initiatedBy: initiatingUserId,
    });

    // Update local presenter state
    this._updateState({ currentPresenterEmail: presenterUserId });
    this._updateUsersPresenterStatus(presenterUserId);

    // Show notification about presenter change
    if (this._isCurrentUser(message.current_presenter)) {
      this._notificationService?.showPresenterEvent('assigned').subscribe();
    } else {
      const displayName = message.current_presenter.display_name || presenterUserId;
      this._notificationService?.showPresenterEvent('assigned', displayName).subscribe();
    }

    // Presenter info will be updated through participants_update WebSocket message
  }

  /**
   * Handle presenter request event (host receives this when a participant requests presenter)
   */
  private _handlePresenterRequest(message: PresenterRequestMessageWithUser): void {
    // Defensive: The server should add user field per PresenterRequestMessageWithUser,
    // but we need to handle cases where it's missing
    if (!message.user) {
      this._logger.error(
        'Received presenter_request without user field - server not conforming to expected schema',
        { message },
      );
      return;
    }

    // Extract user identifier with fallback
    const userIdentifier = this._getUserIdentifier(message.user);
    const displayName = message.user.display_name || message.user.email || userIdentifier;

    this._logger.info('Presenter request received', {
      providerId: message.user.provider_id,
      userEmail: message.user.email,
      displayName: displayName,
    });

    // Add to pending requests list (using email for backward compatibility)
    const userEmail = message.user.email || userIdentifier;
    this.addPresenterRequest(userEmail);

    // Update the user's presenterRequestState to 'hand_raised'
    this.updateUserPresenterRequestState(userEmail, 'hand_raised');

    // Show notification with approve/deny actions (host only)
    if (this.isCurrentUserHost()) {
      this._notificationService
        ?.showPresenterRequestReceived(userEmail, displayName)
        .subscribe(action => {
          if (action === 'approve') {
            this.approvePresenterRequest(userEmail).subscribe({
              next: () => {
                this._logger.info('Presenter request approved from notification', {
                  userEmail: userEmail,
                });
              },
              error: error => {
                this._logger.error('Failed to approve presenter request from notification', error);
              },
            });
          } else if (action === 'deny') {
            this.denyPresenterRequest(userEmail).subscribe({
              next: () => {
                this._logger.info('Presenter request denied from notification', {
                  userEmail: userEmail,
                });
              },
              error: error => {
                this._logger.error('Failed to deny presenter request from notification', error);
              },
            });
          }
        });
    }
  }

  /**
   * Handle presenter denied event (participant receives this when their request is denied)
   */
  private _handlePresenterDenied(message: PresenterDeniedMessage): void {
    this._logger.info('Presenter request denied', {
      currentPresenter: message.current_presenter,
    });

    // Per schema, presenter_denied only includes current_presenter (User object)
    // This message is sent only to the requester, so always show notification
    this._notificationService?.showPresenterEvent('requestDenied').subscribe();
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
      isPresenterModeActive: false,
    });
  }

  /**
   * Redirect user to dashboard
   */
  private _redirectToDashboard(): void {
    this._router
      .navigate(['/dashboard'])
      .then(() => {
        this._logger.info('Redirected to dashboard');
      })
      .catch(error => {
        this._logger.error('Failed to redirect to dashboard', error);
      });
  }

  /**
   * Redirect user to threat model edit page
   */
  private _redirectToThreatModel(): void {
    if (this._threatModelId) {
      this._router
        .navigate(['/tm', this._threatModelId])
        .then(() => {
          this._logger.info('Redirected to threat model edit page');
        })
        .catch(error => {
          this._logger.error('Failed to redirect to threat model edit page', error);
        });
    } else {
      this._logger.warn('No threat model ID available, redirecting to dashboard instead');
      this._redirectToDashboard();
    }
  }

  /**
   * Clean up resources and subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('DfdCollaborationService destroying');

    // No periodic refresh to stop - using WebSocket messages only

    this._subscriptions.unsubscribe();

    // Leave collaboration session if active
    if (this._collaborationState$.value.isActive) {
      this.leaveSession().subscribe({
        error: error => this._logger.error('Error leaving collaboration on destroy', error),
      });
    }

    // Complete the session ended subject
    this._sessionEndedSubject.complete();
  }
}
