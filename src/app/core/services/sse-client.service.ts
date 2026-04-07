/**
 * SSE Client Service
 *
 * Provides a generic mechanism for making POST requests that return
 * Server-Sent Events (SSE) streams via the browser's fetch API.
 *
 * Angular's HttpClient does not expose ReadableStream response bodies, so this
 * service bypasses it in favour of the native fetch API while still integrating
 * with the application's AuthService for 401 / token-refresh handling.
 *
 * Key functionality:
 * - Makes POST requests that accept text/event-stream responses
 * - Parses the SSE wire format (event: / data: fields, \n\n delimited)
 * - Emits parsed SseEvent objects via an Observable
 * - Automatically retries once after a 401 by calling AuthService.forceRefreshToken()
 * - Cleans up the underlying ReadableStream reader on unsubscribe / error
 * - Uses credentials: 'include' for cookie-based auth (bypasses Angular interceptors)
 */

import { Injectable, Inject } from '@angular/core';
import { Observable, Subscriber } from 'rxjs';
import { take } from 'rxjs/operators';

import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';
import { AUTH_SERVICE, type IAuthService, type SseEvent } from '../interfaces';

/** Error shape emitted when the server returns a non-2xx status. */
export interface SseHttpError {
  status: number;
  statusText: string;
  retryAfter?: number;
}

/**
 * Service for streaming SSE events over HTTP POST.
 *
 * Usage:
 *   sseClient.post('/api/chat/session', body).subscribe({ next, error, complete })
 */
@Injectable({
  providedIn: 'root',
})
export class SseClientService {
  private readonly baseUrl: string;

  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: IAuthService,
    private readonly logger: LoggerService,
  ) {
    const raw = environment.apiUrl;
    this.baseUrl = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  }

  /**
   * Make a POST request and stream the SSE response as an Observable<SseEvent>.
   *
   * @param endpoint  API path, with or without a leading slash
   * @param body      Optional request body — will be JSON-serialised
   */
  post(endpoint: string, body?: unknown): Observable<SseEvent> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${normalizedEndpoint}`;

    this.logger.debug(`[sse] POST request to ${url}`, body !== undefined ? { body } : undefined);

    return new Observable<SseEvent>(subscriber => {
      const abortController = new AbortController();

      void this.executeFetch(url, body, abortController, subscriber, false);

      // Teardown: abort the in-flight request / ongoing read loop
      return () => {
        this.logger.debug(`[sse] Stream aborted for ${url}`);
        abortController.abort();
      };
    });
  }

  private async executeFetch(
    url: string,
    body: unknown,
    abortController: AbortController,
    subscriber: Subscriber<SseEvent>,
    isRetry: boolean,
  ): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
      });

      this.logger.debug(`[sse] Response from ${url}`, {
        status: response.status,
        statusText: response.statusText,
        isRetry,
      });

      // Handle 401 with a single token-refresh retry
      if (response.status === 401 && !isRetry) {
        this.logger.debug('[sse] 401 received, attempting token refresh and retry');
        this.authService
          .forceRefreshToken()
          .pipe(take(1))
          .subscribe({
            next: () => {
              void this.executeFetch(url, body, abortController, subscriber, true);
            },
            error: (err: unknown) => {
              subscriber.error(err);
            },
          });
        return;
      }

      // Error for any other non-2xx status
      if (!response.ok) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        const error: SseHttpError = {
          status: response.status,
          statusText: response.statusText,
          ...(retryAfter !== undefined && !isNaN(retryAfter) ? { retryAfter } : {}),
        };
        this.logger.debug(`[sse] Error response from ${url}`, error);
        subscriber.error(error);
        return;
      }

      if (!response.body) {
        subscriber.error(new Error('SSE response has no body'));
        return;
      }

      await this.readStream(response.body, url, subscriber);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        subscriber.complete();
        return;
      }
      subscriber.error(err);
    }
  }

  private async readStream(
    body: ReadableStream<Uint8Array>,
    url: string,
    subscriber: Subscriber<SseEvent>,
  ): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    // Register reader cancellation as part of subscriber teardown
    subscriber.add(() => {
      void reader.cancel();
    });

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (buffer.trim()) {
            this.parseAndEmit(buffer, url, subscriber);
          }
          this.logger.debug(`[sse] Stream completed for ${url}`);
          subscriber.complete();
          return;
        }

        buffer += decoder.decode(value, { stream: true });

        // SSE events are separated by double newline
        const parts = buffer.split('\n\n');

        // The last element may be an incomplete event — keep it as the new buffer
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          if (part.trim()) {
            this.parseAndEmit(part, url, subscriber);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        subscriber.complete();
        return;
      }
      subscriber.error(err);
    }
  }

  private parseAndEmit(raw: string, url: string, subscriber: Subscriber<SseEvent>): void {
    let event = 'message';
    let data = '';

    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        data = line.slice('data:'.length).trim();
      }
    }

    if (data) {
      // Log the event type and parsed data. For token events, truncate to
      // avoid flooding the log with streaming content.
      if (event === 'token') {
        this.logger.debug(`[sse] Event from ${url}`, { event, data: '(token content)' });
      } else {
        this.logger.debug(`[sse] Event from ${url}`, { event, data });
      }
      subscriber.next({ event, data });
    }
  }
}
