import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Interceptor to add Cache-Control headers to API requests.
 * Prevents browsers and proxies from caching responses that may contain
 * sensitive authentication data or user-specific content.
 *
 * Addresses AUTH-VULN-006: Missing Cache-Control Headers
 */
@Injectable()
export class CacheControlInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isApiRequest(request.url)) {
      return next.handle(request);
    }

    const noCacheRequest = request.clone({
      setHeaders: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        Pragma: 'no-cache',
      },
    });

    return next.handle(noCacheRequest);
  }

  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }
}
