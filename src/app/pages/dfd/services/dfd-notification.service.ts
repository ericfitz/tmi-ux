import { Injectable, OnDestroy } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { Observable, Subject, Subscription } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';
import { WebSocketState, WebSocketError, WebSocketErrorType } from '../infrastructure/adapters/websocket.adapter';

/**
 * Notification types for consistent styling and behavior
 */
export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
}

/**
 * Notification configuration interface
 */
export interface NotificationConfig extends Partial<MatSnackBarConfig> {
  type?: NotificationType;
  actionLabel?: string;
  actionCallback?: () => void;
  persistent?: boolean; // Don't auto-dismiss
}

/**
 * Standard notification presets
 */
interface NotificationPresets {
  [key: string]: NotificationConfig;
}

/**
 * Service for managing notifications in the DFD editor
 * Provides centralized notification management for collaboration events, 
 * WebSocket status changes, and error handling with appropriate styling and actions.
 */
@Injectable({
  providedIn: 'root',
})
export class DfdNotificationService implements OnDestroy {
  private readonly _destroy$ = new Subject<void>();
  private _activeNotifications = new Map<string, MatSnackBarRef<SimpleSnackBar>>();
  private _subscriptions = new Subscription();

  // Notification presets for consistent styling
  private readonly _presets: NotificationPresets = {
    // WebSocket connection status
    websocketConnecting: {
      type: NotificationType.INFO,
      duration: 0, // Persistent until connection established
      panelClass: ['notification-info'],
    },
    websocketConnected: {
      type: NotificationType.SUCCESS,
      duration: 3000,
      panelClass: ['notification-success'],
    },
    websocketDisconnected: {
      type: NotificationType.WARNING,
      duration: 0, // Persistent until resolved
      panelClass: ['notification-warning'],
      actionLabel: 'Retry',
    },
    websocketReconnecting: {
      type: NotificationType.INFO,
      duration: 0, // Persistent until reconnection attempt completes
      panelClass: ['notification-info'],
    },
    websocketFailed: {
      type: NotificationType.ERROR,
      duration: 0, // Persistent - requires user action
      panelClass: ['notification-error'],
      actionLabel: 'Retry',
    },

    // Collaboration session events
    sessionStarted: {
      type: NotificationType.SUCCESS,
      duration: 3000,
      panelClass: ['notification-success'],
    },
    sessionEnded: {
      type: NotificationType.INFO,
      duration: 3000,
      panelClass: ['notification-info'],
    },
    userJoined: {
      type: NotificationType.INFO,
      duration: 2000,
      panelClass: ['notification-info'],
    },
    userLeft: {
      type: NotificationType.INFO,
      duration: 2000,
      panelClass: ['notification-info'],
    },

    // Presenter mode notifications
    presenterAssigned: {
      type: NotificationType.SUCCESS,
      duration: 3000,
      panelClass: ['notification-success'],
    },
    presenterRequestSent: {
      type: NotificationType.INFO,
      duration: 3000,
      panelClass: ['notification-info'],
    },
    presenterRequestApproved: {
      type: NotificationType.SUCCESS,
      duration: 3000,
      panelClass: ['notification-success'],
    },
    presenterRequestDenied: {
      type: NotificationType.WARNING,
      duration: 3000,
      panelClass: ['notification-warning'],
    },

    // Error notifications
    operationError: {
      type: NotificationType.ERROR,
      duration: 5000,
      panelClass: ['notification-error'],
    },
    authenticationError: {
      type: NotificationType.ERROR,
      duration: 0, // Persistent - requires user action
      panelClass: ['notification-error'],
      actionLabel: 'Login',
    },
    networkError: {
      type: NotificationType.ERROR,
      duration: 5000,
      panelClass: ['notification-error'],
      actionLabel: 'Retry',
    },

    // General notifications
    success: {
      type: NotificationType.SUCCESS,
      duration: 3000,
      panelClass: ['notification-success'],
    },
    info: {
      type: NotificationType.INFO,
      duration: 3000,
      panelClass: ['notification-info'],
    },
    warning: {
      type: NotificationType.WARNING,
      duration: 4000,
      panelClass: ['notification-warning'],
    },
    error: {
      type: NotificationType.ERROR,
      duration: 5000,
      panelClass: ['notification-error'],
    },
  };

  constructor(
    private _snackBar: MatSnackBar,
    private _logger: LoggerService,
  ) {
    this._logger.info('DfdNotificationService initialized');
  }

  /**
   * Show a notification with the specified preset configuration
   * @param presetKey The preset configuration to use
   * @param message The message to display
   * @param overrides Optional configuration overrides
   * @returns Observable that completes when notification is dismissed
   */
  showPreset(
    presetKey: string, 
    message: string, 
    overrides?: Partial<NotificationConfig>
  ): Observable<void> {
    const preset = this._presets[presetKey];
    if (!preset) {
      this._logger.warn('Unknown notification preset', { presetKey });
      return this.show(message, { type: NotificationType.INFO, ...overrides });
    }

    return this.show(message, { ...preset, ...overrides });
  }

