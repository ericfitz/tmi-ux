import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { map, filter, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import {
  CollaborationSession,
  SessionState,
} from '../../domain/collaboration/collaboration-session';
import { User } from '../../domain/collaboration/user';
import {
  UserPresence,
  PresenceStatus,
  UserActivity,
} from '../../domain/collaboration/user-presence';
import {
  AnyCollaborationEvent,
  ConflictResolution,
} from '../../domain/collaboration/collaboration-events';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';

/**
 * Application service for managing collaboration sessions and real-time interactions
 */
@Injectable({
  providedIn: 'root',
})
export class CollaborationApplicationService {
  private readonly _activeSessions = new Map<string, CollaborationSession>();
  private readonly _currentUser$ = new BehaviorSubject<User | null>(null);
  private readonly _currentSession$ = new BehaviorSubject<CollaborationSession | null>(null);
  private readonly _collaborationEvents$ = new Subject<AnyCollaborationEvent>();

  // Observables for reactive updates
  public readonly currentUser$ = this._currentUser$.asObservable();
  public readonly currentSession$ = this._currentSession$.asObservable();
  public readonly collaborationEvents$ = this._collaborationEvents$.asObservable();

  /**
   * Observable for current session participants
   */
  public readonly sessionParticipants$ = this.currentSession$.pipe(
    map(session => session?.getParticipants() || []),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1),
  );

  /**
   * Observable for active participants only
   */
  public readonly activeParticipants$ = this.currentSession$.pipe(
    map(session => session?.getActiveParticipants() || []),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1),
  );

  /**
   * Observable for unresolved conflicts
   */
  public readonly unresolvedConflicts$ = this.currentSession$.pipe(
    map(session => session?.getUnresolvedConflicts() || []),
    distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
    shareReplay(1),
  );

  /**
   * Observable for session state changes
   */
  public readonly sessionState$ = this.currentSession$.pipe(
    map(session => session?.state || null),
    distinctUntilChanged(),
    shareReplay(1),
  );

  /**
   * Set the current user
   */
  setCurrentUser(user: User): void {
    this._currentUser$.next(user);
  }

  /**
   * Get the current user
   */
  getCurrentUser(): User | null {
    return this._currentUser$.value;
  }

  /**
   * Create a new collaboration session
   */
  createSession(
    sessionId: string,
    diagramId: string,
    creator: User,
  ): Observable<CollaborationSession> {
    return new Observable(observer => {
      try {
        if (this._activeSessions.has(sessionId)) {
          throw new Error(`Session ${sessionId} already exists`);
        }

        const session = CollaborationSession.create(sessionId, diagramId, creator.id, creator);
        this._activeSessions.set(sessionId, session);
        this._currentSession$.next(session);

        // Emit events
        this._emitSessionEvents(session);

        observer.next(session);
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Join an existing collaboration session
   */
  joinSession(sessionId: string, user: User): Observable<CollaborationSession> {
    return new Observable(observer => {
      try {
        const session = this._activeSessions.get(sessionId);
        if (!session) {
          throw new Error(`Session ${sessionId} not found`);
        }

        if (!session.isActive()) {
          throw new Error(`Session ${sessionId} is not active`);
        }

        session.addParticipant(user);
        this._currentSession$.next(session);

        // Emit events
        this._emitSessionEvents(session);

        observer.next(session);
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Leave the current collaboration session
   */
  leaveSession(userId: string): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session to leave');
        }

        session.removeParticipant(userId);

        // If session is empty, remove it
        if (session.participantCount === 0) {
          this._activeSessions.delete(session.id);
          this._currentSession$.next(null);
        }

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Update user presence in the current session
   */
  updateUserPresence(userId: string, presence: UserPresence): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        session.updateUserPresence(userId, presence);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Update user cursor position
   */
  updateUserCursor(
    userId: string,
    cursorState: {
      position: { x: number; y: number };
      selectedNodeIds: string[];
      selectedEdgeIds: string[];
      isVisible: boolean;
    },
  ): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        session.updateUserCursor(userId, cursorState);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Execute a collaborative command
   */
  executeCollaborativeCommand(command: AnyDiagramCommand): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        session.executeCommand(command);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Resolve a command conflict
   */
  resolveConflict(
    conflictId: string,
    resolution: ConflictResolution,
    resolvedBy: string,
  ): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        session.resolveConflict(conflictId, resolution, resolvedBy);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Mark user as away due to inactivity
   */
  markUserAsAway(userId: string): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        const participant = session.getParticipant(userId);
        if (!participant) {
          throw new Error(`User ${userId} not found in session`);
        }

        const awayPresence = participant.markAsAway();
        session.updateUserPresence(userId, awayPresence);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Mark user as back online
   */
  markUserAsOnline(userId: string): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        const participant = session.getParticipant(userId);
        if (!participant) {
          throw new Error(`User ${userId} not found in session`);
        }

        const onlinePresence = participant
          .withStatus(PresenceStatus.ONLINE)
          .withActivity(UserActivity.VIEWING);

        session.updateUserPresence(userId, onlinePresence);

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Synchronize session state
   */
  synchronizeSession(): Observable<void> {
    return new Observable(observer => {
      try {
        const session = this._currentSession$.value;
        if (!session) {
          throw new Error('No active session');
        }

        session.synchronizeState();

        // Emit events
        this._emitSessionEvents(session);

        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | null {
    return this._activeSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this._activeSessions.values());
  }

  /**
   * Check if user is in any active session
   */
  isUserInSession(userId: string): boolean {
    return Array.from(this._activeSessions.values()).some(
      session => session.getParticipant(userId) !== undefined,
    );
  }

  /**
   * Get user's current session
   */
  getUserSession(userId: string): CollaborationSession | null {
    return (
      Array.from(this._activeSessions.values()).find(
        session => session.getParticipant(userId) !== undefined,
      ) || null
    );
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(inactivityThreshold: number = 30 * 60 * 1000): void {
    const now = Date.now();
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this._activeSessions) {
      if (session.isInactiveFor(inactivityThreshold) || session.participantCount === 0) {
        sessionsToRemove.push(sessionId);
      }
    }

    for (const sessionId of sessionsToRemove) {
      const session = this._activeSessions.get(sessionId);
      if (session) {
        session.endSession();
        this._activeSessions.delete(sessionId);

        // If this was the current session, clear it
        if (this._currentSession$.value?.id === sessionId) {
          this._currentSession$.next(null);
        }
      }
    }
  }

  /**
   * Emit session events
   */
  private _emitSessionEvents(session: CollaborationSession): void {
    const events = session.getUncommittedEvents();
    for (const event of events) {
      this._collaborationEvents$.next(event);
    }
    session.markEventsAsCommitted();
  }

  /**
   * Dispose of the service and clean up resources
   */
  dispose(): void {
    this._activeSessions.clear();
    this._currentUser$.complete();
    this._currentSession$.complete();
    this._collaborationEvents$.complete();
  }
}
