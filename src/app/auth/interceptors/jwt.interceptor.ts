import {
  HttpContext,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Observable, catchError, throwError, switchMap } from '../../core/rxjs-imports';

import { LoggerService } from '../../core/services/logger.service';
import {
  IS_AUTH_RETRY,
  IS_LOGOUT_REQUEST,
  IS_STEPUP_RETRY,
  SKIP_ERROR_HANDLING,
} from '../../core/tokens/http-context.tokens';
import { AuthService } from '../services/auth.service';
import { StepUpService } from '../services/step-up.service';
import { isStepUpChallenge } from '../utils/step-up.utils';
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
// SEM@a0359eb0b6e1fd48cf64d58f74313645e64a3e46: handle auth errors on API requests; refresh session cookie and retry on 401 (mutates shared state)
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

  private _authService: AuthService | null = null;
  private _stepUpService: StepUpService | null = null;

  // SEM@34d18ba2c1f88c2e9b650c912322cbc42588d59c: initialize interceptor with lazy-resolved DI injector and logger (mutates shared state)
  constructor(
    private injector: Injector,
    private logger: LoggerService,
  ) {}

  /** Lazily resolve AuthService to break the circular dependency:
   *  HTTP_INTERCEPTORS → JwtInterceptor → AuthService → HttpClient → HTTP_INTERCEPTORS */
  private get authService(): AuthService {
    if (!this._authService) {
      this._authService = this.injector.get(AuthService);
    }
    return this._authService;
  }

  /** Lazily resolve StepUpService to avoid the same DI cycle as AuthService. */
  private get stepUpService(): StepUpService {
    if (!this._stepUpService) {
      this._stepUpService = this.injector.get(StepUpService);
    }
    return this._stepUpService;
  }

  /**
   * Intercept HTTP requests to handle auth errors.
   * No token is attached — cookies are sent automatically by the browser.
   */
  // SEM@a0359eb0b6e1fd48cf64d58f74313645e64a3e46: intercept API requests and handle 401 errors with step-up or token refresh (mutates shared state)
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Logout requests and session probes manage their own error handling.
    // Skip interceptor to prevent retry loops.
    if (request.context.get(IS_LOGOUT_REQUEST) || request.context.get(SKIP_ERROR_HANDLING)) {
      return next.handle(request);
    }

    // For authenticated API endpoints, handle 401 errors with refresh/retry
    if (this.isApiRequest(request.url) && !this.isPublicEndpoint(request.url)) {
      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401) {
            if (isStepUpChallenge(error)) {
              return this.handleStepUpChallenge(request, next, error);
            }
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

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: validate whether a URL targets the configured API base (pure)
  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }

  // SEM@a068b149611f54ba065b375e8dcbfceef992cb9a: validate whether an API URL matches a public unauthenticated endpoint (pure)
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
   * Handle a step-up challenge (401 + insufficient_user_authentication).
   * Token refresh cannot satisfy a freshness challenge, so this branches
   * before the refresh path. Weak providers complete in-flight and the
   * original request is retried once; strong providers redirect (the page
   * unloads) or the user cancels — either way the original error propagates.
   */
  // SEM@a0359eb0b6e1fd48cf64d58f74313645e64a3e46: handle step-up authentication challenge by escalating auth and retrying request (mutates shared state)
  private handleStepUpChallenge(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    originalError: HttpErrorResponse,
  ): Observable<HttpEvent<unknown>> {
    if (request.context.get(IS_STEPUP_RETRY)) {
      this.logger.warn('Step-up challenge on retried request - not retrying again', {
        url: request.url,
      });
      return throwError(() => originalError);
    }
    const providerId = this.authService.userProfile?.provider ?? '';
    this.logger.info('Step-up challenge received - initiating step-up', {
      url: request.url,
      provider: providerId,
    });
    return this.stepUpService.beginStepUp(providerId).pipe(
      switchMap(outcome => {
        if (outcome === 'weak_complete') {
          // Retry the original request once, marked to prevent loops.
          // Use a fresh HttpContext (matching the IS_AUTH_RETRY retry pattern)
          // — SKIP_ERROR_HANDLING requests never reach here because intercept()
          // short-circuits them at the top.
          const retryRequest = request.clone({
            context: new HttpContext().set(IS_STEPUP_RETRY, true),
          });
          return next.handle(retryRequest);
        }
        // 'redirecting': page is unloading; 'cancelled': user dismissed dialog.
        // Either way, propagate the original challenge error.
        return throwError(() => originalError);
      }),
    );
  }

  /**
   * Handle 401 errors with cookie-based token refresh.
   * Uses IS_AUTH_RETRY context to prevent infinite retry loops.
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: refresh session cookie on 401 and retry request; logout on repeated failure (mutates shared state)
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

  // SEM@04ef43aefdebc79041ccc78bc009f0d0d130c110: dispatch auth error notification for 401/403 responses and rethrow (mutates shared state)
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
