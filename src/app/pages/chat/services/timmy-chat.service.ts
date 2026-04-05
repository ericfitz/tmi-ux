import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { SseClientService } from '../../../core/services/sse-client.service';
import { ActivityTrackerService } from '../../../core/services/activity-tracker.service';
import { ChatSession, ChatMessage } from '../models/chat.model';
import { SseEvent } from '../../../core/interfaces/sse.interface';

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
    return this.api.get<ChatSession>(`/threat_models/${threatModelId}/chat/sessions/${sessionId}`);
  }

  /** Soft-delete a session. */
  deleteSession(threatModelId: string, sessionId: string): Observable<void> {
    return this.api.delete<void>(`/threat_models/${threatModelId}/chat/sessions/${sessionId}`);
  }

  /**
   * Send a message to Timmy. Returns an SSE stream of response events
   * (message_start, token, message_end, error).
   */
  sendMessage(threatModelId: string, sessionId: string, content: string): Observable<SseEvent> {
    this.activityTracker.markActive();
    return this.sse.post(`/threat_models/${threatModelId}/chat/sessions/${sessionId}/messages`, {
      content,
    });
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
