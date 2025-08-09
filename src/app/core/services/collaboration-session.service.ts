/**
 * Collaboration Session Service
 *
 * This service manages collaboration sessions with real-time updates via WebSocket.
 * It provides centralized session management with support for both mock and real data.
 *
 * Key functionality:
 * - Queries server for available collaboration sessions
 * - Monitors WebSocket for session announcements (started/ended)
 * - Provides reactive streams for session list updates
 * - Integrates with MockDataService for development/testing
 * - Handles server connectivity states
 */

import { Injectable, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject, combineLatest, EMPTY, of } from 'rxjs';
import { map, switchMap, takeUntil, catchError, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import { MockDataService } from '../../mocks/mock-data.service';
import { ServerConnectionService, ServerConnectionStatus } from './server-connection.service';
import { WebSocketAdapter, MessageType } from '../../pages/dfd/infrastructure/adapters/websocket.adapter';

/**
 * Interface for collaboration session data
 */
export interface CollaborationSession {
  id: string;
  threatModelId: string;
  threatModelName: string;
  diagramId: string;
  diagramName: string;
  hostUser: string;
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
  }>;
  websocket_url: string;
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

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private mockDataService: MockDataService,
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
    return combineLatest([
      this.mockDataService.useMockData$,
      this.serverConnectionService.connectionStatus$,
    ]).pipe(
      map(([useMockData, serverStatus]) => {
        // Show if using mock data OR server is connected
        return useMockData || serverStatus === ServerConnectionStatus.CONNECTED;
      }),
      distinctUntilChanged(),
      shareReplay(1),
    );
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /**
   * Manually refresh collaboration sessions
   */
  refreshSessions(): void {
    this.loadSessions().subscribe({
      next: () => {
        this.logger.debugComponent('CollaborationSession', 'Manual sessions refresh completed');
      },
      error: (error) => {
        this.logger.error('Failed to refresh collaboration sessions', error);
      }
    });
  }

  /**
   * Initialize the service and set up reactive data flow
   */
  private initializeService(): void {
    this.logger.info('CollaborationSessionService initialized');

    // Set up reactive session loading based on mock data toggle and server connection
    combineLatest([
      this.mockDataService.useMockData$,
      this.serverConnectionService.connectionStatus$,
    ])
      .pipe(
        switchMap(() => this.loadSessions()),
        takeUntil(this._destroy$),
      )
      .subscribe({
        next: () => {
          this.logger.debugComponent('CollaborationSession', 'Reactive session loading completed');
        },
        error: (error) => {
          this.logger.error('Reactive session loading failed', error);
        }
      });

    // Listen for WebSocket session announcements
    this.setupWebSocketListeners();
  }

  /**
   * Load collaboration sessions based on current state
   */
  private loadSessions(): Observable<CollaborationSession[]> {
    if (this.mockDataService.isUsingMockData) {
      return this.loadMockSessions();
    } else if (this.serverConnectionService.currentStatus === ServerConnectionStatus.CONNECTED) {
      return this.loadRealSessions();
    } else {
      // No data to load - clear sessions
      this._sessions$.next([]);
      return EMPTY;
    }
  }

  /**
   * Load mock collaboration sessions
   */
  private loadMockSessions(): Observable<CollaborationSession[]> {
    const mockSessions = this.mockDataService.getMockCollaborationSessions();
    this.logger.info('Loading mock collaboration sessions', { count: mockSessions.length });
    
    this._sessions$.next(mockSessions);
    return of(mockSessions);
  }

  /**
   * Load real collaboration sessions from server
   */
  private loadRealSessions(): Observable<CollaborationSession[]> {
    this.logger.info('Loading collaboration sessions from server');

    // Always use HTTP API to load sessions - WebSocket is only for real-time updates
    return this.requestSessionsViaHttp().pipe(
      map(sessions => {
        this.logger.info('Loaded sessions from HTTP API', { count: sessions.length, sessions });
        this._sessions$.next(sessions);
        return sessions;
      })
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
    this.logger.debugComponent('CollaborationSession', 'Transforming server session', serverSession);
    
    const session: CollaborationSession = {
      id: serverSession.session_id,
      threatModelId: serverSession.threat_model_id,
      threatModelName: serverSession.threat_model_name || `TM ${serverSession.threat_model_id.slice(0, 8)}`,
      diagramId: serverSession.diagram_id,
      diagramName: serverSession.diagram_name || `Diagram ${serverSession.diagram_id.slice(0, 8)}`,
      hostUser: serverSession.participants[0]?.user_id || 'Unknown User',
      startedAt: new Date(serverSession.started_at || serverSession.participants[0]?.joined_at || Date.now()),
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
    this.logger.info('Session started', { sessionId: session.id, diagramName: session.diagramName });
    
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
}