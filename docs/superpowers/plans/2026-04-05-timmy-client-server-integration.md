# Timmy Client-Server Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock/client-side Timmy chat with a real server-integrated implementation using SSE for streaming and REST for CRUD.

**Architecture:** New `SseClientService` (generic SSE-over-POST using fetch + ReadableStream) in core, new `TimmyChatService` in chat module wrapping both SSE and REST endpoints. Components reworked for server-driven sessions and token-by-token message streaming. Old mock, IndexedDB, client-side context builder, and source panel removed.

**Tech Stack:** Angular 19, RxJS, fetch API (ReadableStream), Angular Material, ngx-markdown, Vitest

---

## File Map

### New Files
| File | Responsibility |
|---|---|
| `src/app/core/services/sse-client.service.ts` | Generic SSE-over-POST client: fetch + ReadableStream → Observable\<SseEvent\> |
| `src/app/core/services/sse-client.service.spec.ts` | Unit tests for SseClientService |
| `src/app/pages/chat/services/timmy-chat.service.ts` | Server API client: session CRUD (REST via ApiService), session creation + message sending (SSE via SseClientService) |
| `src/app/pages/chat/services/timmy-chat.service.spec.ts` | Unit tests for TimmyChatService |

### Modified Files
| File | Changes |
|---|---|
| `src/app/pages/chat/models/chat.model.ts` | Replace interfaces with server-aligned model + SSE event types |
| `src/app/pages/chat/components/chat-page/chat-page.component.ts` | Server-driven sessions, streaming orchestration, preparation status |
| `src/app/pages/chat/components/chat-page/chat-page.component.html` | Remove tab group and source panel, add source summary rendering |
| `src/app/pages/chat/components/chat-page/chat-page.component.scss` | Remove tab group styles, adjust side panel |
| `src/app/pages/chat/components/chat-messages/chat-messages.component.ts` | Add streaming inputs, preparation status input, disable state |
| `src/app/pages/chat/components/chat-messages/chat-messages.component.html` | Status bubble, streaming message, pinned input layout |
| `src/app/pages/chat/components/chat-messages/chat-messages.component.scss` | Status bubble styles, layout fix for pinned input |
| `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.ts` | Add sourceSnapshot input, collapsible source summary |
| `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.html` | Collapsible source summary section, remove message count from session meta |
| `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.scss` | Source summary styles |
| `src/assets/i18n/en-US.json` | Add new i18n keys for status bubble, source summary, errors |

### Deleted Files
| File | Reason |
|---|---|
| `src/app/pages/chat/services/chat.service.ts` | Abstract base class replaced by concrete TimmyChatService |
| `src/app/pages/chat/services/mock-chat.service.ts` | Mock no longer needed |
| `src/app/pages/chat/services/mock-chat.service.spec.ts` | Mock tests removed |
| `src/app/pages/chat/services/chat-context-builder.service.ts` | Server builds context |
| `src/app/pages/chat/services/chat-context-builder.service.spec.ts` | Context builder tests removed |
| `src/app/pages/chat/services/chat-session-storage.service.ts` | Server manages sessions |
| `src/app/pages/chat/services/chat-session-storage.service.spec.ts` | Session storage tests removed |
| `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.ts` | Source toggles move to entity edit dialogs |
| `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.html` | Removed with component |
| `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.scss` | Removed with component |

---

## Task 1: Update Data Model

**Files:**
- Modify: `src/app/pages/chat/models/chat.model.ts`

- [ ] **Step 1: Replace chat.model.ts with server-aligned interfaces**

```typescript
/**
 * Chat feature models for the Timmy chat bot.
 *
 * These types define the data structures for chat sessions, messages,
 * SSE events, and preparation status for the server-integrated chat.
 */

export type EntityType = 'document' | 'repository' | 'diagram' | 'note' | 'asset' | 'threat';

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  tokenCount?: number;
  sequence: number;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  threatModelId: string;
  title: string;
  sourceSnapshot: SourceSnapshotEntry[];
  status: 'active' | 'archived';
  createdAt: string;
  modifiedAt: string;
}

export interface SourceSnapshotEntry {
  entityType: EntityType;
  entityId: string;
  entityName?: string;
}

/** Generic SSE event as parsed from a text/event-stream response. */
export interface SseEvent {
  event: string;
  data: string;
}

// Session creation SSE events
export interface SessionCreatedEvent {
  sessionId: string;
  sourceCount: number;
}

export interface ProgressEvent {
  phase: string;
  entityType: string;
  entityName: string;
  progress: number;
  detail?: string;
}

export interface ReadyEvent {
  sessionId: string;
  sourcesLoaded: number;
  chunksEmbedded: number;
  cachedReused: number;
  newlyEmbedded: number;
}

// Message streaming SSE events
export interface MessageStartEvent {
  messageId: string;
  role: 'assistant';
}

export interface TokenEvent {
  content: string;
}

export interface MessageEndEvent {
  messageId: string;
  tokenCount: number;
}

// Error event (can occur in either stream)
export interface ChatErrorEvent {
  code: string;
  message: string;
}

/** Client-side preparation status for the ephemeral status bubble. */
export interface PreparationStatus {
  phase: string;
  entityName: string;
  progress: number;
  current: number;
  total: number;
  ready?: boolean;
  readyStats?: ReadyEvent;
  error?: string;
}

/** Metadata key used to exclude entities from Timmy chat context. */
export const TIMMY_METADATA_KEY = 'timmy';
```

- [ ] **Step 2: Verify the project builds**

Run: `pnpm run build`
Expected: Build succeeds. There will be compilation errors in files that import removed types (`ChatContextPayload`, `SerializedEntity`, `ChatRole`, `ChatSession.messages`, `ChatSession.lastMessageAt`). These are expected and will be resolved in subsequent tasks when those files are modified or deleted. If there are errors in *other* files not related to the removed types, fix them now.

- [ ] **Step 3: Commit**

```bash
git add src/app/pages/chat/models/chat.model.ts
git commit -m "refactor(chat): update data model for server integration (#293)"
```

---

## Task 2: Create SseClientService

**Files:**
- Create: `src/app/core/services/sse-client.service.ts`
- Create: `src/app/core/services/sse-client.service.spec.ts`

- [ ] **Step 1: Write failing tests for SseClientService**

