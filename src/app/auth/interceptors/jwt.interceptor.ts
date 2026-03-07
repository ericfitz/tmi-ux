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
import { IS_AUTH_RETRY, IS_LOGOUT_REQUEST } from '../../core/tokens/http-context.tokens';
import { AuthService } from '../services/auth.service';
import { environment } from '../../../environments/environment';
import { AuthError } from '../models/auth.models';

/**
 * Interceptor to handle authentication errors on API requests.
 * With HttpOnly cookie auth, no Authorization header is injected —
 * the browser sends cookies automatically via withCredentials.
 * This interceptor handles 401 errors by triggering a cookie-based
 * token refresh and retrying the original request.
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
   * Intercept HTTP requests to handle auth errors.
   * No token is attached — cookies are sent automatically by the browser.
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Logout requests manage their own error handling.
    // Skip interceptor to prevent 401 retry loops during logout.
    if (request.context.get(IS_LOGOUT_REQUEST)) {
      return next.handle(request);
    }

    // For authenticated API endpoints, handle 401 errors with refresh/retry
    if (this.isApiRequest(request.url) && !this.isPublicEndpoint(request.url)) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.logger.error('401 UNAUTHORIZED on API request', {
              url: request.url,
              method: request.method,
              status: error.status,
              statusText: error.statusText,
              errorMessage: error.message,
              serverErrorBody: error.error as Record<string, unknown>,
            });
            return this.handleUnauthorizedErrorWithRefresh(request, next);
          }
          return this.handleError(error, request);
        }),
      );
    }

    // For public endpoints or non-API requests, just pass through
    return next
      .handle(request)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, request)));
  }

  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }

  private isPublicEndpoint(url: string): boolean {
    if (!this.isApiRequest(url)) {
      return false;
    }

    let path = url.replace(environment.apiUrl, '');
    if (path === '') {
      path = '/';
    }

    return this.publicEndpoints.some(endpoint => {
      if (endpoint.endsWith('/*')) {
        const baseEndpoint = endpoint.slice(0, -2);
        return path.startsWith(baseEndpoint);
      }
      return path === endpoint || path.startsWith(endpoint + '/');
    });
  }

  /**
   * Handle 401 errors with cookie-based token refresh.
   * Uses IS_AUTH_RETRY context to prevent infinite retry loops.
   */
  private handleUnauthorizedErrorWithRefresh(
    request: HttpRequest<unknown>,
    next: HttpHandler,
  ): Observable<HttpEvent<unknown>> {
    const isRetry = request.context.get(IS_AUTH_RETRY);

    if (isRetry) {
      this.logger.warn('401 on retry request - triggering logout', {
        url: request.url,
        method: request.method,
      });

      const authError: AuthError = {
        code: 'unauthorized_after_refresh',
        message: 'Authentication failed after token refresh',
        retryable: false,
      };
      this.authService.handleAuthError(authError);
      this.authService.logout();

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

    this.logger.warn('Received 401 Unauthorized - attempting cookie-based token refresh');

    return this.authService.forceRefreshToken().pipe(
      switchMap(() => {
        this.logger.info('Token refresh successful - retrying original request');

        // Retry the original request with IS_AUTH_RETRY set to prevent loops.
        // No need to clone headers — the browser sends the refreshed cookie automatically.
        const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
        const retryRequest = request.clone({
          context: retryContext,
        });

        return next.handle(retryRequest);
      }),
      catchError((refreshError: unknown) => {
        this.logger.error('Token refresh failed - triggering logout', refreshError);

        const authError: AuthError = {
          code: 'token_refresh_failed',
          message: 'Unable to refresh authentication token',
          retryable: false,
        };
        this.authService.handleAuthError(authError);
        this.authService.logout();

        return throwError(() => refreshError);
      }),
    );
  }

  private handleError(error: HttpErrorResponse, _request: HttpRequest<unknown>): Observable<never> {
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

    return throwError(() => error);
  }
}
