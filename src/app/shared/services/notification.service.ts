import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { LoggerService } from '../../core/services/logger.service';
import { extractHttpErrorMessage } from '../utils/http-error.utils';

/**
 * Configuration for save error notifications
 */
export interface SaveErrorNotification {
  title: string;
  message: string;
  statusCode?: number;
  retryAction?: () => void;
  duration?: number;
  actionLabel?: string;
}

/**
 * Configuration for connection error notifications
 */
export interface ConnectionErrorNotification {
  message: string;
  duration?: number;
  showRetry?: boolean;
  retryAction?: () => void;
}

/**
 * Enhanced notification service for save failures and connection issues
 * Handles detailed server error display and prevents notification spam
 */
@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  // Track shown notifications to prevent spam
  private _shownNotifications = new Set<string>();
  private _lastConnectionErrorTime?: Date;
  private _connectionErrorCooldown = 30000; // 30 seconds

  constructor(
    private snackBar: MatSnackBar,
    private logger: LoggerService,
  ) {}

  /**
   * Show a save error notification with detailed server error information
   * @param error HTTP error response or error object
   * @param context Additional context about what was being saved
   * @param retryAction Optional retry function
   */
  showSaveError(
    error: HttpErrorResponse | Error,
    context: string = 'data',
    retryAction?: () => void,
  ): void {
    const notification = this.createSaveErrorNotification(error, context, retryAction);

    this.logger.debugComponent('Notification', 'Showing save error notification', {
      context,
      statusCode: notification.statusCode,
      message: notification.message,
    });

    // Show snackbar with retry action if provided
    const snackBarRef = this.snackBar.open(
      `${notification.title}: ${notification.message}`,
      notification.retryAction ? notification.actionLabel || 'Retry' : 'Dismiss',
      {
        duration: notification.duration || 8000, // Longer duration for error messages
        panelClass: ['error-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top',
      },
    );

    // Handle retry action
    if (notification.retryAction) {
      snackBarRef.onAction().subscribe(() => {
        notification.retryAction!();
      });
    }
  }

  /**
   * Show a connection error notification with smart spam prevention
   * @param isServerError Whether this is a server connectivity issue vs general network
   * @param retryAction Optional retry function
   */
  showConnectionError(isServerError: boolean = true, retryAction?: () => void): void {
    const now = new Date();

    // Prevent spam - only show if enough time has passed since last connection error
    if (
      this._lastConnectionErrorTime &&
      now.getTime() - this._lastConnectionErrorTime.getTime() < this._connectionErrorCooldown
    ) {
      return;
    }

    const message = isServerError
      ? 'Unable to connect to server. Your changes may not be saved.'
      : 'Network connection lost. Please check your internet connection.';

    this.logger.debugComponent('Notification', 'Showing connection error notification', {
      isServerError,
      message,
    });

    const snackBarRef = this.snackBar.open(message, retryAction ? 'Retry' : 'Dismiss', {
      duration: 10000, // Longer duration for connection errors
      panelClass: ['warning-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });

    // Handle retry action
    if (retryAction) {
      snackBarRef.onAction().subscribe(() => {
        retryAction();
      });
    }

    this._lastConnectionErrorTime = now;
  }

  /**
   * Show connection restored notification
   */
  showConnectionRestored(): void {
    this.logger.debugComponent('Notification', 'Showing connection restored notification');

    this.snackBar.open('Connection restored. Saving pending changes...', 'Dismiss', {
      duration: 4000,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });

    // Reset connection error cooldown
    this._lastConnectionErrorTime = undefined;
  }

  /**
   * Show a generic success notification
   * @param message Success message to display
   * @param duration Duration in milliseconds (default 3000)
   */
  showSuccess(message: string, duration: number = 3000): void {
    this.logger.debugComponent('Notification', 'Showing success notification', { message });

    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['success-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  /**
   * Show a generic warning notification
   * @param message Warning message to display
   * @param duration Duration in milliseconds (default 5000)
   */
  showWarning(message: string, duration: number = 5000): void {
    this.logger.debugComponent('Notification', 'Showing warning notification', { message });

    this.snackBar.open(message, 'Dismiss', {
      duration,
      panelClass: ['warning-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  /**
   * Show a validation error notification for form fields
   * @param fieldName Name of the field with validation error
   * @param errorMessage Validation error message
   */
  showValidationError(fieldName: string, errorMessage: string): void {
    const message = `${fieldName}: ${errorMessage}`;

    this.logger.debugComponent('Notification', 'Showing validation error notification', {
      fieldName,
      errorMessage,
    });

    this.snackBar.open(message, 'Dismiss', {
      duration: 5000,
      panelClass: ['error-snackbar'],
      horizontalPosition: 'right',
      verticalPosition: 'top',
    });
  }

  /**
   * Dismiss all current notifications
   */
  dismissAll(): void {
    this.snackBar.dismiss();
  }

  /**
   * Create save error notification configuration from error object
   * @param error Error object (HttpErrorResponse, Error, or any)
   * @param context What was being saved
   * @param retryAction Optional retry function
   * @returns SaveErrorNotification configuration
   */
  private createSaveErrorNotification(
    error: Error | HttpErrorResponse,
    context: string,
    retryAction?: () => void,
  ): SaveErrorNotification {
    let title = 'Save Failed';
    let message = `Failed to save ${context}`;
    let statusCode: number | undefined;

    if (error instanceof HttpErrorResponse) {
      statusCode = error.status;
      ({ title, message } = this.getHttpErrorDetails(error));
    } else if (error instanceof Error) {
      ({ title, message } = this.getJsErrorDetails(error));
    } else if (typeof error === 'string') {
      message = error;
    }

    return {
      title,
      message,
      statusCode,
      retryAction,
      duration: 8000,
      actionLabel: retryAction ? 'Retry' : undefined,
    };
  }

  /**
   * Map an HTTP error status to a user-facing title and message.
   */
  private getHttpErrorDetails(error: HttpErrorResponse): { title: string; message: string } {
    const STATUS_MAP: Record<number, { title: string; message: string | null }> = {
      400: { title: 'Validation Error', message: 'Please check your input and try again' },
      401: { title: 'Authentication Required', message: 'Please log in again to continue' },
      403: {
        title: 'Permission Denied',
        message: 'You do not have permission to save this item',
      },
      404: {
        title: 'Not Found',
        message: 'The item you are trying to save could not be found',
      },
      409: { title: 'Conflict', message: 'This item was modified by another user' },
      422: { title: 'Validation Error', message: 'The data provided is invalid' },
      500: {
        title: 'Server Error',
        message: 'The server encountered an error while saving',
      },
      502: {
        title: 'Service Unavailable',
        message: 'The server is temporarily unavailable. Please try again later',
      },
      503: {
        title: 'Service Unavailable',
        message: 'The server is temporarily unavailable. Please try again later',
      },
      504: {
        title: 'Service Unavailable',
        message: 'The server is temporarily unavailable. Please try again later',
      },
    };

    const entry = STATUS_MAP[error.status];

    if (entry) {
      // For statuses that may have server-provided details, prefer extracting from the response
      const extractable = [400, 409, 422, 500];
      const message = extractable.includes(error.status)
        ? extractHttpErrorMessage(error) || entry.message!
        : entry.message!;
      return { title: entry.title, message };
    }

    return {
      title: `HTTP ${error.status}`,
      message: extractHttpErrorMessage(error) || `Server returned error ${error.status}`,
    };
  }

  /**
   * Map a JavaScript Error to a user-facing title and message.
   */
  private getJsErrorDetails(error: Error): { title: string; message: string } {
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      return {
        title: 'Network Error',
        message: 'Unable to connect to server. Please check your connection',
      };
    }

    return {
      title: 'Save Failed',
      message: error.message || 'An unexpected error occurred',
    };
  }
}
