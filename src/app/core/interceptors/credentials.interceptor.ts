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
export class CredentialsInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isApiRequest(request.url)) {
      return next.handle(request);
    }

    const credentialedRequest = request.clone({
      withCredentials: true,
    });

    return next.handle(credentialedRequest);
  }

  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }
}
