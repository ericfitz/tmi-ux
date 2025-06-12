import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoggerService } from '../../../core/services/logger.service';
import { DfdEventBusService, DfdEventType, ErrorEvent } from './dfd-event-bus.service';

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Fatal = 'fatal',
}

/**
 * Error information structure
 */
export interface ErrorInfo {
  message: string;
  details?: string;
  error?: Error;
  severity: ErrorSeverity;
  timestamp: number;
  context?: unknown;
  id: string;
}

/**
 * Service for centralized error handling in DFD components
 */
@Injectable({
  providedIn: 'root',
})
export class DfdErrorService {
  // Current errors
  private _errors = new BehaviorSubject<ErrorInfo[]>([]);

  // Has fatal error flag
  private _hasFatalError = new BehaviorSubject<boolean>(false);

  constructor(
    private logger: LoggerService,
    private eventBus: DfdEventBusService,
  ) {
    // Subscribe to error events from the event bus
    this.eventBus.onEventType<ErrorEvent>(DfdEventType.Error).subscribe(event => {
      this.handleError(event.error, event.message, ErrorSeverity.Error, event.context);
    });
  }

  /**
   * Handle a new error
   * @param error The error object
   * @param message User-friendly error message
   * @param severity Error severity
   * @param context Additional context information
   * @returns The error ID
   */
  handleError(
    error: Error | string,
    message: string,
    severity: ErrorSeverity = ErrorSeverity.Error,
    context?: unknown,
  ): string {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    const timestamp = Date.now();
    const id = `error-${timestamp}-${Math.random().toString(36).substring(2, 9)}`;

    const errorInfo: ErrorInfo = {
      message,
      details: errorObj.message,
      error: errorObj,
      severity,
      timestamp,
      context,
      id,
    };

    // Add to errors list
    const currentErrors = this._errors.getValue();
    this._errors.next([...currentErrors, errorInfo]);

    // Log the error
    switch (severity) {
      case ErrorSeverity.Info:
        this.logger.info(message, { error: errorObj, context });
        break;
      case ErrorSeverity.Warning:
        this.logger.warn(message, { error: errorObj, context });
        break;
      case ErrorSeverity.Error:
        this.logger.error(message, errorObj);
        break;
      case ErrorSeverity.Fatal:
        this.logger.error(`FATAL: ${message}`, errorObj);
        this._hasFatalError.next(true);
        break;
    }

    return id;
  }

  /**
   * Log an informational message
   * @param message The message
   * @param context Optional context
   */
  logInfo(message: string, context?: unknown): string {
    return this.handleError(new Error(message), message, ErrorSeverity.Info, context);
  }

  /**
   * Log a warning
   * @param message The warning message
   * @param context Optional context
   */
  logWarning(message: string, context?: unknown): string {
    return this.handleError(new Error(message), message, ErrorSeverity.Warning, context);
  }

  /**
   * Log an error
   * @param error The error object or message
   * @param message User-friendly error message
   * @param context Optional context
   */
  logError(error: Error | string, message: string, context?: unknown): string {
    return this.handleError(error, message, ErrorSeverity.Error, context);
  }

  /**
   * Log a fatal error
   * @param error The error object or message
   * @param message User-friendly error message
   * @param context Optional context
   */
  logFatal(error: Error | string, message: string, context?: unknown): string {
    return this.handleError(error, message, ErrorSeverity.Fatal, context);
  }

  /**
   * Dismiss an error by ID
   * @param id The error ID to dismiss
   */
  dismissError(id: string): void {
    const currentErrors = this._errors.getValue();
    this._errors.next(currentErrors.filter(e => e.id !== id));
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this._errors.next([]);
    // Only clear non-fatal errors flag
    if (this._hasFatalError.value) {
      const hasFatal = this._errors.getValue().some(e => e.severity === ErrorSeverity.Fatal);
      this._hasFatalError.next(hasFatal);
    }
  }

  /**
   * Get the current errors
   * @returns Observable of errors
   */
  get errors$(): Observable<ErrorInfo[]> {
    return this._errors.asObservable();
  }

  /**
   * Get the current fatal error state
   * @returns Observable of fatal error state
   */
  get hasFatalError$(): Observable<boolean> {
    return this._hasFatalError.asObservable();
  }

  /**
   * Check if there are any errors
   * @returns True if there are errors
   */
  get hasErrors(): boolean {
    return this._errors.getValue().length > 0;
  }

  /**
   * Check if there is a fatal error
   * @returns True if there is a fatal error
   */
  get hasFatalError(): boolean {
    return this._hasFatalError.getValue();
  }
}
