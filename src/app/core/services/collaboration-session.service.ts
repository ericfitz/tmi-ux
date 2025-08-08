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

    // If WebSocket is connected, use WebSocket to request sessions
    if (this.webSocketAdapter.isConnected) {
      return this.requestSessionsViaWebSocket();
    } else {
      // Fallback to HTTP API
      return this.requestSessionsViaHttp();
    }
  }

  /**
   * Request sessions via WebSocket
   */
  private requestSessionsViaWebSocket(): Observable<CollaborationSession[]> {
    return this.webSocketAdapter
      .sendMessageWithResponse<{ sessions: CollaborationSession[] }>(
        {
          type: MessageType.SESSION_LIST_REQUEST,
          data: {},
        },
        MessageType.SESSION_LIST_RESPONSE,
        5000,
      )
      .pipe(
        map(response => response.sessions),
        catchError(error => {
          this.logger.error('Failed to load sessions via WebSocket', error);
          // Fallback to HTTP
          return this.requestSessionsViaHttp();
        }),
      );
  }

  /**
   * Request sessions via HTTP API
   */
  private requestSessionsViaHttp(): Observable<CollaborationSession[]> {
    const url = `${environment.apiUrl}/collaboration/sessions`;
    
    return this.http.get<{ sessions: CollaborationSession[] }>(url).pipe(
      map(response => response.sessions || []),
      catchError(error => {
        this.logger.error('Failed to load sessions via HTTP', error);
        return of([]);
      }),
    );
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

    // Listen for session list responses
    this.webSocketAdapter
      .getMessagesOfType<{ sessions: CollaborationSession[] }>(MessageType.SESSION_LIST_RESPONSE)
      .pipe(takeUntil(this._destroy$))
      .subscribe(response => {
        this.logger.info('Received session list from WebSocket', { count: response.sessions.length });
        this._sessions$.next(response.sessions);
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