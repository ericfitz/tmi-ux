import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, throwError, Subscription } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import { WebSocketAdapter, WebSocketState } from '../infrastructure/adapters/websocket.adapter';
import { DfdNotificationService } from './dfd-notification.service';
import { environment } from '../../../../environments/environment';

/**
 * Represents a user in a collaboration session
 */
export interface CollaborationUser {
  id: string;
  name: string;
  role: 'owner' | 'writer' | 'reader';
  status: 'active' | 'idle' | 'disconnected';
  cursorPosition?: { x: number; y: number };
  isPresenter?: boolean;
}

/**
 * Represents a collaboration session from the API
 */
interface CollaborationSession {
  session_id: string;
  threat_model_id: string;
  diagram_id: string;
  participants: Array<{
    user_id: string;
    joined_at: string;
  }>;
  websocket_url: string;
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

  // Current session information
  private _currentSession: CollaborationSession | null = null;
  private _threatModelId: string | null = null;
  private _diagramId: string | null = null;
  
  // Subscription management
  private _subscriptions = new Subscription();

  constructor(
    private _logger: LoggerService,
    private _authService: AuthService,
    private _threatModelService: ThreatModelService,
    private _webSocketAdapter: WebSocketAdapter,
    private _notificationService: DfdNotificationService,
  ) {
    this._logger.info('DfdCollaborationService initialized');
    this._setupWebSocketListeners();
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
   * Start a collaboration session
   * @returns Observable<boolean> indicating success or failure
   */
  public startCollaboration(): Observable<boolean> {
    this._logger.info('Starting collaboration session');

    if (!this._threatModelId || !this._diagramId) {
      this._logger.error('Cannot start collaboration: diagram context not set');
      return throwError(() => new Error('Diagram context not set. Call setDiagramContext() first.'));
    }

    if (this._isCollaborating$.value) {
      this._logger.warn('Collaboration session already active');
      return throwError(() => new Error('Collaboration session is already active'));
    }

    // Make API call to start collaboration session
    return this._threatModelService.startDiagramCollaborationSession(this._threatModelId, this._diagramId).pipe(
      tap((session: CollaborationSession) => {
        this._logger.info('Collaboration session started successfully', {
          sessionId: session.session_id,
          threatModelId: session.threat_model_id,
          diagramId: session.diagram_id,
          websocketUrl: session.websocket_url
        });

        // Store the session
        this._currentSession = session;

        // Connect to WebSocket
        this._connectToWebSocket(session.websocket_url);

        // Update collaboration state
        this._isCollaborating$.next(true);
        
        // Show session started notification
        this._notificationService.showSessionEvent('started').subscribe();

        // Convert API participants to CollaborationUser format, using email addresses consistently
        const currentUserEmail = this._authService.userEmail || 'current-user';
        const collaborationUsers: CollaborationUser[] = session.participants.map(participant => ({
          id: participant.user_id,
          name: participant.user_id, // Use email address as display name
          role: participant.user_id === currentUserEmail ? 'owner' as const : 'writer' as const, // Owner is the current user who started session
          status: 'active' as const,
        }));

        // If current user is not in participants list, add them as owner
        if (!collaborationUsers.some(u => u.id === currentUserEmail)) {
          const currentUser: CollaborationUser = {
            id: currentUserEmail,
            name: currentUserEmail, // Use email address consistently
            role: 'owner',
            status: 'active',
          };
          collaborationUsers.unshift(currentUser); // Add owner at the beginning
        }

        this._collaborationUsers$.next(collaborationUsers);
      }),
      map(() => true),
      catchError((error) => {
        this._logger.error('Failed to start collaboration session', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * End the current collaboration session
   * @returns Observable<boolean> indicating success or failure
   */
  public endCollaboration(): Observable<boolean> {
    this._logger.info('Ending collaboration session');

    if (!this._currentSession) {
      this._logger.warn('No active collaboration session to end');
      return throwError(() => new Error('No active collaboration session'));
    }

    // Make API call to end collaboration session
    return this._threatModelService.endDiagramCollaborationSession(
      this._currentSession.threat_model_id, 
      this._currentSession.diagram_id
    ).pipe(
      tap(() => {
        this._logger.info('Collaboration session ended successfully', {
          sessionId: this._currentSession?.session_id,
          threatModelId: this._currentSession?.threat_model_id,
          diagramId: this._currentSession?.diagram_id
        });

        // Disconnect WebSocket
        this._disconnectFromWebSocket();

        // Clear session state
        this._currentSession = null;
        this._isCollaborating$.next(false);
        this._collaborationUsers$.next([]);
        this._currentPresenterId$.next(null);
        this._pendingPresenterRequests$.next([]);
        
        // Show session ended notification
        this._notificationService.showSessionEvent('ended').subscribe();
      }),
      map(() => true),
      catchError((error) => {
        this._logger.error('Failed to end collaboration session', error);
        
        // Even if API call fails, clean up local state
        this._disconnectFromWebSocket();
        this._currentSession = null;
        this._isCollaborating$.next(false);
        this._collaborationUsers$.next([]);
        this._currentPresenterId$.next(null);
        this._pendingPresenterRequests$.next([]);
        
        // Show session ended notification even on error
        this._notificationService.showSessionEvent('ended').subscribe();
        
        return throwError(() => error);
      })
    );
  }

  /**
   * Invite a user to the collaboration session
   * @param email The email of the user to invite
   * @param role The role to assign to the user
   * @returns Observable<boolean> indicating success or failure
   */
  public inviteUser(email: string, role: 'owner' | 'writer' | 'reader'): Observable<boolean> {
    this._logger.info('Inviting user to collaboration session', { email, role });

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
          role,
          status: 'disconnected', // Start as disconnected until they accept
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
   * Update a user's role in the collaboration session
   * @param userId The ID of the user to update
   * @param role The new role to assign
   * @returns Observable<boolean> indicating success or failure
   */
  public updateUserRole(userId: string, role: 'owner' | 'writer' | 'reader'): Observable<boolean> {
    this._logger.info('Updating user role in collaboration session', { userId, role });

    // In a real implementation, this would notify the server to update the user's role

    // For now, we'll just update the user in our local list
    return new Observable<boolean>(observer => {
      const users = this._collaborationUsers$.value;
      const updatedUsers = users.map(user => {
        if (user.id === userId) {
          return { ...user, role };
        }
        return user;
      });

      this._collaborationUsers$.next(updatedUsers);

      observer.next(true);
      observer.complete();
    });
  }

  /**
   * Get the current user's role in the collaboration session
   * @returns The current user's role, or null if not in a session
   */
  public getCurrentUserRole(): 'owner' | 'writer' | 'reader' | null {
    if (!this._isCollaborating$.value) {
      return null;
    }

    const users = this._collaborationUsers$.value;
    const currentUserEmail = this._authService.userEmail || 'current-user';
    const currentUser = users.find(user => user.id === currentUserEmail);

    return currentUser ? currentUser.role : null;
  }

  /**
   * Check if the current user has a specific permission
   * @param permission The permission to check
   * @returns boolean indicating if the user has the permission
   */
  public hasPermission(permission: 'edit' | 'invite' | 'remove' | 'changeRole'): boolean {
    const role = this.getCurrentUserRole();

    if (!role) {
      return false;
    }

    switch (permission) {
      case 'edit':
        return role === 'owner' || role === 'writer';
      case 'invite':
      case 'remove':
      case 'changeRole':
        return role === 'owner';
      default:
        return false;
    }
  }

  /**
   * Check if the current user is the owner of the collaboration session
   * @returns boolean indicating if the current user is the owner
   */
  public isCurrentUserOwner(): boolean {
    return this.getCurrentUserRole() === 'owner';
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

    if (this.isCurrentUserOwner()) {
      // Owners can become presenter immediately
      return this.setPresenter(currentUserId);
    }

    this._logger.info('Requesting presenter privileges', { userId: currentUserId });

    // Send presenter request via WebSocket
    return this._webSocketAdapter.sendTMIMessage({
      message_type: 'presenter_request',
      user_id: currentUserId
    }).pipe(
      map(() => {
        // Show request sent notification
        this._notificationService.showPresenterEvent('requestSent').subscribe();
        return true;
      }),
      catchError((error) => {
        this._logger.error('Failed to send presenter request', error);
        this._notificationService.showOperationError('send presenter request', error.message || 'Unknown error').subscribe();
        return throwError(() => error);
      })
    );
  }

  /**
   * Approve a presenter request (owner only)
   * @param userId The user ID to approve as presenter
   * @returns Observable<boolean> indicating success
   */
  public approvePresenterRequest(userId: string): Observable<boolean> {
    if (!this.isCurrentUserOwner()) {
      return throwError(() => new Error('Only session owners can approve presenter requests'));
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
    if (!this.isCurrentUserOwner()) {
      return throwError(() => new Error('Only session owners can deny presenter requests'));
    }

    this._logger.info('Denying presenter request', { userId });

    // Remove from pending requests
    const pendingRequests = this._pendingPresenterRequests$.value;
    this._pendingPresenterRequests$.next(pendingRequests.filter(id => id !== userId));

    // Send denial via WebSocket
    return this._webSocketAdapter.sendTMIMessage({
      message_type: 'presenter_denied',
      user_id: this.getCurrentUserId() || '',
      target_user: userId
    }).pipe(
      map(() => {
        // Show denial notification (for owner)
        this._notificationService.showPresenterEvent('requestDenied').subscribe();
        return true;
      }),
      catchError((error) => {
        this._logger.error('Failed to send presenter denial', error);
        this._notificationService.showOperationError('deny presenter request', error.message || 'Unknown error').subscribe();
        return throwError(() => error);
      })
    );
  }

  /**
   * Set presenter (owner only)
   * @param userId The user ID to set as presenter, or null to clear presenter
   * @returns Observable<boolean> indicating success
   */
  public setPresenter(userId: string | null): Observable<boolean> {
    if (!this.isCurrentUserOwner()) {
      return throwError(() => new Error('Only session owners can set presenter'));
    }

    this._logger.info('Setting presenter', { userId });

    // Update local state
    this._currentPresenterId$.next(userId);
    this._updateUsersPresenterStatus(userId);

    // Send presenter update via WebSocket
    return this._webSocketAdapter.sendTMIMessage({
      message_type: 'presenter_update',
      user_id: userId || undefined
    }).pipe(
      map(() => {
        // Show presenter assigned notification
        const currentUserId = this.getCurrentUserId();
        if (userId === currentUserId) {
          this._notificationService.showPresenterEvent('assigned').subscribe();
        } else if (userId) {
          const user = this._collaborationUsers$.value.find(u => u.id === userId);
          this._notificationService.showPresenterEvent('assigned', user?.name || userId).subscribe();
        } else {
          this._notificationService.showPresenterEvent('cleared').subscribe();
        }
        return true;
      }),
      catchError((error) => {
        this._logger.error('Failed to send presenter update', error);
        // Revert local state on error
        this._currentPresenterId$.next(null);
        this._updateUsersPresenterStatus(null);
        this._notificationService.showOperationError('update presenter', error.message || 'Unknown error').subscribe();
        return throwError(() => error);
      })
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
      isPresenter: user.id === presenterId
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
      fullUrl: fullWebSocketUrl 
    });

    this._webSocketAdapter.connect(fullWebSocketUrl).subscribe({
      next: () => {
        this._logger.info('WebSocket connection established successfully');
      },
      error: (error) => {
        this._logger.error('Failed to connect to WebSocket', error);
        this._notificationService.showWebSocketError(
          {
            type: error.type || 'connection_failed',
            message: error.message || 'Failed to connect to collaboration server',
            originalError: error,
            isRecoverable: true,
            retryable: true
          },
          () => this._retryWebSocketConnection()
        ).subscribe();
      }
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
      this._logger.info('WebSocket disconnected');
    } catch (error) {
      this._logger.error('Error disconnecting from WebSocket', error);
    }
  }

  /**
   * Setup WebSocket listeners for connection state and collaboration events
   */
  private _setupWebSocketListeners(): void {
    // Listen to connection state changes
    this._subscriptions.add(
      this._webSocketAdapter.connectionState$.subscribe((state: WebSocketState) => {
        this._handleWebSocketStateChange(state);
      })
    );

    // Listen to connection errors
    this._subscriptions.add(
      this._webSocketAdapter.errors$.subscribe((error) => {
        this._notificationService.showWebSocketError(error, () => this._retryWebSocketConnection()).subscribe();
      })
    );
  }

  /**
   * Handle WebSocket state changes and show appropriate notifications
   */
  private _handleWebSocketStateChange(state: WebSocketState): void {
    this._logger.debug('WebSocket state changed', { state });

    switch (state) {
      case WebSocketState.CONNECTING:
        this._notificationService.showWebSocketStatus(state).subscribe();
        break;
      case WebSocketState.CONNECTED:
        this._notificationService.showWebSocketStatus(state).subscribe();
        break;
      case WebSocketState.DISCONNECTED:
      case WebSocketState.ERROR:
      case WebSocketState.FAILED:
        this._notificationService.showWebSocketStatus(state, () => this._retryWebSocketConnection()).subscribe();
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
      this._notificationService.showError('Cannot retry connection - no active session').subscribe();
    }
  }

  /**
   * Clean up resources and subscriptions
   */
  ngOnDestroy(): void {
    this._logger.info('DfdCollaborationService destroying');
    this._subscriptions.unsubscribe();
    
    // End collaboration if active
    if (this._isCollaborating$.value) {
      this.endCollaboration().subscribe({
        error: (error) => this._logger.error('Error ending collaboration on destroy', error)
      });
    }
  }
}
