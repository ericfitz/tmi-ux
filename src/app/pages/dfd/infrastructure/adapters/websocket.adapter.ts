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
import { Observable, Subject, BehaviorSubject, throwError } from 'rxjs';
import { map, filter, takeUntil, distinctUntilChanged, shareReplay } from 'rxjs/operators';

import { LoggerService } from '../../../../core/services/logger.service';
import { TMIWebSocketMessage, TMIMessageType } from '../../models/websocket-message.types';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * WebSocket error types for different recovery strategies
 */
export enum WebSocketErrorType {
  CONNECTION_FAILED = 'connection_failed',
  AUTHENTICATION_FAILED = 'authentication_failed',
  MESSAGE_SEND_FAILED = 'message_send_failed',
  PARSE_ERROR = 'parse_error',
  TIMEOUT = 'timeout',
  NETWORK_ERROR = 'network_error',
}

/**
 * Enhanced error information
 */
export interface WebSocketError {
  type: WebSocketErrorType;
  message: string;
  originalError?: any;
  isRecoverable: boolean;
  retryable: boolean;
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

  // Collaboration session announcements
  SESSION_STARTED = 'session_started',
  SESSION_ENDED = 'session_ended',
  SESSION_LIST_REQUEST = 'session_list_request',
  SESSION_LIST_RESPONSE = 'session_list_response',

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
  
  // Shared subjects for TMI messages to avoid duplicate handlers
  private readonly _tmiMessages$ = new Subject<TMIWebSocketMessage>();
  private _tmiMessageHandlerSetup = false;

  constructor(private logger: LoggerService) {}

  // State management
  private readonly _connectionState$ = new BehaviorSubject<WebSocketState>(
    WebSocketState.DISCONNECTED,
  );
  private readonly _messages$ = new Subject<WebSocketMessage>();
  private readonly _errors$ = new Subject<WebSocketError>();

  // Enhanced error tracking
  private _lastError: WebSocketError | null = null;
  private _connectionHealth = 100; // Health percentage (0-100)
  private _missedHeartbeats = 0;
  private readonly _maxMissedHeartbeats = 3;

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
  get errors$(): Observable<WebSocketError> {
    return this._errors$.asObservable();
  }

  /**
   * Get connection health percentage (0-100)
   */
  get connectionHealth(): number {
    return this._connectionHealth;
  }

  /**
   * Get last error information
   */
  get lastError(): WebSocketError | null {
    return this._lastError;
  }

