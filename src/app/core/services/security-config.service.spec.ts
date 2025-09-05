import '@angular/compiler';

import { expect, describe, it, beforeEach, vi } from 'vitest';

import { SecurityConfigService } from './security-config.service';
import { LoggerService } from './logger.service';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    apiUrl: 'http://localhost:8080',
    logLevel: 'DEBUG',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
  },
}));

describe('SecurityConfigService', () => {
  let service: SecurityConfigService;
  let loggerSpy: LoggerService;
  let documentMock: Document;

  beforeEach(() => {
    // Mock window properties
    Object.defineProperty(window, 'isSecureContext', {
      value: true,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'location', {
      value: {
        protocol: 'https:',
        hostname: 'localhost',
      },
      writable: true,
      configurable: true,
    });

    // Create a mock logger
    loggerSpy = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    } as any;

    // Create a mock document
    const mockMeta = {
      httpEquiv: '',
      content: '',
    };
    documentMock = {
      createElement: vi.fn().mockReturnValue(mockMeta),
      head: {
        appendChild: vi.fn(),
      },
      querySelector: vi.fn().mockReturnValue({
        parentNode: {
          insertBefore: vi.fn(),
        },
        nextSibling: null,
      }),
    } as any;

    // Create service instance directly
    service = new SecurityConfigService(loggerSpy, documentMock);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should detect security context', async () => {
    const isSecure = await new Promise<boolean>(resolve => {
      service.isSecureContext$.subscribe(value => resolve(value));
    });
    expect(typeof isSecure).toBe('boolean');
  });

  it('should generate recommended headers', async () => {
    const headers = await new Promise(resolve => {
      service.recommendedHeaders$.subscribe(value => resolve(value));
    });
    expect(headers).toBeDefined();
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should provide deployment recommendations for standalone', () => {
    const recommendations = service.getDeploymentRecommendations('standalone');
    expect(recommendations).toContain('Content Security Policy');
    expect(recommendations).toContain('Same-origin policy');
  });

  it('should provide deployment recommendations for proxy', () => {
    const recommendations = service.getDeploymentRecommendations('proxy');
    expect(recommendations).toContain('nginx configuration');
    expect(recommendations).toContain('add_header');
  });

  it('should provide deployment recommendations for load balancer', () => {
    const recommendations = service.getDeploymentRecommendations('loadbalancer');
    expect(recommendations).toContain('load balancer level');
    expect(recommendations).toContain('X-Forwarded-Proto');
  });

  it('should validate current headers', () => {
    const validation = service.validateCurrentHeaders();
    expect(validation).toHaveProperty('missing');
    expect(validation).toHaveProperty('warnings');
    expect(Array.isArray(validation.missing)).toBe(true);
    expect(Array.isArray(validation.warnings)).toBe(true);
  });

  it('should return CSP violation handler', () => {
    const handler = service.getCspViolationHandler();
    expect(typeof handler).toBe('function');

    // Test the handler
    const mockEvent = {
      blockedURI: 'https://evil.com',
      violatedDirective: 'script-src',
      originalPolicy: "default-src 'self'",
      sourceFile: 'test.js',
      lineNumber: 10,
      columnNumber: 5,
    } as SecurityPolicyViolationEvent;

    handler(mockEvent);
    expect(loggerSpy.warn).toHaveBeenCalledWith('CSP Violation detected', expect.any(Object));
  });

  it('should use default security config', () => {
    const config = service.getSecurityConfig();
    expect(config.enableHSTS).toBe(true);
    expect(config.hstsMaxAge).toBe(31536000);
    expect(config.hstsIncludeSubDomains).toBe(true);
    expect(config.frameOptions).toBe('DENY');
  });

  it('should inject dynamic CSP with API URL', () => {
    // Verify CSP meta tag was created
    expect(documentMock.createElement).toHaveBeenCalledWith('meta');

    // Get the created meta element
    const createElementCalls = (documentMock.createElement as any).mock.calls;
    const metaCall = createElementCalls.find((call: any[]) => call[0] === 'meta');
    expect(metaCall).toBeDefined();

    // Verify CSP content includes API URL
    const metaElement = (documentMock.createElement as any).mock.results[0].value;
    expect(metaElement.httpEquiv).toBe('Content-Security-Policy');
    expect(metaElement.content).toContain('connect-src');
    expect(metaElement.content).toContain('http://localhost:8080'); // Default API URL from environment
    expect(metaElement.content).toContain('wss:');
    expect(metaElement.content).toContain('ws:');
  });
});
