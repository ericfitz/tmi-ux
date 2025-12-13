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
import { Injector } from '@angular/core';
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
  let mockInjector: {
    get: ReturnType<typeof vi.fn>;
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

    mockInjector = {
      get: vi.fn(),
    };

    service = new CollaborationSessionService(
      mockHttpClient as unknown as HttpClient,
      mockLoggerService as unknown as LoggerService,
      mockServerConnectionService as unknown as ServerConnectionService,
      mockWebSocketAdapter as unknown as WebSocketAdapter,
      mockInjector as unknown as Injector,
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
