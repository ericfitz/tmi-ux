import { Injectable, OnDestroy } from '@angular/core';
import {
  MatSnackBar,
  MatSnackBarConfig,
  MatSnackBarRef,
  SimpleSnackBar,
} from '@angular/material/snack-bar';
import { Observable, Subject, Subscription } from 'rxjs';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import {
  WebSocketState,
  WebSocketError,
  WebSocketErrorType,
} from '../../../../core/services/websocket.adapter';
import {
  ICollaborationNotificationService,
  SessionEventType,
  PresenterEventType,
} from '../../../../core/interfaces/collaboration-notification.interface';
import {
  PresenterRequestSnackbarComponent,
  PresenterRequestSnackbarData,
} from '../../presentation/components/presenter-request-snackbar/presenter-request-snackbar.component';

/**
 * Notification types for consistent styling and behavior
 */
export enum NotificationType {
  SUCCESS = 'success',
  INFO = 'info',
  WARN = 'warning',
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
export class AppNotificationService implements OnDestroy, ICollaborationNotificationService {
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
      type: NotificationType.WARN,
      duration: 5000, // Auto-dismiss after 5 seconds
      panelClass: ['notification-warning'],
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
      type: NotificationType.WARN,
      duration: 3000,
      panelClass: ['notification-warning'],
    },