  /**
   * Check if connection is healthy (connected and good health)
   */
  get isHealthy(): boolean {
    return this.isConnected && this._connectionHealth > 50;
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
   * Connect to WebSocket server (URL should already include auth token if needed)
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

        this.logger.info('Connecting WebSocket', {
          url: url.replace(/\?.*$/, ''), // Don't log query params (including token)
          hasToken: url.includes('?token='),
        });

        // Log WebSocket connection request with component debug logging
        this.logger.debugComponent('websocket-api', 'WebSocket connection request:', {
          url: url.replace(/\?.*$/, ''), // Redact query params for security
          protocol: 'WebSocket',
          hasAuthToken: url.includes('?token='),
        });

        this._socket = new WebSocket(url);
        this._setupEventListeners();

        // Wait for connection to open
        const openHandler = (): void => {
          this._connectionState$.next(WebSocketState.CONNECTED);
          this._reconnectAttempts = 0;
          this._startHeartbeat();

          // Log successful WebSocket connection with component debug logging
          this.logger.debugComponent('websocket-api', 'WebSocket connection established:', {
            url: url.replace(/\?.*$/, ''),
            readyState: this._socket?.readyState,
            protocol: this._socket?.protocol || 'none',
          });

          observer.next();
          observer.complete();
        };

        const errorHandler = (event: any): void => {
          this._connectionState$.next(WebSocketState.ERROR);
          const errorMessage =
            event.message || event.error?.message || 'WebSocket connection failed';

          // Classify the error for appropriate recovery strategy
          const wsError = this._classifyConnectionError(event, errorMessage);
          this._lastError = wsError;
          this._updateConnectionHealth(-30); // Decrease health on connection error

          this.logger.error('WebSocket connection error', {
            url: url,
            error: errorMessage,
            errorType: wsError.type,
            isRecoverable: wsError.isRecoverable,
            readyState: this._socket?.readyState,
          });

          this._errors$.next(wsError);
          observer.error(new Error(`WebSocket connection failed: ${errorMessage}`));
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
      // Log WebSocket disconnection with component debug logging
      this.logger.debugComponent('websocket-api', 'WebSocket disconnection requested:', {
        url: this._url?.replace(/\?.*$/, ''),
        readyState: this._socket.readyState,
        connectionHealth: this._connectionHealth,
      });

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

        // Log WebSocket message send with component debug logging
        this.logger.debugComponent('websocket-api', 'WebSocket message sent:', {
          messageId: fullMessage.id,
          messageType: fullMessage.type,
          sessionId: fullMessage.sessionId,
          userId: fullMessage.userId,
          requiresAck: fullMessage.requiresAck,
          body: this._redactSensitiveData(fullMessage.data),
        });

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
   * Get TMI collaborative messages of a specific type
   */
  getTMIMessagesOfType<T extends TMIWebSocketMessage>(messageType: TMIMessageType): Observable<T> {
    // Set up the single TMI message handler if not already set up
    this._setupTMIMessageHandler();
    
    // Filter messages by type
    return this._tmiMessages$.pipe(
      filter(message => {
        const messageTypeToCheck = (message as any).message_type || (message as any).event;
        return messageTypeToCheck === messageType;
      }),
      map(message => message as T),
      takeUntil(this._destroy$),
    );
  }

  /**
   * Set up a single message handler for all TMI messages
   */
  private _setupTMIMessageHandler(): void {
    if (this._tmiMessageHandlerSetup) {
      return;
    }

    this._tmiMessageHandlerSetup = true;

    // Listen for connection state changes
    this.connectionState$
      .pipe(takeUntil(this._destroy$))
      .subscribe(state => {
        if (state === WebSocketState.CONNECTED && this._socket) {
          // Set up message handler
          const messageHandler = (event: MessageEvent) => {
            try {
              const rawData = event.data;

              // Parse JSON
              let parsedMessage: any;
              try {
                parsedMessage = JSON.parse(rawData);
              } catch (jsonError) {
                // Only process if it looks like it might be a TMI message
                if (typeof rawData === 'string' && (rawData.includes('message_type') || rawData.includes('event'))) {
                  this._handleMalformedMessage(
                    'Invalid JSON format in TMI message',
                    jsonError,
                    rawData,
                  );
                }
                return;
              }

              // Check if this is a TMI message
              if (!parsedMessage.message_type && !parsedMessage.event) {
                return; // Not a TMI message
              }

              // Validate TMI message structure
              const validationResult = this._validateTMIMessage(parsedMessage);
              if (!validationResult.isValid) {
                this._handleMalformedMessage(
                  `TMI message validation failed: ${validationResult.error}`,
                  null,
                  rawData,
                );
                return;
              }

              const message = parsedMessage as TMIWebSocketMessage;
              const messageTypeToCheck = (message as any).message_type || (message as any).event;
              
              // Log ALL TMI messages for debugging
              this.logger.debugComponent('wsmsg', 'TMI WebSocket message received', {
                messageType: messageTypeToCheck,
                userId: (message as any).user_id,
                timestamp: (message as any).timestamp,
                operationId: (message as any).operation_id,
                sequenceNumber: (message as any).sequence_number,
                targetUser: (message as any).target_user,
                currentPresenter: (message as any).current_presenter,
                sessionManager: (message as any).session_manager,
                participantCount: (message as any).participants?.length,
                hasOperation: !!(message as any).operation,
                operationType: (message as any).operation?.type,
                cellCount: (message as any).operation?.cells?.length,
                reason: (message as any).reason,
                method: (message as any).method,
                operationType2: (message as any).operation_type,
                message: (message as any).message,
                fullBody: this._redactSensitiveData(message as any),
              });
              
              // Emit the message
              this._tmiMessages$.next(message);
            } catch (error) {
              this._handleMalformedMessage(
                'Unexpected error processing TMI message',
                error,
                event.data,
              );
            }
          };

          this._socket.addEventListener('message', messageHandler);

          // Clean up handler when disconnected
          const closeHandler = (): void => {
            if (this._socket) {
              this._socket.removeEventListener('message', messageHandler);
            }
          };
          this._socket.addEventListener('close', closeHandler, { once: true });
        }
      });
  }

  /**
   * Send TMI collaborative message
   */
  sendTMIMessage(message: TMIWebSocketMessage): Observable<void> {
    return new Observable(observer => {
      try {
        if (!this.isConnected) {
          throw new Error('WebSocket is not connected');
        }

        this.logger.debug('Sending TMI message', {
          type: (message as any).message_type || (message as any).event,
          userId: (message as any).user_id,
        });

        // Log WebSocket message send with component debug logging
        this.logger.debugComponent('websocket-api', 'WebSocket message sent:', {
          messageType: (message as any).message_type || (message as any).event,
          userId: (message as any).user_id,
          operationId: (message as any).operation_id,
          hasOperation: !!(message as any).operation,
          body: this._redactSensitiveData(message),
        });

        this._socket!.send(JSON.stringify(message));
        observer.next();
        observer.complete();
      } catch (error) {
        this.logger.error('Failed to send TMI message', { error, message });
        observer.error(error);
      }
    });
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
        const rawData = event.data as string;

        // Parse JSON
        let parsedMessage: any;
        try {
          parsedMessage = JSON.parse(rawData);
        } catch (jsonError) {
          this._handleMalformedMessage('Invalid JSON format', jsonError, rawData);
          return;
        }

        // Check if this is a TMI message (has message_type or event field)
        const isTMIMessage = parsedMessage.message_type || parsedMessage.event;
        
        if (isTMIMessage) {
          // Skip internal validation for TMI messages - they have different structure
          // TMI messages will be handled by getTMIMessagesOfType observers
          // Logging is done in getTMIMessagesOfType to avoid duplicate logs
          return;
        }

        // Validate internal WebSocket message structure
        const validationResult = this._validateWebSocketMessage(parsedMessage);
        if (!validationResult.isValid) {
          this._handleMalformedMessage(
            `Message validation failed: ${validationResult.error}`,
            null,
            rawData,
          );
          return;
        }

        const message = parsedMessage as WebSocketMessage;

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

        // Log incoming WebSocket message with component debug logging
        this.logger.debugComponent('websocket-api', 'WebSocket message received:', {
          messageId: message.id,
          messageType: message.type,
          sessionId: message.sessionId,
          userId: message.userId,
          timestamp: message.timestamp,
          requiresAck: message.requiresAck,
          body: this._redactSensitiveData(message.data),
        });
        
        // Also log with wsmsg component for consistency
        this.logger.debugComponent('wsmsg', 'Internal WebSocket message received', {
          messageId: message.id,
          messageType: message.type,
          sessionId: message.sessionId,
          userId: message.userId,
          timestamp: message.timestamp,
          fullBody: this._redactSensitiveData(message.data),
        });

        this._messages$.next(message);
        this._updateConnectionHealth(5); // Small health boost for successful message
      } catch (error) {
        this._handleMalformedMessage('Unexpected error processing message', error, event.data);
      }
    });

