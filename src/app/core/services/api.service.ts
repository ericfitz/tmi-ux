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
    this.logger.debug(`GET request to: ${url}`, params);

    return this.http.get<T>(url, { params }).pipe(
      retry(1),
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
    this.logger.debug(`POST request to: ${url}`);

    return this.http
      .post<T>(url, body)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, 'POST', endpoint)));
  }

  /**
   * Generic PUT request
   * @param endpoint The API endpoint (without the base URL)
   * @param body The request body
   */
  put<T>(endpoint: string, body: Record<string, unknown>): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    this.logger.debug(`PUT request to: ${url}`);

    return this.http
      .put<T>(url, body)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, 'PUT', endpoint)));
  }

  /**
   * Generic DELETE request
   * @param endpoint The API endpoint (without the base URL)
   */
  delete<T>(endpoint: string): Observable<T> {
    const url = `${this.apiUrl}/${endpoint}`;
    this.logger.debug(`DELETE request to: ${url}`);

    return this.http
      .delete<T>(url)
      .pipe(catchError((error: HttpErrorResponse) => this.handleError(error, 'DELETE', endpoint)));
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
      this.logger.debug('Full error response', error);
    }

    // Return an observable with a user-facing error message
    return throwError(() => new Error(errorMessage));
  }
}
