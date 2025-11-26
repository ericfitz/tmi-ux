import { Injectable, Inject, DOCUMENT } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Environment } from '../../../environments/environment.interface';
import { LoggerService } from './logger.service';

export interface SecurityHeaders {
  'Content-Security-Policy'?: string;
  'X-Frame-Options'?: string;
  'X-Content-Type-Options'?: string;
  'X-XSS-Protection'?: string;
  'Referrer-Policy'?: string;
  'Permissions-Policy'?: string;
  'Strict-Transport-Security'?: string;
}

export interface SecurityConfig {
  enableHSTS: boolean;
  hstsMaxAge: number;
  hstsIncludeSubDomains: boolean;
  hstsPreload: boolean;
  cspReportUri?: string;
  frameOptions: 'DENY' | 'SAMEORIGIN';
  referrerPolicy: string;
  permissionsPolicy: string;
}

@Injectable({
  providedIn: 'root',
})
export class SecurityConfigService {
  private readonly defaultConfig: SecurityConfig = {
    enableHSTS: true,
    hstsMaxAge: 31536000, // 1 year
    hstsIncludeSubDomains: true,
    hstsPreload: false,
    frameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
  };

  private _isSecureContext$ = new BehaviorSubject<boolean>(false);
  private _recommendedHeaders$ = new BehaviorSubject<SecurityHeaders>({});

  public readonly isSecureContext$: Observable<boolean> = this._isSecureContext$.asObservable();
  public readonly recommendedHeaders$: Observable<SecurityHeaders> =
    this._recommendedHeaders$.asObservable();

  constructor(
    private logger: LoggerService,
    @Inject(DOCUMENT) private document: Document,
  ) {
    this.detectSecurityContext();
    this.generateRecommendedHeaders();
    this.injectDynamicCSP();
  }

  private detectSecurityContext(): void {
    const isSecure = window.isSecureContext;
    // const protocol = window.location.protocol;
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    this._isSecureContext$.next(isSecure);

    // this.logger.debugComponent('SecurityConfigService', 'Security context detected', {
    //   isSecure,
    //   protocol: window.location.protocol,
    //   isLocalhost,
    //   hostname: window.location.hostname,
    // });

    if (!isSecure && !isLocalhost) {
      this.logger.warn('Application is not running in a secure context', {
        message: 'Some features may be limited.',
      });
    }
  }

  private generateRecommendedHeaders(): void {
    const config = this.getSecurityConfig();
    const headers: SecurityHeaders = {
      'X-Frame-Options': config.frameOptions,
      'X-Content-Type-Options': 'nosniff',
      'X-XSS-Protection': '0', // Disabled per modern security guidance
      'Referrer-Policy': config.referrerPolicy,
      'Permissions-Policy': config.permissionsPolicy,
    };

    // Only recommend HSTS for secure contexts
    if (this._isSecureContext$.value && config.enableHSTS) {
      let hstsValue = `max-age=${config.hstsMaxAge}`;
      if (config.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (config.hstsPreload) {
        hstsValue += '; preload';
      }
      headers['Strict-Transport-Security'] = hstsValue;
    }

    this._recommendedHeaders$.next(headers);
  }

  public getSecurityConfig(): SecurityConfig {
    // Allow environment-based overrides
    const env = environment as Environment & { securityConfig?: Partial<SecurityConfig> };
    const envConfig = env.securityConfig || {};
    return {
      ...this.defaultConfig,
      ...envConfig,
    };
  }

  public getDeploymentRecommendations(scenario: 'standalone' | 'proxy' | 'loadbalancer'): string {
    const headers = this._recommendedHeaders$.value;
    let recommendations = '';

    switch (scenario) {
      case 'standalone':
        recommendations = `
For standalone deployment, security is primarily enforced through:
1. Content Security Policy (CSP) meta tag in index.html
2. Same-origin policy enforced by browsers
3. CORS configuration in your API server

No additional server configuration needed for the frontend.
        `;
        break;

      case 'proxy':
        recommendations = `
For deployment behind a proxy (e.g., nginx), add these headers:

# nginx configuration
${Object.entries(headers)
  .map(([key, value]) => `add_header ${key} "${value}" always;`)
  .join('\n')}

# Conditional HSTS (only with SSL)
map $https $hsts_header {
    "on" "${headers['Strict-Transport-Security'] || 'max-age=31536000; includeSubDomains'}";
}
add_header Strict-Transport-Security $hsts_header always;
        `;
        break;

      case 'loadbalancer':
        recommendations = `
For deployment behind a load balancer:

1. Configure these headers at the load balancer level:
${Object.entries(headers)
  .map(([key, value]) => `   ${key}: ${value}`)
  .join('\n')}

2. Enable HSTS only if TLS termination occurs at the load balancer
3. Use X-Forwarded-Proto to detect HTTPS at application level
4. Ensure WebSocket upgrade headers are properly forwarded
        `;
        break;
    }

    return recommendations;
  }

  public validateCurrentHeaders(): { missing: string[]; warnings: string[] } {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check if CSP is present (it should be via meta tag)
    const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!cspMeta) {
      missing.push('Content-Security-Policy');
      warnings.push('CSP meta tag is missing from index.html');
    }

    // In a real implementation, we would check response headers here
    // For now, we'll provide guidance
    if (!this._isSecureContext$.value) {
      warnings.push('Running in insecure context - HSTS and other security features may not work');
    }

    return { missing, warnings };
  }

