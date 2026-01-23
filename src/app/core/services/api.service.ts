/**
 * API Service
 *
 * This service provides a centralized interface for making HTTP requests to the TMI backend API.
 * It handles error processing, authentication integration, and request logging.
 *
 * Key functionality:
 * - Provides generic HTTP methods (GET, POST, PUT, DELETE) with consistent error handling
 * - Integrates with authentication service for automatic token handling via JWT interceptor
 * - Handles API errors with automatic retry logic and user-friendly error messages
 * - Logs all API requests for debugging and monitoring
 * - Supports query parameters and request body serialization
 * - Provides specialized error handling for authentication failures
 * - Uses environment configuration for base API URL
 * - Handles timeout and network connectivity issues gracefully
 */

import { HttpClient, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, retry, timeout } from 'rxjs/operators';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';

import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_HANDLING } from '../tokens/http-context.tokens';
import {
  ValidationErrorDialogComponent,
  ValidationErrorData,
} from '../components/validation-error-dialog/validation-error-dialog.component';
import { extractHttpErrorDetails } from '@app/shared/utils/http-error.utils';

/**
 * Service for making API requests
 * Uses environment configuration for API URL
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl;
  private readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
  private readonly SAVE_TIMEOUT = 45000; // 45 seconds for save operations

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private router: Router,
    private dialog: MatDialog,
  ) {
    // this.logger.info(`API Service initialized with endpoint: ${this.apiUrl}`);
  }

  /**
   * Build full URL from base API URL and endpoint
   * Normalizes slashes to prevent double-slashes or missing slashes
   * @param endpoint The API endpoint path
   * @returns Full URL with properly normalized slashes
   */
  private buildUrl(endpoint: string): string {
    // Remove trailing slash from apiUrl if present
    const baseUrl = this.apiUrl.endsWith('/') ? this.apiUrl.slice(0, -1) : this.apiUrl;

    // Ensure endpoint starts with a slash
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    return `${baseUrl}${normalizedEndpoint}`;
  }

  /**
   * Generic GET request
   * @param endpoint The API endpoint (without the base URL)
   * @param params Optional query parameters
   */
  get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Observable<T> {
    const url = this.buildUrl(endpoint);

    // Request logging handled by JWT interceptor

    return this.http.get<T>(url, { params }).pipe(
      retry(1),
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'GET', endpoint)),
    );
  }

  /**
   * GET request that returns text response (for non-JSON content types)
   * @param endpoint The API endpoint (without the base URL)
   * @param params Optional query parameters
   */
  getText(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Observable<string> {
    const url = this.buildUrl(endpoint);

    return this.http.get(url, { params, responseType: 'text' }).pipe(
      retry(1),
      catchError((error: HttpErrorResponse) => this.handleError(error, 'GET', endpoint)),
    );
  }

  /**
   * Generic POST request
   * @param endpoint The API endpoint (without the base URL)
   * @param body The request body
   */
  post<T>(endpoint: string, body: Record<string, unknown>): Observable<T> {
    const url = this.buildUrl(endpoint);

    // Request logging handled by JWT interceptor

    return this.http.post<T>(url, body).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'POST', endpoint)),
    );
  }

  /**
   * Generic PUT request
   * @param endpoint The API endpoint (without the base URL)
   * @param body The request body
   * @param context Optional HttpContext for advanced request configuration
   */
  put<T>(endpoint: string, body: Record<string, unknown>, context?: HttpContext): Observable<T> {
    const url = this.buildUrl(endpoint);

    // Request logging handled by JWT interceptor

    return this.http.put<T>(url, body, context ? { context } : {}).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'PUT', endpoint, context)),
    );
  }

  /**
   * Generic DELETE request
   * @param endpoint The API endpoint (without the base URL)
   */
  delete<T>(endpoint: string): Observable<T> {
    const url = this.buildUrl(endpoint);

    // Request logging handled by JWT interceptor

    return this.http.delete<T>(url).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'DELETE', endpoint)),
    );
  }

  /**
   * Generic DELETE request with query parameters
   * @param endpoint The API endpoint (without the base URL)
   * @param params Optional query parameters
   */
  deleteWithParams<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean>,
  ): Observable<T> {
    const url = this.buildUrl(endpoint);

    // Request logging handled by JWT interceptor

    return this.http.delete<T>(url, { params }).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'DELETE', endpoint)),
    );
  }

  /**
   * Generic PATCH request with JSON Patch operations
   * @param endpoint The API endpoint (without the base URL)
   * @param operations Array of JSON Patch operations
   * @param timeoutMs Optional timeout in milliseconds (defaults to SAVE_TIMEOUT for save operations)
   */
  patch<T>(
    endpoint: string,
    operations: Array<{ op: string; path: string; value?: unknown }>,
    timeoutMs?: number,
  ): Observable<T> {
    const url = this.buildUrl(endpoint);
    const requestTimeout = timeoutMs || this.SAVE_TIMEOUT;

    // Request logging handled by JWT interceptor

    return this.http
      .patch<T>(url, operations, {
        headers: { 'Content-Type': 'application/json-patch+json' },
      })
      .pipe(
        timeout(requestTimeout),
        // Response logging handled by JWT interceptor
        catchError((error: HttpErrorResponse | TimeoutError | Error) =>
          this.handleError(error, 'PATCH', endpoint),
        ),
      );
  }

  /**
   * Standardized error handling with logging
   */
  private handleError(
    error: HttpErrorResponse | TimeoutError | Error,
    method: string,
    endpoint: string,
    context?: HttpContext,
  ): Observable<never> {
    let errorMessage = '';

    // Check if error handling should be skipped
    const skipErrorHandling = context?.get(SKIP_ERROR_HANDLING) ?? false;

    if (error instanceof TimeoutError) {
      // Request timeout
      errorMessage = `Request timeout for ${method} ${endpoint}`;
      this.logger.error(errorMessage, error);
    } else if (error instanceof HttpErrorResponse) {
      if (error.error instanceof ErrorEvent) {
        // Client-side error
        errorMessage = `Client Error: ${error.error.message}`;
        this.logger.error(errorMessage);
      } else {
        // Server-side error
        errorMessage = `Server Error: ${error.status} ${error.statusText} for ${method} ${endpoint}`;
        this.logger.error(errorMessage, error);

        // Only handle specific error types if not skipped
        // Note: 401 errors are handled exclusively by JwtInterceptor
        if (!skipErrorHandling) {
          if (error.status === 400) {
            // Handle validation errors
            this.handleValidationError(error);
          } else if (error.status === 403) {
            this.logger.warn('API returned 403 Forbidden. Redirecting to unauthorized page.');
            void this.router.navigate(['/unauthorized'], {
              queryParams: { currentUrl: this.router.url, reason: 'forbidden_api' },
            });
          }
        }

        // Log more details in debug mode
        this.logger.debugComponent('Api', 'Full error response', error);
      }
    } else {
      // Other errors (including generic Error instances)
      errorMessage = `Unexpected error during ${method} ${endpoint}: ${error.message}`;
      this.logger.error(errorMessage, error);
    }

    // Return an observable with the original error for HttpErrorResponse to preserve status codes,
    // or a user-facing error message for other error types
    if (error instanceof HttpErrorResponse) {
      return throwError(() => error);
    } else {
      return throwError(() => new Error(errorMessage));
    }
  }

  /**
   * Handle validation errors by showing a user-friendly dialog
   */
  private handleValidationError(error: HttpErrorResponse): void {
    try {
      const { error: validationError, errorDescription } = extractHttpErrorDetails(error);

      const dialogData: ValidationErrorData = {
        error: validationError || 'Unknown validation error',
        errorDescription: errorDescription || '',
      };

      this.dialog.open(ValidationErrorDialogComponent, {
        width: '500px',
        data: dialogData,
      });

      this.logger.debugComponent('Api', 'Showing validation error dialog', dialogData);
    } catch (parseError) {
      this.logger.error('Failed to parse validation error response', parseError);
    }
  }
}