Create `src/app/core/services/sse-client.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { SseClientService } from './sse-client.service';
import { AuthService } from '../../auth/services/auth.service';
import { LoggerService } from './logger.service';
import { SseEvent } from '../../pages/chat/models/chat.model';

describe('SseClientService', () => {
  let service: SseClientService;
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockAuthService: { forceRefreshToken: ReturnType<typeof vi.fn> };
  let mockLogger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; info: ReturnType<typeof vi.fn> };

  /**
   * Helper: create a ReadableStream from SSE-formatted text.
   * Encodes the string and yields it as a single chunk.
   */
  function createSseStream(sseText: string): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sseText));
        controller.close();
      },
    });
  }

  /**
   * Helper: create a mock Response with a ReadableStream body.
   */
  function mockResponse(sseText: string, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      body: createSseStream(sseText),
      headers: new Headers({ 'content-type': 'text/event-stream' }),
    } as unknown as Response;
  }

  beforeEach(() => {
    mockAuthService = {
      forceRefreshToken: vi.fn(),
    };
    mockLogger = {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    };
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    TestBed.configureTestingModule({
      providers: [
        SseClientService,
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoggerService, useValue: mockLogger },
      ],
    });
    service = TestBed.inject(SseClientService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should parse a single SSE event', () => {
    const sseText = 'event: message_start\ndata: {"messageId":"abc","role":"assistant"}\n\n';
    mockFetch.mockResolvedValue(mockResponse(sseText));

    const events: SseEvent[] = [];
    return new Promise<void>((resolve, reject) => {
      service.post('/test', { body: true }).subscribe({
        next: event => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0].event).toBe('message_start');
          expect(events[0].data).toBe('{"messageId":"abc","role":"assistant"}');
          resolve();
        },
        error: reject,
      });
    });
  });

  it('should parse multiple SSE events', () => {
    const sseText =
      'event: token\ndata: {"content":"Hello"}\n\n' +
      'event: token\ndata: {"content":" world"}\n\n' +
      'event: message_end\ndata: {"messageId":"abc","tokenCount":2}\n\n';
    mockFetch.mockResolvedValue(mockResponse(sseText));

    const events: SseEvent[] = [];
    return new Promise<void>((resolve, reject) => {
      service.post('/test').subscribe({
        next: event => events.push(event),
        complete: () => {
          expect(events).toHaveLength(3);
          expect(events[0].event).toBe('token');
          expect(events[1].event).toBe('token');
          expect(events[2].event).toBe('message_end');
          resolve();
        },
        error: reject,
      });
    });
  });

  it('should handle events with no event field (default to "message")', () => {
    const sseText = 'data: {"content":"no event field"}\n\n';
    mockFetch.mockResolvedValue(mockResponse(sseText));

    const events: SseEvent[] = [];
    return new Promise<void>((resolve, reject) => {
      service.post('/test').subscribe({
        next: event => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          expect(events[0].event).toBe('message');
          expect(events[0].data).toBe('{"content":"no event field"}');
          resolve();
        },
        error: reject,
      });
    });
  });

  it('should error on non-2xx response', () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      headers: new Headers({ 'retry-after': '60' }),
    } as unknown as Response);

    return new Promise<void>((resolve, reject) => {
      service.post('/test').subscribe({
        next: () => reject(new Error('should not emit')),
        error: err => {
          expect(err.status).toBe(429);
          resolve();
        },
        complete: () => reject(new Error('should not complete')),
      });
    });
  });

  it('should error on network failure', () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    return new Promise<void>((resolve, reject) => {
      service.post('/test').subscribe({
        next: () => reject(new Error('should not emit')),
        error: err => {
          expect(err).toBeInstanceOf(TypeError);
          resolve();
        },
        complete: () => reject(new Error('should not complete')),
      });
    });
  });

  it('should call fetch with correct options', () => {
    const sseText = 'event: ready\ndata: {}\n\n';
    mockFetch.mockResolvedValue(mockResponse(sseText));

    return new Promise<void>((resolve, reject) => {
      service.post('/test', { key: 'value' }).subscribe({
        complete: () => {
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining('/test'),
            expect.objectContaining({
              method: 'POST',
              credentials: 'include',
              headers: expect.objectContaining({
                'Content-Type': 'application/json',
                Accept: 'text/event-stream',
              }),
              body: JSON.stringify({ key: 'value' }),
            }),
          );
          resolve();
        },
        error: reject,
      });
    });
  });

  it('should cancel the reader when unsubscribed', () => {
    const cancelFn = vi.fn();
    const reader = {
      read: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves — simulates ongoing stream
      cancel: cancelFn,
    };
    const body = { getReader: () => reader } as unknown as ReadableStream;
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      body,
      headers: new Headers(),
    } as unknown as Response);

    const sub = service.post('/test').subscribe();

    // Allow the fetch promise to resolve and the read loop to start
    return new Promise<void>(resolve => {
      setTimeout(() => {
        sub.unsubscribe();
        // Give the teardown a tick to run
        setTimeout(() => {
          expect(cancelFn).toHaveBeenCalled();
          resolve();
        }, 10);
      }, 10);
    });
  });

  it('should handle multi-line data fields', () => {
    const sseText = 'event: token\ndata: {"content":"line1\\nline2"}\n\n';
    mockFetch.mockResolvedValue(mockResponse(sseText));

    const events: SseEvent[] = [];
    return new Promise<void>((resolve, reject) => {
      service.post('/test').subscribe({
        next: event => events.push(event),
        complete: () => {
          expect(events).toHaveLength(1);
          const parsed = JSON.parse(events[0].data);
          expect(parsed.content).toBe('line1\nline2');
          resolve();
        },
        error: reject,
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --reporter=verbose src/app/core/services/sse-client.service.spec.ts`
Expected: FAIL — `SseClientService` does not exist yet.

- [ ] **Step 3: Implement SseClientService**

Create `src/app/core/services/sse-client.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';
import { LoggerService } from './logger.service';
import { SseEvent } from '../../pages/chat/models/chat.model';

/**
 * Generic SSE-over-POST client using fetch + ReadableStream.
 *
 * Returns an Observable<SseEvent> that emits parsed SSE events.
 * Uses cookie-based auth (credentials: 'include').
 * Cancels the stream when the Observable is unsubscribed.
 */
@Injectable({ providedIn: 'root' })
export class SseClientService {
  private readonly baseUrl: string;

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
  ) {
    const url = environment.apiUrl;
    this.baseUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  }

  /**
   * Send a POST request and stream the SSE response.
   * @param endpoint API endpoint path (e.g., '/threat_models/123/chat/sessions')
   * @param body Optional request body (will be JSON-serialized)
   * @returns Observable that emits each SSE event and completes when the stream ends
   */
  post(endpoint: string, body?: unknown): Observable<SseEvent> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${normalizedEndpoint}`;

    return new Observable<SseEvent>(subscriber => {
      const abortController = new AbortController();

      this.executeFetch(url, body, abortController, subscriber, false);

      // Teardown: cancel the stream when unsubscribed
      return () => {
        abortController.abort();
      };
    });
  }

  private executeFetch(
    url: string,
    body: unknown | undefined,
    abortController: AbortController,
    subscriber: Subscriber<SseEvent>,
    isRetry: boolean,
  ): void {
    const options: RequestInit = {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: abortController.signal,
    };

    fetch(url, options)
      .then(response => {
        if (response.status === 401 && !isRetry) {
          this.logger.warn('SSE request got 401, attempting token refresh');
          this.authService.forceRefreshToken().subscribe({
            next: () => {
              this.executeFetch(url, body, abortController, subscriber, true);
            },
            error: err => {
              subscriber.error({ status: 401, message: 'Authentication failed after refresh', cause: err });
            },
          });
          return;
        }

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          subscriber.error({
            status: response.status,
            statusText: response.statusText,
            retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
          });
          return;
        }

        if (!response.body) {
          subscriber.error({ status: response.status, message: 'Response has no body' });
          return;
        }

        this.readStream(response.body, subscriber);
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          // Expected when unsubscribed — complete silently
          subscriber.complete();
        } else {
          subscriber.error(err);
        }
      });
  }

  private readStream(
    body: ReadableStream<Uint8Array>,
    subscriber: Subscriber<SseEvent>,
  ): void {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const read = (): void => {
      reader
        .read()
        .then(({ done, value }) => {
          if (done) {
            // Flush any remaining buffer
            if (buffer.trim()) {
              this.parseAndEmit(buffer, subscriber);
            }
            subscriber.complete();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by double newlines
          const parts = buffer.split('\n\n');
          // Last part is incomplete — keep it in the buffer
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            if (part.trim()) {
              this.parseAndEmit(part, subscriber);
            }
          }

          read();
        })
        .catch(err => {
          if (err.name === 'AbortError') {
            subscriber.complete();
          } else {
            this.logger.error('SSE stream read error', err);
            subscriber.error(err);
          }
        });
    };

    // Wire up abort to cancel the reader
    // The AbortController signal is already handled by fetch,
    // but we also need to cancel the reader directly on unsubscribe
    // since the read loop may be in progress
    subscriber.add(() => {
      reader.cancel().catch(() => {
        // Ignore cancel errors (stream may already be closed)
      });
    });

    read();
  }

  private parseAndEmit(raw: string, subscriber: Subscriber<SseEvent>): void {
    let eventType = 'message';
    let data = '';

    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice(5).trim();
      }
      // Ignore other fields (id:, retry:, comments starting with :)
    }

    if (data) {
      subscriber.next({ event: eventType, data });
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --reporter=verbose src/app/core/services/sse-client.service.spec.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/core/services/sse-client.service.ts src/app/core/services/sse-client.service.spec.ts
git commit -m "feat(core): add SseClientService for SSE-over-POST streaming (#293)"
```

---

## Task 3: Create TimmyChatService

**Files:**
- Create: `src/app/pages/chat/services/timmy-chat.service.ts`
- Create: `src/app/pages/chat/services/timmy-chat.service.spec.ts`

- [ ] **Step 1: Write failing tests for TimmyChatService**

Create `src/app/pages/chat/services/timmy-chat.service.spec.ts`:

```typescript
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of } from 'rxjs';

