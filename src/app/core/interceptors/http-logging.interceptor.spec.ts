/**
 * HTTP Logging Interceptor Tests
 */

import '@angular/compiler';

import { HttpRequest, HttpResponse, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { throwError, of } from 'rxjs';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HttpLoggingInterceptor } from './http-logging.interceptor';

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
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockResponse = new HttpResponse({ status: 200, body: { success: true } });
      
      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        'GET request details:',
        expect.objectContaining({
          url: 'http://localhost:8080/api/test',
          headers: expect.any(Object),
        })
      );
    });

    it('should log API responses with component debug logging', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockResponse = new HttpResponse({ 
        status: 200, 
        body: { success: true },
        statusText: 'OK'
      });
      
      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        'GET response from http://localhost:8080/api/test:',
        expect.objectContaining({
          status: 200,
          statusText: 'OK',
        })
      );
    });
  });

  describe('Error Categorization', () => {
    it('should categorize 401 errors as "Auth error"', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Auth error: 401 Unauthorized for GET http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize 403 errors as "Auth error"', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockError = new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Auth error: 403 Forbidden for GET http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize 400 errors as "Validation error"', () => {
      const mockRequest = new HttpRequest('POST', 'http://localhost:8080/api/test', {});
      const mockError = new HttpErrorResponse({
        status: 400,
        statusText: 'Bad Request',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Validation error: 400 Bad Request for POST http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize 422 errors as "Validation error"', () => {
      const mockRequest = new HttpRequest('POST', 'http://localhost:8080/api/test', {});
      const mockError = new HttpErrorResponse({
        status: 422,
        statusText: 'Unprocessable Entity',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Validation error: 422 Unprocessable Entity for POST http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize 404 errors as "Not found error"', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockError = new HttpErrorResponse({
        status: 404,
        statusText: 'Not Found',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Not found error: 404 Not Found for GET http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize 500+ errors as "Server error"', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'Server error: 500 Internal Server Error for GET http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });

    it('should categorize other errors as "API error"', () => {
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test');
      const mockError = new HttpErrorResponse({
        status: 418,
        statusText: "I'm a teapot",
        url: 'http://localhost:8080/api/test',
      });
      
      httpHandler.handle.mockReturnValue(throwError(() => mockError));

      interceptor.intercept(mockRequest, httpHandler).subscribe({
        error: () => {
          expect(loggerService.error).toHaveBeenCalledWith(
            'API error: 418 I\'m a teapot for GET http://localhost:8080/api/test',
            mockError
          );
        }
      });
    });
  });

  describe('Secret Redaction', () => {
    it('should redact sensitive information from headers', () => {
      const headers = new HttpHeaders({
        'Authorization': 'Bearer abc123def456ghi789jkl012',
        'X-API-Key': 'secret123',
        'Content-Type': 'application/json',
      });
      const mockRequest = new HttpRequest('GET', 'http://localhost:8080/api/test', null, { headers });
      const mockResponse = new HttpResponse({ status: 200 });
      
      httpHandler.handle.mockReturnValue(of(mockResponse));

      interceptor.intercept(mockRequest, httpHandler).subscribe();

      expect(loggerService.debugComponent).toHaveBeenCalledWith(
        'api',
        'GET request details:',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer abc1************l012',
            'Content-Type': 'application/json',
          })
        })
      );
    });
  });
});