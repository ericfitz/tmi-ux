# Timmy Client-Server Integration Design

**Date:** 2026-04-05
**Issue:** ericfitz/tmi-ux#293
**Server design:** ericfitz/tmi — `docs/superpowers/specs/2026-04-04-timmy-backend-design.md`
**Branch:** `feature/timmy`

## Overview

Replace the mock/client-side Timmy chat implementation with a real server-integrated one. The server manages sessions, messages, context construction, and LLM interaction. The client becomes a thin UI layer that speaks SSE for streaming and REST for CRUD.

## What Gets Removed

| File/Concern | Reason |
|---|---|
| `MockChatService` | Real service replaces it |
| `ChatContextBuilderService` + spec | Server builds context (two-tier: structured + vector retrieval) |
| `ChatSessionStorageService` + spec | Server is source of truth for sessions; no IndexedDB |
| `ChatSourcePanelComponent` + template + styles | Source toggles move to entity edit dialogs (#554) and DFD editor (#555) |
| `ChatContextPayload`, `SerializedEntity` interfaces | Unused without client-side context building |
| `ChatService` abstract class | Replaced by concrete `TimmyChatService` |
| Tab group in side panel | Single panel (sessions), no tabs needed |
| `mock-chat.service.spec.ts` | Mock removed |
| `chat-context-builder.service.spec.ts` | Context builder removed |
| `chat-session-storage.service.spec.ts` | Session storage removed |

## What Gets Added

### SseClientService

**Location:** `src/app/core/services/sse-client.service.ts`

A generic, reusable service for SSE-over-POST. Not Timmy-specific.

```typescript
@Injectable({ providedIn: 'root' })
class SseClientService {
  post(url: string, body?: unknown): Observable<SseEvent>
}
```

**Implementation:**
- Uses `fetch()` with `method: 'POST'`, `credentials: 'include'` (cookie auth), `Content-Type: application/json`
- Reads the `ReadableStream` response line by line, splits on `\n\n` (SSE frame boundary), parses `event:` and `data:` fields
- Emits each parsed `SseEvent` through the Observable
- On stream end: completes the Observable
- On network error or non-2xx response: errors the Observable with a structured error (status code, message)
- On Observable unsubscribe: calls `reader.cancel()` to abort the fetch (cleans up server resources if user navigates away mid-stream)
- No retry logic — consumers decide whether to retry
- On 401 response: triggers `AuthService.forceRefreshToken()` and retries once, mirroring the JWT interceptor pattern. This is a defensive edge case — proactive token refresh should prevent 401s during normal use.

**Why not extend ApiService?** `ApiService` uses Angular's `HttpClient`, which doesn't support streaming response bodies. `fetch()` is the only browser API that provides `ReadableStream`. `SseClientService` is complementary to `ApiService`, not a replacement. It uses the same `environment.apiUrl` base URL and cookie auth.

### TimmyChatService

**Location:** `src/app/pages/chat/services/timmy-chat.service.ts`

Concrete service replacing the abstract `ChatService` + `MockChatService` pair. Direct mapping to the server Chat API.

```typescript
@Injectable({ providedIn: 'root' })
class TimmyChatService {
  // Session CRUD
  createSession(threatModelId: string): Observable<SseEvent>
  listSessions(threatModelId: string): Observable<ChatSession[]>
  getSession(threatModelId: string, sessionId: string): Observable<ChatSession>
  deleteSession(threatModelId: string, sessionId: string): Observable<void>

  // Messages
  sendMessage(threatModelId: string, sessionId: string, content: string): Observable<SseEvent>
  getMessages(threatModelId: string, sessionId: string, limit?: number, offset?: number): Observable<ChatMessage[]>
}
```

**Design notes:**
- `createSession()` and `sendMessage()` return raw `Observable<SseEvent>` — the component parses event types and handles them. Keeps the service as a thin transport layer.
- REST methods (`listSessions`, `getSession`, `deleteSession`, `getMessages`) use `ApiService` to get retry, error handling, and logging for free.
- SSE methods (`createSession`, `sendMessage`) use `SseClientService`.
- Both use cookie auth automatically.
- Provided in root — no component-level providers needed.

**Token refresh integration:** `TimmyChatService` injects `ActivityTrackerService` and calls `markActive()` when initiating SSE requests (`createSession`, `sendMessage`). This ensures the existing proactive token refresh mechanism stays warm during active chat sessions, since SSE requests bypass Angular's `HttpClient` and the JWT interceptor chain. The app already supports silent refresh for up to 7 days for active sessions — this integration ensures chat activity counts as "active."

### Server API Endpoints (reference)

| Method | Path | Transport | Client Method |
|---|---|---|---|
| `POST` | `/threat_models/{id}/chat/sessions` | SSE | `createSession()` |
| `GET` | `/threat_models/{id}/chat/sessions` | REST | `listSessions()` |
| `GET` | `/threat_models/{id}/chat/sessions/{sid}` | REST | `getSession()` |
| `DELETE` | `/threat_models/{id}/chat/sessions/{sid}` | REST | `deleteSession()` |
| `POST` | `/threat_models/{id}/chat/sessions/{sid}/messages` | SSE | `sendMessage()` |
| `GET` | `/threat_models/{id}/chat/sessions/{sid}/messages` | REST | `getMessages()` |

## Data Model Changes

### Updated Interfaces (`chat.model.ts`)

```typescript
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
```

Note: Entity inclusion in Timmy chat is controlled by the `timmy_enabled: boolean` property on each entity (a first-class API field, not metadata). This property is already in the API schema and generated types.

### SSE Event Types

```typescript
export interface SseEvent {
  event: string;
  data: string;
}

// Session creation events
export interface SessionCreatedEvent { sessionId: string; sourceCount: number; }
export interface ProgressEvent { phase: string; entityType: string; entityName: string; progress: number; detail?: string; }
export interface ReadyEvent { sessionId: string; sourcesLoaded: number; chunksEmbedded: number; cachedReused: number; newlyEmbedded: number; }

// Message streaming events
export interface MessageStartEvent { messageId: string; role: 'assistant'; }
export interface TokenEvent { content: string; }
export interface MessageEndEvent { messageId: string; tokenCount: number; }

// Error event (can occur in either stream)
export interface ChatErrorEvent { code: string; message: string; }
```

### Removed

- `ChatRole` type alias (inlined into `ChatMessage.role`)
- `ChatContextPayload` interface
- `SerializedEntity` interface
- `ChatSession.messages` array (messages fetched separately)
- `ChatSession.lastMessageAt` (replaced by `modifiedAt` from server)
- `TIMMY_METADATA_KEY` constant (entity inclusion uses `timmy_enabled` API property instead)

## Component Changes

### ChatPageComponent

**Orchestration layer — major rework.**

**Session lifecycle (server-driven):**

1. **On init:** Call `timmyChatService.listSessions()` to populate session list.
2. **New session:** User sends first message → call `createSession()` → subscribe to SSE stream → show preparation status bubble → on `ready` event, extract session ID, then immediately call `sendMessage()` with the user's text.
3. **Resume session:** User selects a session → call `getMessages()` to load history → set as active.
4. **Delete session:** Call `deleteSession()` → refresh list.

**Message flow (streaming):**

1. User sends text → add user message to local `messages` array immediately (optimistic rendering).
2. Call `sendMessage()` → subscribe to SSE stream.
3. On `message_start`: add a new assistant message to `messages` with empty content.
4. On `token`: append token text to the assistant message's content, trigger change detection.
5. On `message_end`: update the message with final `tokenCount`, refresh session list (to update `modifiedAt`).
6. On `error`: show error inline in the chat area.

**Preparation status:**

- Component property: `preparationStatus: { phase: string; entityName: string; progress: number; current: number; total: number } | null`
- When non-null, `ChatMessagesComponent` renders the ephemeral status bubble inline in the chat flow.
- Updated on each `progress` event from session creation SSE.
- Set to null after `ready` event (after brief "Ready!" display).
- Input is disabled while `preparationStatus` is non-null.

**Removed concerns:**
- `pendingToggles`, `debounceSave()`, `flushTogglesToModel()`, `buildEntityMetadata()` — source toggling moves to entity edit dialogs (#554, #555).
- `sessionStorage` dependency.
- `contextBuilder` dependency.
- `providers: [{ provide: ChatService, useClass: MockChatService }]` line.

### ChatMessagesComponent

**Token-by-token rendering:**

- Tracks `streamingMessageId: string | null` to identify which message is actively streaming.
- During streaming: render raw text (no markdown). Apply markdown formatting once on `message_end`. Alternatively, debounce markdown rendering to ~100ms during streaming if performance allows.
- Typing cursor indicator on the streaming message.

**Ephemeral preparation status bubble:**

- New input: `preparationStatus` from parent.
- Rendered inline in the chat flow, below the last message, in the position where the next message would appear.
- Animated spinner icon (Material `progress_activity` or CSS spinner) while processing; check icon (`check_circle`) on ready.
- Status text updates in place: `"Processing source 4 of 12 — Document: Auth Design Doc — embedding 75%"`
- On ready: `"Ready! 12 sources loaded, 47 chunks indexed."`
- Not part of the `messages` array — rendered conditionally after the message list. Visually inline, not persisted.

**Input state:**

- Disabled during preparation (`preparationStatus` is non-null and not in ready state).
- Disabled during streaming (`streamingMessageId` is non-null).
- Visual indication: grayed placeholder, disabled send button.

**Layout fix:**

- The input field must be pinned to the bottom of the chat area, always visible on screen.
- The message list scrolls independently above it.
- Standard chat layout: fixed input, scrollable messages.

### ChatSessionPanelComponent

**No tab group — standalone session list panel.**

**Collapsible source summary:**

- New input: active session's `sourceSnapshot` (array of `SourceSnapshotEntry`).
- When a session is active, shows a collapsible section:
  - **Collapsed (default):** `"12 sources included"` with expand chevron.
  - **Expanded:** grouped list by entity type — e.g., `"Assets (3): User DB, Auth Service, API Gateway"`.
- When no session is active, source summary is hidden.

**No other structural changes** — session display (title, date), delete button, new session button stay the same, backed by server data instead of IndexedDB.

### ChatSourcePanelComponent

**Removed entirely.** Source toggling moves to:
- Entity edit dialogs (#554)
- DFD editor header (#555)

## Error Handling

### Rate Limiting (429)

- Server returns `Retry-After` header.
- Inline error message in chat area: "Message limit reached. Try again in X minutes."
- Disable input until retry period expires (or let user try manually).

### Memory Pressure (503 with Retry-After)

- Server can't load vector index for this threat model.
- On session creation: error in status bubble: "Server is busy. Try again in a moment."
- On message send: inline error message similar to rate limiting.

### SSE Error Events

- Server sends `event: error` mid-stream with code and message.
- Display error message inline as a system-style bubble (visually distinct from assistant messages).

### Network Errors

- Fetch failure or connection drop mid-stream.
- Mid-stream during message: keep received tokens, show error indicator: "Response interrupted. Try sending your message again."
- During session creation: status bubble shows error state with retry prompt.

### Auth Errors (401)

- `SseClientService` checks response status before reading stream.
- On 401: triggers `AuthService.forceRefreshToken()` and retries once.
- Defensive edge case — proactive token refresh (via `ActivityTrackerService.markActive()` integration in `TimmyChatService`) should prevent 401s during normal active chat sessions.

## Related Issues

- #554 — Add "Include in Timmy chat" toggle to entity edit dialogs
- #555 — Add "Include in Timmy chat" toggle to DFD editor header
- #556 — Save Timmy chat sessions and messages as threat model notes

## Out of Scope

- Admin usage/status endpoints (server-side admin UX)
- `auth_required` SSE event handling (Phase 2 OAuth content providers)
- Session title editing
- Message pagination (load more history) — fetch all messages for now; optimize if sessions get very long
