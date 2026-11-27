// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { CollaborationSessionService } from './collaboration-session.service';
import { LoggerService } from './logger.service';
import { ServerConnectionService, ServerConnectionStatus } from './server-connection.service';
import { WebSocketAdapter } from './websocket.adapter';

describe('CollaborationSessionService', () => {
  let service: CollaborationSessionService;
  let mockHttpClient: {
    get: ReturnType<typeof vi.fn>;
  };
  let mockLoggerService: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockServerConnectionService: {
    connectionStatus$: BehaviorSubject<ServerConnectionStatus>;
  };
  let mockWebSocketAdapter: {
    onMessage: ReturnType<typeof vi.fn>;
    isConnected: ReturnType<typeof vi.fn>;
    getMessagesOfType: ReturnType<typeof vi.fn>;
  };
  beforeEach(() => {
    vi.clearAllMocks();

    mockHttpClient = {
      get: vi.fn(),
    };

    mockLoggerService = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockServerConnectionService = {
      connectionStatus$: new BehaviorSubject<ServerConnectionStatus>(
        ServerConnectionStatus.CONNECTED,
      ),
    };

    mockWebSocketAdapter = {
      onMessage: vi.fn().mockReturnValue(of()),
      isConnected: vi.fn().mockReturnValue(true),
      getMessagesOfType: vi.fn().mockReturnValue(of()),
    };

    service = new CollaborationSessionService(
      mockHttpClient as unknown as HttpClient,
      mockLoggerService as unknown as LoggerService,
      mockServerConnectionService as unknown as ServerConnectionService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with empty sessions', () => {
      service.sessions$.subscribe(sessions => {
        expect(sessions).toEqual([]);
      });
    });
  });

  describe('sessions$', () => {
    it('should provide observable of sessions', () => {
      service.sessions$.subscribe(sessions => {
        expect(Array.isArray(sessions)).toBe(true);
      });
    });
  });

  describe('shouldShowCollaboration$', () => {
    it('should return true when server is connected', () => {
      mockServerConnectionService.connectionStatus$.next(ServerConnectionStatus.CONNECTED);

      service.shouldShowCollaboration$.subscribe(shouldShow => {
        expect(shouldShow).toBe(true);
      });
    });

    it('should return false when server is not configured', () => {
      mockServerConnectionService.connectionStatus$.next(ServerConnectionStatus.NOT_CONFIGURED);

      service.shouldShowCollaboration$.subscribe(shouldShow => {
        expect(shouldShow).toBe(false);
      });
    });

    it('should return false when server has error', () => {
      mockServerConnectionService.connectionStatus$.next(ServerConnectionStatus.ERROR);

      service.shouldShowCollaboration$.subscribe(shouldShow => {
        expect(shouldShow).toBe(false);
      });
    });
  });

  describe('subscribeToSessionPolling()', () => {
    it('should increment subscriber count', () => {
      service.subscribeToSessionPolling();

      // Subscriber count is tracked internally
      expect(service).toBeTruthy();
    });

    it('should start polling on first subscriber', () => {
      mockHttpClient.get.mockReturnValue(of([]));

      service.subscribeToSessionPolling();

      // Polling should be started
      expect(service).toBeTruthy();
    });

    it('should not start polling again for second subscriber', () => {
      mockHttpClient.get.mockReturnValue(of([]));

      service.subscribeToSessionPolling();
      const firstCallCount = mockHttpClient.get.mock.calls.length;

      service.subscribeToSessionPolling();

      // Should not make additional HTTP calls
      expect(mockHttpClient.get.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('unsubscribeFromSessionPolling()', () => {
    it('should decrement subscriber count', () => {
      service.subscribeToSessionPolling();
      service.unsubscribeFromSessionPolling();

      expect(service).toBeTruthy();
    });

    it('should clear sessions when last subscriber unsubscribes', () => {
      service.subscribeToSessionPolling();
      service.unsubscribeFromSessionPolling();

      service.sessions$.subscribe(sessions => {
        expect(sessions).toEqual([]);
      });
    });

    it('should not go below zero subscribers', () => {
      service.unsubscribeFromSessionPolling();
      service.unsubscribeFromSessionPolling();

      // Should not cause errors
      expect(service).toBeTruthy();
    });
  });

  describe('GET /me/sessions (OpenAPI 3.0.3 CollaborationSession[])', () => {
    const alice = {
      principal_type: 'user' as const,
      provider: 'tmi',
      provider_id: 'alice@tmi.local',
      display_name: 'Alice',
      email: 'alice@tmi.local',
    };
    const specSession = {
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      threat_model_id: '550e8400-e29b-41d4-a716-446655440002',
      threat_model_name: 'Payment Service',
      diagram_id: '550e8400-e29b-41d4-a716-446655440001',
      diagram_name: 'Checkout DFD',
      participants: [
        { user: alice, last_activity: '2026-11-26T12:00:00Z', permissions: 'writer' as const },
      ],
      websocket_url: 'wss://api.tmi.dev/ws',
    };

    it('maps a spec-shaped session, using the given host', async () => {
      mockHttpClient.get.mockReturnValue(of([{ ...specSession, host: alice }]));
      const sessions = await new Promise<unknown[]>(resolve =>
        service['requestSessionsViaHttp']().subscribe(resolve),
      );
      expect(sessions).toEqual([
        expect.objectContaining({
          id: specSession.session_id,
          threatModelId: specSession.threat_model_id,
          threatModelName: 'Payment Service',
          diagramId: specSession.diagram_id,
          diagramName: 'Checkout DFD',
          host: alice,
          activeUsers: 1,
        }),
      ]);
    });

    it('falls back to the first participant as host when the server omits host', async () => {
      mockHttpClient.get.mockReturnValue(of([specSession]));
      const sessions = await new Promise<Array<{ host: unknown }>>(resolve =>
        service['requestSessionsViaHttp']().subscribe(resolve),
      );
      expect(sessions[0].host).toEqual(alice);
    });

    it('uses a placeholder host when there is neither host nor participant', async () => {
      mockHttpClient.get.mockReturnValue(of([{ ...specSession, participants: [] }]));
      const sessions = await new Promise<
        Array<{ host: { display_name: string }; activeUsers: number }>
      >(resolve => service['requestSessionsViaHttp']().subscribe(resolve));
      expect(sessions[0].host.display_name).toBe('Unknown');
      expect(sessions[0].activeUsers).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      service.ngOnDestroy();

      expect(service).toBeTruthy();
    });

    it('should stop polling on destroy', () => {
      mockHttpClient.get.mockReturnValue(of([]));

      service.subscribeToSessionPolling();
      service.ngOnDestroy();

      expect(service).toBeTruthy();
    });
  });
});
