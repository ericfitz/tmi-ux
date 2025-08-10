/**
 * HTTP Logging Interceptor
 *
 * Centralized HTTP request/response logging and error categorization for the entire application.
 * This interceptor provides:
 * - Comprehensive request/response logging with secret redaction
 * - Error categorization by HTTP status codes
 * - Consistent debug logging for all HTTP interactions
 * - Performance-conscious logging (only when debug logging is enabled)
 *
 * Error Categories:
 * - 401/403 errors → "Auth error"
 * - 400/422 errors → "Validation error"
 * - 404 errors → "Not found error"
 * - 500+ errors → "Server error"
 * - Other errors → "API error"
 */

import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { LoggerService } from '../services/logger.service';

@Injectable()
export class HttpLoggingInterceptor implements HttpInterceptor {
  constructor(private logger: LoggerService) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Log the outgoing request
    this.logApiRequest(request);

    return next.handle(request).pipe(
      tap(event => {
        // Log successful responses
        if (event instanceof HttpResponse) {
          this.logApiResponse(request, event);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Log and categorize errors
        this.logAndCategorizeError(error, request);
        return throwError(() => error);
      })
    );
  }

  /**
   * Log API request details with secret redaction
   * Only logs when component-specific debug logging is enabled for 'api'
   */
  private logApiRequest(request: HttpRequest<unknown>): void {
    // Extract headers as a plain object
    const headers: Record<string, string> = {};
    request.headers.keys().forEach(key => {
      const value = request.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    });

    // Log the request with component-specific debug logging
    this.logger.debugComponent('api', `${request.method} request details:`, {
      url: request.url,
      headers: this.redactSecrets(headers, true),
      body: request.body ? this.redactSecrets(request.body as Record<string, unknown>, false) : undefined,
      params: this.extractUrlParams(request.url),
    });
  }

  /**
   * Log API response details with secret redaction
   * Only logs when component-specific debug logging is enabled for 'api'
   */
  private logApiResponse(request: HttpRequest<unknown>, response: HttpResponse<unknown>): void {
    // Extract response headers as a plain object
    const headers: Record<string, string> = {};
    response.headers.keys().forEach(key => {
      const value = response.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    });

    // Log the response with component-specific debug logging
    this.logger.debugComponent('api', `${request.method} response from ${request.url}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: this.redactSecrets(headers, true),
      body: response.body
        ? this.redactSecrets(response.body as Record<string, unknown>, false)
        : undefined,
    });
  }

  /**
   * Log and categorize HTTP errors based on status codes
   */
  private logAndCategorizeError(error: HttpErrorResponse, request: HttpRequest<unknown>): void {
    let errorMessage = '';

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error - categorize by status code
      const status = error.status || 'Unknown';
      const statusText = error.statusText || 'Unknown Error';
      const method = request?.method || 'Unknown';
      const url = request?.url || 'Unknown URL';

      switch (error.status) {
        case 401:
        case 403:
          errorMessage = `Auth error: ${status} ${statusText} for ${method} ${url}`;
          break;
        case 400:
        case 422:
          errorMessage = `Validation error: ${status} ${statusText} for ${method} ${url}`;
          break;
        case 404:
          errorMessage = `Not found error: ${status} ${statusText} for ${method} ${url}`;
          break;
        default:
          if (error.status >= 500) {
            errorMessage = `Server error: ${status} ${statusText} for ${method} ${url}`;
          } else {
            errorMessage = `API error: ${status} ${statusText} for ${method} ${url}`;
          }
          break;
      }
    }

    // Log the categorized error
    this.logger.error(errorMessage, error);
  }

  /**
   * Extract URL parameters from a URL string
   */
  private extractUrlParams(url: string): Record<string, string> | undefined {
    try {
      const urlObj = new URL(url);
      const params: Record<string, string> = {};
      urlObj.searchParams.forEach((value, key) => {
        params[key] = value;
      });
      return Object.keys(params).length > 0 ? params : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Redact sensitive information from objects
   * @param obj Object that may contain sensitive data
   * @param isHeaderContext Whether this is being called for headers (affects Authorization handling)
   * @returns Object with sensitive values redacted
   */
  private redactSecrets(obj: Record<string, unknown>, isHeaderContext = false): Record<string, unknown> {
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
      const isAuthorizationField = lowerKey === 'authorization';

      // Handle Authorization field - only redact in header context
      if (isAuthorizationField && isHeaderContext) {
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
        redacted[key] = this.redactSecrets(value as Record<string, unknown>, isHeaderContext);
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
}