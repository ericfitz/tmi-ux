import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Subject, Observable } from 'rxjs';
import { filter, takeUntil, catchError } from 'rxjs/operators';

import { CollaborationApplicationService } from '../../application/collaboration/collaboration-application.service';
import {
  WebSocketAdapter,
  WebSocketMessage,
  MessageType,
  WebSocketState,
} from '../adapters/websocket.adapter';
import { SerializationService } from './serialization.service';
import { User } from '../../domain/collaboration/user';
import {
  UserPresence,
  PresenceStatus,
  UserActivity,
  CursorState,
} from '../../domain/collaboration/user-presence';
import { CollaborationSession } from '../../domain/collaboration/collaboration-session';
import { AnyDiagramCommand } from '../../domain/commands/diagram-commands';
import { AnyCollaborationEvent } from '../../domain/collaboration/collaboration-events';
import { Point } from '../../domain/value-objects/point';

/**
 * Service that integrates WebSocket communication with collaboration features
 */
@Injectable({
  providedIn: 'root',
})
export class CollaborationWebSocketService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private readonly _currentUser$ = new BehaviorSubject<User | null>(null);
  private readonly _currentSession$ = new BehaviorSubject<CollaborationSession | null>(null);

  /**
   * Observable for current user
   */
  public readonly currentUser$ = this._currentUser$.asObservable();

  /**
   * Observable for current collaboration session
   */
  public readonly currentSession$ = this._currentSession$.asObservable();

  /**
   * Observable for WebSocket connection state
   */
  public readonly connectionState$: Observable<WebSocketState>;

  /**
   * Observable for connection errors
   */
  public readonly connectionErrors$: Observable<Error>;

  constructor(
    private readonly _collaborationService: CollaborationApplicationService,
    private readonly _webSocketAdapter: WebSocketAdapter,
    private readonly _serializationService: SerializationService,
  ) {
    this.connectionState$ = this._webSocketAdapter.connectionState$;
    this.connectionErrors$ = this._webSocketAdapter.errors$;

    this._setupWebSocketMessageHandling();
    this._setupCollaborationEventBroadcasting();
  }

  /**
   * Connect to collaboration server
   */
  public connect(serverUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this._webSocketAdapter.connect(serverUrl).subscribe({
        next: () => resolve(),
        error: (error: Error) => reject(error),
      });
    });
  }

  /**
   * Disconnect from collaboration server
   */
  public disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Leave current session if active
        const currentUser = this._currentUser$.value;
        if (currentUser) {
          this.leaveSession()
            .then(() => {
              this._disconnectWebSocket(resolve, reject);
            })
            .catch((error: Error) => reject(error));
        } else {
          this._disconnectWebSocket(resolve, reject);
        }
      } catch (error) {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to disconnect from collaboration server:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Join a collaboration session
   */
  public joinSession(sessionId: string, user: User): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._webSocketAdapter.isConnected) {
        reject(new Error('WebSocket not connected'));
        return;
      }

      try {
        // Create join session message
        const message: WebSocketMessage = {
          id: this._generateMessageId(),
          type: MessageType.JOIN_SESSION,
          sessionId,
          userId: user.id,
          timestamp: Date.now(),
          data: {
            user: this._serializeUser(user),
          },
          requiresAck: true,
        };

        // Send join request and wait for acknowledgment
        this._webSocketAdapter.sendMessage(message).subscribe({
          next: () => {
            // Update local state
            this._currentUser$.next(user);

            // Join session in collaboration service
            this._collaborationService.joinSession(sessionId, user).subscribe({
              next: session => {
                this._currentSession$.next(session);
                resolve();
              },
              error: (error: Error) => reject(error),
            });
          },
          error: (error: Error) => reject(error),
        });
      } catch (error) {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to join collaboration session:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Leave current collaboration session
   */
  public leaveSession(): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentUser = this._currentUser$.value;

      if (!currentUser) {
        resolve();
        return;
      }

      if (!this._webSocketAdapter.isConnected) {
        // If WebSocket is disconnected, just clean up local state
        this._currentSession$.next(null);
        this._currentUser$.next(null);
        resolve();
        return;
      }

      try {
        // Create leave session message
        const message: WebSocketMessage = {
          id: this._generateMessageId(),
          type: MessageType.LEAVE_SESSION,
          sessionId: this._currentSession$.value?.id || '',
          userId: currentUser.id,
          timestamp: Date.now(),
          data: {},
          requiresAck: true,
        };

        // Send leave request
        this._webSocketAdapter.sendMessage(message).subscribe({
          next: () => {
            // Leave session in collaboration service
            this._collaborationService.leaveSession(currentUser.id).subscribe({
              next: () => {
                // Update local state
                this._currentSession$.next(null);
                this._currentUser$.next(null);
                resolve();
              },
              error: (error: Error) => reject(error),
            });
          },
          error: (error: Error) => reject(error),
        });
      } catch (error) {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to leave collaboration session:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Update user presence
   */
  public updatePresence(presence: UserPresence): Promise<void> {
    return new Promise(resolve => {
      const currentSession = this._currentSession$.value;
      const currentUser = this._currentUser$.value;

      if (!currentSession || !currentUser || !this._webSocketAdapter.isConnected) {
        resolve();
        return;
      }

      try {
        // Create presence update message
        const message: WebSocketMessage = {
          id: this._generateMessageId(),
          type: MessageType.USER_PRESENCE_UPDATE,
          sessionId: currentSession.id,
          userId: currentUser.id,
          timestamp: Date.now(),
          data: {
            presence: this._serializeUserPresence(presence),
          },
        };

        // Send presence update (no acknowledgment required for frequent updates)
        this._webSocketAdapter.sendMessage(message).subscribe({
          next: () => {
            // Update presence in collaboration service
            this._collaborationService.updateUserPresence(currentUser.id, presence).subscribe({
              next: () => resolve(),
              error: () => {
                // TODO: Replace with LoggerService when available
                // console.error('Failed to update user presence in collaboration service:', error);
                resolve(); // Don't fail for presence updates
              },
            });
          },
          error: () => {
            // TODO: Replace with LoggerService when available
            // console.error('Failed to send presence update:', error);
            resolve(); // Don't fail for presence updates
          },
        });
      } catch {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to update user presence:', error);
        resolve(); // Don't fail for presence updates
      }
    });
  }

  /**
   * Send cursor position update
   */
  public updateCursor(x: number, y: number): Promise<void> {
    return new Promise(resolve => {
      const currentSession = this._currentSession$.value;
      const currentUser = this._currentUser$.value;

      if (!currentSession || !currentUser || !this._webSocketAdapter.isConnected) {
        resolve();
        return;
      }

      try {
        // Create cursor update message
        const message: WebSocketMessage = {
          id: this._generateMessageId(),
          type: MessageType.USER_CURSOR_UPDATE,
          sessionId: currentSession.id,
          userId: currentUser.id,
          timestamp: Date.now(),
          data: {
            x,
            y,
          },
        };

        // Send cursor update (no acknowledgment required for frequent updates)
        this._webSocketAdapter.sendMessage(message).subscribe({
          next: () => resolve(),
          error: () => {
            // TODO: Replace with LoggerService when available
            // console.error('Failed to update cursor position:', error);
            resolve(); // Don't fail for cursor updates
          },
        });
      } catch {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to update cursor position:', error);
        resolve(); // Don't fail for cursor updates
      }
    });
  }

  /**
   * Execute a command and broadcast to other users
   */
  public executeCommand(command: AnyDiagramCommand): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentSession = this._currentSession$.value;
      const currentUser = this._currentUser$.value;

      if (!currentSession || !currentUser) {
        reject(new Error('No active collaboration session'));
        return;
      }

      try {
        // Execute command locally first
        this._collaborationService.executeCollaborativeCommand(command).subscribe({
          next: () => {
            // Broadcast command to other users if connected
            if (this._webSocketAdapter.isConnected) {
              const message: WebSocketMessage = {
                id: this._generateMessageId(),
                type: MessageType.COMMAND_EXECUTE,
                sessionId: currentSession.id,
                userId: currentUser.id,
                timestamp: Date.now(),
                data: {
                  command: this._serializationService.serializeCommand(command),
                },
                requiresAck: true,
              };

              this._webSocketAdapter.sendMessage(message).subscribe({
                next: () => resolve(),
                error: (error: Error) => reject(error),
              });
            } else {
              resolve();
            }
          },
          error: (error: Error) => reject(error),
        });
      } catch (error) {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to execute and broadcast command:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Request state synchronization
   */
  public requestStateSync(): Promise<void> {
    return new Promise((resolve, reject) => {
      const currentSession = this._currentSession$.value;
      const currentUser = this._currentUser$.value;

      if (!currentSession || !currentUser || !this._webSocketAdapter.isConnected) {
        resolve();
        return;
      }

      try {
        const message: WebSocketMessage = {
          id: this._generateMessageId(),
          type: MessageType.STATE_SYNC_REQUEST,
          sessionId: currentSession.id,
          userId: currentUser.id,
          timestamp: Date.now(),
          data: {},
          requiresAck: true,
        };

        this._webSocketAdapter.sendMessage(message).subscribe({
          next: () => resolve(),
          error: (error: Error) => reject(error),
        });
      } catch (error) {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to request state synchronization:', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Helper method to disconnect WebSocket
   */
  private _disconnectWebSocket(resolve: () => void, reject: (error: Error) => void): void {
    try {
      this._webSocketAdapter.disconnect();
      resolve();
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Setup WebSocket message handling
   */
  private _setupWebSocketMessageHandling(): void {
    this._webSocketAdapter.messages$
      .pipe(
        takeUntil(this._destroy$),
        catchError(() => {
          // TODO: Replace with LoggerService when available
          // console.error('Error handling WebSocket message:', error);
          return [];
        }),
      )
      .subscribe(message => {
        this._handleWebSocketMessage(message);
      });

    // Handle connection state changes
    this._webSocketAdapter.connectionState$
      .pipe(
        takeUntil(this._destroy$),
        filter(state => state === WebSocketState.DISCONNECTED),
      )
      .subscribe(() => {
        // Clean up state on disconnection
        this._currentSession$.next(null);
        this._currentUser$.next(null);
      });
  }

  /**
   * Setup collaboration event broadcasting
   */
  private _setupCollaborationEventBroadcasting(): void {
    // Listen for collaboration events and broadcast them
    this._collaborationService.collaborationEvents$
      .pipe(
        takeUntil(this._destroy$),
        filter(() => this._webSocketAdapter.isConnected),
        catchError(() => {
          // TODO: Replace with LoggerService when available
          // console.error('Error broadcasting collaboration event:', error);
          return [];
        }),
      )
      .subscribe(event => {
        this._broadcastEvent(event);
      });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private _handleWebSocketMessage(message: WebSocketMessage): void {
    try {
      switch (message.type) {
        case MessageType.SESSION_JOINED:
          this._handleSessionJoined(message);
          break;

        case MessageType.SESSION_LEFT:
          this._handleSessionLeft(message);
          break;

        case MessageType.USER_PRESENCE_UPDATE:
          this._handlePresenceUpdate(message);
          break;

        case MessageType.USER_CURSOR_UPDATE:
          this._handleCursorUpdate(message);
          break;

        case MessageType.COMMAND_EXECUTE:
          this._handleCommandExecution(message);
          break;

        case MessageType.COMMAND_CONFLICT:
          this._handleCommandConflict(message);
          break;

        case MessageType.CONFLICT_RESOLVED:
          this._handleConflictResolution(message);
          break;

        case MessageType.STATE_SYNC_RESPONSE:
          this._handleStateSyncResponse(message);
          break;

        case MessageType.ERROR:
          this._handleError(message);
          break;

        default:
        // TODO: Replace with LoggerService when available
        // console.warn('Unknown message type:', message.type);
      }
    } catch {
      // TODO: Replace with LoggerService when available
      // console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle session joined message
   */
  private _handleSessionJoined(message: WebSocketMessage): void {
    if (message.data['session']) {
      // const sessionData = message.data['session'] as unknown;
      // Update current session with server data
      // TODO: Replace with LoggerService when available
      // console.log('Session joined:', sessionData);
    }
  }

  /**
   * Handle session left message
   */
  private _handleSessionLeft(_message: WebSocketMessage): void {
    // if (message.userId === this._currentUser$.value?.id) {
    //   this._currentSession$.next(null);
    //   this._currentUser$.next(null);
    // }
  }

  /**
   * Handle presence update message
   */
  private _handlePresenceUpdate(message: WebSocketMessage): void {
    const currentUser = this._currentUser$.value;
    if (!message.userId || !message.data['presence'] || message.userId === currentUser?.id) {
      return;
    }

    const presenceData = message.data['presence'];
    const presence = this._deserializeUserPresence(presenceData);

    this._collaborationService.updateUserPresence(message.userId, presence).subscribe({
      error: () => {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to update user presence:', error);
      },
    });
  }

  /**
   * Handle cursor update message
   */
  private _handleCursorUpdate(_message: WebSocketMessage): void {
    // const currentUser = this._currentUser$.value;
    // if (!message.userId || message.userId === currentUser?.id) {
    //   return;
    // }
    // Cursor updates are handled by the UI layer
    // This service just passes them through via events
    // TODO: Replace with LoggerService when available
    // console.log('Cursor update from user:', message.userId, message.data);
  }

  /**
   * Handle command execution message
   */
  private _handleCommandExecution(message: WebSocketMessage): void {
    const currentUser = this._currentUser$.value;

    if (!message.userId || !message.data['command']) {
      return;
    }

    // Don't execute our own commands
    if (message.userId === currentUser?.id) {
      return;
    }

    const commandData = message.data['command'] as {
      type: string;
      data: Record<string, unknown>;
      timestamp: number;
      version: string;
    };
    const command = this._serializationService.deserializeCommand(commandData);

    this._collaborationService.executeCollaborativeCommand(command).subscribe({
      error: () => {
        // TODO: Replace with LoggerService when available
        // console.error('Failed to execute remote command:', error);
      },
    });
  }

  /**
   * Handle command conflict message
   */
  private _handleCommandConflict(_message: WebSocketMessage): void {
    // if (!message.data['conflict']) {
    //   return;
    // }
    // const conflictData = message.data['conflict'] as unknown;
    // TODO: Replace with LoggerService when available
    // console.log('Command conflict detected:', conflictData);
    // Handle conflict resolution in collaboration service
  }

  /**
   * Handle conflict resolution message
   */
  private _handleConflictResolution(_message: WebSocketMessage): void {
    // if (!message.data['resolution']) {
    //   return;
    // }
    // const resolutionData = message.data['resolution'] as unknown;
    // TODO: Replace with LoggerService when available
    // console.log('Conflict resolution received:', resolutionData);
    // Apply conflict resolution
  }

  /**
   * Handle state sync response message
   */
  private _handleStateSyncResponse(_message: WebSocketMessage): void {
    // if (!message.data['state']) {
    //   return;
    // }
    // const stateData = message.data['state'] as unknown;
    // TODO: Replace with LoggerService when available
    // console.log('State sync response received:', stateData);
    // Synchronize state with server
  }

  /**
   * Handle error message
   */
  private _handleError(_message: WebSocketMessage): void {
    // TODO: Replace with LoggerService when available
    // console.error('WebSocket error message:', message.data);
  }

  /**
   * Broadcast domain event via WebSocket
   */
  private _broadcastEvent(event: AnyCollaborationEvent): void {
    const currentSession = this._currentSession$.value;
    const currentUser = this._currentUser$.value;

    if (!currentSession || !currentUser || !this._webSocketAdapter.isConnected) {
      return;
    }

    try {
      const message: WebSocketMessage = {
        id: this._generateMessageId(),
        type: this._getMessageTypeForEvent(event),
        sessionId: currentSession.id,
        userId: currentUser.id,
        timestamp: Date.now(),
        data: {
          event: this._serializationService.serializeEvent(event),
        },
      };

      this._webSocketAdapter.sendMessage(message).subscribe({
        error: () => {
          // TODO: Replace with LoggerService when available
          // console.error('Failed to broadcast event:', error);
        },
      });
    } catch {
      // TODO: Replace with LoggerService when available
      // console.error('Failed to broadcast event:', error);
    }
  }

  /**
   * Get WebSocket message type for domain event
   */
  private _getMessageTypeForEvent(event: AnyCollaborationEvent): MessageType {
    // Map domain events to WebSocket message types
    switch (event.type) {
      case 'UserJoinedSessionEvent':
      case 'UserLeftSessionEvent':
        return MessageType.USER_PRESENCE_UPDATE;
      case 'CommandConflictEvent':
        return MessageType.COMMAND_CONFLICT;
      case 'ConflictResolvedEvent':
        return MessageType.CONFLICT_RESOLVED;
      default:
        return MessageType.COMMAND_EXECUTED;
    }
  }

  /**
   * Serialize user for transmission
   */
  private _serializeUser(user: User): Record<string, unknown> {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      color: user.color,
    };
  }

  /**
   * Serialize user presence for transmission
   */
  private _serializeUserPresence(presence: UserPresence): Record<string, unknown> {
    return {
      user: this._serializeUser(presence.user),
      status: presence.status,
      activity: presence.activity,
      lastSeen: presence.lastSeen.toISOString(),
      cursorState: presence.cursorState,
      currentTool: presence.currentTool,
    };
  }

  /**
   * Deserialize user presence from transmission
   */
  private _deserializeUserPresence(data: unknown): UserPresence {
    const presenceData = data as {
      user: { id: string; name: string; email: string; avatar?: string; color?: string };
      status: string;
      activity: string;
      lastSeen: string;
      cursorState?: {
        position: { x: number; y: number };
        selectedNodeIds: string[];
        selectedEdgeIds: string[];
        isVisible: boolean;
      };
      currentTool?: string;
    };

    // Convert cursor state if present
    let cursorState: CursorState | undefined;
    if (presenceData.cursorState) {
      cursorState = {
        position: new Point(
          presenceData.cursorState.position.x,
          presenceData.cursorState.position.y,
        ),
        selectedNodeIds: presenceData.cursorState.selectedNodeIds,
        selectedEdgeIds: presenceData.cursorState.selectedEdgeIds,
        isVisible: presenceData.cursorState.isVisible,
      };
    }

    return UserPresence.fromJSON({
      user: presenceData.user,
      status: presenceData.status as PresenceStatus,
      activity: presenceData.activity as UserActivity,
      lastSeen: presenceData.lastSeen,
      cursorState,
      currentTool: presenceData.currentTool,
    });
  }

  /**
   * Generate unique message ID
   */
  private _generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup on destroy
   */
  public ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }
}
