import '@angular/compiler';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { of, throwError } from 'rxjs';

import { SseClientService } from './sse-client.service';
import { LoggerService } from './logger.service';
import { type IAuthService, type SseEvent } from '../interfaces';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
  },
}));

/** Build a ReadableStream from raw SSE text */
function makeStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

/** Build a mock Response object */
function makeResponse(
  ok: boolean,
  status: number,
  body: ReadableStream<Uint8Array> | null,
  headers: Record<string, string> = {},
): Response {
  const headerMap = new Headers(headers);
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    body,
    headers: headerMap,
  } as unknown as Response;
}

interface MockLoggerService {
  error: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  debugComponent: ReturnType<typeof vi.fn>;
}

interface MockAuthService {
  forceRefreshToken: ReturnType<typeof vi.fn>;
}

describe('SseClientService', () => {
  let service: SseClientService;
  let mockLogger: MockLoggerService;
  let mockAuth: MockAuthService;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockAuth = {
      forceRefreshToken: vi.fn(),
    };

    service = new SseClientService(
      mockAuth as unknown as IAuthService,
      mockLogger as unknown as LoggerService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should parse a single SSE event', () => {
    const sseText = 'event: token\ndata: hello\n\n';
    const stream = makeStream(sseText);
    const response = makeResponse(true, 200, stream);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      const events: SseEvent[] = [];
      service.post('/chat/session').subscribe({
        next: ev => events.push(ev),
        error: reject,
        complete: () => {
          try {
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ event: 'token', data: 'hello' });
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should parse multiple SSE events', () => {
    const sseText =
      'event: start\ndata: begin\n\nevent: token\ndata: world\n\nevent: end\ndata: done\n\n';
    const stream = makeStream(sseText);
    const response = makeResponse(true, 200, stream);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      const events: SseEvent[] = [];
      service.post('/chat/messages').subscribe({
        next: ev => events.push(ev),
        error: reject,
        complete: () => {
          try {
            expect(events).toHaveLength(3);
            expect(events[0]).toEqual({ event: 'start', data: 'begin' });
            expect(events[1]).toEqual({ event: 'token', data: 'world' });
            expect(events[2]).toEqual({ event: 'end', data: 'done' });
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should default event type to "message" when no event field is present', () => {
    const sseText = 'data: hello\n\n';
    const stream = makeStream(sseText);
    const response = makeResponse(true, 200, stream);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      const events: SseEvent[] = [];
      service.post('/chat/session').subscribe({
        next: ev => events.push(ev),
        error: reject,
        complete: () => {
          try {
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ event: 'message', data: 'hello' });
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should error with status when response is non-2xx', () => {
    const response = makeResponse(false, 503, null, { 'retry-after': '5' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      service.post('/chat/session').subscribe({
        next: () => reject(new Error('Should not emit')),
        error: (err: { status: number; retryAfter: number }) => {
          try {
            expect(err.status).toBe(503);
            expect(err.retryAfter).toBe(5);
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        complete: () => reject(new Error('Should not complete')),
      });
    });
  });

  it('should error on network failure', () => {
    const networkError = new Error('Network failure');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError));

    return new Promise<void>((resolve, reject) => {
      service.post('/chat/session').subscribe({
        next: () => reject(new Error('Should not emit')),
        error: (err: Error) => {
          try {
            expect(err.message).toBe('Network failure');
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        complete: () => reject(new Error('Should not complete')),
      });
    });
  });

  it('should call fetch with correct options', () => {
    const sseText = 'data: ok\n\n';
    const stream = makeStream(sseText);
    const response = makeResponse(true, 200, stream);
    const mockFetch = vi.fn().mockResolvedValue(response);
    vi.stubGlobal('fetch', mockFetch);

    const body = { sessionId: 'abc123' };

    return new Promise<void>((resolve, reject) => {
      service.post('/chat/messages', body).subscribe({
        error: reject,
        complete: () => {
          try {
            expect(mockFetch).toHaveBeenCalledOnce();
            const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
            expect(url).toBe('http://localhost:8080/chat/messages');
            expect(options.method).toBe('POST');
            expect(options.credentials).toBe('include');
            expect((options.headers as Record<string, string>)['Content-Type']).toBe(
              'application/json',
            );
            expect((options.headers as Record<string, string>)['Accept']).toBe('text/event-stream');
            expect(options.body).toBe(JSON.stringify(body));
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should cancel the stream reader when unsubscribed', () => {
    let streamController!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
      },
    });
    const response = makeResponse(true, 200, stream);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        const subscription = service.post('/chat/session').subscribe({
          next: () => {
            /* ignore */
          },
          error: reject,
        });

        setTimeout(() => {
          subscription.unsubscribe();
          try {
            streamController.close();
          } catch {
            // Already closed/cancelled — expected
          }
          resolve();
        }, 50);
      }, 0);
    });
  });

  it('should handle multi-line data fields (e.g. JSON)', () => {
    const json = JSON.stringify({ content: 'line1\nline2' });
    const sseText = `event: token\ndata: ${json}\n\n`;
    const stream = makeStream(sseText);
    const response = makeResponse(true, 200, stream);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));

    return new Promise<void>((resolve, reject) => {
      const events: SseEvent[] = [];
      service.post('/chat/messages', { msg: 'hi' }).subscribe({
        next: ev => events.push(ev),
        error: reject,
        complete: () => {
          try {
            expect(events).toHaveLength(1);
            expect(events[0].event).toBe('token');
            const parsed = JSON.parse(events[0].data) as { content: string };
            expect(parsed.content).toBe('line1\nline2');
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should retry after a 401 when forceRefreshToken succeeds', () => {
    const sseText = 'event: token\ndata: after-refresh\n\n';
    const stream = makeStream(sseText);

    const response401 = makeResponse(false, 401, null);
    const response200 = makeResponse(true, 200, stream);

    const mockFetch = vi.fn().mockResolvedValueOnce(response401).mockResolvedValueOnce(response200);
    vi.stubGlobal('fetch', mockFetch);

    mockAuth.forceRefreshToken.mockReturnValue(of({ expiresAt: new Date(), expiresIn: 3600 }));

    return new Promise<void>((resolve, reject) => {
      const events: SseEvent[] = [];
      service.post('/chat/session').subscribe({
        next: ev => events.push(ev),
        error: reject,
        complete: () => {
          try {
            expect(mockFetch).toHaveBeenCalledTimes(2);
            expect(mockAuth.forceRefreshToken).toHaveBeenCalledOnce();
            expect(events).toHaveLength(1);
            expect(events[0]).toEqual({ event: 'token', data: 'after-refresh' });
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
      });
    });
  });

  it('should error when forceRefreshToken fails on a 401', () => {
    const response401 = makeResponse(false, 401, null);
    const mockFetch = vi.fn().mockResolvedValue(response401);
    vi.stubGlobal('fetch', mockFetch);

    const refreshError = new Error('Refresh failed');
    mockAuth.forceRefreshToken.mockReturnValue(throwError(() => refreshError));

    return new Promise<void>((resolve, reject) => {
      service.post('/chat/session').subscribe({
        next: () => reject(new Error('Should not emit')),
        error: (err: Error) => {
          try {
            expect(err.message).toBe('Refresh failed');
            resolve();
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        },
        complete: () => reject(new Error('Should not complete')),
      });
    });
  });
});
