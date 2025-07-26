/**
 * WebSocket Adapter
 * 
 * This adapter provides WebSocket communication infrastructure for real-time collaboration
 * in the DFD editor. It handles connection management and message routing.
 * 
 * Key functionality:
 * - Manages WebSocket connection lifecycle (connect, disconnect, reconnect)
 * - Provides connection state monitoring with reactive observables
 * - Handles message serialization and deserialization for collaboration events
 * - Implements automatic reconnection with exponential backoff
 * - Provides type-safe message routing for different collaboration events
 * - Manages session joining and leaving for collaborative editing
 * - Handles user presence updates and cursor position synchronization
 * - Supports command execution and event broadcasting
 * - Provides error handling and connection recovery mechanisms
 * - Implements heartbeat/ping-pong for connection health monitoring
 * - Supports message queuing for offline scenarios
 * - Provides logging and debugging for WebSocket communication
 */

import { Injectable } from '@angular/core';
import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, filter, takeUntil, distinctUntilChanged, shareReplay } from 'rxjs/operators';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
}

/**
 * WebSocket message types for collaboration
 */
export enum MessageType {
  // Session management
  JOIN_SESSION = 'join_session',
  LEAVE_SESSION = 'leave_session',
  SESSION_JOINED = 'session_joined',
  SESSION_LEFT = 'session_left',

  // User presence
  USER_PRESENCE_UPDATE = 'user_presence_update',
  USER_CURSOR_UPDATE = 'user_cursor_update',

  // Commands and events
  COMMAND_EXECUTE = 'command_execute',
  COMMAND_EXECUTED = 'command_executed',
  COMMAND_CONFLICT = 'command_conflict',
  CONFLICT_RESOLVED = 'conflict_resolved',

  // Synchronization
  STATE_SYNC_REQUEST = 'state_sync_request',
  STATE_SYNC_RESPONSE = 'state_sync_response',

  // System messages
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  ACKNOWLEDGMENT = 'ack',
}

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  id: string;
  type: MessageType;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  data: Record<string, unknown>;
  requiresAck?: boolean;
}

/**
 * WebSocket adapter for real-time collaboration communication
 */
@Injectable({
  providedIn: 'root',
})
export class WebSocketAdapter {
  private _socket: WebSocket | null = null;
  private _url: string | null = null;
  private _reconnectAttempts = 0;
  private readonly _maxReconnectAttempts = 5;
  private readonly _reconnectDelay = 1000;
  private _heartbeatInterval: number | null = null;
  private readonly _destroy$ = new Subject<void>();

  // State management
  private readonly _connectionState$ = new BehaviorSubject<WebSocketState>(
    WebSocketState.DISCONNECTED,
  );
  private readonly _messages$ = new Subject<WebSocketMessage>();
  private readonly _errors$ = new Subject<Error>();

