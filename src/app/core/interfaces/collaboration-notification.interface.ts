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
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user of a collaboration session lifecycle event
  showSessionEvent(eventType: SessionEventType, displayName?: string): Observable<void>;

  /**
   * Show a presenter-related event notification
   * @param eventType The type of presenter event
   * @param displayName Optional display name for user-related events
   * @returns Observable that completes when notification is shown
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user of a presenter role change or request event
  showPresenterEvent(eventType: PresenterEventType, displayName?: string): Observable<void>;

  /**
   * Show an operation error notification
   * @param operation The operation that failed
   * @param errorMessage The error message
   * @returns Observable that completes when notification is shown
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user that a named collaboration operation failed with an error message
  showOperationError(operation: string, errorMessage: string): Observable<void>;

  /**
   * Show a WebSocket status notification
   * @param state The WebSocket state
   * @param retryCallback Optional callback for retry action
   * @returns Observable that completes when notification is shown
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user of WebSocket connection state with optional retry action (pure)
  showWebSocketStatus(state: WebSocketState, retryCallback?: () => void): Observable<void>;

  /**
   * Show a WebSocket error notification
   * @param error The WebSocket error
   * @param retryCallback Optional callback for retry action
   * @returns Observable that completes when notification is shown
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user of a WebSocket error with optional retry action (pure)
  showWebSocketError(error: WebSocketError, retryCallback?: () => void): Observable<void>;

  /**
   * Show a general error notification
   * @param message The error message
   * @returns Observable that completes when notification is shown
   */
  // SEM@2d0a5fe4b5507768d4604debd61018f8d3909cec: notify the user of a general error message (pure)
  showError(message: string): Observable<void>;

  /**
   * Show a general info notification
   * @param message The info message
   * @returns Observable that completes when notification is shown
   */
  // SEM@5bf1a2e1fa628ea957ce2b6c1b81c82743b2200f: notify the user with a general informational message (pure)
  showInfo(message: string): Observable<void>;

  /**
   * Show a presenter request notification with approve/deny actions
   * @param userEmail The email of the user requesting presenter privileges
   * @param displayName The display name of the user
   * @returns Observable that emits 'approve' or 'deny' action, or completes without value if dismissed
   */
  // SEM@2ee7de4555d27c2af18eaee4686f6735d85b472d: notify the user of a presenter privilege request and return approve/deny decision (pure)
  showPresenterRequestReceived(
    userEmail: string,
    displayName: string,
  ): Observable<'approve' | 'deny' | null>;

  /**
   * Notify the user that the session ended and they are now working solo.
   * Unlike showSessionEvent('ended') (suppressed by design), this is always shown:
   * it carries the REASON, which the collaboration icon state cannot.
   * @param reason Why the session ended
   * @returns Observable that completes when notification is shown
   */
  // SEM@5e5cf5657df2f3460ec839bff04d078877417664: notify the user that the collaboration session ended and they are now working solo (pure)
  showSoloTransition(reason: SoloTransitionReason): Observable<void>;
}

/** Why the collaboration session ended (drives the solo-transition message) */
// SEM@5e5cf5657df2f3460ec839bff04d078877417664: enumerate reasons a collaboration session ended and the user transitioned to solo (pure)
export type SoloTransitionReason = 'left' | 'ended_by_you' | 'disconnected' | 'error';

/**
 * Types of session events that can trigger notifications
 */
// SEM@016cf91ed31dd9e800b8d2c22c26718ea531c7d4: enumerate collaboration session lifecycle events for notification dispatch (pure)
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
// SEM@8ad43e58ae86a57581df9b84b3533a52b4228ae8: enumerate presenter role lifecycle events for notification dispatch (pure)
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
