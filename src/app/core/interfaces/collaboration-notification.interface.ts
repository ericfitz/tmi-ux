import { Observable } from 'rxjs';
import { WebSocketState, WebSocketError } from '../services/websocket.adapter';

/**
 * Interface for collaboration notification services.
 * This abstraction allows core services to send notifications
 * without depending on feature-specific implementations.
 */
export interface ICollaborationNotificationService {
  /**
   * Show a session-related event notification
   * @param eventType The type of session event
   * @param displayName Optional display name for user-related events
   * @returns Observable that completes when notification is shown
   */
  showSessionEvent(eventType: SessionEventType, displayName?: string): Observable<void>;

  /**
   * Show a presenter-related event notification
   * @param eventType The type of presenter event
   * @param displayName Optional display name for user-related events
   * @returns Observable that completes when notification is shown
   */
  showPresenterEvent(eventType: PresenterEventType, displayName?: string): Observable<void>;

  /**
   * Show an operation error notification
   * @param operation The operation that failed
   * @param errorMessage The error message
   * @returns Observable that completes when notification is shown
   */
  showOperationError(operation: string, errorMessage: string): Observable<void>;

  /**
   * Show a WebSocket status notification
   * @param state The WebSocket state
   * @param retryCallback Optional callback for retry action
   * @returns Observable that completes when notification is shown
   */
  showWebSocketStatus(state: WebSocketState, retryCallback?: () => void): Observable<void>;

  /**
   * Show a WebSocket error notification
   * @param error The WebSocket error
   * @param retryCallback Optional callback for retry action
   * @returns Observable that completes when notification is shown
   */
  showWebSocketError(error: WebSocketError, retryCallback?: () => void): Observable<void>;

  /**
   * Show a general error notification
   * @param message The error message
   * @returns Observable that completes when notification is shown
   */
  showError(message: string): Observable<void>;

  /**
   * Show a presenter request notification with approve/deny actions
   * @param userEmail The email of the user requesting presenter privileges
   * @param displayName The display name of the user
   * @returns Observable that emits 'approve' or 'deny' action, or completes without value if dismissed
   */
  showPresenterRequestReceived(
    userEmail: string,
    displayName: string,
  ): Observable<'approve' | 'deny' | null>;
}

/**
 * Types of session events that can trigger notifications
 */
export type SessionEventType =
  | 'started'
  | 'ended'
  | 'userJoined'
  | 'userLeft'
  | 'userRemoved'
  | 'disconnected'
  | 'reconnecting'
  | 'reconnected';

/**
 * Types of presenter events that can trigger notifications
 */
export type PresenterEventType =
  | 'requestSent'
  | 'requestDenied'
  | 'assigned'
  | 'cleared'
  | 'removed'
  | 'requested'
  | 'cursorMoved'
  | 'selectionChanged';

/**
 * Injection token for the collaboration notification service
 */
import { InjectionToken } from '@angular/core';

export const COLLABORATION_NOTIFICATION_SERVICE =
  new InjectionToken<ICollaborationNotificationService>('CollaborationNotificationService');
