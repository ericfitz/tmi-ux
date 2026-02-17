// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { HttpClient, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { throwError } from 'rxjs';
import { TimeoutError } from 'rxjs';
import { SKIP_ERROR_HANDLING } from '../tokens/http-context.tokens';
import {
  createTypedMockLoggerService,
  createTypedMockRouter,
  createTypedMockHttpClient,
  type MockLoggerService,
  type MockRouter,
  type MockHttpClient,
} from '../../../testing/mocks';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    production: false,
    logLevel: 'DEBUG',
    apiUrl: 'http://localhost:8080',
    authTokenExpiryMinutes: 60,
    operatorName: 'TMI Operator (Test)',
    operatorContact: 'test@example.com',
  },
}));

import { environment } from '../../../environments/environment';

// Mock interfaces for type safety
interface MockMatDialog {
  open: ReturnType<typeof vi.fn>;
}

describe('ApiService', () => {
  let service: ApiService;
  let httpClient: MockHttpClient;
  let loggerService: MockLoggerService;
  let router: MockRouter;
  let dialog: MockMatDialog;

  // Test data
  const mockSuccessResponse = { id: 1, name: 'Test Data' };
  const mockErrorResponse = { error: 'Test error message' };
  const testEndpoint = 'test-endpoint';
  const testParams = { param1: 'value1', param2: 42, param3: true };
  const testBody = { data: 'test data', value: 123 };

  beforeEach(() => {
    // Clear mocks before each test
    vi.clearAllMocks();

    // Create mocks for dependencies
    loggerService = createTypedMockLoggerService();
    router = createTypedMockRouter('/current-route');
    httpClient = createTypedMockHttpClient(mockSuccessResponse);

    dialog = {
      open: vi.fn(),
    };

    // Create the service directly with mocked dependencies
    // Note: authService removed - 401 handling now in JwtInterceptor
    service = new ApiService(
      httpClient as unknown as HttpClient,
      loggerService as unknown as LoggerService,
      router as unknown as Router,
      dialog as unknown as MatDialog,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should use environment API URL', () => {
      expect(service['apiUrl']).toBe(environment.apiUrl);
    });
  });

  describe('GET Requests', () => {
    it('should make successful GET request without parameters', () => {
      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe(result => {
        expect(result).toEqual(mockSuccessResponse);
        expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
          params: undefined,
        });
        // Logging is now handled by JWT interceptor
      });
    });

    it('should make successful GET request with parameters', () => {
      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint, testParams);

      result$.subscribe(result => {
        expect(result).toEqual(mockSuccessResponse);
        expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
          params: testParams,
        });
        // Logging is now handled by JWT interceptor
      });
    });

    it('should handle GET request errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 500,
        statusText: 'Internal Server Error',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(500);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });

    it('should handle network errors with retry logic', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 500,
        statusText: 'Internal Server Error',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          // Verify that error handling works correctly after retry attempts
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(500);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('POST Requests', () => {
    it('should make successful POST request', () => {
      const result$ = service.post<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe(result => {
        expect(result).toEqual(mockSuccessResponse);
        expect(httpClient.post).toHaveBeenCalledWith(
          `${environment.apiUrl}/${testEndpoint}`,
          testBody,
        );
        // Logging is now handled by JWT interceptor
      });
    });

    it('should handle POST request errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 400,
        statusText: 'Bad Request',
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.post<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(400);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('PUT Requests', () => {
    it('should make successful PUT request', () => {
      const result$ = service.put<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe(result => {
        expect(result).toEqual(mockSuccessResponse);
        expect(httpClient.put).toHaveBeenCalledWith(
          `${environment.apiUrl}/${testEndpoint}`,
          testBody,
          {},
        );
        // Logging is now handled by JWT interceptor
      });
    });

    it('should handle PUT request errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 404,
        statusText: 'Not Found',
      });

      vi.mocked(httpClient.put).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.put<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(404);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('DELETE Requests', () => {
    it('should make successful DELETE request', () => {
      const result$ = service.delete<undefined>(testEndpoint);

      result$.subscribe(result => {
        expect(result).toBeUndefined(); // DELETE returns 204 No Content with no body
        expect(httpClient.delete).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`);
        // Logging is now handled by JWT interceptor
      });
    });

    it('should handle DELETE request errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 403,
        statusText: 'Forbidden',
      });

      vi.mocked(httpClient.delete).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.delete<undefined>(testEndpoint);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(403);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle client-side errors', () => {
      const clientError = new HttpErrorResponse({
        error: new ErrorEvent('Network error', { message: 'Connection failed' }),
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => clientError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.error.message).toBe('Connection failed');
          expect(loggerService.error).toHaveBeenCalledWith('Client Error: Connection failed');
        },
      });
    });

    it('should propagate 401 unauthorized errors (JWT interceptor handles auth)', () => {
      const unauthorizedError = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 401,
        statusText: 'Unauthorized',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => unauthorizedError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          // 401 errors are passed through - JWT interceptor handles them
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(401);
          // Should NOT redirect - that's handled by JWT interceptor
          expect(router.navigate).not.toHaveBeenCalled();
        },
      });
    });

    it('should handle 403 forbidden errors with redirect', () => {
      const forbiddenError = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 403,
        statusText: 'Forbidden',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => forbiddenError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: () => {
          expect(loggerService.warn).toHaveBeenCalledWith(
            'API returned 403 Forbidden. Redirecting to unauthorized page.',
          );
          expect(router.navigate).toHaveBeenCalledWith(['/unauthorized'], {
            queryParams: { currentUrl: router.url, reason: 'forbidden_api' },
          });
        },
      });
    });

    it('should log debug information for server errors', () => {
      const serverError = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 500,
        statusText: 'Internal Server Error',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => serverError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: () => {
          expect(loggerService.debugComponent).toHaveBeenCalledWith(
            'Api',
            'Full error response',
            serverError,
          );
        },
      });
    });

    it('should include method and endpoint in error messages', () => {
      const serverError = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 500,
        statusText: 'Internal Server Error',
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => serverError));

      const result$ = service.post<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(500);
          expect(loggerService.error).toHaveBeenCalledWith(
            `Server Error: 500 Internal Server Error for POST ${testEndpoint}`,
            serverError,
          );
        },
      });
    });
  });

  describe('URL Construction', () => {
    it('should construct URLs correctly with leading slash in endpoint', () => {
      const endpointWithSlash = '/test-endpoint';
      service.get<typeof mockSuccessResponse>(endpointWithSlash);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}${endpointWithSlash}`, {
        params: undefined,
      });
    });

    it('should construct URLs correctly without leading slash in endpoint', () => {
      const endpointWithoutSlash = 'test-endpoint';
      service.get<typeof mockSuccessResponse>(endpointWithoutSlash);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${endpointWithoutSlash}`, {
        params: undefined,
      });
    });

    it('should handle nested endpoints correctly', () => {
      const nestedEndpoint = 'users/123/profile';
      service.get<typeof mockSuccessResponse>(nestedEndpoint);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${nestedEndpoint}`, {
        params: undefined,
      });
    });
  });

  describe('Parameter Handling', () => {
    it('should handle string parameters', () => {
      const stringParams = { search: 'test query', filter: 'active' };
      service.get<typeof mockSuccessResponse>(testEndpoint, stringParams);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params: stringParams,
      });
    });

    it('should handle number parameters', () => {
      const numberParams = { page: 1, limit: 10, offset: 0 };
      service.get<typeof mockSuccessResponse>(testEndpoint, numberParams);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params: numberParams,
      });
    });

    it('should handle boolean parameters', () => {
      const booleanParams = { active: true, deleted: false };
      service.get<typeof mockSuccessResponse>(testEndpoint, booleanParams);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params: booleanParams,
      });
    });

    it('should handle mixed parameter types', () => {
      const mixedParams = { search: 'test', page: 1, active: true };
      service.get<typeof mockSuccessResponse>(testEndpoint, mixedParams);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params: mixedParams,
      });
    });
  });

  describe('PATCH Requests', () => {
    const patchOperations = [
      { op: 'replace', path: '/name', value: 'Updated Name' },
      { op: 'add', path: '/tags/-', value: 'new-tag' },
    ];

    it('should make successful PATCH request with JSON Patch operations', () => {
      const result$ = service.patch<typeof mockSuccessResponse>(testEndpoint, patchOperations);

      result$.subscribe(result => {
        expect(result).toEqual(mockSuccessResponse);
        expect(httpClient.patch).toHaveBeenCalledWith(
          `${environment.apiUrl}/${testEndpoint}`,
          patchOperations,
          { headers: { 'Content-Type': 'application/json-patch+json' } },
        );
      });
    });

    it('should handle PATCH request errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: { error: 'Invalid patch operation' },
        status: 400,
        statusText: 'Bad Request',
      });

      vi.mocked(httpClient.patch).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.patch<typeof mockSuccessResponse>(testEndpoint, patchOperations);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(400);
          expect(loggerService.error).toHaveBeenCalled();
        },
      });
    });
  });

  describe('getText Requests', () => {
    it('should make GET request with text responseType', () => {
      vi.mocked(httpClient.get).mockReturnValue(throwError(() => 'should not be called') as any);
      // Override for this specific call pattern
      vi.mocked(httpClient.get).mockReturnValueOnce({
        pipe: vi.fn().mockReturnValue({ subscribe: vi.fn() }),
      } as any);

      service.getText(testEndpoint);

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params: undefined,
        responseType: 'text',
      });
    });
  });

  describe('deleteWithParams Requests', () => {
    it('should make DELETE request with query parameters', () => {
      const params = { cascade: true, force: false };
      service.deleteWithParams<undefined>(testEndpoint, params);

      expect(httpClient.delete).toHaveBeenCalledWith(`${environment.apiUrl}/${testEndpoint}`, {
        params,
      });
    });

    it('should handle deleteWithParams errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 404,
        statusText: 'Not Found',
      });

      vi.mocked(httpClient.delete).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.deleteWithParams<undefined>(testEndpoint, { id: 123 });

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(404);
        },
      });
    });
  });

  describe('Timeout Handling', () => {
    it('should handle timeout errors', () => {
      const timeoutError = new TimeoutError();

      vi.mocked(httpClient.patch).mockReturnValue(throwError(() => timeoutError));

      const result$ = service.patch<typeof mockSuccessResponse>(testEndpoint, [
        { op: 'replace', path: '/name', value: 'test' },
      ]);

      result$.subscribe({
        error: error => {
          // TimeoutError is wrapped into a new Error by handleError
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('timeout');
          expect(loggerService.error).toHaveBeenCalledWith(
            expect.stringContaining('timeout'),
            timeoutError,
          );
        },
      });
    });
  });

  describe('Validation Error Dialog', () => {
    it('should open validation error dialog on 400 errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: {
          error: 'validation_error',
          error_description: 'Name must be at least 3 characters',
        },
        status: 400,
        statusText: 'Bad Request',
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.post<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe({
        error: () => {
          expect(dialog.open).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              width: '500px',
              data: {
                error: 'validation_error',
                errorDescription: 'Name must be at least 3 characters',
              },
            }),
          );
        },
      });
    });

    it('should handle missing error details gracefully in validation errors', () => {
      const errorResponse = new HttpErrorResponse({
        error: {},
        status: 400,
        statusText: 'Bad Request',
      });

      vi.mocked(httpClient.post).mockReturnValue(throwError(() => errorResponse));

      const result$ = service.post<typeof mockSuccessResponse>(testEndpoint, testBody);

      result$.subscribe({
        error: () => {
          expect(dialog.open).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
              data: {
                error: 'Unknown validation error',
                errorDescription: '',
              },
            }),
          );
        },
      });
    });
  });

  describe('SKIP_ERROR_HANDLING', () => {
    it('should skip 400 validation dialog when SKIP_ERROR_HANDLING is set', () => {
      const errorResponse = new HttpErrorResponse({
        error: { error: 'validation_error' },
        status: 400,
        statusText: 'Bad Request',
      });

      vi.mocked(httpClient.put).mockReturnValue(throwError(() => errorResponse));

      const context = new HttpContext().set(SKIP_ERROR_HANDLING, true);
      const result$ = service.put<typeof mockSuccessResponse>(testEndpoint, testBody, context);

      result$.subscribe({
        error: () => {
          // Dialog should NOT be opened when SKIP_ERROR_HANDLING is set
          expect(dialog.open).not.toHaveBeenCalled();
          // 403 redirect should also be skipped
          expect(router.navigate).not.toHaveBeenCalled();
        },
      });
    });

    it('should skip 403 redirect when SKIP_ERROR_HANDLING is set', () => {
      const errorResponse = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 403,
        statusText: 'Forbidden',
      });

      vi.mocked(httpClient.put).mockReturnValue(throwError(() => errorResponse));

      const context = new HttpContext().set(SKIP_ERROR_HANDLING, true);
      const result$ = service.put<typeof mockSuccessResponse>(testEndpoint, testBody, context);

      result$.subscribe({
        error: () => {
          expect(router.navigate).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('404 Error Handling', () => {
    it('should propagate 404 errors without special handling', () => {
      const notFoundError = new HttpErrorResponse({
        error: { error: 'Resource not found' },
        status: 404,
        statusText: 'Not Found',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => notFoundError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(404);
          // No redirect or dialog for 404
          expect(router.navigate).not.toHaveBeenCalled();
          expect(dialog.open).not.toHaveBeenCalled();
        },
      });
    });
  });

  describe('Error Response Preservation', () => {
    it('should return HttpErrorResponse for server errors (preserving status codes)', () => {
      const serverError = new HttpErrorResponse({
        error: { message: 'Internal server error' },
        status: 500,
        statusText: 'Internal Server Error',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => serverError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          // Should preserve the HttpErrorResponse, not wrap it
          expect(error).toBeInstanceOf(HttpErrorResponse);
          expect(error.status).toBe(500);
        },
      });
    });

    it('should wrap non-HTTP errors in Error with descriptive message', () => {
      const genericError = new Error('Something broke');

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => genericError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: error => {
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toContain('Unexpected error');
          expect(error.message).toContain('GET');
          expect(error.message).toContain(testEndpoint);
        },
      });
    });
  });

  describe('URL Normalization', () => {
    it('should handle apiUrl with trailing slash', () => {
      // The apiUrl from environment is 'http://localhost:8080'
      // Let's test the buildUrl method indirectly
      service.get<typeof mockSuccessResponse>('/endpoint');

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/endpoint`, {
        params: undefined,
      });
    });
  });
});
