import '@angular/compiler';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { expect, describe, it, beforeEach, vi, afterEach } from 'vitest';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { securityHeadersInterceptor } from './security-headers.interceptor';
import { LoggerService } from '../services/logger.service';
import { SecurityConfigService } from '../services/security-config.service';
import { environment } from '../../../environments/environment';

describe('SecurityHeadersInterceptor', () => {
  let httpClient: HttpClient;
  let httpTestingController: HttpTestingController;
  let loggerSpy: LoggerService;
  let securityConfigSpy: Partial<SecurityConfigService>;

  beforeEach(() => {
    loggerSpy = {
      debug: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
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

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([securityHeadersInterceptor])),
        provideHttpClientTesting(),
        { provide: LoggerService, useValue: loggerSpy },
        { provide: SecurityConfigService, useValue: securityConfigSpy },
      ],
    });

    httpClient = TestBed.inject(HttpClient);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should check for missing security headers', () => {
    const testUrl = `${environment.apiUrl}/test`;

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { data: 'test' },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          // Missing security headers
        }),
      },
    );

    if (!environment.production) {
      expect(loggerSpy.debug).toHaveBeenCalledWith(
        'Missing security headers in API response',
        expect.objectContaining({
          url: testUrl,
          missingHeaders: expect.arrayContaining(['X-Frame-Options', 'X-Content-Type-Options']),
        }),
      );
    }
  });

  it('should not log when headers are present', () => {
    const testUrl = `${environment.apiUrl}/test`;

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { data: 'test' },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'X-Frame-Options': 'DENY',
          'X-Content-Type-Options': 'nosniff',
          'Strict-Transport-Security': 'max-age=31536000',
        }),
      },
    );

    if (!environment.production) {
      expect(loggerSpy.debug).not.toHaveBeenCalled();
    }
  });

  it('should warn about insecure X-Frame-Options', () => {
    const testUrl = `${environment.apiUrl}/test`;

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { data: 'test' },
      {
        headers: new HttpHeaders({
          'X-Frame-Options': 'ALLOWALL',
        }),
      },
    );

    if (!environment.production) {
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Security header warnings',
        expect.objectContaining({
          warnings: expect.arrayContaining(['X-Frame-Options is set to ALLOWALL (insecure)']),
        }),
      );
    }
  });

  it('should warn about verbose Server header', () => {
    const testUrl = `${environment.apiUrl}/test`;

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { data: 'test' },
      {
        headers: new HttpHeaders({
          Server: 'Apache/2.4.41 (Ubuntu) OpenSSL/1.1.1f PHP/7.4.3',
        }),
      },
    );

    if (!environment.production) {
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Security header warnings',
        expect.objectContaining({
          warnings: expect.arrayContaining(['Server header may be disclosing too much information']),
        }),
      );
    }
  });

  it('should warn about missing HSTS on HTTPS', () => {
    const testUrl = 'https://api.example.com/test';

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush(
      { data: 'test' },
      {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
        }),
      },
    );

    if (!environment.production) {
      expect(loggerSpy.warn).toHaveBeenCalledWith(
        'Security header warnings',
        expect.objectContaining({
          warnings: expect.arrayContaining(['HSTS header missing on HTTPS response']),
        }),
      );
    }
  });

  it('should not check headers for non-API requests', () => {
    const testUrl = 'https://external.com/test';

    httpClient.get(testUrl).subscribe();

    const req = httpTestingController.expectOne(testUrl);
    req.flush({ data: 'test' });

    expect(loggerSpy.debug).not.toHaveBeenCalled();
    expect(loggerSpy.warning).not.toHaveBeenCalled();
  });
});