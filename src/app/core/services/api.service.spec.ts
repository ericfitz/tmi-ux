// This project uses vitest for all unit tests, with native vitest syntax
// This project uses cypress for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Execute all tests for a component by using "pnpm run test:<componentname>"
// Do not disable or skip failing tests, ask the user what to do
import '@angular/compiler';

import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AuthService } from '../../auth/services/auth.service';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { throwError } from 'rxjs';
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
interface MockAuthService {
  logout: ReturnType<typeof vi.fn>;
}

interface MockMatDialog {
  open: ReturnType<typeof vi.fn>;
}

describe('ApiService', () => {
  let service: ApiService;
  let httpClient: MockHttpClient;
  let loggerService: MockLoggerService;
  let router: MockRouter;
  let authService: MockAuthService;
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

    authService = {
      logout: vi.fn(),
    };

    dialog = {
      open: vi.fn(),
    };

    // Create the service directly with mocked dependencies
    service = new ApiService(
      httpClient as unknown as HttpClient,
      loggerService as unknown as LoggerService,
      router as unknown as Router,
      authService as unknown as AuthService,
      dialog as unknown as MatDialog,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
      expect(loggerService.info).toHaveBeenCalledWith(
        `API Service initialized with endpoint: ${environment.apiUrl}`,
      );
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

    it('should handle 401 unauthorized errors with logout and redirect', () => {
      const unauthorizedError = new HttpErrorResponse({
        error: mockErrorResponse,
        status: 401,
        statusText: 'Unauthorized',
      });

      vi.mocked(httpClient.get).mockReturnValue(throwError(() => unauthorizedError));

      const result$ = service.get<typeof mockSuccessResponse>(testEndpoint);

      result$.subscribe({
        error: () => {
          expect(loggerService.warn).toHaveBeenCalledWith(
            'API returned 401 Unauthorized. Redirecting to login.',
          );
          expect(authService.logout).toHaveBeenCalled();
          expect(router.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: { returnUrl: router.url, reason: 'unauthorized_api' },
          });
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

      expect(httpClient.get).toHaveBeenCalledWith(`${environment.apiUrl}/${endpointWithSlash}`, {
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
});