  /**
   * Show a notification with custom configuration
   * @param message The message to display
   * @param config Optional configuration
   * @returns Observable that completes when notification is dismissed
   */
  show(message: string, config: NotificationConfig = {}): Observable<void> {
    return new Observable(observer => {
      try {
        // Build configuration with defaults
        const snackBarConfig: MatSnackBarConfig = {
          duration: config.persistent ? 0 : (config.duration ?? 3000),
          horizontalPosition: config.horizontalPosition ?? 'end',
          verticalPosition: config.verticalPosition ?? 'top',
          panelClass: config.panelClass ?? this._getPanelClassForType(config.type),
          ...config,
        };

        // Create unique key for this notification
        const notificationKey = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Show the notification
        const snackBarRef = this._snackBar.open(
          message, 
          config.actionLabel || 'Dismiss', 
          snackBarConfig
        );

        // Store reference for potential dismissal
        this._activeNotifications.set(notificationKey, snackBarRef);

        // Handle action clicks
        snackBarRef.onAction().subscribe(() => {
          if (config.actionCallback) {
            try {
              config.actionCallback();
            } catch (error) {
              this._logger.error('Error executing notification action callback', error);
            }
          }
          observer.next();
          observer.complete();
        });

        // Handle dismissal
        snackBarRef.afterDismissed().subscribe(() => {
          this._activeNotifications.delete(notificationKey);
          observer.next();
          observer.complete();
        });

        this._logger.debug('Notification shown', { 
          message, 
          type: config.type, 
          duration: snackBarConfig.duration,
          notificationKey 
        });
      } catch (error) {
        this._logger.error('Failed to show notification', { error, message, config });
        observer.error(error);
      }
    });
  }

  /**
   * Show WebSocket connection status notification
   * @param state The WebSocket state
   * @param retryCallback Optional callback for retry action
   */
  showWebSocketStatus(state: WebSocketState, retryCallback?: () => void): Observable<void> {
    let message: string;
    let presetKey: string;
    let actionCallback: (() => void) | undefined = retryCallback;

    switch (state) {
      case WebSocketState.CONNECTING:
        message = 'Connecting to collaboration server...';
        presetKey = 'websocketConnecting';
        actionCallback = undefined; // No action during connecting
        break;
      case WebSocketState.CONNECTED:
        message = 'Connected to collaboration server';
        presetKey = 'websocketConnected';
        actionCallback = undefined;
        break;
      case WebSocketState.DISCONNECTED:
        message = 'Disconnected from collaboration server. Changes will be saved locally.';
        presetKey = 'websocketDisconnected';
        break;
      case WebSocketState.RECONNECTING:
        message = 'Attempting to reconnect to collaboration server...';
        presetKey = 'websocketReconnecting';
        actionCallback = undefined; // No action during reconnecting
        break;
      case WebSocketState.ERROR:
        message = 'Connection error. Working in offline mode.';
        presetKey = 'websocketFailed';
        break;
      case WebSocketState.FAILED:
        message = 'Connection failed after multiple attempts. Working in offline mode.';
        presetKey = 'websocketFailed';
        break;
      default:
        message = 'Unknown connection status';
        presetKey = 'info';
    }

    // Dismiss any existing WebSocket status notifications
    this._dismissWebSocketNotifications();

    return this.showPreset(presetKey, message, { actionCallback });
  }

  /**
   * Show WebSocket error notification with appropriate recovery action
   * @param error The WebSocket error
   * @param retryCallback Optional callback for retry action
   */
  showWebSocketError(error: WebSocketError, retryCallback?: () => void): Observable<void> {
    let message: string;
    let presetKey: string;
    let actionCallback: (() => void) | undefined = retryCallback;

    switch (error.type) {
      case WebSocketErrorType.AUTHENTICATION_FAILED:
        message = 'Authentication failed. Please log in again.';
        presetKey = 'authenticationError';
        break;
      case WebSocketErrorType.NETWORK_ERROR:
        message = 'Network connection issue. Check your internet connection.';
        presetKey = 'networkError';
        break;
      case WebSocketErrorType.CONNECTION_FAILED:
        message = 'Failed to connect to collaboration server.';
        presetKey = 'networkError';
        break;
      case WebSocketErrorType.TIMEOUT:
        message = 'Connection timeout. The server may be overloaded.';
        presetKey = 'networkError';
        break;
      case WebSocketErrorType.MESSAGE_SEND_FAILED:
        message = 'Failed to send message. Your changes may not be synced.';
        presetKey = 'operationError';
        break;
      case WebSocketErrorType.PARSE_ERROR:
        message = 'Communication error with server. Some updates may not sync.';
        presetKey = 'warning';
        actionCallback = undefined; // Parse errors usually don't need retry
        break;
      default:
        message = error.message || 'Unknown WebSocket error occurred';
        presetKey = 'operationError';
    }

    // Don't provide retry for non-retryable errors
    if (!error.retryable) {
      actionCallback = undefined;
    }

    return this.showPreset(presetKey, message, { actionCallback });
  }

