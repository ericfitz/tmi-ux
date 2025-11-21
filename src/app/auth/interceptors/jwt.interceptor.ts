import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError, switchMap } from '../../core/rxjs-imports';

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
    '/oauth2/callback',
    '/oauth2/providers',
    '/oauth2/refresh',
    '/oauth2/authorize/*',
    '/oauth2/token/*',
  ];

  // SessionManager service (will be injected if available)
  private sessionManager: { onTokenRefreshed: () => void } | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private logger: LoggerService,
  ) {
    // this.logger.info('JWT Interceptor initialized');
    // Get SessionManager from AuthService (avoids circular dependency)
    setTimeout(() => {
      this.sessionManager = (
        this.authService as unknown as { sessionManagerService: { onTokenRefreshed: () => void } }
      ).sessionManagerService;
    }, 0);
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

          return next.handle(tokenizedRequest).pipe();
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
              responseHeaders: error.headers?.keys()?.reduce(
                (acc, key) => {
                  const value = error.headers.get(key);
                  if (value) {
                    acc[key] = value;
                  }
                  return acc;
                },
                {} as Record<string, string>,
              ),
              requestHeaders: request.headers?.keys()?.reduce(
                (acc, key) => {
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
                },
                {} as Record<string, string>,
              ),
            });
            return this.handleUnauthorizedErrorWithRefresh(request, next);
          }
          return this.handleError(error, request);
        }),
      );
    }

    // For public endpoints or non-API requests, just pass through with error handling
    return next.handle(request).pipe(
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
      // Handle exact matches and wildcard matches (for paths like /oauth2/authorize/* and /oauth2/token/*)
      if (endpoint.endsWith('/*')) {
        const baseEndpoint = endpoint.slice(0, -2);
        return path.startsWith(baseEndpoint);
      }
      return path === endpoint || path.startsWith(endpoint + '/');
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

        // Notify SessionManager if available (timers will be reset by AuthService.storeToken)
        // No additional action needed here as token storage will trigger session manager

        // Clone the original request with the new token
        const retryRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${newToken.token}`,
          },
        });

        // Retry the original request with new token
        return next.handle(retryRequest).pipe();
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
   * Handle authentication errors (401/403 only)
   * @param error HTTP error response
   * @param request Original request
   * @returns Observable that throws the error
   */
  private handleError(error: HttpErrorResponse, _request: HttpRequest<unknown>): Observable<never> {
    // Only handle auth-related errors in JWT interceptor
    if (error.status === 401) {
      const authError: AuthError = {
        code: 'unauthorized',
        message: 'Authentication required',
        retryable: false,
      };
      this.authService.handleAuthError(authError);
    } else if (error.status === 403) {
      const authError: AuthError = {
        code: 'forbidden',
        message: 'You do not have permission to access this resource',
        retryable: false,
      };
      this.authService.handleAuthError(authError);
    }

    // Return the original error (logging is handled by HttpLoggingInterceptor)
    return throwError(() => error);
  }
}
