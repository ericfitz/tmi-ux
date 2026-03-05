import '@angular/compiler';

import { HttpRequest, HttpResponse, HttpHeaders } from '@angular/common/http';
import { of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CacheControlInterceptor } from './cache-control.interceptor';
import { environment } from '../../../environments/environment';

describe('CacheControlInterceptor', () => {
  let interceptor: CacheControlInterceptor;
  let httpHandler: any;

  beforeEach(() => {
    interceptor = new CacheControlInterceptor();
    httpHandler = {
      handle: vi.fn(),
    };
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  it('should add Cache-Control and Pragma headers to API requests', () => {
    const mockRequest = new HttpRequest('GET', `${environment.apiUrl}/test`);
    const mockResponse = new HttpResponse({ status: 200, body: { success: true } });
    httpHandler.handle.mockReturnValue(of(mockResponse));

    interceptor.intercept(mockRequest, httpHandler).subscribe();

    const clonedRequest: HttpRequest<unknown> = httpHandler.handle.mock.calls[0][0];
    expect(clonedRequest.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(clonedRequest.headers.get('Pragma')).toBe('no-cache');
  });

  it('should not add headers to non-API requests', () => {
    const mockRequest = new HttpRequest('GET', 'https://external.com/resource');
    const mockResponse = new HttpResponse({ status: 200, body: {} });
    httpHandler.handle.mockReturnValue(of(mockResponse));

    interceptor.intercept(mockRequest, httpHandler).subscribe();

    const passedRequest: HttpRequest<unknown> = httpHandler.handle.mock.calls[0][0];
    expect(passedRequest.headers.has('Cache-Control')).toBe(false);
    expect(passedRequest.headers.has('Pragma')).toBe(false);
  });

  it('should add headers for POST requests to API', () => {
    const mockRequest = new HttpRequest('POST', `${environment.apiUrl}/oauth2/token/google`, {});
    const mockResponse = new HttpResponse({ status: 200, body: {} });
    httpHandler.handle.mockReturnValue(of(mockResponse));

    interceptor.intercept(mockRequest, httpHandler).subscribe();

    const clonedRequest: HttpRequest<unknown> = httpHandler.handle.mock.calls[0][0];
    expect(clonedRequest.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(clonedRequest.headers.get('Pragma')).toBe('no-cache');
  });

  it('should preserve existing request headers', () => {
    const mockRequest = new HttpRequest('GET', `${environment.apiUrl}/test`, null, {
      headers: new HttpHeaders({
        Authorization: 'Bearer token123',
        'Content-Type': 'application/json',
      }),
    });
    const mockResponse = new HttpResponse({ status: 200, body: {} });
    httpHandler.handle.mockReturnValue(of(mockResponse));

    interceptor.intercept(mockRequest, httpHandler).subscribe();

    const clonedRequest: HttpRequest<unknown> = httpHandler.handle.mock.calls[0][0];
    expect(clonedRequest.headers.get('Authorization')).toBe('Bearer token123');
    expect(clonedRequest.headers.get('Content-Type')).toBe('application/json');
    expect(clonedRequest.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
  });
});