  /**
   * Show collaboration session event notification
   * @param event The session event type
   * @param details Additional details (e.g., user name)
   */
  showSessionEvent(event: 'started' | 'ended' | 'userJoined' | 'userLeft', details?: string): Observable<void> {
    let message: string;
    let presetKey: string;

    switch (event) {
      case 'started':
        message = 'Collaboration session started. Other users can now join and edit.';
        presetKey = 'sessionStarted';
        break;
      case 'ended':
        message = 'Collaboration session ended. Working in single-user mode.';
        presetKey = 'sessionEnded';
        break;
      case 'userJoined':
        message = details ? `${details} joined the collaboration session` : 'A user joined the collaboration session';
        presetKey = 'userJoined';
        break;
      case 'userLeft':
        message = details ? `${details} left the collaboration session` : 'A user left the collaboration session';
        presetKey = 'userLeft';
        break;
      default:
        message = 'Collaboration session event occurred';
        presetKey = 'info';
    }

    return this.showPreset(presetKey, message);
  }

  /**
   * Show presenter mode notification
   * @param event The presenter event type
   * @param userName Optional user name for context
   */
  showPresenterEvent(
    event: 'assigned' | 'requestSent' | 'requestApproved' | 'requestDenied' | 'cleared', 
    userName?: string
  ): Observable<void> {
    let message: string;
    let presetKey: string;

    switch (event) {
      case 'assigned':
        if (userName) {
          message = `${userName} is now the presenter`;
        } else {
          message = 'You are now the presenter';
        }
        presetKey = 'presenterAssigned';
        break;
      case 'requestSent':
        message = 'Presenter request sent to session owner';
        presetKey = 'presenterRequestSent';
        break;
      case 'requestApproved':
        message = 'Your presenter request was approved. You are now the presenter.';
        presetKey = 'presenterRequestApproved';
        break;
      case 'requestDenied':
        message = 'Your presenter request was denied';
        presetKey = 'presenterRequestDenied';
        break;
      case 'cleared':
        message = 'Presenter mode has been cleared';
        presetKey = 'info';
        break;
      default:
        message = 'Presenter mode changed';
        presetKey = 'info';
    }

    return this.showPreset(presetKey, message);
  }

  /**
   * Show operation error notification
   * @param operation The operation that failed
   * @param error The error details
   * @param retryCallback Optional retry callback
   */
  showOperationError(operation: string, error: string, retryCallback?: () => void): Observable<void> {
    const message = `Failed to ${operation}: ${error}`;
    return this.showPreset('operationError', message, { actionCallback: retryCallback });
  }

  /**
   * Show success notification
   * @param message The success message
   */
  showSuccess(message: string): Observable<void> {
    return this.showPreset('success', message);
  }

  /**
   * Show info notification
   * @param message The info message
   */
  showInfo(message: string): Observable<void> {
    return this.showPreset('info', message);
  }

  /**
   * Show warning notification
   * @param message The warning message
   */
  showWarning(message: string): Observable<void> {
    return this.showPreset('warning', message);
  }

  /**
   * Show error notification
   * @param message The error message
   * @param retryCallback Optional retry callback
   */
  showError(message: string, retryCallback?: () => void): Observable<void> {
    return this.showPreset('error', message, { actionCallback: retryCallback });
  }

  /**
   * Dismiss all active notifications
   */
  dismissAll(): void {
    this._snackBar.dismiss();
    this._activeNotifications.clear();
    this._logger.debug('All notifications dismissed');
  }

  /**
   * Dismiss notifications by key pattern
   * @param keyPattern Pattern to match notification keys
   */
  dismissByPattern(keyPattern: RegExp): void {
    const keysToRemove: string[] = [];
    
    for (const [key, ref] of this._activeNotifications.entries()) {
      if (keyPattern.test(key)) {
        ref.dismiss();
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => this._activeNotifications.delete(key));
    
    this._logger.debug('Notifications dismissed by pattern', { 
      pattern: keyPattern.toString(), 
      count: keysToRemove.length 
    });
  }

  /**
   * Get panel class for notification type
   * @param type The notification type
   * @returns Array of CSS classes
   */
  private _getPanelClassForType(type?: NotificationType): string[] {
    switch (type) {
      case NotificationType.SUCCESS:
        return ['notification-success'];
      case NotificationType.WARNING:
        return ['notification-warning'];
      case NotificationType.ERROR:
        return ['notification-error'];
      case NotificationType.INFO:
      default:
        return ['notification-info'];
    }
  }

  /**
   * Dismiss WebSocket-related notifications to avoid duplication
   */
  private _dismissWebSocketNotifications(): void {
    this.dismissByPattern(/websocket/i);
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
    this.dismissAll();
    this._logger.debug('DfdNotificationService destroyed');
  }
}