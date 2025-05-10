import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';

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

  // WebSocket connection
  private _webSocket: WebSocket | null = null;

  constructor(private _logger: LoggerService) {
    this._logger.info('DfdCollaborationService initialized');
  }

  /**
   * Start a collaboration session
   * @returns Observable<boolean> indicating success or failure
   */
  public startCollaboration(): Observable<boolean> {
    this._logger.info('Starting collaboration session');

    // In a real implementation, this would establish a WebSocket connection
    // and send the current diagram state to the server

    // For now, we'll simulate a successful connection
    setTimeout(() => {
      this._isCollaborating$.next(true);

      // Add the current user as the owner
      const currentUser: CollaborationUser = {
        id: 'current-user',
        name: 'Current User',
        role: 'owner',
        status: 'active',
      };

      this._collaborationUsers$.next([currentUser]);
    }, 500);

    return new Observable<boolean>(observer => {
      setTimeout(() => {
        observer.next(true);
        observer.complete();
      }, 500);
    });
  }

  /**
   * End the current collaboration session
   * @returns Observable<boolean> indicating success or failure
   */
  public endCollaboration(): Observable<boolean> {
    this._logger.info('Ending collaboration session');

    // In a real implementation, this would close the WebSocket connection
    // and notify the server that the session is ending

    if (this._webSocket) {
      this._webSocket.close();
      this._webSocket = null;
    }

    this._isCollaborating$.next(false);
    this._collaborationUsers$.next([]);

    return new Observable<boolean>(observer => {
      observer.next(true);
      observer.complete();
    });
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
}
