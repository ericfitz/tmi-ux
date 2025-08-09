import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { ThreatModelService } from '../../tm/services/threat-model.service';
import { WebSocketAdapter } from '../infrastructure/adapters/websocket.adapter';

/**
 * Represents a user in a collaboration session
 */
export interface CollaborationUser {
  id: string;
  name: string;
  role: 'owner' | 'writer' | 'reader';
  status: 'active' | 'idle' | 'disconnected';
  cursorPosition?: { x: number; y: number };
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
export class DfdCollaborationService {
  // Observable for collaboration status
  private _isCollaborating$ = new BehaviorSubject<boolean>(false);
  public isCollaborating$ = this._isCollaborating$.asObservable();

  // Observable for users in the collaboration session
  private _collaborationUsers$ = new BehaviorSubject<CollaborationUser[]>([]);
  public collaborationUsers$ = this._collaborationUsers$.asObservable();

  // Current session information
  private _currentSession: CollaborationSession | null = null;
  private _threatModelId: string | null = null;
  private _diagramId: string | null = null;

  constructor(
    private _logger: LoggerService,
    private _authService: AuthService,
    private _threatModelService: ThreatModelService,
    private _webSocketAdapter: WebSocketAdapter,
  ) {
    this._logger.info('DfdCollaborationService initialized');
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

        // Add current user as owner
        const currentUser: CollaborationUser = {
          id: this._authService.username || 'current-user',
          name: this._authService.username || 'Current User',
          role: 'owner',
          status: 'active',
        };

        // Convert API participants to CollaborationUser format
        const collaborationUsers = session.participants.map(participant => ({
          id: participant.user_id,
          name: participant.user_id, // Use user_id as name for now
          role: 'writer' as const, // Default role for other participants
          status: 'active' as const,
        }));

        // Add current user if not already in participants
        const allUsers = collaborationUsers.some(u => u.id === currentUser.id) 
          ? collaborationUsers 
          : [currentUser, ...collaborationUsers];

        this._collaborationUsers$.next(allUsers);
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
      }),
      map(() => true),
      catchError((error) => {
        this._logger.error('Failed to end collaboration session', error);
        
        // Even if API call fails, clean up local state
        this._disconnectFromWebSocket();
        this._currentSession = null;
        this._isCollaborating$.next(false);
        this._collaborationUsers$.next([]);
        
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
    const currentUser = users.find(user => user.id === 'current-user');

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
   * Connect to WebSocket for real-time collaboration
   * @param websocketUrl The WebSocket URL provided by the API
   */
  private _connectToWebSocket(websocketUrl: string): void {
    this._logger.info('Connecting to collaboration WebSocket', { websocketUrl });

    try {
      this._webSocketAdapter.connect(websocketUrl);
      this._logger.info('WebSocket connection initiated');
    } catch (error) {
      this._logger.error('Failed to connect to WebSocket', error);
    }
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
}
