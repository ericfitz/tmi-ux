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

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, EMPTY, of, Subscription } from 'rxjs';
import { map, switchMap, takeUntil, catchError, shareReplay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { ServerConnectionService, ServerConnectionStatus } from './server-connection.service';
import { WebSocketAdapter, MessageType } from './websocket.adapter';
import { User } from '@app/pages/tm/models/threat-model.model';

/**
 * Interface for collaboration session data
 */
export interface CollaborationSession {
  id: string;
  threatModelId: string;
  threatModelName: string;
  diagramId: string;
  diagramName: string;
  host: User;
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
  host?: User;
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
// SEM@85c97d704e5197f893d6e6ce1a6b8a0763d47d21: poll and broadcast active collaboration sessions via WebSocket and HTTP (mutates shared state)
export class CollaborationSessionService implements OnDestroy {
  private readonly _sessions$ = new BehaviorSubject<CollaborationSession[]>([]);
  private readonly _destroy$ = new Subject<void>();
  private _subscriberCount = 0;
  private _sessionPollingSubscription: Subscription | null = null;

  // SEM@7b1c50d5310daf035ba2d194bb898b33003dc519: inject dependencies and initialize WebSocket listeners (mutates shared state)
  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
    private webSocketAdapter: WebSocketAdapter,
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

  // SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: cancel all subscriptions and stop session polling on destroy (mutates shared state)
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
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: register a polling consumer; start polling on first subscriber (mutates shared state)
  subscribeToSessionPolling(): void {
    this._subscriberCount++;
    // this.logger.debugComponent(
    //   'CollaborationSession',
    //   `Session polling subscriber added (count: ${this._subscriberCount})`,
    // );

    if (this._subscriberCount === 1) {
      // this.logger.info('Starting collaboration session polling - first subscriber added');
      this.startSessionPolling();
    }
  }

  /**
   * Unsubscribe from collaboration session polling
   * This will stop session polling if no subscribers remain
   */
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: deregister a polling consumer; stop polling when no subscribers remain (mutates shared state)
  unsubscribeFromSessionPolling(): void {
    if (this._subscriberCount > 0) {
      this._subscriberCount--;
      // this.logger.debugComponent(
      //   'CollaborationSession',
      //   `Session polling subscriber removed (count: ${this._subscriberCount})`,
      // );

      if (this._subscriberCount === 0) {
        // this.logger.info('Stopping collaboration session polling - no subscribers remain');
        this.stopSessionPolling();
        // Clear sessions when no one is subscribing
        this._sessions$.next([]);
      }
    }
  }

  /**
   * Manually refresh collaboration sessions
   */
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: manually trigger a one-shot reload of collaboration sessions (reads DB)
  refreshSessions(): void {
    this.loadSessions().subscribe({
      next: () => {
        // this.logger.debugComponent('CollaborationSession', 'Manual sessions refresh completed');
      },
      error: error => {
        this.logger.error('Failed to refresh collaboration sessions', error);
      },
    });
  }

  /**
   * Initialize the service and set up reactive data flow
   */
  // SEM@93bad2aec249e272774fbe2addcb34ee0615c847: set up WebSocket listeners for real-time session announcements (mutates shared state)
  private initializeService(): void {
    // this.logger.info('CollaborationSessionService initialized');

    // Listen for WebSocket session announcements (always active for real-time updates)
    this.setupWebSocketListeners();
  }

  /**
   * Start polling for collaboration sessions
   */
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: start reactive session polling tied to server connection status (mutates shared state)
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
          // this.logger.debugComponent('CollaborationSession', 'Reactive session loading completed');
        },
        error: error => {
          this.logger.error('Reactive session loading failed', error);
        },
      });
  }

  /**
   * Stop polling for collaboration sessions
   */
  // SEM@9e59453b8a7a00576b4430464d29100ac3a7ab7b: cancel the active collaboration session polling subscription (mutates shared state)
  private stopSessionPolling(): void {
    if (this._sessionPollingSubscription) {
      this._sessionPollingSubscription.unsubscribe();
      this._sessionPollingSubscription = null;
    }
  }

  /**
   * Load collaboration sessions based on current state
   */
  // SEM@99984b054fdc39a5bbb0b01e01beba172934773f: fetch collaboration sessions when connected, or clear the list (mutates shared state)
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
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: fetch collaboration sessions from REST API and publish to session stream (mutates shared state)
  private loadRealSessions(): Observable<CollaborationSession[]> {
    // Always use REST API to load sessions - WebSocket is only for real-time updates
    return this.requestSessionsViaHttp().pipe(
      map(sessions => {
        // this.logger.debug('Loaded collaboration sessions from REST API', {
        //   count: sessions.length,
        // });
        this._sessions$.next(sessions);
        return sessions;
      }),
    );
  }

  /**
   * Request sessions via HTTP API
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: fetch the current user's collaboration sessions from the REST API (reads DB)
  private requestSessionsViaHttp(): Observable<CollaborationSession[]> {
    const url = `${environment.apiUrl}/me/sessions`;

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
  // SEM@85c97d704e5197f893d6e6ce1a6b8a0763d47d21: convert a server collaboration session DTO to the client CollaborationSession model (pure)
  private transformServerSession(serverSession: ServerCollaborationSession): CollaborationSession {
    // this.logger.debugComponent(
    //   'CollaborationSession',
    //   'Transforming server session',
    //   serverSession,
    // );

    // Create a fallback User object if host is not provided
    const fallbackHost: User = {
      principal_type: 'user',
      provider: 'unknown',
      provider_id: serverSession.participants[0]?.user_id || 'unknown',
      email: serverSession.participants[0]?.user_id || '',
      display_name: serverSession.participants[0]?.user_id || 'Unknown',
    };

    const session: CollaborationSession = {
      id: serverSession.session_id,
      threatModelId: serverSession.threat_model_id,
      threatModelName:
        serverSession.threat_model_name || `TM ${serverSession.threat_model_id.slice(0, 8)}`,
      diagramId: serverSession.diagram_id,
      diagramName: serverSession.diagram_name || `Diagram ${serverSession.diagram_id.slice(0, 8)}`,
      host: serverSession.host || fallbackHost,
      startedAt: new Date(
        serverSession.started_at || serverSession.participants[0]?.joined_at || Date.now(),
      ),
      activeUsers: serverSession.participants.length,
    };

    // this.logger.debugComponent('CollaborationSession', 'Transformed session', session);
    return session;
  }

  /**
   * Set up WebSocket listeners for session announcements
   */
  // SEM@94f68d7fee2c7372bc00137ee2e1031b3e48fe89: register WebSocket listeners for session-started and session-ended announcements (mutates shared state)
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
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: add or update a collaboration session in the active session list (mutates shared state)
  private handleSessionStarted(session: CollaborationSession): void {
    // this.logger.info('Session started', {
    //   sessionId: session.id,
    //   diagramName: session.diagramName,
    // });

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
  // SEM@e2a977f3ac5871495f1b0d8d71c426f0b109bbc8: remove an ended collaboration session from the active session list (mutates shared state)
  private handleSessionEnded(session: CollaborationSession): void {
    // this.logger.info('Session ended', { sessionId: session.id, diagramName: session.diagramName });

    const currentSessions = this._sessions$.value;
    const updatedSessions = currentSessions.filter(s => s.id !== session.id);
    this._sessions$.next(updatedSessions);
  }
}