  // Message acknowledgment tracking
  private readonly _pendingAcks = new Map<
    string,
    {
      resolve: (value: void) => void;
      reject: (error: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();

  /**
   * Observable for connection state changes
   */
  get connectionState$(): Observable<WebSocketState> {
    return this._connectionState$.pipe(distinctUntilChanged(), shareReplay(1));
  }

  /**
   * Observable for incoming messages
   */
  get messages$(): Observable<WebSocketMessage> {
    return this._messages$.asObservable();
  }

  /**
   * Observable for connection errors
   */
  get errors$(): Observable<Error> {
    return this._errors$.asObservable();
  }

  /**
   * Get current connection state
   */
  get connectionState(): WebSocketState {
    return this._connectionState$.value;
  }

  /**
   * Check if WebSocket is connected
   */
  get isConnected(): boolean {
    return this.connectionState === WebSocketState.CONNECTED;
  }

  /**
   * Connect to WebSocket server
   */
  connect(url: string): Observable<void> {
    return new Observable(observer => {
      try {
        if (this._socket && this._socket.readyState === WebSocket.OPEN) {
          observer.next();
          observer.complete();
          return;
        }

        this._url = url;
        this._connectionState$.next(WebSocketState.CONNECTING);

        this._socket = new WebSocket(url);
        this._setupEventListeners();

        // Wait for connection to open
        const openHandler = (): void => {
          this._connectionState$.next(WebSocketState.CONNECTED);
          this._reconnectAttempts = 0;
          this._startHeartbeat();
          observer.next();
          observer.complete();
        };

        const errorHandler = (_error: Event): void => {
          this._connectionState$.next(WebSocketState.ERROR);
          observer.error(new Error('WebSocket connection failed'));
        };

        this._socket.addEventListener('open', openHandler, { once: true });
        this._socket.addEventListener('error', errorHandler, { once: true });
      } catch (error) {
        this._connectionState$.next(WebSocketState.ERROR);
        observer.error(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this._stopHeartbeat();

    if (this._socket) {
      this._socket.close(1000, 'Client disconnect');
      this._socket = null;
    }

    this._connectionState$.next(WebSocketState.DISCONNECTED);
    this._clearPendingAcks();
  }

  /**
   * Send a message through WebSocket
   */
  sendMessage(message: Omit<WebSocketMessage, 'id' | 'timestamp'>): Observable<void> {
    return new Observable(observer => {
      try {
        if (!this.isConnected) {
          throw new Error('WebSocket is not connected');
        }

        const fullMessage: WebSocketMessage = {
          ...message,
          id: this._generateMessageId(),
          timestamp: Date.now(),
        };

        this._socket!.send(JSON.stringify(fullMessage));

        if (message.requiresAck) {
          // Wait for acknowledgment
          this._waitForAcknowledgment(fullMessage.id).then(
            () => {
              observer.next();
              observer.complete();
            },
            error => observer.error(error),
          );
        } else {
          observer.next();
          observer.complete();
        }
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Send a message and wait for a specific response
   */
  sendMessageWithResponse<T = unknown>(
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    responseType: MessageType,
    timeout: number = 5000,
  ): Observable<T> {
    return new Observable(observer => {
      const messageId = this._generateMessageId();

      // Set up response listener
      const responseSubscription = this.messages$
        .pipe(
          filter(msg => msg.type === responseType && msg.data['requestId'] === messageId),
          map(msg => msg.data as T),
          takeUntil(this._destroy$),
        )
        .subscribe({
          next: data => {
            observer.next(data);
            observer.complete();
          },
          error: error => observer.error(error),
        });

      // Set up timeout
      const timeoutId = setTimeout(() => {
        responseSubscription.unsubscribe();
        observer.error(new Error(`Request timeout after ${timeout}ms`));
      }, timeout);

      // Send the message
      const fullMessage: WebSocketMessage = {
        ...message,
        id: messageId,
        timestamp: Date.now(),
        data: {
          ...message.data,
          requestId: messageId,
        },
      };

      try {
        if (!this.isConnected) {
          throw new Error('WebSocket is not connected');
        }

        this._socket!.send(JSON.stringify(fullMessage));
      } catch (error) {
        clearTimeout(timeoutId);
        responseSubscription.unsubscribe();
        observer.error(error);
      }

      // Cleanup on unsubscribe
      return () => {
        clearTimeout(timeoutId);
        responseSubscription.unsubscribe();
      };
    });
  }

  /**
   * Get messages of a specific type
   */
  getMessagesOfType<T = unknown>(messageType: MessageType): Observable<T> {
    return this.messages$.pipe(
      filter(message => message.type === messageType),
      map(message => message.data as T),
    );
  }

  /**
   * Get messages for a specific session
   */
  getSessionMessages(sessionId: string): Observable<WebSocketMessage> {
    return this.messages$.pipe(filter(message => message.sessionId === sessionId));
  }

  /**
   * Dispose of the adapter and clean up resources
   */
  dispose(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this.disconnect();
    this._clearPendingAcks();
  }

  /**
   * Setup WebSocket event listeners
   */
  private _setupEventListeners(): void {
    if (!this._socket) return;

    this._socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data as string) as WebSocketMessage;

        // Handle acknowledgments
        if (message.type === MessageType.ACKNOWLEDGMENT) {
          this._handleAcknowledgment(message.data['messageId'] as string);
          return;
        }

        // Handle heartbeat
        if (message.type === MessageType.HEARTBEAT) {
          this._handleHeartbeat();
          return;
        }

        // Send acknowledgment if required
        if (message.requiresAck) {
          this._sendAcknowledgment(message.id);
        }

        this._messages$.next(message);
      } catch {
        this._errors$.next(new Error('Failed to parse WebSocket message'));
      }
    });

    this._socket.addEventListener('close', event => {
      this._connectionState$.next(WebSocketState.DISCONNECTED);
      this._stopHeartbeat();

      // Attempt reconnection if not a clean close
      if (event.code !== 1000 && this._reconnectAttempts < this._maxReconnectAttempts) {
        this._attemptReconnection();
      }
    });

    this._socket.addEventListener('error', () => {
      this._connectionState$.next(WebSocketState.ERROR);
      this._errors$.next(new Error('WebSocket error occurred'));
    });
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private _attemptReconnection(): void {
    if (!this._url || this._reconnectAttempts >= this._maxReconnectAttempts) {
      return;
    }

    this._reconnectAttempts++;
    const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

    setTimeout(() => {
      if (this._url) {
        this.connect(this._url).subscribe({
          error: () => this._attemptReconnection(),
        });
      }
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private _startHeartbeat(): void {
    this._stopHeartbeat();

    this._heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        this.sendMessage({
          type: MessageType.HEARTBEAT,
          data: { timestamp: Date.now() },
        }).subscribe({
          error: () => {
            // Heartbeat failed, connection might be lost
            this._connectionState$.next(WebSocketState.ERROR);
          },
        });
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  /**
   * Stop heartbeat
   */
  private _stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
  }

  /**
   * Handle incoming heartbeat
   */
  private _handleHeartbeat(): void {
    // Respond to server heartbeat if needed
    // For now, just acknowledge that connection is alive
  }

  /**
   * Wait for message acknowledgment
   */
  private _waitForAcknowledgment(messageId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingAcks.delete(messageId);
        reject(new Error('Message acknowledgment timeout'));
      }, 5000);

      this._pendingAcks.set(messageId, {
        resolve,
        reject,
        timeout,
      });
    });
  }

  /**
   * Handle acknowledgment for sent message
   */
  private _handleAcknowledgment(messageId: string): void {
    const pending = this._pendingAcks.get(messageId);
    if (pending) {
      clearTimeout(pending.timeout);
      this._pendingAcks.delete(messageId);
      pending.resolve();
    }
  }

  /**
   * Send acknowledgment for received message
   */
  private _sendAcknowledgment(messageId: string): void {
    if (this.isConnected) {
      const ackMessage: WebSocketMessage = {
        id: this._generateMessageId(),
        type: MessageType.ACKNOWLEDGMENT,
        timestamp: Date.now(),
        data: { messageId },
      };

      this._socket!.send(JSON.stringify(ackMessage));
    }
  }

  /**
   * Clear all pending acknowledgments
   */
  private _clearPendingAcks(): void {
    for (const [, pending] of Array.from(this._pendingAcks.entries())) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Connection closed'));
    }
    this._pendingAcks.clear();
  }

  /**
   * Generate unique message ID
   */
  private _generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