  public getCspViolationHandler(): (event: SecurityPolicyViolationEvent) => void {
    return (event: SecurityPolicyViolationEvent) => {
      this.logger.warn('CSP Violation detected', {
        blockedUri: event.blockedURI,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
        sourceFile: event.sourceFile,
        lineNumber: event.lineNumber,
        columnNumber: event.columnNumber,
      });

      // In production, you might want to send this to a reporting endpoint
      if (environment.production && this.getSecurityConfig().cspReportUri) {
        // Send violation report to configured endpoint
        // This is just a placeholder - implement based on your reporting needs
      }
    };
  }

  public monitorSecurityViolations(): void {
    // Listen for CSP violations
    window.addEventListener('securitypolicyviolation', this.getCspViolationHandler());

    // Log initial security status
    const validation = this.validateCurrentHeaders();
    if (validation.warnings.length > 0) {
      this.logger.warn('Security configuration warnings detected', {
        validation,
      });
    }
  }

  private injectDynamicCSP(): void {
    // Extract API URL components
    const apiUrl = new URL(environment.apiUrl);
    const apiOrigin = apiUrl.origin;
    const apiProtocol = apiUrl.protocol;

    // Build connect-src directive with API URL
    const connectSources = [
      "'self'",
      apiOrigin,
      // WebSocket protocols
      'wss:',
      'ws:',
      // Allow https for OAuth callbacks and other API calls
      'https:',
    ];

    // If API is on HTTP, we need to allow it specifically
    if (apiProtocol === 'http:') {
      connectSources.push('http:');
    }

    // Build img-src directive - allow HTTP images if API is on HTTP
    const imgSources = ["'self'", 'data:', 'https:', 'blob:'];
    if (apiProtocol === 'http:') {
      imgSources.push('http:');
    }

    // Build complete CSP policy
    // Note: frame-ancestors, report-uri, and sandbox directives are ignored in meta tags
    // and must be set via HTTP headers at the server level
    const cspDirectives = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
      `font-src 'self' https://fonts.gstatic.com data:`,
      `img-src ${imgSources.join(' ')}`,
      `connect-src ${connectSources.join(' ')}`,
      // frame-ancestors removed - only works in HTTP headers
      `base-uri 'self'`,
      `form-action 'self'`,
      `object-src 'none'`,
      `media-src 'self'`,
      `worker-src 'self' blob:`,
      `manifest-src 'self'`,
    ];

    // Add upgrade-insecure-requests only in production or when using HTTPS
    if (environment.production || window.location.protocol === 'https:') {
      cspDirectives.push('upgrade-insecure-requests');
    }

    // Note: report-uri directive is also ignored in meta tags
    // CSP reporting must be configured at the server level

    const cspContent = cspDirectives.join('; ');

    // Create and inject CSP meta tag
    const cspMeta = this.document.createElement('meta');
    cspMeta.httpEquiv = 'Content-Security-Policy';
    cspMeta.content = cspContent;

    // Insert after charset meta tag to ensure it's early in the document
    const charsetMeta = this.document.querySelector('meta[charset]');
    if (charsetMeta && charsetMeta.parentNode) {
      charsetMeta.parentNode.insertBefore(cspMeta, charsetMeta.nextSibling);
    } else {
      // Fallback: append to head
      this.document.head.appendChild(cspMeta);
    }

    // this.logger.debugComponent(
    //   'SecurityConfigService',
    //   'Dynamic CSP injected (note: frame-ancestors ignored in meta tags)',
    //   {
    //     apiOrigin,
    //     cspContent,
    //     limitationsNote:
    //       'For clickjacking protection, configure X-Frame-Options header at server level',
    //   },
    // );
  }
}