    // Error notifications
    operationError: {
      type: NotificationType.ERROR,
      duration: 5000,
      panelClass: ['notification-error'],
    },
    embeddingValidationError: {
      type: NotificationType.WARN,
      duration: 4000,
      panelClass: ['notification-warning'],
    },
    authenticationError: {
      type: NotificationType.ERROR,
      duration: 0, // Persistent - requires user action
      panelClass: ['notification-error'],
    },
    networkError: {
      type: NotificationType.ERROR,
      duration: 5000,
      panelClass: ['notification-error'],
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
      type: NotificationType.WARN,
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
    private _transloco: TranslocoService,
  ) {
    this._logger.debug('AppNotificationService initialized');
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
    overrides?: Partial<NotificationConfig>,
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
          config.actionLabel || this._transloco.translate('common.dismiss'),
          snackBarConfig,
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

        this._logger.debugComponent('AppNotificationService', 'Notification shown', {
          message,
          type: config.type,
          duration: snackBarConfig.duration,
          notificationKey,
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

    // Only show notifications for error states - success states are indicated by WebSocket icon
    switch (state) {
      case WebSocketState.CONNECTING:
      case WebSocketState.CONNECTED:
      case WebSocketState.RECONNECTING:
        // These are already indicated by the WebSocket icon state - no notification needed
        this._logger.debugComponent(
          'AppNotificationService',
          'WebSocket status suppressed - already indicated by UI',
          { state },
        );
        // Still dismiss any existing WebSocket error notifications on success
        if (state === WebSocketState.CONNECTED) {
          this._dismissWebSocketNotifications();
        }
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });

      case WebSocketState.DISCONNECTED:
        // Show warning for disconnection (user should know data might not sync)
        message = this._transloco.translate('notifications.websocket.disconnected');
        presetKey = 'websocketDisconnected';
        this._dismissWebSocketNotifications();
        return this.showPreset(presetKey, message);

      case WebSocketState.ERROR:
      case WebSocketState.FAILED:
        // Show error notifications with retry option
        message =
          state === WebSocketState.FAILED
            ? this._transloco.translate('notifications.websocket.multipleFailed')
            : this._transloco.translate('notifications.websocket.connectionError');
        presetKey = 'websocketFailed';

        this._dismissWebSocketNotifications();
        return this.showPreset(presetKey, message, {
          actionLabel: this._transloco.translate('common.retry'),
          actionCallback: retryCallback,
        });

      default:
        this._logger.warn('Unknown WebSocket state', { state });
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });
    }
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

    let actionLabel: string | undefined;

    switch (error.type) {
      case WebSocketErrorType.AUTHENTICATION_FAILED:
        message = this._transloco.translate('notifications.websocket.authenticationFailed');
        presetKey = 'authenticationError';
        actionLabel = this._transloco.translate('notifications.actions.login');
        break;
      case WebSocketErrorType.NETWORK_ERROR:
        message = this._transloco.translate('notifications.websocket.connectionError');
        presetKey = 'networkError';
        actionLabel = this._transloco.translate('common.retry');
        break;
      case WebSocketErrorType.CONNECTION_FAILED:
        message = this._transloco.translate('notifications.websocket.connectionFailed');
        presetKey = 'networkError';
        actionLabel = this._transloco.translate('common.retry');
        break;
      case WebSocketErrorType.TIMEOUT:
        message = this._transloco.translate('notifications.websocket.connectionTimeout');
        presetKey = 'networkError';
        actionLabel = this._transloco.translate('common.retry');
        break;
      case WebSocketErrorType.MESSAGE_SEND_FAILED:
        message = this._transloco.translate('notifications.websocket.messageSendFailed');
        presetKey = 'operationError';
        break;
      case WebSocketErrorType.PARSE_ERROR:
        message = this._transloco.translate('notifications.websocket.communicationError');
        presetKey = 'warning';
        actionCallback = undefined; // Parse errors usually don't need retry
        break;
      default:
        message =
          error.message || this._transloco.translate('notifications.websocket.unknownError');
        presetKey = 'operationError';
    }

    // Don't provide retry for non-retryable errors
    if (!error.retryable) {
      actionCallback = undefined;
      actionLabel = undefined;
    }

    return this.showPreset(presetKey, message, { actionLabel, actionCallback });
  }

  /**
   * Show collaboration session event notification
   * @param eventType The session event type
   * @param displayName Additional details (e.g., user name)
   */
  showSessionEvent(eventType: SessionEventType, displayName?: string): Observable<void> {
    // Only show notifications for events that aren't already indicated by UI state
    // Session start/end are already visible via collaboration icon state
    // Only show user join/leave events since they provide useful information
    switch (eventType) {
      case 'started':
      case 'ended':
        // These are already indicated by the collaboration icon state - no notification needed
        this._logger.debugComponent(
          'AppNotificationService',
          'Session event suppressed - already indicated by UI',
          { eventType },
        );
        return new Observable<void>(observer => {
          observer.next();
          observer.complete();
        });
      case 'userJoined':
        if (displayName) {
          const message = this._transloco.translate('collaboration.userJoined', {
            user: displayName,
          });
          return this.showPreset('userJoined', message);
        }
        break;
      case 'userLeft':
        if (displayName) {
          const message = this._transloco.translate('collaboration.userLeft', {
            user: displayName,
          });
          return this.showPreset('userLeft', message);
        }
        break;
      case 'userRemoved':
        if (displayName) {
          const message = this._transloco.translate('notifications.session.userRemoved', {
            user: displayName,
          });
          return this.showPreset('userLeft', message);
        } else {
          const message = this._transloco.translate('notifications.session.youWereRemoved');
          return this.showPreset('userLeft', message);
        }
        break;
      case 'disconnected':
        return this.showPreset(
          'warning',
          this._transloco.translate('notifications.session.disconnected'),
        );
      case 'reconnecting':
        return this.showPreset(
          'info',
          this._transloco.translate('notifications.session.reconnecting'),
        );
      case 'reconnected':
        return this.showPreset(
          'success',
          this._transloco.translate('notifications.session.reconnected'),
        );
      default:
        this._logger.warn('Unknown session event', { eventType });
        break;
    }

    // Return empty observable for suppressed events
    return new Observable<void>(observer => {
      observer.next();
      observer.complete();
    });
  }

  /**
   * Show presenter mode notification
   * @param event The presenter event type
   * @param displayName Optional user name for context
   */
  showPresenterEvent(eventType: PresenterEventType, displayName?: string): Observable<void> {
    let message: string;
    let presetKey: string;

    switch (eventType) {
      case 'assigned':
        message = displayName
          ? this._transloco.translate('notifications.presenter.assigned', { user: displayName })
          : this._transloco.translate('notifications.presenter.assignedYou');
        presetKey = 'presenterAssigned';
        break;
      case 'requestSent':
        message = this._transloco.translate('notifications.presenter.requestSent');
        presetKey = 'presenterRequestSent';
        break;
      case 'requestDenied':
        message = this._transloco.translate('notifications.presenter.requestDenied');
        presetKey = 'presenterRequestDenied';
        break;
      case 'cleared':
        message = this._transloco.translate('notifications.presenter.cleared');
        presetKey = 'info';
        break;
      case 'requested':
        message = displayName
          ? this._transloco.translate('notifications.presenter.requesting', { user: displayName })
          : this._transloco.translate('notifications.presenter.privilegesRequested');
        presetKey = 'info';
        break;
      case 'removed':
        message = displayName
          ? this._transloco.translate('notifications.presenter.removed', { user: displayName })
          : this._transloco.translate('notifications.presenter.removedYou');
        presetKey = 'info';
        break;
      case 'cursorMoved':
        message = this._transloco.translate('notifications.presenter.cursorMoved');
        presetKey = 'info';
        break;
      case 'selectionChanged':
        message = this._transloco.translate('notifications.presenter.selectionChanged');
        presetKey = 'info';
        break;
      default:
        message = this._transloco.translate('notifications.presenter.modeChanged');
        presetKey = 'info';
    }

    return this.showPreset(presetKey, message);
  }

  /**
   * Show operation error notification
   * @param operation The operation that failed
   * @param errorMessage The error message
   */
  showOperationError(operation: string, errorMessage: string): Observable<void> {
    const message = this._transloco.translate('notifications.operationError', {
      operation,
      errorMessage,
    });
    return this.showPreset('operationError', message);
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
   * Show embedding validation error notification
   * @param translationKey The translation key for the error message
   */
  showEmbeddingValidationError(translationKey: string): Observable<void> {
    const message = this._transloco.translate(translationKey);
    return this.showPreset('embeddingValidationError', message);
  }

  /**
   * Dismiss all active notifications
   */
  dismissAll(): void {
    this._snackBar.dismiss();
    this._activeNotifications.clear();
    this._logger.debugComponent('AppNotificationService', 'All notifications dismissed');
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

    this._logger.debugComponent('AppNotificationService', 'Notifications dismissed by pattern', {
      pattern: keyPattern.toString(),
      count: keysToRemove.length,
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
      case NotificationType.WARN:
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

  /**
   * Show presenter request notification with approve/deny actions
   * @param userEmail The email of the user requesting presenter privileges
   * @param displayName The display name of the user
   * @returns Observable that emits 'approve' or 'deny' based on user action
   */
  showPresenterRequestReceived(
    userEmail: string,
    displayName: string,
  ): Observable<'approve' | 'deny' | null> {
    return new Observable(observer => {
      const data: PresenterRequestSnackbarData = {
        userEmail,
        displayName,
        message: '', // Message is built in component
      };

      const snackBarRef = this._snackBar.openFromComponent(PresenterRequestSnackbarComponent, {
        data,
        duration: 0, // Persistent until user acts
        horizontalPosition: 'end',
        verticalPosition: 'top',
        panelClass: ['notification-info', 'presenter-request-notification'],
      });

      // Store reference for potential dismissal
      const notificationKey = `presenter_request_${userEmail}_${Date.now()}`;
      this._activeNotifications.set(notificationKey, snackBarRef as any);

      // Handle approve action
      snackBarRef.onAction().subscribe(() => {
        this._logger.info('Presenter request approved via snackbar', { userEmail, displayName });
        observer.next('approve');
        observer.complete();
      });

      // Handle dismissal (deny or timeout)
      snackBarRef.afterDismissed().subscribe(dismissal => {
        this._activeNotifications.delete(notificationKey);

        // If dismissed without action, treat as deny
        if (!dismissal.dismissedByAction) {
          this._logger.info('Presenter request denied via snackbar dismissal', {
            userEmail,
            displayName,
          });
          observer.next('deny');
        }
        observer.complete();
      });

      this._logger.debugComponent(
        'AppNotificationService',
        'Presenter request notification shown',
        {
          userEmail,
          displayName,
          notificationKey,
        },
      );
    });
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
    this._subscriptions.unsubscribe();
    this.dismissAll();
    this._logger.debugComponent('AppNotificationService', 'AppNotificationService destroyed');
  }
}
