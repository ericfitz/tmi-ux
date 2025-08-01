import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError, switchMap, tap } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { AuthError } from '../models/auth.models';

/**
 * Interceptor to add JWT token to API requests
 * Also handles authentication errors
 */
@Injectable()
export class JwtInterceptor implements HttpInterceptor {
  // Public endpoints that don't require authentication
  private readonly publicEndpoints = [
    '/',
    '/version',
    '/auth/login',
    '/auth/callback',
    '/auth/providers',
    '/auth/token',
    '/auth/refresh',
    '/auth/authorize/*',
    '/auth/exchange/*',
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private logger: LoggerService,
  ) {
    this.logger.info('JWT Interceptor initialized');
  }

  /**
   * Intercept HTTP requests to add JWT token and handle auth errors
   * @param request The original request
   * @param next The next handler
   * @returns An observable of the HTTP event
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Only add token to requests to our API that are not public endpoints
    if (this.isApiRequest(request.url) && !this.isPublicEndpoint(request.url)) {
      // Get a valid token (with automatic refresh if needed)
      return this.authService.getValidToken().pipe(
        switchMap(token => {
          // this.logger.debugComponent('api', 'JWT Interceptor adding token to request', {
          //   url: request.url,
          //   method: request.method,
          //   tokenLength: token.token?.length,
          //   tokenPrefix: token.token?.substring(0, 20) + '...',
          //   expiresAt: token.expiresAt.toISOString(),
          // });
          
          const tokenizedRequest = request.clone({
            setHeaders: {
              Authorization: `Bearer ${token.token}`,
            },
          });

          // Log the complete request details with component-specific debug logging
          this.logApiRequest(tokenizedRequest);

          return next.handle(tokenizedRequest).pipe(
            tap(event => {
              if (event instanceof HttpResponse) {
                this.logApiResponse(tokenizedRequest, event);
              }
            }),
          );
        }),
        catchError((error: HttpErrorResponse) => {
          // Log the 401 error details for diagnosis
          if (error.status === 401) {
            this.logger.error('❌ 401 UNAUTHORIZED ERROR ANALYSIS', {
              url: request.url,
              method: request.method,
              status: error.status,
              statusText: error.statusText,
              errorMessage: error.message,
              serverErrorBody: error.error as Record<string, unknown>,
              responseHeaders: error.headers?.keys()?.reduce((acc, key) => {
                const value = error.headers.get(key);
                if (value) {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, string>),
              requestHeaders: request.headers?.keys()?.reduce((acc, key) => {
                const value = request.headers.get(key);
                if (value) {
                  if (key.toLowerCase() === 'authorization') {
                    // Show only the Bearer prefix and token type for debugging
                    acc[key] = value.substring(0, 20) + '...[redacted]';
                  } else {
                    acc[key] = value;
                  }
                }
                return acc;
              }, {} as Record<string, string>),
            });
            return this.handleUnauthorizedErrorWithRefresh(request, next);
          }
          return this.handleError(error, request);
        }),
      );
    }

    // For public endpoints or non-API requests, just pass through with error handling
    // Log public endpoint requests too
    if (this.isApiRequest(request.url)) {
      this.logApiRequest(request);
    }

    return next.handle(request).pipe(
      tap(event => {
        if (event instanceof HttpResponse && this.isApiRequest(request.url)) {
          this.logApiResponse(request, event);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !this.isPublicEndpoint(request.url)) {
          this.handleUnauthorizedError();
        }
        return this.handleError(error, request);
      }),
    );
  }

  /**
   * Check if the request is to our API
   * @param url Request URL
   * @returns True if the request is to our API
   */
  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }

  /**
   * Check if the request is to a public endpoint that doesn't require authentication
   * @param url Request URL
   * @returns True if the request is to a public endpoint
   */
  private isPublicEndpoint(url: string): boolean {
    if (!this.isApiRequest(url)) {
      return false;
    }

    // Extract the path from the API URL
    let path = url.replace(environment.apiUrl, '');

    // If path is empty (root request), treat it as "/"
    if (path === '') {
      path = '/';
    }

    return this.publicEndpoints.some(endpoint => {
      // Handle exact matches and wildcard matches (for paths like /auth/authorize/* and /auth/exchange/*)
      if (endpoint.endsWith('/*')) {
        const baseEndpoint = endpoint.slice(0, -2);
        return path.startsWith(baseEndpoint);
      }
      return path === endpoint || path.startsWith(endpoint + '/');
    });
  }

  /**
   * Log API request details with secret redaction
   * @param request The HTTP request to log
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
      headers: this.redactSecrets(headers),
      body: request.body ? this.redactSecrets(request.body as Record<string, unknown>) : undefined,
      params: this.extractUrlParams(request.url),
    });
  }

  /**
   * Extract URL parameters from a URL string
   * @param url The URL to extract parameters from
   * @returns Object containing URL parameters
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
   * @returns Object with sensitive values redacted
   */
  private redactSecrets(obj: Record<string, unknown>): Record<string, unknown> {
    const redacted = { ...obj };
    const sensitiveKeys = [
      'bearer',
      'token',
      'password',
      'secret',
      'key',
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
   * @param request The original HTTP request
   * @param response The HTTP response
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
      headers: this.redactSecrets(headers),
      body: response.body
        ? this.redactSecrets(response.body as Record<string, unknown>)
        : undefined,
    });
  }

  /**
   * Handle 401 Unauthorized errors with reactive refresh
   * Attempts to refresh the token and retry the original request
   * @param request Original request that failed
   * @param next HTTP handler
   * @returns Observable of the retried request or error
   */
  private handleUnauthorizedErrorWithRefresh(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    this.logger.warn('Received 401 Unauthorized - attempting reactive token refresh');

    // Attempt to refresh the token
    return this.authService.getValidTokenIfAvailable().pipe(
      switchMap(newToken => {
        if (!newToken) {
          // If no token available after refresh attempt, redirect to login
          this.logger.warn('No token available after refresh attempt - redirecting to login');
          this.handleUnauthorizedError();
          return throwError(() => new Error('Token refresh failed - no token available'));
        }

        this.logger.info('Token refresh successful - retrying original request');

        // Clone the original request with the new token
        const retryRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${newToken.token}`,
          },
        });

        // Log the retry attempt
        this.logApiRequest(retryRequest);

        // Retry the original request with new token
        return next.handle(retryRequest).pipe(
          tap(event => {
            if (event instanceof HttpResponse) {
              this.logApiResponse(retryRequest, event);
            }
          }),
        );
      }),
      catchError(refreshError => {
        // Token refresh failed - logout and redirect
        this.logger.error('Token refresh failed during reactive refresh', refreshError);
        this.handleUnauthorizedError();
        return throwError(() => refreshError as Error);
      }),
    );
  }

  /**
   * Handle 401 Unauthorized errors (fallback when refresh fails)
   * Redirects to login page
   */
  private handleUnauthorizedError(): void {
    this.logger.warn('Unauthorized request - redirecting to login');

    // Clear authentication data
    this.authService.logout();

    // Redirect to login page with return URL
    void this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.router.url, reason: 'session_expired' },
    });
  }

  /**
   * Handle HTTP errors
   * @param error HTTP error response
   * @param request Original request
   * @returns Observable that throws the error
   */
  private handleError(error: HttpErrorResponse, request: HttpRequest<unknown>): Observable<never> {
    let errorMessage = '';
    let authError: AuthError | null = null;

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
      authError = {
        code: 'client_error',
        message: error.error.message,
        retryable: true,
      };
    } else {
      // Server-side error
      const status = error.status || 'Unknown';
      const statusText = error.statusText || 'Unknown Error';
      const method = request?.method || 'Unknown';
      const url = request?.url || 'Unknown URL';
      errorMessage = `Server Error: ${status} ${statusText} for ${method} ${url}`;

      // Create auth error based on status code
      switch (error.status) {
        case 401:
          authError = {
            code: 'unauthorized',
            message: 'Authentication required',
            retryable: false,
          };
          break;
        case 403:
          authError = {
            code: 'forbidden',
            message: 'You do not have permission to access this resource',
            retryable: false,
          };
          break;
        default:
          authError = {
            code: 'api_error',
            message: error.message,
            retryable: true,
          };
      }
    }

    // Log the error
    this.logger.error(errorMessage, error);

    // Emit the auth error
    if (authError) {
      this.authService.handleAuthError(authError);
    }

    // Return an observable with a user-facing error message
    return throwError(() => new Error(errorMessage));
  }
}
