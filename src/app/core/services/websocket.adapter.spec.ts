// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  WebSocketAdapter,
  WebSocketState,
  WebSocketErrorType,
  MessageType,
} from './websocket.adapter';
import { LoggerService } from './logger.service';

// Mock WebSocket since JSDOM doesn't have a real implementation
// SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: test double simulating a browser WebSocket for unit tests (pure)
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  protocol = '';
  url: string;

  // Store listeners in registration order to match real browser behavior
  private _handlers: Map<string, Array<{ handler: (event: unknown) => void; once: boolean }>> =
    new Map();

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: initialize mock WebSocket with a URL in CONNECTING state (pure)
  constructor(url: string) {
    this.url = url;
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: register an event handler on the mock WebSocket (mutates shared state)
  addEventListener(
    event: string,
    handler: (event: unknown) => void,
    options?: { once?: boolean },
  ): void {
    const handlers = this._handlers.get(event) || [];
    handlers.push({ handler, once: !!options?.once });
    this._handlers.set(event, handlers);
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: unregister an event handler from the mock WebSocket (mutates shared state)
  removeEventListener(event: string, handler: (event: unknown) => void): void {
    const handlers = this._handlers.get(event) || [];
    this._handlers.set(
      event,
      handlers.filter(h => h.handler !== handler),
    );
  }

  send = vi.fn();

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: close the mock WebSocket and emit a close event (mutates shared state)
  close(code?: number, _reason?: string): void {
    this.readyState = MockWebSocket.CLOSED;
    this._emit('close', { code: code || 1000, reason: _reason || '', wasClean: true });
  }

  // Test helpers to simulate WebSocket events
  // Fires handlers in registration order (matching real browser behavior)
  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: dispatch a named event to all registered handlers, removing one-time listeners (mutates shared state)
  _emit(event: string, data?: unknown): void {
    const handlers = this._handlers.get(event) || [];
    const remaining: Array<{ handler: (event: unknown) => void; once: boolean }> = [];

    for (const entry of handlers) {
      entry.handler(data);
      if (!entry.once) {
        remaining.push(entry);
      }
    }

    this._handlers.set(event, remaining);
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: simulate a WebSocket open event for test scenarios (mutates shared state)
  _simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this._emit('open', {});
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: simulate a WebSocket error event for test scenarios (mutates shared state)
  _simulateError(message?: string): void {
    this._emit('error', { message: message || 'WebSocket error occurred' });
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: simulate an inbound WebSocket message event for test scenarios (mutates shared state)
  _simulateMessage(data: string): void {
    this._emit('message', { data });
  }

  // SEM@adc23c30192359abc0155c90f4af2ee91d2faa8e: simulate a WebSocket close event with code and reason for test scenarios (mutates shared state)
  _simulateClose(code: number, reason: string, wasClean: boolean): void {
    this.readyState = MockWebSocket.CLOSED;
    this._emit('close', { code, reason, wasClean });
  }
}

describe('WebSocketAdapter', () => {
  let adapter: WebSocketAdapter;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let mockWebSocketInstance: MockWebSocket;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
      debug: vi.fn(),
    };

    adapter = new WebSocketAdapter(mockLogger as unknown as LoggerService);

    // Mock the global WebSocket constructor with static constants
    mockWebSocketInstance = new MockWebSocket('');
    const mockConstructor = vi.fn().mockImplementation(function (url: string) {
      mockWebSocketInstance = new MockWebSocket(url);
      return mockWebSocketInstance;
    });
    // WebSocket static constants are used by the adapter for readyState checks
    mockConstructor.CONNECTING = MockWebSocket.CONNECTING;
    mockConstructor.OPEN = MockWebSocket.OPEN;
    mockConstructor.CLOSING = MockWebSocket.CLOSING;
    mockConstructor.CLOSED = MockWebSocket.CLOSED;
    vi.stubGlobal('WebSocket', mockConstructor);
  });

  afterEach(() => {
    adapter.dispose();
    vi.unstubAllGlobals();
  });

  describe('Initial State', () => {
    it('should initialize in DISCONNECTED state', () => {
      expect(adapter.connectionState).toBe(WebSocketState.DISCONNECTED);
    });

    it('should not be connected initially', () => {
      expect(adapter.isConnected).toBe(false);
    });

    it('should have no last error initially', () => {
      expect(adapter.lastError).toBeNull();
    });
  });

  describe('connect()', () => {
    it('should transition to CONNECTING state when connect is called', () => {
      const states: WebSocketState[] = [];
      adapter.connectionState$.subscribe(state => states.push(state));

      adapter.connect('ws://localhost:8080/ws').subscribe();

      expect(states).toContain(WebSocketState.CONNECTING);
    });

    it('should transition to CONNECTED state on successful connection', () => {
      let completed = false;
      adapter.connect('ws://localhost:8080/ws').subscribe({
        complete: () => {
          completed = true;
        },
      });

      mockWebSocketInstance._simulateOpen();

      expect(completed).toBe(true);
      expect(adapter.connectionState).toBe(WebSocketState.CONNECTED);
      expect(adapter.isConnected).toBe(true);
    });

    it('should reset reconnect attempts on successful connection', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      // Verify via the connected state
      expect(adapter.connectionState).toBe(WebSocketState.CONNECTED);
    });

    it('should emit error on connection failure', () => {
      let error: Error | undefined;
      adapter.connect('ws://localhost:8080/ws').subscribe({
        error: (err: Error) => {
          error = err;
        },
      });

      mockWebSocketInstance._simulateError('Connection refused');

      expect(error).toBeDefined();
      expect(error!.message).toContain('WebSocket connection failed');
    });

    it('should transition to ERROR state on connection failure', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      mockWebSocketInstance._simulateError('Connection refused');

      expect(adapter.connectionState).toBe(WebSocketState.ERROR);
    });

    it('should complete immediately if already connected', () => {
      // First connection
      adapter.connect('ws://localhost:8080/ws').subscribe();
      const firstSocket = mockWebSocketInstance;
      firstSocket._simulateOpen();

      // The adapter stores the socket internally. When connect() is called again,
      // it checks this._socket.readyState === WebSocket.OPEN.
      // We need to ensure the global WebSocket.OPEN constant matches our mock's value.
      const mockConstructor = vi.fn().mockImplementation(() => firstSocket);
      // Copy static constants to the mock constructor
      mockConstructor.OPEN = MockWebSocket.OPEN;
      mockConstructor.CONNECTING = MockWebSocket.CONNECTING;
      mockConstructor.CLOSING = MockWebSocket.CLOSING;
      mockConstructor.CLOSED = MockWebSocket.CLOSED;
      vi.stubGlobal('WebSocket', mockConstructor);

      // Second connection attempt should complete immediately since socket is OPEN
      let completed = false;
      adapter.connect('ws://localhost:8080/ws').subscribe({
        complete: () => {
          completed = true;
        },
      });

      expect(completed).toBe(true);
    });

    it('should not log token in connection URL', () => {
      adapter.connect('ws://localhost:8080/ws?token=secret123').subscribe();

      // The logger sees only the path (no query string).
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Connecting WebSocket',
        expect.objectContaining({
          url: 'ws://localhost:8080/ws',
        }),
      );
      // And it must NOT carry the hasToken flag that previously hinted the
      // token was being passed in the URL.
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ hasToken: expect.anything() }),
      );
    });

    it('should strip ?token= before opening the WebSocket (tmi-ux#661)', () => {
      adapter
        .connect('wss://api.example.com/ws/diagrams/abc?token=eyJhbGciOiJIUzI1NiJ9')
        .subscribe();

      // The URL passed to `new WebSocket(...)` must not contain the token.
      expect(mockWebSocketInstance.url).toBe('wss://api.example.com/ws/diagrams/abc');
      // And the regression must be surfaced via a warning so it stays visible.
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Stripped `token` query parameter'),
        expect.objectContaining({ url: 'wss://api.example.com/ws/diagrams/abc' }),
      );
    });

    it('should strip token while preserving other query params (tmi-ux#661)', () => {
      adapter
        .connect('wss://api.example.com/ws/diagrams/abc?ticket=xyz&token=secret&foo=bar')
        .subscribe();

      const opened = mockWebSocketInstance.url;
      expect(opened).not.toContain('token=');
      expect(opened).toContain('ticket=xyz');
      expect(opened).toContain('foo=bar');
    });

    it('should pass through URLs that do not contain a token param (tmi-ux#661)', () => {
      adapter.connect('wss://api.example.com/ws/diagrams/abc?ticket=xyz').subscribe();

      expect(mockWebSocketInstance.url).toBe('wss://api.example.com/ws/diagrams/abc?ticket=xyz');
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });
  });

  describe('disconnect()', () => {
    it('should transition to DISCONNECTED state', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      adapter.disconnect();

      expect(adapter.connectionState).toBe(WebSocketState.DISCONNECTED);
      expect(adapter.isConnected).toBe(false);
    });

    it('should handle disconnect when not connected', () => {
      // Should not throw
      expect(() => adapter.disconnect()).not.toThrow();
    });
  });

  describe('sendMessage()', () => {
    it('should throw when not connected', () => {
      let error: Error | undefined;
      adapter
        .sendMessage({
          type: MessageType.JOIN_SESSION,
          data: {},
        })
        .subscribe({
          error: (err: Error) => {
            error = err;
          },
        });

      expect(error).toBeDefined();
      expect(error!.message).toBe('WebSocket is not connected');
    });

    it('should send message with generated id and timestamp', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      adapter
        .sendMessage({
          type: MessageType.JOIN_SESSION,
          data: { sessionId: 'session-1' },
        })
        .subscribe();

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(1);
      const sentMessage = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentMessage.id).toBeDefined();
      expect(sentMessage.id).toMatch(/^msg_/);
      expect(sentMessage.timestamp).toBeGreaterThan(0);
      expect(sentMessage.type).toBe(MessageType.JOIN_SESSION);
      expect(sentMessage.data).toEqual({ sessionId: 'session-1' });
    });

    it('should complete immediately for non-ack messages', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      let completed = false;
      adapter
        .sendMessage({
          type: MessageType.JOIN_SESSION,
          data: {},
        })
        .subscribe({
          complete: () => {
            completed = true;
          },
        });

      expect(completed).toBe(true);
    });
  });

  describe('sendTMIMessage()', () => {
    it('should throw when not connected', () => {
      let error: Error | undefined;
      adapter
        .sendTMIMessage({
          message_type: 'diagram_operation',
        } as never)
        .subscribe({
          error: (err: Error) => {
            error = err;
          },
        });

      expect(error).toBeDefined();
      expect(error!.message).toBe('WebSocket is not connected');
    });

    it('should serialize and send TMI message', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const message = {
        message_type: 'presenter_request',
      };

      adapter.sendTMIMessage(message as never).subscribe();

      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(1);
      const sentData = JSON.parse(mockWebSocketInstance.send.mock.calls[0][0]);
      expect(sentData.message_type).toBe('presenter_request');
    });
  });

  describe('Message Validation - WebSocket Messages', () => {
    it('should reject messages without required id field', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const errorHandler = vi.fn();
      adapter.errors$.subscribe(errorHandler);

      // Send invalid message (no id)
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          type: MessageType.JOIN_SESSION,
          timestamp: Date.now(),
          data: {},
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Received malformed WebSocket message',
        expect.objectContaining({
          reason: expect.stringContaining('valid id'),
        }),
      );
    });

    it('should reject messages without valid type', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          id: 'msg_123',
          type: '',
          timestamp: Date.now(),
          data: {},
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Received malformed WebSocket message',
        expect.objectContaining({
          reason: expect.stringContaining('valid type'),
        }),
      );
    });

    it('should reject messages with invalid JSON', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      mockWebSocketInstance._simulateMessage('not valid json {{{');

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Received malformed WebSocket message',
        expect.objectContaining({
          reason: expect.stringContaining('Invalid JSON'),
        }),
      );
    });

    it('should reject messages with unknown message type', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          id: 'msg_123',
          type: 'unknown_type_xyz',
          timestamp: Date.now(),
          data: {},
        }),
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Received malformed WebSocket message',
        expect.objectContaining({
          reason: expect.stringContaining('Unknown message type'),
        }),
      );
    });
  });

  describe('Message Validation - TMI Messages', () => {
    it('should accept valid TMI messages with message_type field', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const received: unknown[] = [];
      adapter.getTMIMessagesOfType('participants_update').subscribe(msg => {
        received.push(msg);
      });

      // Simulate a message_type message through the TMI handler
      // TMI messages are routed differently - they have message_type instead of id/type
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          message_type: 'participants_update',
          participants: [],
        }),
      );

      expect(received.length).toBe(1);
    });

    it('should filter TMI messages by type correctly', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const presenterMessages: unknown[] = [];
      adapter.getTMIMessagesOfType('current_presenter').subscribe(msg => {
        presenterMessages.push(msg);
      });

      // Send a different message type
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          message_type: 'participants_update',
          participants: [],
        }),
      );

      // Send the expected type
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          message_type: 'current_presenter',
          current_presenter: { email: 'test@example.com' },
        }),
      );

      expect(presenterMessages.length).toBe(1);
    });
  });

  describe('Error Classification', () => {
    it('should classify 401 errors as authentication failures', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      mockWebSocketInstance._simulateError('401 Unauthorized');

      expect(adapter.lastError).toBeDefined();
      expect(adapter.lastError!.type).toBe(WebSocketErrorType.AUTHENTICATION_FAILED);
      expect(adapter.lastError!.isRecoverable).toBe(false);
      expect(adapter.lastError!.retryable).toBe(false);
    });

    it('should classify 403 errors as authentication failures', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      mockWebSocketInstance._simulateError('403 Forbidden');

      expect(adapter.lastError).toBeDefined();
      expect(adapter.lastError!.type).toBe(WebSocketErrorType.AUTHENTICATION_FAILED);
    });

    it('should classify network errors as recoverable', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      mockWebSocketInstance._simulateError('network error: ENOTFOUND');

      expect(adapter.lastError).toBeDefined();
      expect(adapter.lastError!.type).toBe(WebSocketErrorType.NETWORK_ERROR);
      expect(adapter.lastError!.isRecoverable).toBe(true);
      expect(adapter.lastError!.retryable).toBe(true);
    });

    it('should classify timeout errors as recoverable', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      mockWebSocketInstance._simulateError('Connection timeout');

      expect(adapter.lastError).toBeDefined();
      expect(adapter.lastError!.type).toBe(WebSocketErrorType.NETWORK_ERROR);
      expect(adapter.lastError!.isRecoverable).toBe(true);
    });

    it('should default unknown errors to CONNECTION_FAILED', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });

      // Use a message that doesn't match network, timeout, 401, or 403 patterns
      mockWebSocketInstance._simulateError('Something weird happened');

      // The connect() error handler (which runs second) classifies the error
      // _setupEventListeners error handler runs first with generic NETWORK_ERROR
      // but connect() handler overwrites lastError with the classified one
      expect(adapter.lastError).toBeDefined();
      // The error message "Something weird happened" doesn't match any specific pattern
      // so it defaults to CONNECTION_FAILED
      expect(adapter.lastError!.type).toBe(WebSocketErrorType.CONNECTION_FAILED);
      expect(adapter.lastError!.isRecoverable).toBe(true);
    });
  });

  describe('errors$', () => {
    it('should emit error events on connection failure', () => {
      const errors: unknown[] = [];
      adapter.errors$.subscribe(err => errors.push(err));

      adapter.connect('ws://localhost:8080/ws').subscribe({ error: () => {} });
      mockWebSocketInstance._simulateError('Connection failed');

      // Two errors are emitted: one from _setupEventListeners (generic NETWORK_ERROR)
      // and one from connect() error handler (classified error)
      expect(errors.length).toBe(2);
      // Both should have the expected WebSocketError shape
      expect(errors[0]).toHaveProperty('type');
      expect(errors[0]).toHaveProperty('message');
      expect(errors[0]).toHaveProperty('isRecoverable');
      expect(errors[1]).toHaveProperty('type');
    });
  });

  describe('connectionState$', () => {
    it('should emit state transitions in order', () => {
      const states: WebSocketState[] = [];
      adapter.connectionState$.subscribe(state => states.push(state));

      // Initial state
      expect(states).toContain(WebSocketState.DISCONNECTED);

      // Connect
      adapter.connect('ws://localhost:8080/ws').subscribe();
      expect(states).toContain(WebSocketState.CONNECTING);

      // Successful connection
      mockWebSocketInstance._simulateOpen();
      expect(states).toContain(WebSocketState.CONNECTED);
    });

    it('should use distinctUntilChanged to avoid duplicate emissions', () => {
      const states: WebSocketState[] = [];
      adapter.connectionState$.subscribe(state => states.push(state));

      // Initial DISCONNECTED
      expect(states.length).toBe(1);

      // Multiple disconnects should not emit duplicates
      adapter.disconnect();
      adapter.disconnect();

      // Should only have 1 DISCONNECTED emission (deduplicated)
      expect(states.filter(s => s === WebSocketState.DISCONNECTED).length).toBe(1);
    });
  });

  describe('sendMessageWithRetry()', () => {
    it('should succeed on first attempt when connected', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      let completed = false;
      adapter
        .sendMessageWithRetry({
          type: MessageType.COMMAND_EXECUTE,
          data: { command: 'test' },
        })
        .subscribe({
          complete: () => {
            completed = true;
          },
        });

      expect(completed).toBe(true);
      expect(mockWebSocketInstance.send).toHaveBeenCalledTimes(1);
    });

    it('should error when not connected and all retries fail', () => {
      vi.useFakeTimers();

      let error: Error | undefined;
      adapter
        .sendMessageWithRetry(
          {
            type: MessageType.COMMAND_EXECUTE,
            data: {},
          },
          1,
        )
        .subscribe({
          error: (err: Error) => {
            error = err;
          },
        });

      // First attempt fails immediately (not connected)
      // Wait for retry delay
      vi.advanceTimersByTime(2000);

      expect(error).toBeDefined();
      vi.useRealTimers();
    });
  });

  describe('dispose()', () => {
    it('should disconnect and clean up resources', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      adapter.dispose();

      expect(adapter.connectionState).toBe(WebSocketState.DISCONNECTED);
    });

    it('should reject pending acknowledgments', async () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      // Send a message requiring ack
      const errorPromise = new Promise<Error>(resolve => {
        adapter
          .sendMessage({
            type: MessageType.COMMAND_EXECUTE,
            data: {},
            requiresAck: true,
          })
          .subscribe({
            error: (err: Error) => {
              resolve(err);
            },
          });
      });

      // Dispose should reject pending acks
      adapter.dispose();

      // Wait for the promise rejection to propagate
      const error = await errorPromise;
      expect(error).toBeDefined();
      expect(error.message).toBe('Connection closed');
    });
  });

  describe('setAuthService()', () => {
    it('should accept an auth service for token refresh', () => {
      const mockAuthService = {
        getValidToken: vi.fn(),
      };

      // Should not throw
      expect(() => adapter.setAuthService(mockAuthService as never)).not.toThrow();
    });
  });

  describe('getSessionMessages()', () => {
    it('should filter messages by session ID', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const session1Messages: unknown[] = [];
      adapter.getSessionMessages('session-1').subscribe(msg => {
        session1Messages.push(msg);
      });

      // Send message for session-1
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          id: 'msg_1',
          type: MessageType.COMMAND_EXECUTE,
          timestamp: Date.now(),
          sessionId: 'session-1',
          data: { command: 'test1' },
        }),
      );

      // Send message for session-2
      mockWebSocketInstance._simulateMessage(
        JSON.stringify({
          id: 'msg_2',
          type: MessageType.COMMAND_EXECUTE,
          timestamp: Date.now(),
          sessionId: 'session-2',
          data: { command: 'test2' },
        }),
      );

      expect(session1Messages.length).toBe(1);
    });
  });

  describe('Connection Close Handling', () => {
    it('should transition to DISCONNECTED on close', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      mockWebSocketInstance._simulateClose(1000, 'Normal closure', true);

      expect(adapter.connectionState).toBe(WebSocketState.DISCONNECTED);
    });

    it('should log close event details', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      mockWebSocketInstance._simulateClose(1006, 'Abnormal closure', false);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'WebSocket connection closed',
        expect.objectContaining({
          code: 1006,
          reason: 'Abnormal closure',
          wasClean: false,
        }),
      );
    });
  });

  describe('Malformed Message Handling', () => {
    it('should handle non-JSON messages gracefully', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      const errors: unknown[] = [];
      adapter.errors$.subscribe(err => errors.push(err));

      // Send something that's not JSON
      mockWebSocketInstance._simulateMessage('plain text message');

      expect(errors.length).toBe(1);
      expect(errors[0]).toHaveProperty('type', WebSocketErrorType.PARSE_ERROR);
    });

    it('should truncate long malformed messages in logs', () => {
      adapter.connect('ws://localhost:8080/ws').subscribe();
      mockWebSocketInstance._simulateOpen();

      // Send a very long invalid message
      const longMessage = 'x'.repeat(300);
      mockWebSocketInstance._simulateMessage(longMessage);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Received malformed WebSocket message',
        expect.objectContaining({
          rawData: expect.stringContaining('[truncated]'),
        }),
      );
    });
  });
});
