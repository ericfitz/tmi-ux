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

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, retry } from 'rxjs/operators';
import { Router } from '@angular/router';

import { LoggerService } from './logger.service';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/services/auth.service';

/**
 * Service for making API requests
 * Uses environment configuration for API URL
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private logger: LoggerService,
    private router: Router,
    private authService: AuthService,
  ) {
    this.logger.info(`API Service initialized with endpoint: ${this.apiUrl}`);
  }

  /**
   * Generic GET request
   * @param endpoint The API endpoint (without the base URL)
   * @param params Optional query parameters
   */
  get<T>(endpoint: string, params?: Record<string, string | number | boolean>): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;

    // Request logging handled by JWT interceptor

    return this.http.get<T>(url, { params }).pipe(
      retry(1),
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'GET', endpoint)),
    );
  }

  /**
   * Generic POST request
   * @param endpoint The API endpoint (without the base URL)
   * @param body The request body
   */
  post<T>(endpoint: string, body: Record<string, unknown>): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;

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
   */
  put<T>(endpoint: string, body: Record<string, unknown>): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;

    // Request logging handled by JWT interceptor

    return this.http.put<T>(url, body).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'PUT', endpoint)),
    );
  }

  /**
   * Generic DELETE request
   * @param endpoint The API endpoint (without the base URL)
   */
  delete<T>(endpoint: string): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;

    // Request logging handled by JWT interceptor

    return this.http.delete<T>(url).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'DELETE', endpoint)),
    );
  }

  /**
   * Generic PATCH request with JSON Patch operations
   * @param endpoint The API endpoint (without the base URL)
   * @param operations Array of JSON Patch operations
   */
  patch<T>(
    endpoint: string,
    operations: Array<{ op: string; path: string; value?: unknown }>,
  ): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;

    // Request logging handled by JWT interceptor

    return this.http.patch<T>(url, operations).pipe(
      // Response logging handled by JWT interceptor
      catchError((error: HttpErrorResponse) => this.handleError(error, 'PATCH', endpoint)),
    );
  }

  /**
   * Log API request details with secret redaction
   * @param method HTTP method
   * @param url Full URL
   * @param body Request body (optional)
   * @param params Query parameters (optional)
   */
  private logApiRequest(
    method: string,
    url: string,
    body?: Record<string, unknown>,
    params?: Record<string, string | number | boolean>,
  ): void {
    // Get headers from the HTTP request (simulated - actual headers are added by interceptor)
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      // Note: Authorization header will be added by JWT interceptor
    };

    // Log the request with component-specific debug logging
    this.logger.debugComponent('api', `${method} request details:`, {
      url,
      headers: this.redactSecrets(headers),
      body: body ? this.redactSecrets(body) : undefined,
      params: params ? this.redactSecrets(params) : undefined,
    });
  }

  /**
   * Redact sensitive information from objects
   * @param obj Object that may contain sensitive data
   * @returns Object with sensitive values redacted
   */
  private redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...obj };
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
    ];

    for (const [key, value] of Object.entries(redacted)) {
      const lowerKey = key.toLowerCase();
      const isAuthorizationHeader = key.toLowerCase() === 'authorization';

      // Handle Authorization header specially (always redact)
      if (isAuthorizationHeader) {
        if (typeof value === 'string' && value.length > 0) {
          if (value.startsWith('Bearer ')) {
            // Special handling for Bearer tokens - show prefix but redact token
            const tokenPart = value.substring(7); // Remove 'Bearer '
            redacted[key] = `Bearer ${this.redactToken(tokenPart)}`;
          } else {
            // Redact other Authorization header values
            redacted[key] = this.redactToken(value);
          }
        } else {
          redacted[key] = '[REDACTED]';
        }
      }
      // Check if the key contains other sensitive information (but not "authorization" in general)
      else if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        if (typeof value === 'string' && value.length > 0) {
          redacted[key] = this.redactToken(value);
        } else {
          redacted[key] = '[REDACTED]';
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively redact nested objects
        redacted[key] = this.redactSecrets(value as Record<string, unknown>);
      }
    }

    return redacted;
  }

  /**
   * Redact a token while showing first and last few characters for debugging
   * @param token The token to redact
   * @returns Redacted token string
   */
  private redactToken(token: string): string {
    if (token.length <= 8) {
      return '[REDACTED]';
    }
    const start = token.substring(0, 4);
    const end = token.substring(token.length - 4);
    const middle = '*'.repeat(Math.min(12, token.length - 8));
    return `${start}${middle}${end}`;
  }

  /**
   * Log API response details with secret redaction
   * @param method HTTP method
   * @param url Full URL
   * @param response Response body
   */
  private logApiResponse(method: string, url: string, response: unknown): void {
    // Log the response with component-specific debug logging
    this.logger.debugComponent('api', `${method} response from ${url}:`, {
      body: response ? this.redactSecrets(response as Record<string, unknown>) : undefined,
      // Note: Response headers are not easily accessible from the API service level
      // They will be logged by the JWT interceptor
    });
  }

  /**
   * Standardized error handling with logging
   */
  private handleError(
    error: HttpErrorResponse,
    method: string,
    endpoint: string,
  ): Observable<never> {
    let errorMessage = '';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
      this.logger.error(errorMessage);
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} ${error.statusText} for ${method} ${endpoint}`;
      this.logger.error(errorMessage, error);

      // Handle authorization errors
      if (error.status === 401) {
        this.logger.warn('API returned 401 Unauthorized. Redirecting to login.');
        this.authService.logout(); // Clear session
        void this.router.navigate(['/login'], {
          queryParams: { returnUrl: this.router.url, reason: 'unauthorized_api' },
        });
      } else if (error.status === 403) {
        this.logger.warn('API returned 403 Forbidden. Redirecting to unauthorized page.');
        void this.router.navigate(['/unauthorized'], {
          queryParams: { currentUrl: this.router.url, reason: 'forbidden_api' },
        });
      }

      // Log more details in debug mode
      this.logger.debugComponent('Api', 'Full error response', error);
    }

    // Return an observable with a user-facing error message
    return throwError(() => new Error(errorMessage));
  }
}
