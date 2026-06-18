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
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpResponse,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { LoggerService } from '../services/logger.service';
import { ServerConnectionService } from '../services/server-connection.service';
import { SKIP_ERROR_HANDLING } from '../tokens/http-context.tokens';
import { redactSensitiveData } from '../utils/redact-sensitive-data.util';

@Injectable()
// SEM@345e65cbc4c1f4d9c7d04e2b8e8d52827d0b4ace: log and categorize all HTTP requests, responses, and errors with secret redaction
export class HttpLoggingInterceptor implements HttpInterceptor {
  // SEM@660ec8791a5c29b400be8ffc40e019c7a1c1d240: inject logger and server-connection service dependencies
  constructor(
    private logger: LoggerService,
    private serverConnectionService: ServerConnectionService,
  ) {}

  // SEM@660ec8791a5c29b400be8ffc40e019c7a1c1d240: log HTTP request and response, categorize errors, trigger reactive health check on failures
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Log the outgoing request (if not excluded)
    if (!this.shouldExcludeFromLogging(request)) {
      this.logApiRequest(request);
    }

    return next.handle(request).pipe(
      tap(event => {
        // Log successful responses (if not excluded)
        if (event instanceof HttpResponse && !this.shouldExcludeFromLogging(request)) {
          this.logApiResponse(request, event);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Skip error logging for requests that handle their own errors (e.g. session probes)
        if (!request.context.get(SKIP_ERROR_HANDLING)) {
          this.logAndCategorizeError(error, request);
        }

        // Trigger reactive health check on network errors (status 0) or server errors (5xx),
        // but not for health check requests themselves
        if ((error.status === 0 || error.status >= 500) && !this.isHealthCheckRequest(request)) {
          this.serverConnectionService.triggerReactiveHealthCheck();
        }

        return throwError(() => error);
      }),
    );
  }

  /**
   * Determine if a request should be excluded from logging
   * Excludes GET requests to:
   * - API server root path (health checks)
   * - Local asset files (i18n, etc.)
   */
  // SEM@8d5240acbffdf622dce995270032dc09dd7b3688: filter out GET requests to local assets and API root health-check URLs from logging (pure)
  private shouldExcludeFromLogging(request: HttpRequest<unknown>): boolean {
    // Only exclude GET requests
    if (request.method !== 'GET') {
      return false;
    }

    const url = request.url;

    // Exclude local asset requests (relative URLs starting with /)
    if (url.startsWith('/')) {
      return true;
    }

    // Exclude API server root path (health checks)
    // Match URLs that are exactly the API root without any path
    try {
      const urlObj = new URL(url);
      // Check if the pathname is empty or just '/'
      if (urlObj.pathname === '' || urlObj.pathname === '/') {
        return true;
      }
    } catch {
      // If URL parsing fails, don't exclude (let it be logged)
      return false;
    }

    return false;
  }

  /**
   * Log API request details with secret redaction
   * Only logs when component-specific debug logging is enabled for 'api'
   */
  // SEM@60a3cf007db78b58d220c9c871eb1162924ee121: log outgoing API request headers and body with sensitive data redacted
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
    // Use urlWithParams to include query parameters serialized by HttpClient
    this.logger.debugComponent('api', `${request.method} request to ${request.urlWithParams}:`, {
      url: request.urlWithParams,
      headers: redactSensitiveData(headers, { isHeaderContext: true }),
      body: request.body ? redactSensitiveData(request.body) : undefined,
      params: this.extractUrlParams(request.urlWithParams),
    });
  }

  /**
   * Log API response details with secret redaction
   * Only logs when component-specific debug logging is enabled for 'api'
   */
  // SEM@345e65cbc4c1f4d9c7d04e2b8e8d52827d0b4ace: log API response status, headers, and body with sensitive data redacted
  private logApiResponse(request: HttpRequest<unknown>, response: HttpResponse<unknown>): void {
    // Extract response headers as a plain object
    const headers: Record<string, string> = {};
    response.headers.keys().forEach(key => {
      const value = response.headers.get(key);
      if (value) {
        headers[key] = value;
      }
    });

    // Log the response with component-specific debug logging.
    // Omit large GET response bodies to keep logs readable.
    let body: unknown;
    if (response.body) {
      const serialized = JSON.stringify(response.body);
      body =
        serialized.length > 1024 && request.method === 'GET'
          ? '(omitted, ' + serialized.length + ' chars)'
          : redactSensitiveData(response.body);
    }

    this.logger.debugComponent('api', `${request.method} response from ${request.url}:`, {
      status: response.status,
      statusText: response.statusText,
      headers: redactSensitiveData(headers, { isHeaderContext: true }),
      body,
    });
  }

  /**
   * Log and categorize HTTP errors based on status codes
   */
  // SEM@3b9fe0ea557e93f339708df081074e775f172436: categorize HTTP error by status code and log a structured error message
  private logAndCategorizeError(error: HttpErrorResponse, request: HttpRequest<unknown>): void {
    let errorMessage: string;

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
   * Determine if a request is a health check (API root path).
   * Used to avoid triggering reactive health checks from health check failures.
   */
  // SEM@660ec8791a5c29b400be8ffc40e019c7a1c1d240: validate that a request targets the API root health-check path (pure)
  private isHealthCheckRequest(request: HttpRequest<unknown>): boolean {
    try {
      const urlObj = new URL(request.url);
      return urlObj.pathname === '' || urlObj.pathname === '/';
    } catch {
      return false;
    }
  }

  /**
   * Extract URL parameters from a URL string
   */
  // SEM@7253b0397e7799cbee646b57a44459c9c3a368d3: parse query parameters from a URL string into a key-value map (pure)
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
}
