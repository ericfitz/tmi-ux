/**
 * Collaboration Session Service
 *
 * This service manages collaboration sessions with real-time updates via WebSocket.
 * It provides centralized session management.
 *
 * Key functionality:
 * - Queries server for available collaboration sessions
 * - Monitors WebSocket for session announcements (started/ended)
 * - Provides reactive streams for session list updates
 * - Handles server connectivity states
 */

import { Injectable, OnDestroy, Injector } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, EMPTY, of, Subscription } from 'rxjs';
import { map, switchMap, takeUntil, catchError, shareReplay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { ServerConnectionService, ServerConnectionStatus } from './server-connection.service';
import { WebSocketAdapter, MessageType } from './websocket.adapter';

/**
 * Interface for collaboration session data
 */
export interface CollaborationSession {
  id: string;
  threatModelId: string;
  threatModelName: string;
  diagramId: string;
  diagramName: string;
  host: string;
  startedAt: Date;
  activeUsers: number;
}

/**
 * Interface for server collaboration session response
 */
interface ServerCollaborationSession {
  session_id: string;
  threat_model_id: string;
  threat_model_name?: string;
  diagram_id: string;
  diagram_name?: string;
  participants: Array<{
    user_id: string;
    joined_at?: string;
    permissions?: 'reader' | 'writer';
  }>;
  websocket_url: string;
  host?: string;
  started_at?: string;
}

/**
 * Interface for session started/ended WebSocket messages
 */
export interface SessionAnnouncement {
  session: CollaborationSession;
  action: 'started' | 'ended';
}

@Injectable({
  providedIn: 'root',
})
export class CollaborationSessionService implements OnDestroy {
  private readonly _sessions$ = new BehaviorSubject<CollaborationSession[]>([]);
  private readonly _destroy$ = new Subject<void>();
  private _subscriberCount = 0;
  private _sessionPollingSubscription: Subscription | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _authProvider: any = null; // Lazy-loaded to avoid circular dependency

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
    private webSocketAdapter: WebSocketAdapter,
    private injector: Injector,
  ) {
    this.initializeService();
  }

  /**
   * Observable stream of current collaboration sessions
   */
  get sessions$(): Observable<CollaborationSession[]> {
    return this._sessions$.asObservable();
  }

  /**
   * Observable that determines if collaboration section should be visible
   */
  get shouldShowCollaboration$(): Observable<boolean> {
    return this.serverConnectionService.connectionStatus$.pipe(
      map(serverStatus => serverStatus === ServerConnectionStatus.CONNECTED),
      shareReplay(1),
    );
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();

    if (this._sessionPollingSubscription) {
      this._sessionPollingSubscription.unsubscribe();
    }
  }

  /**
   * Subscribe to collaboration session polling
   * This will start session polling if no other subscribers exist
   */
  subscribeToSessionPolling(): void {
    this._subscriberCount++;
    this.logger.debugComponent(
      'CollaborationSession',
      `Session polling subscriber added (count: ${this._subscriberCount})`,
    );

    if (this._subscriberCount === 1) {
      this.logger.info('Starting collaboration session polling - first subscriber added');
      this.startSessionPolling();
    }
  }

  /**
   * Unsubscribe from collaboration session polling
   * This will stop session polling if no subscribers remain
   */
  unsubscribeFromSessionPolling(): void {
    if (this._subscriberCount > 0) {
      this._subscriberCount--;
      this.logger.debugComponent(
        'CollaborationSession',
        `Session polling subscriber removed (count: ${this._subscriberCount})`,
      );

      if (this._subscriberCount === 0) {
        this.logger.info('Stopping collaboration session polling - no subscribers remain');
        this.stopSessionPolling();
        // Clear sessions when no one is subscribing
        this._sessions$.next([]);
      }
    }
  }

  /**
   * Manually refresh collaboration sessions
   */
  refreshSessions(): void {
    this.loadSessions().subscribe({
      next: () => {
        this.logger.debugComponent('CollaborationSession', 'Manual sessions refresh completed');
      },
      error: error => {
        this.logger.error('Failed to refresh collaboration sessions', error);
      },
    });
  }

  /**
   * Initialize the service and set up reactive data flow
   */
  private initializeService(): void {
    // this.logger.info('CollaborationSessionService initialized');

    // Listen for WebSocket session announcements (always active for real-time updates)
    this.setupWebSocketListeners();
  }

  /**
   * Start polling for collaboration sessions
   */
  private startSessionPolling(): void {
    if (this._sessionPollingSubscription) {
      return; // Already polling
    }

    // Set up reactive session loading based on server connection
    this._sessionPollingSubscription = this.serverConnectionService.connectionStatus$
      .pipe(
        switchMap(() => this.loadSessions()),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: () => {
          this.logger.debugComponent('CollaborationSession', 'Reactive session loading completed');
        },
        error: error => {
          this.logger.error('Reactive session loading failed', error);
        },
      });
  }

  /**
   * Stop polling for collaboration sessions
   */
  private stopSessionPolling(): void {
    if (this._sessionPollingSubscription) {
      this._sessionPollingSubscription.unsubscribe();
      this._sessionPollingSubscription = null;
    }
  }

  /**
   * Load collaboration sessions based on current state
   */
  private loadSessions(): Observable<CollaborationSession[]> {
    if (this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED) {
      return this.loadRealSessions();
    } else {
      // No data to load - clear sessions
      this._sessions$.next([]);
      return EMPTY;
    }
  }

  /**
   * Load real collaboration sessions from server
   */
  private loadRealSessions(): Observable<CollaborationSession[]> {
    // Always use REST API to load sessions - WebSocket is only for real-time updates
    return this.requestSessionsViaHttp().pipe(
      map(sessions => {
        this.logger.debug('Loaded collaboration sessions from REST API', {
          count: sessions.length,
        });
        this._sessions$.next(sessions);
        return sessions;
      }),
    );
  }

  /**
   * Request sessions via HTTP API
   */
  private requestSessionsViaHttp(): Observable<CollaborationSession[]> {
    const url = `${environment.apiUrl}/collaboration/sessions`;

    return this.http.get<ServerCollaborationSession[]>(url).pipe(
      map(response => {
        // Transform server response to match our CollaborationSession interface
        return response.map(session => this.transformServerSession(session));
      }),
      catchError(error => {
        this.logger.error('Failed to load sessions via HTTP', error);
        return of([]);
      }),
    );
  }

  /**
   * Transform server session data to CollaborationSession format
   */
  private transformServerSession(serverSession: ServerCollaborationSession): CollaborationSession {
    this.logger.debugComponent(
      'CollaborationSession',
      'Transforming server session',
      serverSession,
    );

    const session: CollaborationSession = {
      id: serverSession.session_id,
      threatModelId: serverSession.threat_model_id,
      threatModelName:
        serverSession.threat_model_name || `TM ${serverSession.threat_model_id.slice(0, 8)}`,
      diagramId: serverSession.diagram_id,
      diagramName: serverSession.diagram_name || `Diagram ${serverSession.diagram_id.slice(0, 8)}`,
      host: serverSession.host || serverSession.participants[0]?.user_id || 'Unknown User',
      startedAt: new Date(
        serverSession.started_at || serverSession.participants[0]?.joined_at || Date.now(),
      ),
      activeUsers: serverSession.participants.length,
    };

    this.logger.debugComponent('CollaborationSession', 'Transformed session', session);
    return session;
  }

  /**
   * Set up WebSocket listeners for session announcements
   */
  private setupWebSocketListeners(): void {
    // Listen for session started announcements
    this.webSocketAdapter
      .getMessagesOfType<SessionAnnouncement>(MessageType.SESSION_STARTED)
      .pipe(takeUntil(this._destroy$))
      .subscribe(announcement => {
        this.handleSessionStarted(announcement.session);
      });

    // Listen for session ended announcements
    this.webSocketAdapter
      .getMessagesOfType<SessionAnnouncement>(MessageType.SESSION_ENDED)
      .pipe(takeUntil(this._destroy$))
      .subscribe(announcement => {
        this.handleSessionEnded(announcement.session);
      });
  }

  /**
   * Handle session started announcement
   */
  private handleSessionStarted(session: CollaborationSession): void {
    this.logger.info('Session started', {
      sessionId: session.id,
      diagramName: session.diagramName,
    });

    const currentSessions = this._sessions$.value;
    const existingIndex = currentSessions.findIndex(s => s.id === session.id);

    if (existingIndex === -1) {
      // Add new session
      this._sessions$.next([...currentSessions, session]);
    } else {
      // Update existing session
      const updatedSessions = [...currentSessions];
      updatedSessions[existingIndex] = session;
      this._sessions$.next(updatedSessions);
    }
  }

  /**
   * Handle session ended announcement
   */
  private handleSessionEnded(session: CollaborationSession): void {
    this.logger.info('Session ended', { sessionId: session.id, diagramName: session.diagramName });

    const currentSessions = this._sessions$.value;
    const updatedSessions = currentSessions.filter(s => s.id !== session.id);
    this._sessions$.next(updatedSessions);
  }

  /**
   * Lazy-load AuthProvider to avoid circular dependency
   * AuthService is in the auth module which depends on core services
   * We use late binding via Injector to get it without static import
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getAuthProvider(): any {
    if (!this._authProvider) {
      try {
        // Use dynamic import to load AuthService class without static import
        // This breaks the circular dependency at module level
        void import('../../auth/services/auth.service').then(module => {
          this._authProvider = this.injector.get(module.AuthService);
        });
        // Return null on first call - will be available on subsequent calls
        return null;
      } catch {
        // AuthService not yet available, return null
        return null;
      }
    }
    return this._authProvider;
  }
}
