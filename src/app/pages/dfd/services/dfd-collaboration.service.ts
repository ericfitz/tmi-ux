import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, throwError, Subscription, timer, of } from 'rxjs';
import { map, catchError, tap, skip, switchMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import {
  WebSocketAdapter,
  WebSocketState,
  MessageType,
} from '../infrastructure/adapters/websocket.adapter';
import { DfdNotificationService } from './dfd-notification.service';
import { environment } from '../../../../environments/environment';

/**
 * Represents a user in a collaboration session
 */
export interface CollaborationUser {
  id: string;
  name: string;
  permission: 'writer' | 'reader'; // Based on threat model permissions
  status: 'active' | 'idle' | 'disconnected';
  cursorPosition?: { x: number; y: number };
  isPresenter?: boolean;
  isSessionManager?: boolean; // True for the person who created the session
  lastActivity?: Date;
}

/**
 * Represents a collaboration session from the API
 */
export interface CollaborationSession {
  session_id: string;
  threat_model_id: string;
  diagram_id: string;
  participants: Array<{
    user_id: string;
    joined_at: string;
    permissions?: 'reader' | 'writer';
  }>;
  websocket_url: string;
  session_manager?: string;
}

/**
 * Service for managing collaboration sessions in the DFD editor
 */
@Injectable({
  providedIn: 'root',
})
export class DfdCollaborationService implements OnDestroy {
  // Observable for collaboration status
  private _isCollaborating$ = new BehaviorSubject<boolean>(false);
  public isCollaborating$ = this._isCollaborating$.asObservable();

  // Observable for users in the collaboration session
  private _collaborationUsers$ = new BehaviorSubject<CollaborationUser[]>([]);
  public collaborationUsers$ = this._collaborationUsers$.asObservable();

  // Presenter state tracking
  private _currentPresenterId$ = new BehaviorSubject<string | null>(null);
  public currentPresenterId$ = this._currentPresenterId$.asObservable();

  // Pending presenter requests (for session owners)
  private _pendingPresenterRequests$ = new BehaviorSubject<string[]>([]);
  public pendingPresenterRequests$ = this._pendingPresenterRequests$.asObservable();

  // Existing session available (found but not joined yet)
  private _existingSessionAvailable$ = new BehaviorSubject<CollaborationSession | null>(null);
  public existingSessionAvailable$ = this._existingSessionAvailable$.asObservable();

  // Current session information
  private _currentSession: CollaborationSession | null = null;
  private _threatModelId: string | null = null;
  private _diagramId: string | null = null;

  // Subscription management
  private _subscriptions = new Subscription();
  private _webSocketListenersSetup = false;
  private _intentionalDisconnection = false;

  // Periodic refresh state
  private _refreshTimer: any = null;
  private _refreshBackoffMs = 1000; // Start at 1 second
  private readonly _minRefreshMs = 1000; // Minimum 1 second
  private readonly _maxRefreshMs = 30000; // Maximum 30 seconds

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

    if (this._isCollaborating$.value) {
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
          this._existingSessionAvailable$.next(session);

          if (session) {
            this._logger.info('Found existing collaboration session', {
              sessionId: session.session_id,
              sessionManager: session.session_manager,
              participantCount: session.participants.length,
            });
          } else {
            this._logger.info('No existing collaboration session found');
          }
        }),
        catchError(error => {
          this._logger.error('Failed to check for existing collaboration session', error);
          // Return null instead of throwing - this is not a critical error
          this._existingSessionAvailable$.next(null);
          return new Observable<CollaborationSession | null>(observer => {
            observer.next(null);
            observer.complete();
          });
        }),
      );
  }

  /**
   * Check if current user would be the session manager of the existing session
   * @returns boolean indicating if current user is the session manager of existing session
   */
  public isCurrentUserManagerOfExistingSession(): boolean {
    const existingSession = this._existingSessionAvailable$.value;
    if (!existingSession) {
      return false;
    }
    const currentUserEmail = this._authService.userEmail;
    return currentUserEmail === existingSession.session_manager;
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

    if (this._isCollaborating$.value) {
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

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket
          this._connectToWebSocket(session.websocket_url);

          // Update collaboration state
          this._isCollaborating$.next(true);
          // Clear existing session state since we're now actively collaborating
          this._existingSessionAvailable$.next(null);

          // Convert API participants to CollaborationUser format with correct permissions
          const collaborationUsers: CollaborationUser[] = session.participants.map(participant => {
            if (!participant.permissions) {
              this._logger.error('Server error: participant missing permissions field', {
                sessionId: session.session_id,
                participantId: participant.user_id,
                participant,
              });
              throw new Error(
                `Server error: participant ${participant.user_id} missing permissions field`,
              );
            }
            return {
              id: participant.user_id,
              name: participant.user_id, // Use email address as display name
              permission: participant.permissions, // Use permissions from API response - required field
              status: 'active' as const,
              isSessionManager: participant.user_id === session.session_manager, // Use session_manager field from API
            };
          });

          this._collaborationUsers$.next(collaborationUsers);
        }),
        // Ensure current user appears in participant list before considering join successful
        switchMap(() => this._ensureUserInParticipantList()),
        tap(() => {
          // Show session joined notification only after user is verified in list
          this._notificationService.showSessionEvent('userJoined').subscribe();

          // Start periodic refresh of participant list
          this._startPeriodicRefresh();
        }),
        map(() => true),
        catchError(error => {
          this._logger.error('Failed to join collaboration session via PUT', error);
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

    if (this._isCollaborating$.value) {
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

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket
          this._connectToWebSocket(session.websocket_url);

          // Update collaboration state
          this._isCollaborating$.next(true);
          // Clear existing session state since we're now actively collaborating
          this._existingSessionAvailable$.next(null);

          // Convert API participants to CollaborationUser format
          const collaborationUsers: CollaborationUser[] = session.participants.map(participant => {
            if (!participant.permissions) {
              this._logger.error('Server error: participant missing permissions field', {
                sessionId: session.session_id,
                participantId: participant.user_id,
                participant,
              });
              throw new Error(
                `Server error: participant ${participant.user_id} missing permissions field`,
              );
            }
            return {
              id: participant.user_id,
              name: participant.user_id, // Use email address as display name
              permission: participant.permissions, // Use permissions from API response
              status: 'active' as const,
              isSessionManager: participant.user_id === session.session_manager,
            };
          });

          this._collaborationUsers$.next(collaborationUsers);

          // Store whether this was a new session for later
          return { isNewSession: result.isNewSession };
        }),
        // Ensure current user appears in participant list before considering operation successful
        switchMap((result) => 
          this._ensureUserInParticipantList().pipe(
            map(() => result) // Pass through the isNewSession flag
          )
        ),
        tap((result) => {
          // Show appropriate notification based on whether session was created or joined
          if (result.isNewSession) {
            this._notificationService.showSessionEvent('started').subscribe();
          } else {
            this._notificationService.showSessionEvent('userJoined').subscribe();
          }

          // Start periodic refresh of participant list
          this._startPeriodicRefresh();
        }),
        map(() => true),
        catchError(error => {
          this._logger.error('Smart collaboration starter failed', error);
          return throwError(() => error);
        }),
      );
  }

  /**
   * Start a new collaboration session (session manager only) - DEPRECATED
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

    if (this._isCollaborating$.value) {
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

          // Set up WebSocket listeners before connecting
          this._setupWebSocketListeners();

          // Connect to WebSocket
          this._connectToWebSocket(session.websocket_url);

          // Update collaboration state
          this._isCollaborating$.next(true);
          // Clear existing session state since we're now actively collaborating
          this._existingSessionAvailable$.next(null);

          // Convert API participants to CollaborationUser format, using email addresses consistently
          const collaborationUsers: CollaborationUser[] = session.participants.map(participant => {
            if (!participant.permissions) {
              this._logger.error('Server error: participant missing permissions field', {
                sessionId: session.session_id,
                participantId: participant.user_id,
                participant,
              });
              throw new Error(
                `Server error: participant ${participant.user_id} missing permissions field`,
              );
            }
            return {
              id: participant.user_id,
              name: participant.user_id, // Use email address as display name
              permission: participant.permissions, // Use permissions from API response - required field
              status: 'active' as const,
              isSessionManager: participant.user_id === session.session_manager, // Use session_manager field from API
            };
          });

          // Server guarantees the creating user will be included in the participants list

          this._collaborationUsers$.next(collaborationUsers);
        }),
        // Ensure current user appears in participant list before considering creation successful
        switchMap(() => this._ensureUserInParticipantList()),
        tap(() => {
          // Show session started notification only after user is verified in list
          this._notificationService.showSessionEvent('started').subscribe();

          // Start periodic refresh of participant list
          this._startPeriodicRefresh();
        }),
        map(() => true),
        catchError(error => {
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

    if (this.isCurrentUserSessionManager()) {
      this._logger.info('Session manager leaving - this will end the session for all users');
      return this.endCollaboration();
    }

    // Send leave message via WebSocket
    const currentUserId = this.getCurrentUserId();
    if (currentUserId) {
      this._webSocketAdapter
        .sendTMIMessage({
          event: 'leave',
          user_id: currentUserId,
          timestamp: new Date().toISOString(),
        })
        .subscribe({
          next: () => this._logger.info('Leave session message sent'),
          error: error => this._logger.error('Failed to send leave session message', error),
        });
    }

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

          // Stop periodic refresh
          this._stopPeriodicRefresh();

          // Disconnect WebSocket
          this._disconnectFromWebSocket();

          // Clear session state
          this._currentSession = null;
          this._isCollaborating$.next(false);
          this._collaborationUsers$.next([]);
          this._currentPresenterId$.next(null);
          this._pendingPresenterRequests$.next([]);
          this._existingSessionAvailable$.next(null);

          // Show session ended notification
          this._notificationService.showSessionEvent('ended').subscribe();
        }),
        map(() => true),
        catchError(error => {
          this._logger.error('Failed to end collaboration session', error);

          // Even if API call fails, clean up local state
          // Mark as intentional disconnection to suppress notification
          this._intentionalDisconnection = true;

          // Stop periodic refresh
          this._stopPeriodicRefresh();

          this._disconnectFromWebSocket();
          this._currentSession = null;
          this._isCollaborating$.next(false);
          this._collaborationUsers$.next([]);
          this._currentPresenterId$.next(null);
          this._pendingPresenterRequests$.next([]);
          this._existingSessionAvailable$.next(null);

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
    // which would then notify the user via email or in-app notification

    // For now, we'll simulate adding a new user to the session
    return new Observable<boolean>(observer => {
      setTimeout(() => {
        const users = this._collaborationUsers$.value;

        // Create a new user with a random ID
        const newUser: CollaborationUser = {
          id: `user-${Math.floor(Math.random() * 1000)}`,
          name: email.split('@')[0], // Use the part before @ as the name
          permission,
          status: 'disconnected', // Start as disconnected until they accept
          isSessionManager: false, // Invited users are never session managers
        };

        // Add the new user to the list
        this._collaborationUsers$.next([...users, newUser]);

        observer.next(true);
        observer.complete();
      }, 500);
    });
  }

  /**
   * Remove a user from the collaboration session
   * @param userId The ID of the user to remove
   * @returns Observable<boolean> indicating success or failure
   */
  public removeUser(userId: string): Observable<boolean> {
    this._logger.info('Removing user from collaboration session', { userId });

    // In a real implementation, this would notify the server to remove the user

    // For now, we'll just remove the user from our local list
    return new Observable<boolean>(observer => {
      const users = this._collaborationUsers$.value;
      const updatedUsers = users.filter(user => user.id !== userId);

      this._collaborationUsers$.next(updatedUsers);

      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Update a user's permission in the collaboration session (session manager only)
   * @param userId The ID of the user to update
   * @param permission The new permission to assign
   * @returns Observable<boolean> indicating success or failure
   */
  public updateUserPermission(
    userId: string,
    permission: 'writer' | 'reader',
  ): Observable<boolean> {
    this._logger.info('Updating user permission in collaboration session', { userId, permission });

    if (!this.isCurrentUserSessionManager()) {
      return throwError(() => new Error('Only session manager can update user permissions'));
    }

    // In a real implementation, this would notify the server to update the user's permission
    // For now, we'll just update the user in our local list
    return new Observable<boolean>(observer => {
      const users = this._collaborationUsers$.value;
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          return { ...user, permission };
        }
        return user;
      });

      this._collaborationUsers$.next(updatedUsers);

      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Add a participant to the collaboration session
   * @param userId The user ID (email)
   * @param permission The user's permission level
   */
  public addParticipant(userId: string, permission: 'reader' | 'writer' = 'reader'): void {
    const currentUsers = this._collaborationUsers$.value;
    const userExists = currentUsers.some(user => user.id === userId);

    if (!userExists) {
      const newUser: CollaborationUser = {
        id: userId,
        name: userId, // Use email as name
        permission,
        status: 'active',
        isPresenter: false,
        isSessionManager: userId === this._currentSession?.session_manager,
        lastActivity: new Date(),
      };

      const updatedUsers = [...currentUsers, newUser];
      this._collaborationUsers$.next(updatedUsers);
      this._logger.info('Added participant to collaboration session', {
        userId,
        permission,
        isSessionManager: newUser.isSessionManager,
      });
    }
  }

  /**
   * Remove a participant from the collaboration session
   * @param userId The user ID to remove
   */
  public removeParticipant(userId: string): void {
    const currentUsers = this._collaborationUsers$.value;
    this._logger.info('removeParticipant called', {
      userId,
      currentParticipantCount: currentUsers.length,
      currentParticipants: currentUsers.map(u => ({ id: u.id, name: u.name })),
    });
    
    const updatedUsers = currentUsers.filter(user => user.id !== userId);

    if (updatedUsers.length !== currentUsers.length) {
      this._collaborationUsers$.next(updatedUsers);
      this._logger.info('Removed participant from collaboration session', { 
        userId,
        previousCount: currentUsers.length,
        newCount: updatedUsers.length,
        remainingParticipants: updatedUsers.map(u => ({ id: u.id, name: u.name })),
      });
    } else {
      this._logger.warn('Attempted to remove participant not in list', { userId });
    }
  }

  /**
   * Update all participants from a bulk update message
   * This replaces the entire participant list with the new data
   * @param participants Array of participant information
   * @param sessionManager Optional session manager ID
   * @param currentPresenter Optional current presenter ID
   */
  public updateAllParticipants(
    participants: Array<{
      user_id: string;
      permissions: 'reader' | 'writer';
      is_presenter: boolean;
      is_session_manager: boolean;
      joined_at?: string;
    }>,
    sessionManager?: string,
    currentPresenter?: string | null,
  ): void {
    // Build the new participant list
    const updatedUsers: CollaborationUser[] = participants.map(participant => ({
      id: participant.user_id,
      name: participant.user_id, // Use email as name
      permission: participant.permissions,
      status: 'active' as const,
      isPresenter: participant.is_presenter,
      isSessionManager: participant.is_session_manager,
      lastActivity: new Date(participant.joined_at || Date.now()),
    }));

    // Update the participant list
    this._collaborationUsers$.next(updatedUsers);

    // Update presenter state if provided
    if (currentPresenter !== undefined) {
      this._currentPresenterId$.next(currentPresenter);
    }

    this._logger.info('Bulk participant update applied', {
      participantCount: participants.length,
      sessionManager,
      currentPresenter,
    });
  }

  /**
   * Get the current user's permission in the collaboration session
   * @returns The current user's permission, or null if not in a session
   */
  public getCurrentUserPermission(): 'writer' | 'reader' | null {
    if (!this._isCollaborating$.value) {
      return null;
    }

    const users = this._collaborationUsers$.value;
    const currentUserEmail = this._authService.userEmail || 'current-user';
    const currentUser = users.find(user => user.id === currentUserEmail);

    this._logger.debug('Getting current user permission', {
      currentUserEmail,
      users: users.map(u => ({ id: u.id, permission: u.permission })),
      currentUser: currentUser ? { id: currentUser.id, permission: currentUser.permission } : null,
      isCollaborating: this._isCollaborating$.value,
    });

    return currentUser ? currentUser.permission : null;
  }

  /**
   * Check if collaboration users have been loaded
   * @returns boolean indicating if user list has been populated
   */
  public hasLoadedUsers(): boolean {
    return this._collaborationUsers$.value.length > 0;
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
      if (this._isCollaborating$.value && this._collaborationUsers$.value.length === 0) {
        this._logger.warn(
          'Permission check attempted before user list loaded - will use threat model permission as fallback',
          {
            permission,
            isCollaborating: this._isCollaborating$.value,
            userCount: this._collaborationUsers$.value.length,
          },
        );
      }
      return false;
    }

    switch (permission) {
      case 'edit':
        return userPermission === 'writer'; // Only writers can edit
      case 'manageSession':
        return this.isCurrentUserSessionManager(); // Only session manager can manage session
      default:
        return false;
    }
  }

  /**
   * Check if the current user is the session manager (created the session)
   * @returns boolean indicating if the current user is the session manager
   */
  public isCurrentUserSessionManager(): boolean {
    if (!this._isCollaborating$.value) {
      return false;
    }

    const users = this._collaborationUsers$.value;
    const currentUserEmail = this._authService.userEmail || 'current-user';
    const currentUser = users.find(user => user.id === currentUserEmail);

    return currentUser?.isSessionManager || false;
  }

  /**
   * Check if a specific user is the current user
   * @param userId The user ID to check
   * @returns boolean indicating if this is the current user
   */
  public isCurrentUser(userId: string): boolean {
    const currentUserEmail = this._authService.userEmail || 'current-user';
    return userId === currentUserEmail;
  }

  /**
   * Get the current user's ID (email)
   * @returns The current user's email or null if not authenticated
   */
  public getCurrentUserId(): string | null {
    return this._authService.userEmail;
  }

  /**
   * Check if the current user is the presenter
   * @returns boolean indicating if current user is presenter
   */
  public isCurrentUserPresenter(): boolean {
    const currentUserId = this.getCurrentUserId();
    return currentUserId === this._currentPresenterId$.value;
  }

  /**
   * Get current collaboration status
   * @returns boolean indicating if currently collaborating
   */
  public isCollaborating(): boolean {
    return this._isCollaborating$.value;
  }

  /**
   * Get the current presenter's user ID
   * @returns The presenter's user ID or null if no presenter
   */
  public getCurrentPresenterId(): string | null {
    return this._currentPresenterId$.value;
  }

  /**
   * Request presenter privileges (for non-owners)
   * @returns Observable<boolean> indicating if request was sent successfully
   */
  public requestPresenterPrivileges(): Observable<boolean> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return throwError(() => new Error('Current user not identified'));
    }

    if (this.isCurrentUserSessionManager()) {
      // Session managers can become presenter immediately
      return this.setPresenter(currentUserId);
    }

    this._logger.info('Requesting presenter privileges', { userId: currentUserId });

    // Send presenter request via WebSocket
    return this._webSocketAdapter
      .sendTMIMessage({
        message_type: 'presenter_request',
        user_id: currentUserId,
      })
      .pipe(
        map(() => {
          // Show request sent notification
          this._notificationService.showPresenterEvent('requestSent').subscribe();
          return true;
        }),
        catchError(error => {
          this._logger.error('Failed to send presenter request', error);
          this._notificationService
            .showOperationError('send presenter request', error.message || 'Unknown error')
            .subscribe();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Approve a presenter request (owner only)
   * @param userId The user ID to approve as presenter
   * @returns Observable<boolean> indicating success
   */
  public approvePresenterRequest(userId: string): Observable<boolean> {
    if (!this.isCurrentUserSessionManager()) {
      return throwError(() => new Error('Only session manager can approve presenter requests'));
    }

    this._logger.info('Approving presenter request', { userId });

    // Remove from pending requests
    const pendingRequests = this._pendingPresenterRequests$.value;
    this._pendingPresenterRequests$.next(pendingRequests.filter(id => id !== userId));

    return this.setPresenter(userId);
  }

  /**
   * Deny a presenter request (owner only)
   * @param userId The user ID to deny presenter privileges
   * @returns Observable<boolean> indicating success
   */
  public denyPresenterRequest(userId: string): Observable<boolean> {
    if (!this.isCurrentUserSessionManager()) {
      return throwError(() => new Error('Only session manager can deny presenter requests'));
    }

    this._logger.info('Denying presenter request', { userId });

    // Remove from pending requests
    const pendingRequests = this._pendingPresenterRequests$.value;
    this._pendingPresenterRequests$.next(pendingRequests.filter(id => id !== userId));

    // Send denial via WebSocket
    return this._webSocketAdapter
      .sendTMIMessage({
        message_type: 'presenter_denied',
        user_id: this.getCurrentUserId() || '',
        target_user: userId,
      })
      .pipe(
        map(() => {
          // Show denial notification (for owner)
          this._notificationService.showPresenterEvent('requestDenied').subscribe();
          return true;
        }),
        catchError(error => {
          this._logger.error('Failed to send presenter denial', error);
          this._notificationService
            .showOperationError('deny presenter request', error.message || 'Unknown error')
            .subscribe();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Set presenter (owner only)
   * @param userId The user ID to set as presenter, or null to clear presenter
   * @returns Observable<boolean> indicating success
   */
  public setPresenter(userId: string | null): Observable<boolean> {
    if (!this.isCurrentUserSessionManager()) {
      return throwError(() => new Error('Only session manager can set presenter'));
    }

    this._logger.info('Setting presenter', { userId });

    // Update local state
    this._currentPresenterId$.next(userId);
    this._updateUsersPresenterStatus(userId);

    // Send presenter update via WebSocket
    return this._webSocketAdapter
      .sendTMIMessage({
        message_type: 'presenter_update',
        user_id: userId || undefined,
      })
      .pipe(
        map(() => {
          // Show presenter assigned notification
          const currentUserId = this.getCurrentUserId();
          if (userId === currentUserId) {
            this._notificationService.showPresenterEvent('assigned').subscribe();
          } else if (userId) {
            const user = this._collaborationUsers$.value.find(u => u.id === userId);
            this._notificationService
              .showPresenterEvent('assigned', user?.name || userId)
              .subscribe();
          } else {
            this._notificationService.showPresenterEvent('cleared').subscribe();
          }
          return true;
        }),
        catchError(error => {
          this._logger.error('Failed to send presenter update', error);
          // Revert local state on error
          this._currentPresenterId$.next(null);
          this._updateUsersPresenterStatus(null);
          this._notificationService
            .showOperationError('update presenter', error.message || 'Unknown error')
            .subscribe();
          return throwError(() => error);
        }),
      );
  }

  /**
   * Take back presenter privileges (owner only)
   * @returns Observable<boolean> indicating success
   */
  public takeBackPresenterPrivileges(): Observable<boolean> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return throwError(() => new Error('Current user not identified'));
    }

    return this.setPresenter(currentUserId);
  }

  /**
   * Add a presenter request to pending list
   * @param userId The user ID requesting presenter privileges
   */
  public addPresenterRequest(userId: string): void {
    const pendingRequests = this._pendingPresenterRequests$.value;
    if (!pendingRequests.includes(userId)) {
      this._pendingPresenterRequests$.next([...pendingRequests, userId]);
    }
  }

  /**
   * Update the current presenter ID (for external updates)
   * @param presenterId The user ID of the current presenter
   */
  public updatePresenterId(presenterId: string | null): void {
    this._currentPresenterId$.next(presenterId);
    this._updateUsersPresenterStatus(presenterId);
  }

  /**
   * Update users' presenter status based on current presenter
   * @param presenterId The user ID of the current presenter
   */
  public _updateUsersPresenterStatus(presenterId: string | null): void {
    const users = this._collaborationUsers$.value;
    const updatedUsers = users.map(user => ({
      ...user,
      isPresenter: user.id === presenterId,
    }));
    this._collaborationUsers$.next(updatedUsers);
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
        // Don't refresh immediately after connection - the join/start operations already loaded participants
        // Only refresh when we receive WebSocket events about participant changes
      },
      error: error => {
        this._logger.error('Failed to connect to WebSocket', error);
        this._notificationService
          .showWebSocketError(
            {
              type: error.type || 'connection_failed',
              message: error.message || 'Failed to connect to collaboration server',
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

    // Listen to user presence updates
    this._subscriptions.add(
      this._webSocketAdapter
        .getMessagesOfType(MessageType.USER_PRESENCE_UPDATE)
        .subscribe(message => {
          this._handleUserPresenceUpdate(message);
        }),
    );

    // Listen to session joined events
    this._subscriptions.add(
      this._webSocketAdapter.getMessagesOfType(MessageType.SESSION_JOINED).subscribe(message => {
        this._handleUserJoinedSession(message);
      }),
    );

    // Listen to session left events
    this._subscriptions.add(
      this._webSocketAdapter.getMessagesOfType(MessageType.SESSION_LEFT).subscribe(message => {
        this._handleUserLeftSession(message);
      }),
    );

    // Listen to session ended events
    this._subscriptions.add(
      this._webSocketAdapter.getMessagesOfType(MessageType.SESSION_ENDED).subscribe(message => {
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
      case WebSocketState.CONNECTED:
        this._notificationService.showWebSocketStatus(state).subscribe();
        break;
      case WebSocketState.DISCONNECTED:
        // Don't show disconnection notification if it was intentional (user leaving/ending session)
        if (this._intentionalDisconnection) {
          this._logger.debug('Intentional disconnection - suppressing notification');
          // Reset the flag for next session
          this._intentionalDisconnection = false;
          return;
        }
        // Show notification for unexpected disconnections
        this._notificationService
          .showWebSocketStatus(state, () => this._retryWebSocketConnection())
          .subscribe();
        break;
      case WebSocketState.ERROR:
      case WebSocketState.FAILED:
        this._notificationService
          .showWebSocketStatus(state, () => this._retryWebSocketConnection())
          .subscribe();
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

  /**
   * Handle user presence update messages from WebSocket
   */
  private _handleUserPresenceUpdate(message: any): void {
    this._logger.debug('Received user presence update', message);

    if (message.data && message.data.users) {
      // Update collaboration users list with real-time data
      const updatedUsers: CollaborationUser[] = message.data.users.map((user: any) => ({
        id: user.id,
        name: user.name,
        permission: user.permission || 'reader',
        status: user.status || 'active',
        isPresenter: user.isPresenter || false,
        isSessionManager: user.isSessionManager || false,
        lastActivity: new Date(user.lastActivity || Date.now()),
      }));

      this._collaborationUsers$.next(updatedUsers);
      this._logger.info('Updated collaboration users from WebSocket', {
        userCount: updatedUsers.length,
      });
    }
  }

  /**
   * Handle user joined session messages from WebSocket
   */
  private _handleUserJoinedSession(message: any): void {
    this._logger.debug('User joined session', message);

    if (message.data && message.data.user) {
      const newUser: CollaborationUser = {
        id: message.data.user.id,
        name: message.data.user.name,
        permission: message.data.user.permission || 'reader',
        status: message.data.user.status || 'active',
        isPresenter: message.data.user.isPresenter || false,
        isSessionManager: message.data.user.isSessionManager || false,
        lastActivity: new Date(),
      };

      // Add user to current list
      const currentUsers = this._collaborationUsers$.value;
      const userExists = currentUsers.some(user => user.id === newUser.id);

      if (!userExists) {
        const updatedUsers = [...currentUsers, newUser];
        this._collaborationUsers$.next(updatedUsers);
        this._logger.info('User joined collaboration session', {
          userId: newUser.id,
          userName: newUser.name,
        });
      }
    }
  }

  /**
   * Handle user left session messages from WebSocket
   */
  private _handleUserLeftSession(message: any): void {
    this._logger.debug('User left session', message);

    if (message.data && message.data.userId) {
      const userId = message.data.userId;
      const currentUserId = this.getCurrentUserId();

      // Remove user from current list
      const currentUsers = this._collaborationUsers$.value;
      const updatedUsers = currentUsers.filter(user => user.id !== userId);

      if (updatedUsers.length !== currentUsers.length) {
        this._collaborationUsers$.next(updatedUsers);
        this._logger.info('User left collaboration session', { userId });

        // If the current user was removed, redirect to dashboard
        if (userId === currentUserId && !this.isCurrentUserSessionManager()) {
          this._logger.info('Current user was removed from session, redirecting to dashboard');
          this._cleanupSessionState();
          this._redirectToDashboard();
        }
      }
    }
  }

  /**
   * Handle session ended messages from WebSocket
   */
  private _handleSessionEnded(message: any): void {
    this._logger.debug('Session ended via WebSocket', message);

    // If current user is not the session manager and session was ended, redirect to dashboard
    if (!this.isCurrentUserSessionManager() && this._currentSession) {
      this._logger.info('Session ended by session manager, redirecting other users to dashboard');
      this._cleanupSessionState();
      this._redirectToDashboard();
    }
  }

  /**
   * Handle TMI user joined event (legacy format from CLIENT_INTEGRATION_GUIDE.md)
   * Calls REST API to get updated session status and refresh participants list
   */
  private _handleTMIUserJoined(message: {
    event: string;
    user_id: string;
    timestamp: string;
  }): void {
    this._logger.debug('TMI user joined event received', message);

    if (!message || !message.user_id) {
      this._logger.warn('Invalid TMI user joined message received', message);
      return;
    }

    // Show immediate notification
    const displayName = this._getUserDisplayName(message.user_id);
    this._notificationService.showSessionEvent('userJoined', displayName).subscribe();

    // Refresh participant list from REST API to get accurate session state
    this._refreshSessionStatus('User joined session').subscribe({
      error: error => this._logger.error('Failed to refresh after user joined', error),
    });
  }

  /**
   * Handle TMI user left event (legacy format from CLIENT_INTEGRATION_GUIDE.md)
   * Calls REST API to get updated session status and refresh participants list
   */
  private _handleTMIUserLeft(message: { event: string; user_id: string; timestamp: string }): void {
    this._logger.debug('TMI user left event received', message);

    if (!message || !message.user_id) {
      this._logger.warn('Invalid TMI user left message received', message);
      return;
    }

    // Show immediate notification
    const displayName = this._getUserDisplayName(message.user_id);
    this._notificationService.showSessionEvent('userLeft', displayName).subscribe();

    // Check if the current user left (shouldn't happen but handle gracefully)
    const currentUserId = this.getCurrentUserId();
    if (message.user_id === currentUserId && !this.isCurrentUserSessionManager()) {
      this._logger.warn('Current user received leave event, cleaning up session');
      this._cleanupSessionState();
      this._redirectToDashboard();
      return;
    }

    // Refresh participant list from REST API to get accurate session state
    this._refreshSessionStatus('User left session').subscribe({
      error: error => this._logger.error('Failed to refresh after user left', error),
    });
  }

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
    this._currentPresenterId$.next(message.current_presenter);
    this._updateUsersPresenterStatus(message.current_presenter);

    // Show notification about presenter change
    const displayName = this._getUserDisplayName(message.current_presenter);
    const currentUserId = this.getCurrentUserId();

    if (message.current_presenter === currentUserId) {
      this._notificationService.showPresenterEvent('assigned').subscribe();
    } else {
      this._notificationService.showPresenterEvent('assigned', displayName).subscribe();
    }

    // Refresh participant list from REST API to get accurate session state including presenter info
    this._refreshSessionStatus('Presenter changed').subscribe({
      error: error => this._logger.error('Failed to refresh after presenter changed', error),
    });
  }

  /**
   * Refresh session status by calling REST API and updating participant list
   * This follows the CLIENT_INTEGRATION_GUIDE.md recommendation to call REST API on participant changes
   */
  private _refreshSessionStatus(reason: string): Observable<void> {
    if (!this._currentSession || !this._threatModelId || !this._diagramId) {
      this._logger.warn('Cannot refresh session status - no active session', { reason });
      return throwError(() => new Error('No active session'));
    }

    this._logger.info('Refreshing session status from REST API', { reason });

    return this._threatModelService
      .getDiagramCollaborationSession(this._threatModelId, this._diagramId)
      .pipe(
        tap((session: CollaborationSession | null) => {
          if (session) {
            this._logger.info('Session status refreshed successfully', {
              reason,
              participantCount: session.participants.length,
            });

            // Store the original session manager before updating session data
            const originalSessionManager = this._currentSession?.session_manager;

            // Update session data
            this._currentSession = session;

            // Convert API participants to CollaborationUser format
            const collaborationUsers: CollaborationUser[] = session.participants.map(
              participant => {
                if (!participant.permissions) {
                  this._logger.error('Server error: participant missing permissions field', {
                    sessionId: session.session_id,
                    participantId: participant.user_id,
                    participant,
                  });
                  throw new Error(
                    `Server error: participant ${participant.user_id} missing permissions field`,
                  );
                }

                // Use session_manager from refresh response if available, otherwise fall back to stored session
                const sessionManagerId = session.session_manager || originalSessionManager;
                const isSessionManager = participant.user_id === sessionManagerId;

                return {
                  id: participant.user_id,
                  name: participant.user_id, // Use email address as display name
                  permission: participant.permissions, // Use permissions from API response
                  status: 'active' as const,
                  isSessionManager,
                };
              },
            );

            // Update the participants list
            this._logger.info('Updating collaboration users from refresh', {
              users: collaborationUsers.map(u => ({
                id: u.id,
                name: u.name,
                isSessionManager: u.isSessionManager,
              })),
              count: collaborationUsers.length,
              source: '_refreshSessionStatus',
              reason,
            });
            this._collaborationUsers$.next(collaborationUsers);
          } else {
            this._logger.warn('No active session found during refresh - session may have ended', {
              reason,
            });
            // Session no longer exists, clean up
            this._cleanupSessionState();
            this._redirectToDashboard();
          }
        }),
        map(() => void 0), // Convert to void
        catchError(error => {
          this._logger.error('Failed to refresh session status', { reason, error });
          // Don't clean up session on error, as this might be a temporary network issue
          return throwError(() => error);
        }),
      );
  }

  /**
   * Get user display name from user ID (email)
   */
  private _getUserDisplayName(userId: string): string {
    if (!userId || typeof userId !== 'string') {
      return 'Unknown User';
    }
    // Convert email to display name or use user directory
    return userId.split('@')[0] || userId;
  }

  /**
   * Clean up session state without API calls
   */
  private _cleanupSessionState(): void {
    // Stop periodic refresh
    this._stopPeriodicRefresh();

    this._disconnectFromWebSocket();
    this._currentSession = null;
    this._isCollaborating$.next(false);
    this._collaborationUsers$.next([]);
    this._currentPresenterId$.next(null);
    this._pendingPresenterRequests$.next([]);
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
   * Start periodic refresh of session status with exponential backoff
   */
  private _startPeriodicRefresh(): void {
    // Stop any existing refresh timer
    this._stopPeriodicRefresh();

    // Reset backoff to minimum
    this._refreshBackoffMs = this._minRefreshMs;

    // Schedule first refresh after 1 second
    this._scheduleNextRefresh();

    this._logger.info('Started periodic session refresh', {
      initialDelay: this._refreshBackoffMs,
    });
  }

  /**
   * Ensure current user appears in participant list with retry logic
   * Retries with exponential backoff until user appears or max attempts reached
   */
  private _ensureUserInParticipantList(): Observable<void> {
    const currentUserId = this.getCurrentUserId();
    if (!currentUserId) {
      return throwError(() => new Error('Current user not authenticated'));
    }

    let retryCount = 0;
    const maxRetries = 10; // Max 10 attempts
    let backoffMs = 1000; // Start at 1 second

    const checkUserPresence = (): Observable<void> => {
      return this._refreshSessionStatus('Verifying user in participant list').pipe(
        switchMap(() => {
          // Check if current user is in the participant list
          const users = this._collaborationUsers$.value;
          const userInList = users.some(user => user.id === currentUserId);

          if (userInList) {
            this._logger.info('Current user found in participant list', {
              userId: currentUserId,
              retryCount,
            });
            return of(undefined);
          }

          // User not found, check if we should retry
          if (retryCount >= maxRetries) {
            this._logger.error('Max retries reached - user not in participant list', {
              userId: currentUserId,
              retryCount,
              maxRetries,
            });
            return throwError(() => new Error('Failed to verify user in participant list after max retries'));
          }

          // Retry with exponential backoff
          retryCount++;
          const nextBackoff = Math.min(backoffMs * 2, 30000); // Cap at 30 seconds
          
          this._logger.warn('Current user not yet in participant list, retrying', {
            userId: currentUserId,
            retryCount,
            nextBackoffMs: backoffMs,
          });

          return timer(backoffMs).pipe(
            tap(() => {
              backoffMs = nextBackoff; // Update backoff for next retry
            }),
            switchMap(() => checkUserPresence()),
          );
        }),
        catchError(error => {
          this._logger.error('Error verifying user in participant list', {
            error,
            userId: currentUserId,
            retryCount,
          });
          
          // On error, still retry if under max attempts
          if (retryCount < maxRetries) {
            retryCount++;
            const nextBackoff = Math.min(backoffMs * 2, 30000);
            
            return timer(backoffMs).pipe(
              tap(() => {
                backoffMs = nextBackoff;
              }),
              switchMap(() => checkUserPresence()),
            );
          }
          
          return throwError(() => error);
        }),
      );
    };

    return checkUserPresence();
  }

  /**
   * Stop periodic refresh of session status
   */
  private _stopPeriodicRefresh(): void {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
      this._refreshTimer = null;
      this._logger.debug('Stopped periodic session refresh');
    }
  }

  /**
   * Schedule the next refresh with exponential backoff
   */
  private _scheduleNextRefresh(): void {
    // Stop any existing timer
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }

    // Schedule the refresh
    this._refreshTimer = setTimeout(() => {
      this._refreshSessionStatus('Periodic refresh').subscribe({
        next: () => {
          this._logger.debug('Session refresh completed', {
            backoffMs: this._refreshBackoffMs,
          });

          // Double the backoff for next time (exponential backoff)
          this._refreshBackoffMs = Math.min(this._refreshBackoffMs * 2, this._maxRefreshMs);

          // Schedule next refresh if still collaborating
          if (this._isCollaborating$.value) {
            this._scheduleNextRefresh();
          }
        },
        error: (error: any) => {
          this._logger.error('Session refresh failed', {
            error,
            backoffMs: this._refreshBackoffMs,
          });

          // On error, still continue with exponential backoff
          this._refreshBackoffMs = Math.min(this._refreshBackoffMs * 2, this._maxRefreshMs);

          // Schedule next refresh if still collaborating
          if (this._isCollaborating$.value) {
            this._scheduleNextRefresh();
          }
        },
      });
    }, this._refreshBackoffMs);
  }

  /**
   * Clean up resources and subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('DfdCollaborationService destroying');

    // Stop periodic refresh
    this._stopPeriodicRefresh();

    this._subscriptions.unsubscribe();

    // End collaboration if active
    if (this._isCollaborating$.value) {
      this.endCollaboration().subscribe({
        error: error => this._logger.error('Error ending collaboration on destroy', error),
      });
    }
  }
}
