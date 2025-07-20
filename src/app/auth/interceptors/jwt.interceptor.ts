import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from '../../core/rxjs-imports';

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
    // Only add token to requests to our API
    if (this.isApiRequest(request.url)) {
      request = this.addTokenToRequest(request);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
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
   * Add JWT token to request headers
   * @param request Original request
   * @returns Cloned request with Authorization header
   */
  private addTokenToRequest(request: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.authService.getStoredToken();

    if (token) {
      this.logger.debug('Adding JWT token to request');
      return request.clone({
        setHeaders: {
          Authorization: `Bearer ${token.token}`,
        },
      });
    }

    return request;
  }

  /**
   * Handle 401 Unauthorized errors
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
      errorMessage = `Server Error: ${error.status} ${error.statusText} for ${request.method} ${request.url}`;

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
