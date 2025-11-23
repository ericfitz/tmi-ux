/**
 * HTTP Logging Interceptor Tests
 */

import '@angular/compiler';

import { HttpRequest, HttpResponse, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { throwError, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HttpLoggingInterceptor } from './http-logging.interceptor';

// Test fixture URL - arbitrary value for testing interceptor logging behavior
const TEST_API_URL = 'http://test.example.com/api/test';

describe('HttpLoggingInterceptor', () => {
  let interceptor: HttpLoggingInterceptor;
  let loggerService: any;
  let httpHandler: any;

  beforeEach(() => {
    const loggerServiceMock = {
      debugComponent: vi.fn(),
      error: vi.fn(),
    };

    // Create interceptor directly without TestBed for simpler testing
    loggerService = loggerServiceMock;
    interceptor = new HttpLoggingInterceptor(loggerService);

    httpHandler = {
      handle: vi.fn(),
    };
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
  });

  describe('Request Logging', () => {
    it('should log API requests with component debug logging', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockResponse = new HttpResponse({ status: 200, body: { success: true } });

      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        `GET request to ${TEST_API_URL}:`,
        expect.objectContaining({
          url: TEST_API_URL,
          headers: expect.any(Object),
        }),
      );
    });

    it('should log API responses with component debug logging', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockResponse = new HttpResponse({
        status: 200,
        body: { success: true },
        statusText: 'OK',
      });

      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        `GET response from ${TEST_API_URL}:`,
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        }),
      );
    });
  });

  describe('Error Categorization', () => {
    it('should categorize 401 errors as "Auth error"', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Auth error: 401 Unauthorized for GET ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize 403 errors as "Auth error"', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockError = new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Auth error: 403 Forbidden for GET ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize 400 errors as "Validation error"', () => {
      const mockRequest = new HttpRequest('POST', TEST_API_URL, {});
      const mockError = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Validation error: 400 Bad Request for POST ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize 422 errors as "Validation error"', () => {
      const mockRequest = new HttpRequest('POST', TEST_API_URL, {});
      const mockError = new HttpErrorResponse({
        status: 422,
        statusText: 'Unprocessable Entity',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Validation error: 422 Unprocessable Entity for POST ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize 404 errors as "Not found error"', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockError = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Not found error: 404 Not Found for GET ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize 500+ errors as "Server error"', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `Server error: 500 Internal Server Error for GET ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });

    it('should categorize other errors as "API error"', () => {
      const mockRequest = new HttpRequest('GET', TEST_API_URL);
      const mockError = new HttpErrorResponse({
        status: 418,
        statusText: "I'm a teapot",
        url: TEST_API_URL,
      });

      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            `API error: 418 I'm a teapot for GET ${TEST_API_URL}`,
            mockError,
          );
        },
      });
    });
  });

  describe('Secret Redaction', () => {
    it('should redact sensitive information from headers', () => {
      const headers = new HttpHeaders({
        Authorization: 'Bearer abc123def456ghi789jkl012',
        'X-API-Key': 'secret123',
        'Content-Type': 'application/json',
      });
      const mockRequest = new HttpRequest('GET', TEST_API_URL, null, {
        headers,
      });
      const mockResponse = new HttpResponse({ status: 200 });

      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        `GET request to ${TEST_API_URL}:`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer abc1************l012',
            'Content-Type': 'application/json',
          }),
        }),
      );
    });
  });
});
