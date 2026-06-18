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
// SEM@abb490dd254fcc4ddc6278f47ecad2d865aa4068: add no-store Cache-Control headers to API requests to prevent sensitive-data caching
export class CacheControlInterceptor implements HttpInterceptor {
  // SEM@abb490dd254fcc4ddc6278f47ecad2d865aa4068: attach no-cache headers to API requests; pass non-API requests unmodified
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

  // SEM@abb490dd254fcc4ddc6278f47ecad2d865aa4068: validate that a URL targets the configured API base URL (pure)
  private isApiRequest(url: string): boolean {
    return url.startsWith(environment.apiUrl);
  }
}