import { TimmyChatService } from './timmy-chat.service';
import { ApiService } from '../../../../core/services/api.service';
import { SseClientService } from '../../../../core/services/sse-client.service';
import { ActivityTrackerService } from '../../../../core/services/activity-tracker.service';
import { ChatSession, ChatMessage, SseEvent } from '../../models/chat.model';

describe('TimmyChatService', () => {
  let service: TimmyChatService;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockSseClient: { post: ReturnType<typeof vi.fn> };
  let mockActivityTracker: { markActive: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockApiService = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
    };
    mockSseClient = {
      post: vi.fn(),
    };
    mockActivityTracker = {
      markActive: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        TimmyChatService,
        { provide: ApiService, useValue: mockApiService },
        { provide: SseClientService, useValue: mockSseClient },
        { provide: ActivityTrackerService, useValue: mockActivityTracker },
      ],
    });
    service = TestBed.inject(TimmyChatService);
  });

  describe('listSessions', () => {
    it('should call ApiService.get with correct endpoint', () => {
      const sessions: ChatSession[] = [];
      mockApiService.get.mockReturnValue(of(sessions));

      service.listSessions('tm-123').subscribe(result => {
        expect(result).toBe(sessions);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions');
    });
  });

  describe('getSession', () => {
    it('should call ApiService.get with correct endpoint', () => {
      const session = { id: 's-1' } as ChatSession;
      mockApiService.get.mockReturnValue(of(session));

      service.getSession('tm-123', 's-1').subscribe(result => {
        expect(result).toBe(session);
      });

      expect(mockApiService.get).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions/s-1');
    });
  });

  describe('deleteSession', () => {
    it('should call ApiService.delete with correct endpoint', () => {
      mockApiService.delete.mockReturnValue(of(undefined));

      service.deleteSession('tm-123', 's-1').subscribe();

      expect(mockApiService.delete).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions/s-1');
    });
  });

  describe('getMessages', () => {
    it('should call ApiService.get with correct endpoint and params', () => {
      const messages: ChatMessage[] = [];
      mockApiService.get.mockReturnValue(of(messages));

      service.getMessages('tm-123', 's-1', 50, 0).subscribe(result => {
        expect(result).toBe(messages);
      });

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        { limit: 50, offset: 0 },
      );
    });

    it('should omit params when not provided', () => {
      mockApiService.get.mockReturnValue(of([]));

      service.getMessages('tm-123', 's-1').subscribe();

      expect(mockApiService.get).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        undefined,
      );
    });
  });

  describe('createSession', () => {
    it('should call SseClientService.post with correct endpoint', () => {
      const events: SseEvent[] = [{ event: 'ready', data: '{}' }];
      mockSseClient.post.mockReturnValue(of(...events));

      service.createSession('tm-123').subscribe();

      expect(mockSseClient.post).toHaveBeenCalledWith('/threat_models/tm-123/chat/sessions');
    });

    it('should call markActive on the activity tracker', () => {
      mockSseClient.post.mockReturnValue(of({ event: 'ready', data: '{}' }));

      service.createSession('tm-123').subscribe();

      expect(mockActivityTracker.markActive).toHaveBeenCalled();
    });
  });

  describe('sendMessage', () => {
    it('should call SseClientService.post with correct endpoint and body', () => {
      const events: SseEvent[] = [{ event: 'message_end', data: '{}' }];
      mockSseClient.post.mockReturnValue(of(...events));

      service.sendMessage('tm-123', 's-1', 'Hello Timmy').subscribe();

      expect(mockSseClient.post).toHaveBeenCalledWith(
        '/threat_models/tm-123/chat/sessions/s-1/messages',
        { content: 'Hello Timmy' },
      );
    });

    it('should call markActive on the activity tracker', () => {
      mockSseClient.post.mockReturnValue(of({ event: 'message_end', data: '{}' }));

      service.sendMessage('tm-123', 's-1', 'Hello').subscribe();

      expect(mockActivityTracker.markActive).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/services/timmy-chat.service.spec.ts`
Expected: FAIL — `TimmyChatService` does not exist yet.

- [ ] **Step 3: Implement TimmyChatService**

Create `src/app/pages/chat/services/timmy-chat.service.ts`:

```typescript
import { Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../../../../core/services/api.service';
import { SseClientService } from '../../../../core/services/sse-client.service';
import { ActivityTrackerService } from '../../../../core/services/activity-tracker.service';
import { ChatSession, ChatMessage, SseEvent } from '../../models/chat.model';

/**
 * Client for the Timmy Chat API.
 *
 * Session CRUD and message history use REST via ApiService.
 * Session creation and message sending use SSE via SseClientService
 * for streaming progress/token events.
 */
@Injectable({ providedIn: 'root' })
export class TimmyChatService {
  constructor(
    private api: ApiService,
    private sse: SseClientService,
    private activityTracker: ActivityTrackerService,
  ) {}

  /**
   * Create a new chat session. Returns an SSE stream of progress events
   * (session_created, progress, ready, error).
   */
  createSession(threatModelId: string): Observable<SseEvent> {
    this.activityTracker.markActive();
    return this.sse.post(`/threat_models/${threatModelId}/chat/sessions`);
  }

  /** List the current user's chat sessions for a threat model. */
  listSessions(threatModelId: string): Observable<ChatSession[]> {
    return this.api.get<ChatSession[]>(`/threat_models/${threatModelId}/chat/sessions`);
  }

  /** Get a single session's details (metadata + source snapshot). */
  getSession(threatModelId: string, sessionId: string): Observable<ChatSession> {
    return this.api.get<ChatSession>(
      `/threat_models/${threatModelId}/chat/sessions/${sessionId}`,
    );
  }

  /** Soft-delete a session. */
  deleteSession(threatModelId: string, sessionId: string): Observable<void> {
    return this.api.delete<void>(
      `/threat_models/${threatModelId}/chat/sessions/${sessionId}`,
    );
  }

  /**
   * Send a message to Timmy. Returns an SSE stream of response events
   * (message_start, token, message_end, error).
   */
  sendMessage(
    threatModelId: string,
    sessionId: string,
    content: string,
  ): Observable<SseEvent> {
    this.activityTracker.markActive();
    return this.sse.post(
      `/threat_models/${threatModelId}/chat/sessions/${sessionId}/messages`,
      { content },
    );
  }

  /** Fetch message history for a session (paginated). */
  getMessages(
    threatModelId: string,
    sessionId: string,
    limit?: number,
    offset?: number,
  ): Observable<ChatMessage[]> {
    const params =
      limit !== undefined || offset !== undefined
        ? { ...(limit !== undefined && { limit }), ...(offset !== undefined && { offset }) }
        : undefined;
    return this.api.get<ChatMessage[]>(
      `/threat_models/${threatModelId}/chat/sessions/${sessionId}/messages`,
      params,
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- --reporter=verbose src/app/pages/chat/services/timmy-chat.service.spec.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/chat/services/timmy-chat.service.ts src/app/pages/chat/services/timmy-chat.service.spec.ts
git commit -m "feat(chat): add TimmyChatService for server API integration (#293)"
```

---

## Task 4: Delete Obsolete Files

**Files:**
- Delete: `src/app/pages/chat/services/chat.service.ts`
- Delete: `src/app/pages/chat/services/mock-chat.service.ts`
- Delete: `src/app/pages/chat/services/mock-chat.service.spec.ts`
- Delete: `src/app/pages/chat/services/chat-context-builder.service.ts`
- Delete: `src/app/pages/chat/services/chat-context-builder.service.spec.ts`
- Delete: `src/app/pages/chat/services/chat-session-storage.service.ts`
- Delete: `src/app/pages/chat/services/chat-session-storage.service.spec.ts`
- Delete: `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.ts`
- Delete: `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.html`
- Delete: `src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.scss`

- [ ] **Step 1: Delete the files**

```bash
rm src/app/pages/chat/services/chat.service.ts
rm src/app/pages/chat/services/mock-chat.service.ts
rm src/app/pages/chat/services/mock-chat.service.spec.ts
rm src/app/pages/chat/services/chat-context-builder.service.ts
rm src/app/pages/chat/services/chat-context-builder.service.spec.ts
rm src/app/pages/chat/services/chat-session-storage.service.ts
rm src/app/pages/chat/services/chat-session-storage.service.spec.ts
rm src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.ts
rm src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.html
rm src/app/pages/chat/components/chat-source-panel/chat-source-panel.component.scss
```

- [ ] **Step 2: Commit the deletions**

```bash
git add -A src/app/pages/chat/services/chat.service.ts \
  src/app/pages/chat/services/mock-chat.service.ts \
  src/app/pages/chat/services/mock-chat.service.spec.ts \
  src/app/pages/chat/services/chat-context-builder.service.ts \
  src/app/pages/chat/services/chat-context-builder.service.spec.ts \
  src/app/pages/chat/services/chat-session-storage.service.ts \
  src/app/pages/chat/services/chat-session-storage.service.spec.ts \
  src/app/pages/chat/components/chat-source-panel/
git commit -m "refactor(chat): remove mock services, IndexedDB storage, context builder, and source panel (#293)"
```

Note: The build will fail at this point because `ChatPageComponent` still imports the deleted files. This is expected and resolved in Task 5.

---

## Task 5: Update i18n Keys

**Files:**
- Modify: `src/assets/i18n/en-US.json`

- [ ] **Step 1: Update the chat i18n keys**

Find the existing `chat` section in `src/assets/i18n/en-US.json` and replace it with the updated keys. Keep all existing keys that are still used, remove keys for the source panel, and add new keys for preparation status, source summary, and error messages.

Remove these keys (source panel):
- `chat.sources`
- `chat.noSources`
- `chat.selectAll`
- `chat.deselectAll`
- `chat.entityGroups.*` (all sub-keys)

Add these keys:
```json
{
  "chat": {
    "title": "Timmy",
    "back": "Back to threat model",
    "sessions": "Sessions",
    "messages": "messages",
    "newSession": "New Session",
    "deleteSession": "Delete session",
    "noSessions": "No chat sessions yet. Start a conversation!",
    "send": "Send message",
    "inputPlaceholder": "Ask Timmy about this threat model...",
    "hideSidePanel": "Hide side panel",
    "showSidePanel": "Show side panel",
    "emptyState": {
      "title": "Chat with Timmy",
      "description": "Ask questions about your threat model. Timmy can help analyze threats, review assets, and discuss your security posture."
    },
    "suggestedPrompts": {
      "summary": "Give me a summary of this threat model",
      "threats": "What threats have been identified?",
      "assets": "What assets are in scope?"
    },
    "preparation": {
      "processing": "Processing source {{current}} of {{total}} — {{entityType}}: {{entityName}} — {{phase}} {{progress}}%",
      "ready": "Ready! {{sourcesLoaded}} sources loaded, {{chunksEmbedded}} chunks indexed.",
      "error": "Preparation failed: {{message}}"
    },
    "sourceSummary": {
      "title": "{{count}} sources included",
      "documents": "Documents",
      "repositories": "Repositories",
      "notes": "Notes",
      "assets": "Assets",
      "threats": "Threats",
      "diagrams": "Diagrams"
    },
    "errors": {
      "rateLimited": "Message limit reached. Try again in {{minutes}} minutes.",
      "serverBusy": "Server is busy. Try again in a moment.",
      "interrupted": "Response interrupted. Try sending your message again.",
      "generic": "Something went wrong. Please try again."
    }
  }
}
```

- [ ] **Step 2: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/assets/i18n/en-US.json
git commit -m "feat(i18n): update chat keys for server integration (#293)"
```

---

## Task 6: Rework ChatMessagesComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.ts`
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.html`
- Modify: `src/app/pages/chat/components/chat-messages/chat-messages.component.scss`

- [ ] **Step 1: Update the component TypeScript**

Replace the contents of `src/app/pages/chat/components/chat-messages/chat-messages.component.ts`:

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
} from '@angular/core';
import { TextFieldModule } from '@angular/cdk/text-field';
import { TranslocoModule } from '@jsverse/transloco';
import { MarkdownModule } from 'ngx-markdown';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ChatMessage, PreparationStatus } from '../../models/chat.model';

@Component({
  selector: 'app-chat-messages',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MarkdownModule,
    TextFieldModule,
    TranslocoModule,
  ],
  templateUrl: './chat-messages.component.html',
  styleUrl: './chat-messages.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatMessagesComponent implements AfterViewChecked {
  @Input() messages: ChatMessage[] = [];
  @Input() loading = false;
  @Input() streamingMessageId: string | null = null;
  @Input() preparationStatus: PreparationStatus | null = null;
  @Input() inputDisabled = false;

  @Output() messageSent = new EventEmitter<string>();

  @ViewChild('messagesContainer') messagesContainer?: ElementRef<HTMLDivElement>;

  messageText = '';
  private shouldScroll = false;

  get isInputDisabled(): boolean {
    return this.inputDisabled || this.loading || this.preparationStatus !== null;
  }

  get isSendDisabled(): boolean {
    return !this.messageText.trim() || this.isInputDisabled;
  }

  isStreaming(message: ChatMessage): boolean {
    return message.id === this.streamingMessageId;
  }

  onSend(): void {
    const text = this.messageText.trim();
    if (!text || this.isInputDisabled) return;

    this.messageSent.emit(text);
    this.messageText = '';
    this.shouldScroll = true;
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSend();
    }
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  trackByMessageId(_index: number, message: ChatMessage): string {
    return message.id;
  }

  scrollToBottom(): void {
    const el = this.messagesContainer?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }
}
```

- [ ] **Step 2: Update the component template**

Replace the contents of `src/app/pages/chat/components/chat-messages/chat-messages.component.html`:

```html
<ng-container *transloco="let t">
  <div class="chat-messages" #messagesContainer>
    @if (messages.length === 0 && !loading && !preparationStatus) {
      <div class="empty-state">
        <img src="TMI-IconOnly-Transparent-NoBuffer.png" alt="Timmy" class="empty-icon" />
        <h3>{{ t('chat.emptyState.title') }}</h3>
        <p>{{ t('chat.emptyState.description') }}</p>
        <div class="suggested-prompts">
          <button
            mat-stroked-button
            [disabled]="isInputDisabled"
            (click)="messageText = t('chat.suggestedPrompts.summary'); onSend()"
          >
            {{ t('chat.suggestedPrompts.summary') }}
          </button>
          <button
            mat-stroked-button
            [disabled]="isInputDisabled"
            (click)="messageText = t('chat.suggestedPrompts.threats'); onSend()"
          >
            {{ t('chat.suggestedPrompts.threats') }}
          </button>
          <button
            mat-stroked-button
            [disabled]="isInputDisabled"
            (click)="messageText = t('chat.suggestedPrompts.assets'); onSend()"
          >
            {{ t('chat.suggestedPrompts.assets') }}
          </button>
        </div>
      </div>
    }

    @for (message of messages; track trackByMessageId($index, message)) {
      <div
        class="message"
        [class.user]="message.role === 'user'"
        [class.assistant]="message.role === 'assistant'"
        [class.streaming]="isStreaming(message)"
      >
        <div class="message-avatar">
          @if (message.role === 'user') {
            <mat-icon>person</mat-icon>
          } @else {
            <img src="TMI-IconOnly-Transparent-NoBuffer.png" alt="Timmy" class="timmy-avatar" />
          }
        </div>
        <div class="message-content">
          @if (message.role === 'assistant' && !isStreaming(message)) {
            <markdown [data]="message.content"></markdown>
          } @else {
            <p>{{ message.content }}<span class="typing-cursor" *ngIf="isStreaming(message)"></span></p>
          }
        </div>
      </div>
    }

    @if (preparationStatus) {
      <div class="message assistant status-bubble">
        <div class="message-avatar">
          <img src="TMI-IconOnly-Transparent-NoBuffer.png" alt="Timmy" class="timmy-avatar" />
        </div>
        <div class="message-content status-content">
          @if (preparationStatus.ready) {
            <mat-icon class="status-icon ready">check_circle</mat-icon>
            <span>{{ t('chat.preparation.ready', {
              sourcesLoaded: preparationStatus.readyStats?.sourcesLoaded ?? 0,
              chunksEmbedded: preparationStatus.readyStats?.chunksEmbedded ?? 0
            }) }}</span>
          } @else if (preparationStatus.error) {
            <mat-icon class="status-icon error">error</mat-icon>
            <span>{{ t('chat.preparation.error', { message: preparationStatus.error }) }}</span>
          } @else {
            <mat-spinner diameter="18" class="status-spinner"></mat-spinner>
            <span>{{ t('chat.preparation.processing', {
              current: preparationStatus.current,
              total: preparationStatus.total,
              entityType: preparationStatus.entityName ? '' : '',
              entityName: preparationStatus.entityName,
              phase: preparationStatus.phase,
              progress: preparationStatus.progress
            }) }}</span>
          }
        </div>
      </div>
    }

    @if (loading && !preparationStatus) {
      <div class="message assistant loading">
        <div class="message-avatar">
          <img src="TMI-IconOnly-Transparent-NoBuffer.png" alt="Timmy" class="timmy-avatar" />
        </div>
        <div class="message-content">
          <mat-spinner diameter="24"></mat-spinner>
        </div>
      </div>
    }
  </div>

  <div class="chat-input">
    <mat-form-field appearance="outline" class="message-input">
      <textarea
        matInput
        [(ngModel)]="messageText"
        (keydown)="onKeydown($event)"
        [placeholder]="t('chat.inputPlaceholder')"
        [disabled]="isInputDisabled"
        rows="1"
        cdkTextareaAutosize
        cdkAutosizeMinRows="1"
        cdkAutosizeMaxRows="5"
      ></textarea>
    </mat-form-field>
    <button
      mat-icon-button
      [matTooltip]="t('chat.send')"
      (click)="onSend()"
      [disabled]="isSendDisabled"
      color="primary"
    >
      <mat-icon>send</mat-icon>
    </button>
  </div>
</ng-container>
```

- [ ] **Step 3: Update the component styles**

Replace the contents of `src/app/pages/chat/components/chat-messages/chat-messages.component.scss`:

```scss
:host {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
  color: var(--color-text-secondary, #666);
  padding: 32px;

  .empty-icon {
    width: 64px;
    height: 64px;
    opacity: 0.4;
    margin-bottom: 16px;
    object-fit: contain;
  }

  h3 {
    margin: 0 0 8px;
    font-weight: 500;
  }

  p {
    margin: 0 0 24px;
    max-width: 400px;
  }
}

.suggested-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
}

.message {
  display: flex;
  gap: 12px;
  max-width: 85%;

  &.user {
    align-self: flex-end;
    flex-direction: row-reverse;

    .message-content {
      background: var(--color-primary-light, #e3f2fd);
      border-radius: 16px 16px 4px;
    }
  }

  &.assistant {
    align-self: flex-start;

    .message-content {
      background: var(--color-background-card, #f5f5f5);
      border-radius: 16px 16px 16px 4px;
    }
  }

  &.loading .message-content {
    display: flex;
    align-items: center;
    padding: 12px 20px;
  }

  &.streaming .message-content {
    background: var(--color-background-card, #f5f5f5);
  }
}

.message-avatar {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background-card, #f5f5f5);

  mat-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;
  }

  .timmy-avatar {
    width: 24px;
    height: 24px;
    object-fit: contain;
  }
}

.message-content {
  padding: 12px 16px;
  line-height: 1.5;

  p {
    margin: 0;
    white-space: pre-wrap;
  }

  ::ng-deep {
    /* stylelint-disable-next-line selector-type-no-unknown -- ngx-markdown custom element */
    markdown {
      p:first-child {
        margin-top: 0;
      }

      p:last-child {
        margin-bottom: 0;
      }

      ul,
      ol {
        margin: 8px 0;
        padding-left: 20px;
      }

      code {
        background: rgb(0 0 0 / 6%);
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.9em;
      }

      pre {
        background: rgb(0 0 0 / 6%);
        padding: 12px;
        border-radius: 8px;
        overflow-x: auto;

        code {
          background: none;
          padding: 0;
        }
      }

      h2,
      h3 {
        margin-top: 12px;
        margin-bottom: 8px;
      }
    }
  }
}

// Typing cursor for streaming messages
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: currentcolor;
  margin-left: 1px;
  vertical-align: text-bottom;
  animation: blink 0.7s step-end infinite;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

// Ephemeral preparation status bubble
.status-bubble {
  .status-content {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-text-secondary, #666);
  }

  .status-icon {
    font-size: 20px;
    width: 20px;
    height: 20px;

    &.ready {
      color: var(--color-success, #4caf50);
    }

    &.error {
      color: var(--color-error, #f44336);
    }
  }

  .status-spinner {
    flex-shrink: 0;
  }
}

// Pinned input area — always visible at bottom
.chat-input {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 8px 16px 16px;
  border-top: 1px solid var(--color-border-light, #e0e0e0);
  flex-shrink: 0;

  .message-input {
    flex: 1;

    ::ng-deep .mat-mdc-form-field-subscript-wrapper {
      display: none;
    }
  }
}
```

- [ ] **Step 4: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/chat/components/chat-messages/
git commit -m "feat(chat): add streaming message rendering and preparation status bubble (#293)"
```

---

## Task 7: Rework ChatSessionPanelComponent

**Files:**
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.ts`
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.html`
- Modify: `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.scss`

- [ ] **Step 1: Update the component TypeScript**

Replace the contents of `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.ts`:

```typescript
import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { ChatSession, SourceSnapshotEntry, EntityType } from '../../models/chat.model';

interface SourceGroup {
  type: EntityType;
  labelKey: string;
  entries: SourceSnapshotEntry[];
}

@Component({
  selector: 'app-chat-session-panel',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...CORE_MATERIAL_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './chat-session-panel.component.html',
  styleUrl: './chat-session-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatSessionPanelComponent {
  @Input() sessions: ChatSession[] = [];
  @Input() activeSessionId: string | null = null;
  @Input() sourceSnapshot: SourceSnapshotEntry[] = [];

  @Output() sessionSelected = new EventEmitter<string>();
  @Output() sessionCreated = new EventEmitter<void>();
  @Output() sessionDeleted = new EventEmitter<string>();

  sourceSummaryExpanded = false;

  get sourceGroups(): SourceGroup[] {
    if (!this.sourceSnapshot.length) return [];

    const groupMap = new Map<EntityType, SourceSnapshotEntry[]>();
    for (const entry of this.sourceSnapshot) {
      const list = groupMap.get(entry.entityType) ?? [];
      list.push(entry);
      groupMap.set(entry.entityType, list);
    }

    const typeOrder: EntityType[] = ['asset', 'threat', 'document', 'repository', 'note', 'diagram'];
    const labelKeys: Record<EntityType, string> = {
      asset: 'chat.sourceSummary.assets',
      threat: 'chat.sourceSummary.threats',
      document: 'chat.sourceSummary.documents',
      repository: 'chat.sourceSummary.repositories',
      note: 'chat.sourceSummary.notes',
      diagram: 'chat.sourceSummary.diagrams',
    };

    return typeOrder
      .filter(type => groupMap.has(type))
      .map(type => ({
        type,
        labelKey: labelKeys[type],
        entries: groupMap.get(type)!,
      }));
  }

  onSelect(sessionId: string): void {
    this.sessionSelected.emit(sessionId);
  }

  onCreate(): void {
    this.sessionCreated.emit();
  }

  onDelete(event: Event, sessionId: string): void {
    event.stopPropagation();
    this.sessionDeleted.emit(sessionId);
  }

  toggleSourceSummary(): void {
    this.sourceSummaryExpanded = !this.sourceSummaryExpanded;
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  trackBySessionId(_index: number, session: ChatSession): string {
    return session.id;
  }
}
```

- [ ] **Step 2: Update the component template**

Replace the contents of `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.html`:

```html
<ng-container *transloco="let t">
  <div class="session-header">
    <button mat-raised-button color="primary" (click)="onCreate()">
      <mat-icon>add</mat-icon>
      {{ t('chat.newSession') }}
    </button>
  </div>

  @if (activeSessionId && sourceSnapshot.length > 0) {
    <div class="source-summary">
      <button
        class="source-summary-toggle"
        mat-button
        (click)="toggleSourceSummary()"
      >
        <mat-icon>{{ sourceSummaryExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
        {{ t('chat.sourceSummary.title', { count: sourceSnapshot.length }) }}
      </button>
      @if (sourceSummaryExpanded) {
        <div class="source-groups">
          @for (group of sourceGroups; track group.type) {
            <div class="source-group">
              <span class="source-group-label">{{ t(group.labelKey) }} ({{ group.entries.length }})</span>
              <span class="source-group-names">
                {{ group.entries.map(e => e.entityName || e.entityId).join(', ') }}
              </span>
            </div>
          }
        </div>
      }
    </div>
  }

  @if (sessions.length === 0) {
    <div class="empty-sessions">
      <mat-icon>forum</mat-icon>
      <p>{{ t('chat.noSessions') }}</p>
    </div>
  }

  <mat-list>
    @for (session of sessions; track trackBySessionId($index, session)) {
      <mat-list-item
        class="session-item"
        [class.active]="session.id === activeSessionId"
        (click)="onSelect(session.id)"
      >
        <div class="session-info">
          <span class="session-title">{{ session.title }}</span>
          <span class="session-meta">
            {{ formatDate(session.modifiedAt) }}
          </span>
        </div>
        <button
          mat-icon-button
          class="delete-btn"
          [matTooltip]="t('chat.deleteSession')"
          (click)="onDelete($event, session.id)"
        >
          <mat-icon>delete_outline</mat-icon>
        </button>
      </mat-list-item>
    }
  </mat-list>
</ng-container>
```

- [ ] **Step 3: Update the component styles**

Add the following to the end of `src/app/pages/chat/components/chat-session-panel/chat-session-panel.component.scss`:

```scss
.source-summary {
  padding: 0 8px;
  border-bottom: 1px solid var(--color-border-light, #e0e0e0);
}

.source-summary-toggle {
  width: 100%;
  text-align: left;
  font-size: 13px;
  color: var(--color-text-secondary, #666);
}

.source-groups {
  padding: 0 8px 12px;
}

.source-group {
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}

.source-group-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #666);
  margin-bottom: 2px;
}

.source-group-names {
  display: block;
  font-size: 12px;
  color: var(--color-text-tertiary, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 4: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/pages/chat/components/chat-session-panel/
git commit -m "feat(chat): add collapsible source summary to session panel (#293)"
```

---

## Task 8: Rework ChatPageComponent

This is the largest task — it rewires the orchestration layer from client-side to server-driven.

**Files:**
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.ts`
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.html`
- Modify: `src/app/pages/chat/components/chat-page/chat-page.component.scss`

- [ ] **Step 1: Replace the component TypeScript**

Replace the contents of `src/app/pages/chat/components/chat-page/chat-page.component.ts`:

```typescript
import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  OnInit,
  Optional,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { identity, MonoTypeOperatorFunction } from 'rxjs';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModel } from '../../../tm/models/threat-model.model';
import {
  ChatMessage,
  ChatSession,
  PreparationStatus,
  SourceSnapshotEntry,
  SseEvent,
  SessionCreatedEvent,
  ProgressEvent,
  ReadyEvent,
  MessageStartEvent,
  TokenEvent,
  MessageEndEvent,
  ChatErrorEvent,
} from '../../models/chat.model';
import { TimmyChatService } from '../../services/timmy-chat.service';
import { ChatMessagesComponent } from '../chat-messages/chat-messages.component';
import { ChatSessionPanelComponent } from '../chat-session-panel/chat-session-panel.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ChatMessagesComponent,
    ChatSessionPanelComponent,
  ],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPageComponent implements OnInit {
  threatModel: ThreatModel | null = null;
  threatModelId = '';
  messages: ChatMessage[] = [];
  sessions: ChatSession[] = [];
  activeSessionId: string | null = null;
  activeSourceSnapshot: SourceSnapshotEntry[] = [];
  loading = false;
  sidePanelOpen = true;
  streamingMessageId: string | null = null;
  preparationStatus: PreparationStatus | null = null;

  /** Tracks the source count from session_created to compute progress.current */
  private sessionSourceCount = 0;
  private progressCounter = 0;

  @ViewChild(ChatMessagesComponent) chatMessages?: ChatMessagesComponent;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private timmyChat: TimmyChatService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    @Optional() private destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    this.threatModelId = this.route.snapshot.paramMap.get('id') ?? '';
    this.threatModel = (this.route.snapshot.data['threatModel'] as ThreatModel) ?? null;

    this.loadSessions();
  }

  navigateBack(): void {
    void this.router.navigate(['/tm', this.threatModelId]);
  }

  toggleSidePanel(): void {
    this.sidePanelOpen = !this.sidePanelOpen;
  }

  onMessageSent(text: string): void {
    if (!this.threatModelId) return;

    if (!this.activeSessionId) {
      this.startNewSessionAndSend(text);
    } else {
      this.sendMessageToSession(text);
    }
  }

  onSessionSelected(sessionId: string): void {
    this.activeSessionId = sessionId;
    this.streamingMessageId = null;
    this.preparationStatus = null;

    // Find the session to get its source snapshot
    const session = this.sessions.find(s => s.id === sessionId);
    this.activeSourceSnapshot = session?.sourceSnapshot ?? [];

    this.timmyChat
      .getMessages(this.threatModelId, sessionId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: messages => {
          this.messages = messages;
          this.cdr.markForCheck();
          setTimeout(() => this.chatMessages?.scrollToBottom(), 0);
        },
        error: err => {
          this.logger.error('Failed to load messages', err);
        },
      });
  }

  onSessionCreated(): void {
    this.activeSessionId = null;
    this.activeSourceSnapshot = [];
    this.messages = [];
    this.streamingMessageId = null;
    this.preparationStatus = null;
    this.cdr.markForCheck();
  }

  onSessionDeleted(sessionId: string): void {
    this.timmyChat
      .deleteSession(this.threatModelId, sessionId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: () => {
          if (this.activeSessionId === sessionId) {
            this.activeSessionId = null;
            this.activeSourceSnapshot = [];
            this.messages = [];
          }
          this.loadSessions();
        },
        error: err => {
          this.logger.error('Failed to delete session', err);
        },
      });
  }

  private startNewSessionAndSend(text: string): void {
    // Add user message optimistically
    const userMessage = this.createUserMessage(text, 'pending-session');
    this.messages = [userMessage];
    this.cdr.markForCheck();

    // Track the pending text to send after session is ready
    let sessionId = '';
    this.sessionSourceCount = 0;
    this.progressCounter = 0;

    this.timmyChat
      .createSession(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (event: SseEvent) => {
          this.handleSessionCreationEvent(event, sessionIdFromEvent => {
            sessionId = sessionIdFromEvent;
          });
          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Session creation failed', err);
          this.preparationStatus = {
            phase: '',
            entityName: '',
            progress: 0,
            current: 0,
            total: 0,
            error: err.statusText ?? err.message ?? 'Connection failed',
          };
          this.cdr.markForCheck();
        },
        complete: () => {
          if (sessionId) {
            this.activeSessionId = sessionId;
            // Update user message with real session ID
            userMessage.sessionId = sessionId;
            this.loadSessions();
            // Now send the actual message
            this.sendMessageToSession(text);
          }
        },
      });
  }

  private handleSessionCreationEvent(
    event: SseEvent,
    onSessionId: (id: string) => void,
  ): void {
    switch (event.event) {
      case 'session_created': {
        const data = JSON.parse(event.data) as SessionCreatedEvent;
        onSessionId(data.sessionId);
        this.sessionSourceCount = data.sourceCount;
        this.preparationStatus = {
          phase: 'loading',
          entityName: '',
          progress: 0,
          current: 0,
          total: data.sourceCount,
        };
        break;
      }
      case 'progress': {
        const data = JSON.parse(event.data) as ProgressEvent;
        if (data.progress === 100) {
          this.progressCounter++;
        }
        this.preparationStatus = {
          phase: data.phase,
          entityName: data.entityName,
          progress: data.progress,
          current: this.progressCounter,
          total: this.sessionSourceCount,
        };
        break;
      }
      case 'ready': {
        const data = JSON.parse(event.data) as ReadyEvent;
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 100,
          current: this.sessionSourceCount,
          total: this.sessionSourceCount,
          ready: true,
          readyStats: data,
        };
        // Clear preparation status after a brief display
        setTimeout(() => {
          this.preparationStatus = null;
          this.cdr.markForCheck();
        }, 2000);
        break;
      }
      case 'error': {
        const data = JSON.parse(event.data) as ChatErrorEvent;
        this.preparationStatus = {
          phase: '',
          entityName: '',
          progress: 0,
          current: 0,
          total: 0,
          error: data.message,
        };
        break;
      }
    }
  }

  private sendMessageToSession(text: string): void {
    // Add user message optimistically (if not already added by startNewSessionAndSend)
    if (!this.messages.some(m => m.role === 'user' && m.content === text)) {
      const userMessage = this.createUserMessage(text, this.activeSessionId!);
      this.messages = [...this.messages, userMessage];
    }
    this.loading = true;
    this.cdr.markForCheck();

    let currentMessageId = '';
    let assembledContent = '';

    this.timmyChat
      .sendMessage(this.threatModelId, this.activeSessionId!, text)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: (event: SseEvent) => {
          switch (event.event) {
            case 'message_start': {
              const data = JSON.parse(event.data) as MessageStartEvent;
              currentMessageId = data.messageId;
              assembledContent = '';
              const assistantMessage: ChatMessage = {
                id: currentMessageId,
                sessionId: this.activeSessionId!,
                role: 'assistant',
                content: '',
                sequence: this.messages.length,
                createdAt: new Date().toISOString(),
              };
              this.messages = [...this.messages, assistantMessage];
              this.streamingMessageId = currentMessageId;
              this.loading = false;
              break;
            }
            case 'token': {
              const data = JSON.parse(event.data) as TokenEvent;
              assembledContent += data.content;
              // Update the last message's content in place
              const lastMsg = this.messages[this.messages.length - 1];
              if (lastMsg && lastMsg.id === currentMessageId) {
                lastMsg.content = assembledContent;
                // Trigger change detection by creating a new array reference
                this.messages = [...this.messages];
              }
              break;
            }
            case 'message_end': {
              const data = JSON.parse(event.data) as MessageEndEvent;
              const msg = this.messages.find(m => m.id === currentMessageId);
              if (msg) {
                msg.tokenCount = data.tokenCount;
              }
              this.streamingMessageId = null;
              this.loadSessions(); // refresh modifiedAt
              break;
            }
            case 'error': {
              const data = JSON.parse(event.data) as ChatErrorEvent;
              this.handleStreamError(data, currentMessageId);
              break;
            }
          }
          this.cdr.markForCheck();
          setTimeout(() => this.chatMessages?.scrollToBottom(), 0);
        },
        error: err => {
          this.logger.error('Message send failed', err);
          this.streamingMessageId = null;
          this.loading = false;

          if (err.status === 429) {
            const minutes = err.retryAfter ? Math.ceil(err.retryAfter / 60) : 1;
            this.addErrorMessage(`Message limit reached. Try again in ${minutes} minutes.`);
          } else if (err.status === 503) {
            this.addErrorMessage('Server is busy. Try again in a moment.');
          } else {
            this.addErrorMessage('Response interrupted. Try sending your message again.');
          }
          this.cdr.markForCheck();
        },
      });
  }

  private handleStreamError(data: ChatErrorEvent, currentMessageId: string): void {
    this.streamingMessageId = null;
    this.loading = false;

    if (currentMessageId) {
      // Keep whatever content was received
      const msg = this.messages.find(m => m.id === currentMessageId);
      if (msg && msg.content) {
        msg.content += `\n\n*Error: ${data.message}*`;
      } else {
        this.addErrorMessage(data.message);
      }
    } else {
      this.addErrorMessage(data.message);
    }
  }

  private addErrorMessage(text: string): void {
    const errorMsg: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: this.activeSessionId ?? '',
      role: 'assistant',
      content: `*${text}*`,
      sequence: this.messages.length,
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, errorMsg];
  }

  private createUserMessage(text: string, sessionId: string): ChatMessage {
    return {
      id: crypto.randomUUID(),
      sessionId,
      role: 'user',
      content: text,
      sequence: this.messages.length,
      createdAt: new Date().toISOString(),
    };
  }

  private loadSessions(): void {
    this.timmyChat
      .listSessions(this.threatModelId)
      .pipe(this.untilDestroyed())
      .subscribe({
        next: sessions => {
          this.sessions = sessions;
          // Update source snapshot if the active session is in the list
          if (this.activeSessionId) {
            const active = sessions.find(s => s.id === this.activeSessionId);
            this.activeSourceSnapshot = active?.sourceSnapshot ?? [];
          }
          this.cdr.markForCheck();
        },
        error: err => {
          this.logger.error('Failed to load sessions', err);
        },
      });
  }

  private untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this.destroyRef ? takeUntilDestroyed<T>(this.destroyRef) : identity;
  }
}
```

- [ ] **Step 2: Replace the component template**

Replace the contents of `src/app/pages/chat/components/chat-page/chat-page.component.html`:

```html
<ng-container *transloco="let t">
  <mat-toolbar class="chat-toolbar" color="primary">
    <button mat-icon-button [matTooltip]="t('chat.back')" (click)="navigateBack()">
      <mat-icon>arrow_back</mat-icon>
    </button>
    <img src="TMI-IconOnly-Transparent-NoBuffer.png" alt="Timmy" class="timmy-icon" />
    <span class="toolbar-title">{{ t('chat.title') }}</span>
    <span class="toolbar-spacer"></span>
    <button
      mat-icon-button
      [matTooltip]="t(sidePanelOpen ? 'chat.hideSidePanel' : 'chat.showSidePanel')"
      (click)="toggleSidePanel()"
    >
      <mat-icon>{{ sidePanelOpen ? 'right_panel_close' : 'right_panel_open' }}</mat-icon>
    </button>
  </mat-toolbar>

  <div class="chat-layout">
    <div class="chat-main">
      <app-chat-messages
        [messages]="messages"
        [loading]="loading"
        [streamingMessageId]="streamingMessageId"
        [preparationStatus]="preparationStatus"
        [inputDisabled]="!!preparationStatus && !preparationStatus.ready"
        (messageSent)="onMessageSent($event)"
      ></app-chat-messages>
    </div>

    @if (sidePanelOpen) {
      <div class="side-panel">
        <app-chat-session-panel
          [sessions]="sessions"
          [activeSessionId]="activeSessionId"
          [sourceSnapshot]="activeSourceSnapshot"
          (sessionSelected)="onSessionSelected($event)"
          (sessionCreated)="onSessionCreated()"
          (sessionDeleted)="onSessionDeleted($event)"
        ></app-chat-session-panel>
      </div>
    }
  </div>
</ng-container>
```

- [ ] **Step 3: Update the component styles**

Replace the contents of `src/app/pages/chat/components/chat-page/chat-page.component.scss`:

```scss
:host {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.chat-toolbar {
  flex-shrink: 0;

  .timmy-icon {
    width: 28px;
    height: 28px;
    margin-left: 8px;
    margin-right: 8px;
    object-fit: contain;
  }

  .toolbar-title {
    font-size: 18px;
    font-weight: 500;
  }

  .toolbar-spacer {
    flex: 1;
  }
}

.chat-layout {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.side-panel {
  width: 320px;
  flex-shrink: 0;
  border-left: 1px solid var(--color-border-light, #e0e0e0);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 4: Verify the build succeeds**

Run: `pnpm run build`
Expected: Build succeeds with no errors. All references to deleted files and types should now be resolved.

- [ ] **Step 5: Run lint**

Run: `pnpm run lint:all`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/pages/chat/components/chat-page/
git commit -m "feat(chat): rework ChatPageComponent for server-driven sessions and streaming (#293)"
```

---

## Task 9: Full Build and Test Verification

- [ ] **Step 1: Run the full build**

Run: `pnpm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Run all tests**

Run: `pnpm test`
Expected: All tests pass. The deleted spec files are gone, the new `sse-client.service.spec.ts` and `timmy-chat.service.spec.ts` pass.

- [ ] **Step 3: Run lint**

Run: `pnpm run lint:all`
Expected: No lint errors.

- [ ] **Step 4: Fix any issues found in steps 1-3**

If there are build errors, test failures, or lint issues, fix them. Common issues to check:
- Import paths in modified files
- Missing i18n key references
- Type mismatches between old and new interfaces

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(chat): resolve build and test issues from server integration (#293)"
```

Only commit if there were fixes needed. Skip if steps 1-3 were clean.

---

## Task 10: Run Localization Backfill

The i18n changes in Task 5 only updated `en-US.json`. Other locale files need the new keys added.

- [ ] **Step 1: Check which locale files exist**

Run: `ls src/assets/i18n/`
Expected: List of JSON files like `en-US.json`, `es.json`, `fr.json`, etc.

- [ ] **Step 2: Run the localization check tool**

Run: `pnpm run check-i18n` (or equivalent project tool)
Expected: Shows missing keys in non-English locale files.

- [ ] **Step 3: Add placeholder keys to other locale files**

For each non-English locale file, add the new `chat.preparation.*`, `chat.sourceSummary.*`, and `chat.errors.*` keys with the English values as placeholders. Remove the deleted keys (`chat.sources`, `chat.noSources`, `chat.selectAll`, `chat.deselectAll`, `chat.entityGroups.*`).

- [ ] **Step 4: Commit**

```bash
git add src/assets/i18n/
git commit -m "chore(i18n): backfill new chat keys to all locales (#293)"
```
