import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { HttpErrorResponse } from '@angular/common/http';

import { LoggerService } from '../../core/services/logger.service';

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
  providedIn: 'root'
})
export class NotificationService {
  // Track shown notifications to prevent spam
  private _shownNotifications = new Set<string>();
  private _lastConnectionErrorTime?: Date;
  private _connectionErrorCooldown = 30000; // 30 seconds

  constructor(
    private snackBar: MatSnackBar,
    private logger: LoggerService
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
    retryAction?: () => void
  ): void {
    const notification = this.createSaveErrorNotification(error, context, retryAction);
    
    this.logger.debugComponent('Notification', 'Showing save error notification', {
      context,
      statusCode: notification.statusCode,
      message: notification.message
    });

    // Show snackbar with retry action if provided
    const snackBarRef = this.snackBar.open(
      `${notification.title}: ${notification.message}`,
      notification.retryAction ? (notification.actionLabel || 'Retry') : 'Dismiss',
      {
        duration: notification.duration || 8000, // Longer duration for error messages
        panelClass: ['error-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
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
    if (this._lastConnectionErrorTime && 
        (now.getTime() - this._lastConnectionErrorTime.getTime()) < this._connectionErrorCooldown) {
      return;
    }

    const message = isServerError 
      ? 'Unable to connect to server. Your changes may not be saved.'
      : 'Network connection lost. Please check your internet connection.';

    this.logger.debugComponent('Notification', 'Showing connection error notification', {
      isServerError,
      message
    });

    const snackBarRef = this.snackBar.open(
      message,
      retryAction ? 'Retry' : 'Dismiss',
      {
        duration: 10000, // Longer duration for connection errors
        panelClass: ['warning-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );

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

    this.snackBar.open(
      'Connection restored. Saving pending changes...',
      'Dismiss',
      {
        duration: 4000,
        panelClass: ['success-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );

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

    this.snackBar.open(
      message,
      'Dismiss',
      {
        duration,
        panelClass: ['success-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );
  }

  /**
   * Show a generic warning notification
   * @param message Warning message to display
   * @param duration Duration in milliseconds (default 5000)
   */
  showWarning(message: string, duration: number = 5000): void {
    this.logger.debugComponent('Notification', 'Showing warning notification', { message });

    this.snackBar.open(
      message,
      'Dismiss',
      {
        duration,
        panelClass: ['warning-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );
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
      errorMessage
    });

    this.snackBar.open(
      message,
      'Dismiss',
      {
        duration: 5000,
        panelClass: ['error-snackbar'],
        horizontalPosition: 'right',
        verticalPosition: 'top'
      }
    );
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
    error: any, 
    context: string,
    retryAction?: () => void
  ): SaveErrorNotification {
    let title = 'Save Failed';
    let message = `Failed to save ${context}`;
    let statusCode: number | undefined;

    if (error instanceof HttpErrorResponse) {
      statusCode = error.status;
      
      // Create detailed message based on HTTP status
      switch (error.status) {
        case 400:
          title = 'Validation Error';
          message = this.extractServerErrorMessage(error) || 'Please check your input and try again';
          break;
        case 401:
          title = 'Authentication Required';
          message = 'Please log in again to continue';
          break;
        case 403:
          title = 'Permission Denied';
          message = 'You do not have permission to save this item';
          break;
        case 404:
          title = 'Not Found';
          message = 'The item you are trying to save could not be found';
          break;
        case 409:
          title = 'Conflict';
          message = this.extractServerErrorMessage(error) || 'This item was modified by another user';
          break;
        case 422:
          title = 'Validation Error';
          message = this.extractServerErrorMessage(error) || 'The data provided is invalid';
          break;
        case 500:
          title = 'Server Error';
          message = this.extractServerErrorMessage(error) || 'The server encountered an error while saving';
          break;
        case 502:
        case 503:
        case 504:
          title = 'Service Unavailable';
          message = 'The server is temporarily unavailable. Please try again later';
          break;
        default:
          title = `HTTP ${error.status}`;
          message = this.extractServerErrorMessage(error) || `Server returned error ${error.status}`;
      }
    } else if (error instanceof Error) {
      // Handle JavaScript errors
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        title = 'Network Error';
        message = 'Unable to connect to server. Please check your connection';
      } else {
        message = error.message || 'An unexpected error occurred';
      }
    } else if (typeof error === 'string') {
      message = error;
    }

    return {
      title,
      message,
      statusCode,
      retryAction,
      duration: 8000,
      actionLabel: retryAction ? 'Retry' : undefined
    };
  }

  /**
   * Extract detailed error message from HTTP error response
   * @param error HttpErrorResponse
   * @returns Extracted error message or null
   */
  private extractServerErrorMessage(error: HttpErrorResponse): string | null {
    try {
      const errorBody = error.error;
      
      // Try different common error message formats
      if (typeof errorBody === 'string') {
        return errorBody;
      }
      
      if (errorBody && typeof errorBody === 'object') {
        // Try common error message fields
        return errorBody.message || 
               errorBody.error_description || 
               errorBody.detail || 
               errorBody.error ||
               null;
      }
      
      return null;
    } catch (e) {
      // If we can't parse the error body, return null
      this.logger.debugComponent('Notification', 'Failed to parse error message from server response', e);
      return null;
    }
  }
}