    this._socket.addEventListener('close', event => {
      this._connectionState$.next(WebSocketState.DISCONNECTED);
      this._stopHeartbeat();
      this._updateConnectionHealth(-20); // Health decrease on disconnect

      this.logger.info('WebSocket connection closed', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });

      // Attempt reconnection if not a clean close and connection is recoverable
      if (event.code !== 1000 && this._shouldAttemptReconnection()) {
        this._attemptReconnection();
      } else if (event.code !== 1000) {
        // Max reconnect attempts reached
        this._connectionState$.next(WebSocketState.FAILED);
        const wsError: WebSocketError = {
          type: WebSocketErrorType.CONNECTION_FAILED,
          message: `Connection lost and max reconnection attempts (${this._maxReconnectAttempts}) reached`,
          originalError: event,
          isRecoverable: false,
          retryable: false,
        };
        this._lastError = wsError;
        this._errors$.next(wsError);
      }
    });

    this._socket.addEventListener('error', event => {
      this._connectionState$.next(WebSocketState.ERROR);
      this._updateConnectionHealth(-25); // Larger health decrease for errors

      const wsError: WebSocketError = {
        type: WebSocketErrorType.NETWORK_ERROR,
        message: 'WebSocket error occurred',
        originalError: event,
        isRecoverable: this._connectionHealth > 0,
        retryable: this._connectionHealth > 0,
      };
      this._lastError = wsError;
      this._errors$.next(wsError);
    });
  }

  /**
   * Check if reconnection should be attempted
   */
  private _shouldAttemptReconnection(): boolean {
    return (
      this._reconnectAttempts < this._maxReconnectAttempts &&
      this._connectionHealth > 0 &&
      (!this._lastError || this._lastError.retryable)
    );
  }

  /**
   * Attempt to reconnect to WebSocket server
   */
  private _attemptReconnection(): void {
    if (!this._url || !this._shouldAttemptReconnection()) {
      this.logger.warn('Reconnection not attempted', {
        hasUrl: !!this._url,
        attempts: this._reconnectAttempts,
        maxAttempts: this._maxReconnectAttempts,
        health: this._connectionHealth,
        lastErrorRetryable: this._lastError?.retryable,
      });
      return;
    }

    this._reconnectAttempts++;
    this._connectionState$.next(WebSocketState.RECONNECTING);
    const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

    this.logger.info('WebSocket attempting reconnection', {
      attempt: this._reconnectAttempts,
      maxAttempts: this._maxReconnectAttempts,
      delay,
      health: this._connectionHealth,
      url: this._url.replace(/\?.*$/, ''), // Don't log query params
    });

    setTimeout(() => {
      if (this._url && this._shouldAttemptReconnection()) {
        this.connect(this._url).subscribe({
          next: () => {
            this.logger.info('WebSocket reconnection successful');
            this._updateConnectionHealth(30); // Health boost on successful reconnection
          },
          error: error => {
            this.logger.warn('WebSocket reconnection failed', {
              error,
              attempt: this._reconnectAttempts,
            });
            this._updateConnectionHealth(-10); // Health decrease on failed reconnection
            this._attemptReconnection();
          },
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
          next: () => {
            // Heartbeat successful - improve health
            this._updateConnectionHealth(2);
            this._missedHeartbeats = 0;
          },
          error: error => {
            // Heartbeat failed - track missed heartbeats
            this._missedHeartbeats++;
            this._updateConnectionHealth(-10);

            this.logger.warn('Heartbeat failed', {
              missedCount: this._missedHeartbeats,
              maxMissed: this._maxMissedHeartbeats,
              health: this._connectionHealth,
              error,
            });

            // If too many heartbeats missed, force reconnection
            if (this._missedHeartbeats >= this._maxMissedHeartbeats) {
              this.logger.error('Too many missed heartbeats, forcing reconnection');
              this._connectionState$.next(WebSocketState.ERROR);
              const wsError: WebSocketError = {
                type: WebSocketErrorType.TIMEOUT,
                message: 'Connection unhealthy - too many missed heartbeats',
                originalError: error,
                isRecoverable: true,
                retryable: true,
              };
              this._lastError = wsError;
              this._errors$.next(wsError);
              this._attemptReconnection();
            }
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
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Classify connection errors for appropriate recovery strategy
   */
  private _classifyConnectionError(event: any, errorMessage: string): WebSocketError {
    // Check for authentication errors
    if (
      errorMessage.includes('401') ||
      errorMessage.includes('403') ||
      errorMessage.includes('Unauthorized')
    ) {
      return {
        type: WebSocketErrorType.AUTHENTICATION_FAILED,
        message: 'Authentication failed - invalid or expired token',
        originalError: event,
        isRecoverable: false, // Requires new auth token
        retryable: false,
      };
    }

    // Check for network connectivity errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('timeout')
    ) {
      return {
        type: WebSocketErrorType.NETWORK_ERROR,
        message: 'Network connectivity issue',
        originalError: event,
        isRecoverable: true,
        retryable: true,
      };
    }

    // Default to general connection failure
    return {
      type: WebSocketErrorType.CONNECTION_FAILED,
      message: errorMessage,
      originalError: event,
      isRecoverable: true,
      retryable: true,
    };
  }

  /**
   * Update connection health score
   */
  private _updateConnectionHealth(delta: number): void {
    this._connectionHealth = Math.max(0, Math.min(100, this._connectionHealth + delta));

    if (this._connectionHealth === 0) {
      this._connectionState$.next(WebSocketState.FAILED);
    }

    this.logger.debug('Connection health updated', {
      health: this._connectionHealth,
      delta,
      state: this.connectionState,
    });
  }

  /**
   * Send message with retry mechanism
   */
  sendMessageWithRetry(
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    maxRetries: number = 3,
  ): Observable<void> {
    return new Observable(observer => {
      const attemptSend = (attempt: number) => {
        this.sendMessage(message).subscribe({
          next: () => {
            observer.next();
            observer.complete();
          },
          error: error => {
            if (attempt < maxRetries && this._isRetryableError(error)) {
              this.logger.warn(`Message send failed, retrying (${attempt + 1}/${maxRetries})`, {
                error,
                message,
              });
              setTimeout(() => attemptSend(attempt + 1), 1000 * Math.pow(2, attempt));
            } else {
              this.logger.error(`Message send failed after ${attempt + 1} attempts`, {
                error,
                message,
              });
              observer.error(error);
            }
          },
        });
      };

      attemptSend(0);
    });
  }

  /**
   * Check if an error is retryable
   */
  private _isRetryableError(error: any): boolean {
    return (
      !error.message?.includes('401') &&
      !error.message?.includes('403') &&
      this._connectionHealth > 0
    );
  }

  /**
   * Force reconnection with health reset
   */
  forceReconnect(): Observable<void> {
    this.logger.info('Forcing WebSocket reconnection');

    // Reset health and error state
    this._connectionHealth = 100;
    this._missedHeartbeats = 0;
    this._lastError = null;
    this._reconnectAttempts = 0;

    // Disconnect and reconnect
    this.disconnect();

    if (this._url) {
      return this.connect(this._url);
    } else {
      return throwError(() => new Error('No URL available for reconnection'));
    }
  }

  /**
   * Validate WebSocket message structure
   */
  private _validateWebSocketMessage(message: any): { isValid: boolean; error?: string } {
    // Check if message is an object
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'Message must be an object' };
    }

    // Check required fields for general WebSocket messages
    if (typeof message.id !== 'string' || !message.id.trim()) {
      return { isValid: false, error: 'Message must have a valid id string' };
    }

    if (typeof message.type !== 'string' || !message.type.trim()) {
      return { isValid: false, error: 'Message must have a valid type string' };
    }

    if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
      return { isValid: false, error: 'Message must have a valid timestamp number' };
    }

    if (!message.data || typeof message.data !== 'object') {
      return { isValid: false, error: 'Message must have a data object' };
    }

    // Validate that message type is a known MessageType
    const validTypes = Object.values(MessageType);
    if (!validTypes.includes(message.type as MessageType)) {
      return { isValid: false, error: `Unknown message type: ${message.type}` };
    }

    // Additional validation for specific message types
    if (message.type === MessageType.ACKNOWLEDGMENT) {
      if (typeof message.data.messageId !== 'string') {
        return { isValid: false, error: 'Acknowledgment message must have messageId in data' };
      }
    }

    if (message.requiresAck !== undefined && typeof message.requiresAck !== 'boolean') {
      return { isValid: false, error: 'requiresAck must be a boolean if provided' };
    }

    if (message.sessionId !== undefined && typeof message.sessionId !== 'string') {
      return { isValid: false, error: 'sessionId must be a string if provided' };
    }

    if (message.userId !== undefined && typeof message.userId !== 'string') {
      return { isValid: false, error: 'userId must be a string if provided' };
    }

    return { isValid: true };
  }

  /**
   * Validate TMI collaborative message structure
   */
  private _validateTMIMessage(message: any): { isValid: boolean; error?: string } {
    // Check if message is an object
    if (!message || typeof message !== 'object') {
      return { isValid: false, error: 'TMI message must be an object' };
    }

    // Check for message_type or event field
    const messageType = message.message_type || message.event;
    if (typeof messageType !== 'string' || !messageType.trim()) {
      return { isValid: false, error: 'TMI message must have message_type or event string' };
    }

    // Validate user_id if present
    if (message.user_id !== undefined && typeof message.user_id !== 'string') {
      return { isValid: false, error: 'user_id must be a string if provided' };
    }

    // Validate operation_id if present
    if (message.operation_id !== undefined && typeof message.operation_id !== 'string') {
      return { isValid: false, error: 'operation_id must be a string if provided' };
    }

    // Type-specific validation
    if (messageType === 'diagram_operation') {
      if (!message.operation || typeof message.operation !== 'object') {
        return { isValid: false, error: 'diagram_operation message must have operation object' };
      }

      if (typeof message.operation.type !== 'string') {
        return { isValid: false, error: 'operation must have type string' };
      }

      if (!Array.isArray(message.operation.cells)) {
        return { isValid: false, error: 'operation must have cells array' };
      }
    }

    if (
      messageType === 'presenter_cursor' &&
      (!message.cursor_position || typeof message.cursor_position !== 'object')
    ) {
      return { isValid: false, error: 'presenter_cursor message must have cursor_position object' };
    }

    if (messageType === 'presenter_selection' && !Array.isArray(message.selected_cells)) {
      return {
        isValid: false,
        error: 'presenter_selection message must have selected_cells array',
      };
    }

    return { isValid: true };
  }

  /**
   * Handle malformed messages with proper error reporting
   */
  private _handleMalformedMessage(reason: string, originalError: any, rawData: any): void {
    const truncatedData =
      typeof rawData === 'string' && rawData.length > 200
        ? rawData.substring(0, 200) + '...[truncated]'
        : rawData;

    const wsError: WebSocketError = {
      type: WebSocketErrorType.PARSE_ERROR,
      message: `Malformed WebSocket message: ${reason}`,
      originalError: originalError,
      isRecoverable: true,
      retryable: false,
    };

    this._lastError = wsError;
    this._updateConnectionHealth(-5); // Small health decrease for malformed message

    this.logger.error('Received malformed WebSocket message', {
      reason,
      rawData: truncatedData,
      originalError,
      connectionHealth: this._connectionHealth,
    });

    this._errors$.next(wsError);
  }

  /**
   * Redact sensitive information from WebSocket message data
   * @param data Message data that may contain sensitive information
   * @returns Object with sensitive values redacted
   */
  private _redactSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const redacted = { ...data };
    const sensitiveKeys = [
      'bearer',
      'token',
      'password',
      'secret',
      'jwt',
      'refresh_token',
      'access_token',
      'api_key',
      'apikey',
      'authorization',
      'auth',
    ];

    for (const [key, value] of Object.entries(redacted)) {
      const lowerKey = key.toLowerCase();

      // Check if the key contains sensitive information
      if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        if (typeof value === 'string' && value.length > 0) {
          redacted[key] = this._redactToken(value);
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively redact nested objects
        redacted[key] = this._redactSensitiveData(value);
      }
    }

    return redacted;
  }

  /**
   * Redact a token while showing first and last few characters for debugging
   * @param token The token to redact
   * @returns Redacted token string
   */
  private _redactToken(token: string): string {
    if (token.length <= 8) {
      return '[REDACTED]';
    }
    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    const middle = '*'.repeat(Math.min(12, token.length - 8));
    return `${start}${middle}${end}`;
  }
}
