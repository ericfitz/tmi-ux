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
import { redactSensitiveData } from '../utils/redact-sensitive-data.util';

@Injectable()
export class HttpLoggingInterceptor implements HttpInterceptor {
  constructor(private logger: LoggerService) {}

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
        // Log and categorize errors
        this.logAndCategorizeError(error, request);
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
      headers: redactSensitiveData(headers, { isHeaderContext: true }),
      body: response.body ? redactSensitiveData(response.body) : undefined,
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
}
