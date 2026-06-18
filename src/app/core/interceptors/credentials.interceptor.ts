import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Interceptor to add withCredentials to API requests.
 * Ensures HttpOnly cookies are sent with cross-origin API requests.
 *
 * Only applies to requests targeting the API server (environment.apiUrl),
 * not local asset fetches (config.json, fonts, branding).
 */
@Injectable()
// SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: attach withCredentials flag to API requests so HttpOnly cookies are sent cross-origin
export class CredentialsInterceptor implements HttpInterceptor {
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: attach withCredentials to API requests; forward non-API requests unmodified
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isApiRequest(request.url)) {
      return next.handle(request);
    }

    const credentialedRequest = request.clone({
      withCredentials: true,
    });

    return next.handle(credentialedRequest);
  }

  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: validate that a URL targets the configured API base URL (pure)
  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }
}
