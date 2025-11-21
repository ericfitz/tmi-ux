import '@angular/compiler';

import { HttpRequest, HttpResponse, HttpHeaders, HttpHandlerFn } from '@angular/common/http';
import { expect, describe, it, beforeEach, vi, afterEach, Mock } from 'vitest';
import { of } from 'rxjs';

import { securityHeadersInterceptor } from './security-headers.interceptor';
import { LoggerService } from '../services/logger.service';
import { SecurityConfigService } from '../services/security-config.service';
import { environment } from '../../../environments/environment';
import { inject } from '@angular/core';

// Mock the inject function
vi.mock('@angular/core', async () => {
  const actual = await vi.importActual('@angular/core');
  return {
    ...actual,
    inject: vi.fn(),
  };
});

describe('SecurityHeadersInterceptor', () => {
  let loggerSpy: LoggerService;
  let securityConfigSpy: Partial<SecurityConfigService>;
  let mockNext: Mock<HttpHandlerFn>;
  let interceptorFn: HttpHandlerFn;

  beforeEach(() => {
    vi.clearAllMocks();

    loggerSpy = {
      debug: vi.fn(),
      warning: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      debugComponent: vi.fn(),
    } as any;

    securityConfigSpy = {
      recommendedHeaders$: {
        value: {
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Strict-Transport-Security': 'max-age=31536000',
        },
      } as any,
    };

    // Mock the inject function to return our spies
    (inject as Mock).mockImplementation((token: any) => {
      if (token === LoggerService) return loggerSpy;
      if (token === SecurityConfigService) return securityConfigSpy;
      return null;
    });

    // The interceptor is already a function, no need to call it
    interceptorFn = securityHeadersInterceptor;

    // Mock next handler
    mockNext = vi.fn<HttpHandlerFn>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should check for missing security headers', () => {
    const testUrl = `${environment.apiUrl}/test`;
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        // Missing security headers
      }),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);

      if (!environment.production) {
        expect(loggerSpy.debugComponent).toHaveBeenCalledWith(
          'SecurityHeadersInterceptor',
          'Missing security headers in API response',
          expect.objectContaining({
            url: testUrl,
            missingHeaders: expect.arrayContaining(['X-Frame-Options', 'X-Content-Type-Options']),
          }),
        );
      }
    });
  });

  it('should not log when headers are present', () => {
    const testUrl = `${environment.apiUrl}/test`;
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
        'X-Frame-Options': 'DENY',
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000',
        'Content-Security-Policy': "default-src 'self'",
      }),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);

      if (!environment.production) {
        expect(loggerSpy.debugComponent).not.toHaveBeenCalled();
      }
    });
  });

  it('should warn about insecure X-Frame-Options', () => {
    const testUrl = `${environment.apiUrl}/test`;
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({
        'X-Frame-Options': 'ALLOWALL',
      }),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);

      if (!environment.production) {
        expect(loggerSpy.warn).toHaveBeenCalledWith(
          'Security header warnings',
          expect.objectContaining({
            warnings: expect.arrayContaining(['X-Frame-Options is set to ALLOWALL (insecure)']),
          }),
        );
      }
    });
  });

  it('should warn about verbose Server header', () => {
    const testUrl = `${environment.apiUrl}/test`;
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({
        Server: 'Apache/2.4.41 (Ubuntu) OpenSSL/1.1.1f PHP/7.4.3',
      }),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);

      if (!environment.production) {
        expect(loggerSpy.warn).toHaveBeenCalledWith(
          'Security header warnings',
          expect.objectContaining({
            warnings: expect.arrayContaining([
              'Server header may be disclosing too much information',
            ]),
          }),
        );
      }
    });
  });

  it('should warn about missing HSTS on HTTPS', () => {
    const testUrl = 'https://api.example.com/test';
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({
        'Content-Type': 'application/json',
      }),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);

      if (!environment.production) {
        expect(loggerSpy.warn).toHaveBeenCalledWith(
          'Security header warnings',
          expect.objectContaining({
            warnings: expect.arrayContaining(['HSTS header missing on HTTPS response']),
          }),
        );
      }
    });
  });

  it('should not check headers for non-API requests', () => {
    const testUrl = 'https://external.com/test';
    const mockRequest = new HttpRequest('GET', testUrl);
    const mockResponse = new HttpResponse({
      body: { data: 'test' },
      headers: new HttpHeaders({}),
    });

    mockNext.mockReturnValue(of(mockResponse));

    const result$ = interceptorFn(mockRequest, mockNext);

    result$.subscribe(() => {
      expect(mockNext).toHaveBeenCalledWith(mockRequest);
      // For non-API requests, we still check HTTPS for HSTS
      // but we don't check for other missing headers
      expect(loggerSpy.debugComponent).not.toHaveBeenCalled();
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Security header warnings',
        expect.objectContaining({
          url: testUrl,
          warnings: expect.arrayContaining(['HSTS header missing on HTTPS response']),
        }),
      );
    });
  });
});
