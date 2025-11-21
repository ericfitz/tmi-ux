import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { LoggerService } from '../services/logger.service';
import { SecurityConfigService, SecurityHeaders } from '../services/security-config.service';

export const securityHeadersInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const securityConfig = inject(SecurityConfigService);

  // Only check headers in development mode
  if (environment.production) {
    return next(req);
  }

  return next(req).pipe(
    tap(event => {
      if (event instanceof HttpResponse) {
        // Check for security headers in the response
        const headers = event.headers;
        const missingHeaders: string[] = [];
        const recommendationsObservable = securityConfig.recommendedHeaders$;
        const recommendations = recommendationsObservable.value as SecurityHeaders;

        // Check for recommended security headers
        Object.keys(recommendations).forEach(headerName => {
          if (!headers.has(headerName)) {
            missingHeaders.push(headerName);
          }
        });

        // Special check for CSP header (might be set via meta tag)
        if (!headers.has('Content-Security-Policy')) {
          const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
          if (!cspMeta) {
            missingHeaders.push('Content-Security-Policy (neither header nor meta tag)');
          }
        }

        // Log warnings about missing headers
        if (missingHeaders.length > 0 && req.url.startsWith(environment.apiUrl)) {
          logger.debugComponent(
            'SecurityHeadersInterceptor',
            'Missing security headers in API response',
            {
              url: req.url,
              missingHeaders,
              hint: 'See docs/SECURITY_HEADERS.md for configuration guidance',
            },
          );
        }

        // Check for problematic header values
        const warnings: string[] = [];

        // Check X-Frame-Options
        const xFrameOptions = headers.get('X-Frame-Options');
        if (xFrameOptions && xFrameOptions.toUpperCase() === 'ALLOWALL') {
          warnings.push('X-Frame-Options is set to ALLOWALL (insecure)');
        }

        // Check for Server header disclosure
        const serverHeader = headers.get('Server');
        if (serverHeader && serverHeader.length > 20) {
          warnings.push('Server header may be disclosing too much information');
        }

        // Check for missing HSTS on HTTPS
        if (req.url.startsWith('https://') && !headers.has('Strict-Transport-Security')) {
          warnings.push('HSTS header missing on HTTPS response');
        }

        if (warnings.length > 0) {
          logger.warn('Security header warnings', {
            url: req.url,
            warnings,
          });
        }
      }
    }),
  );
};

export const provideSecurityHeadersInterceptor = (): HttpInterceptorFn | null => {
  // This is a development-only interceptor
  if (!environment.production) {
    return securityHeadersInterceptor;
  }
  return null;
};
