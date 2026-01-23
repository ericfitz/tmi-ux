import {
  HttpContext,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError, switchMap } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import { IS_AUTH_RETRY } from '../../core/tokens/http-context.tokens';
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
    '/saml/providers',
  ];

  constructor(
    private authService: AuthService,
    private logger: LoggerService,
  ) {}

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

    // For public endpoints or non-API requests, just pass through
    // Public endpoints shouldn't require auth, so no special 401 handling needed
    return next
      .handle(request)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, request)));
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
   * Handle 401 Unauthorized errors with forced token refresh.
   * Uses IS_AUTH_RETRY context to prevent infinite retry loops.
   * Does NOT automatically logout - errors propagate to components for appropriate handling.
   * @param request Original request that failed
   * @param next HTTP handler
   * @returns Observable of the retried request or error
   */
  private handleUnauthorizedErrorWithRefresh(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    // Check if this request has already been retried (prevents infinite loops)
    const isRetry = request.context.get(IS_AUTH_RETRY);

    if (isRetry) {
      // Already retried once - propagate error without retry or logout
      this.logger.warn('401 on retry request - propagating error without logout', {
        url: request.url,
        method: request.method,
      });

      // Emit auth error for interested subscribers
      const authError: AuthError = {
        code: 'unauthorized_after_refresh',
        message: 'Authentication failed after token refresh',
        retryable: false,
      };
      this.authService.handleAuthError(authError);

      return throwError(
        () =>
          new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            url: request.url ?? undefined,
            error: { message: 'Authentication failed after token refresh' },
          }),
      );
    }

    this.logger.warn('Received 401 Unauthorized - attempting forced token refresh');

    // Force a token refresh (even if current token appears valid by expiry)
    return this.authService.forceRefreshToken().pipe(
      switchMap(newToken => {
        this.logger.info('Forced token refresh successful - retrying original request');

        // Clone the request with new token AND mark as retry to prevent loops
        const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
        const retryRequest = request.clone({
          setHeaders: {
            Authorization: `Bearer ${newToken.token}`,
          },
          context: retryContext,
        });

        return next.handle(retryRequest);
      }),
      catchError((refreshError: unknown) => {
        // Token refresh failed - propagate error WITHOUT logout
        // Let the component/service handle the error appropriately
        this.logger.error('Forced token refresh failed - propagating error', refreshError);

        // Emit auth error for interested subscribers (e.g., showing login prompt)
        const authError: AuthError = {
          code: 'token_refresh_failed',
          message: 'Unable to refresh authentication token',
          retryable: true,
        };
        this.authService.handleAuthError(authError);

        return throwError(() => refreshError);
      }),
    );
  }

  /**
   * Handle authentication errors (401/403).
   * Emits errors for subscribers but does NOT logout or redirect.
   * @param error HTTP error response
   * @param _request Original request
   * @returns Observable that throws the error
   */
  private handleError(error: HttpErrorResponse, _request: HttpRequest<unknown>): Observable<never> {
    // Emit auth errors for interested subscribers, but don't take destructive action
    if (error.status === 401) {
      const authError: AuthError = {
        code: 'unauthorized',
        message: 'Authentication required',
        retryable: true,
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

    // Return the original error - let components handle it
    return throwError(() => error);
  }
}
