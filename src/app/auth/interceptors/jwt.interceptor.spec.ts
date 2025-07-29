import '@angular/compiler';

import { HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, beforeEach, describe, it, expect } from 'vitest';

import { JwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { JwtToken } from '../models/auth.models';

// Mock the environment module
vi.mock('../../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:8080',
    production: false,
  },
}));

import { environment } from '../../../environments/environment';

describe('JwtInterceptor', () => {
  let interceptor: JwtInterceptor;
  let authService: AuthService;
  let router: Router;
  let loggerService: LoggerService;

  const mockJwtToken: JwtToken = {
    token: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600000),
  };

  // Helper function to create mock requests
  const createMockRequest = (
    url: string,
    method = 'GET',
    includeClone = false,
  ): HttpRequest<unknown> => {
    const request = {
      url,
      method,
      headers: {
        keys: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(null),
      },
    } as any;

    if (includeClone) {
      request.clone = vi.fn().mockReturnThis();
    }

    return request as HttpRequest<unknown>;
  };

  beforeEach(() => {
    const mockAuthService = {
      getValidToken: vi.fn(),
      getValidTokenIfAvailable: vi.fn(),
      logout: vi.fn(),
      handleAuthError: vi.fn(),
    };

    const mockRouter = {
      navigate: vi.fn(),
      url: '/test-path',
    };

    const mockLoggerService = {
      info: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    authService = mockAuthService as unknown as AuthService;
    router = mockRouter as unknown as Router;
    loggerService = mockLoggerService as unknown as LoggerService;

    interceptor = new JwtInterceptor(authService, router, loggerService);
  });

  describe('Core Functionality', () => {
    it('should be created', () => {
      expect(interceptor).toBeTruthy();
    });

    it('should add Authorization header to API requests', async () => {
      vi.mocked(authService.getValidToken).mockReturnValue(of(mockJwtToken));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockRequest.clone).toHaveBeenCalledWith({
            setHeaders: {
              Authorization: `Bearer ${mockJwtToken.token}`,
            },
          });
          expect(loggerService.debugComponent).toHaveBeenCalledWith(
            'api',
            expect.stringContaining('GET request details:'),
            expect.any(Object),
          );
          resolve();
        });
      });
    });

    it('should not add Authorization header to non-API requests', async () => {
      const mockRequest = {
        url: 'https://external-api.com/test',
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidTokenIfAvailable).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to public API endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/auth/login`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'login response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidTokenIfAvailable).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to auth exchange endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/auth/exchange/google`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'exchange response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidTokenIfAvailable).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to auth authorize endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/auth/authorize/github`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'authorize response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidTokenIfAvailable).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to root health check endpoint', async () => {
      const mockRequest = createMockRequest(environment.apiUrl); // This is just "http://localhost:8080" - the root endpoint

      const mockHandler = {
        handle: vi
          .fn()
          .mockReturnValue(of({ status: { code: 'OK', time: '2025-07-28T00:58:26.207Z' } })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidTokenIfAvailable).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should handle token refresh failure', () => {
      // Mock to return error (no token available)
      vi.mocked(authService.getValidToken).mockReturnValue(throwError(() => new Error('No token available')));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET');

      const mockHandler = {
        handle: vi.fn(),
      } as unknown as HttpHandler;

      const result$ = interceptor.intercept(mockRequest, mockHandler);

      // Verify the observable is set up correctly but don't wait for completion
      expect(authService.getValidToken).toHaveBeenCalledOnce();
      expect(mockHandler.handle).not.toHaveBeenCalled();

      // The JWT interceptor processes all errors through handleError method
      result$.subscribe({
        next: () => {
          expect(true).toBe(false); // Should not succeed
        },
        error: error => {
          expect(error).toBeInstanceOf(Error);
          // When no token is available, error gets wrapped by handleError as server error
          expect(error.message).toContain('Server Error: Unknown Unknown Error');
        },
      });
    });

    it('should handle 401 errors with reactive refresh success', async () => {
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token',
      };

      // First call returns token, then fails with 401, then refresh succeeds
      vi.mocked(authService.getValidToken)
        .mockReturnValueOnce(of(mockJwtToken));
      vi.mocked(authService.getValidTokenIfAvailable)
        .mockReturnValueOnce(of(refreshedToken));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/test`,
      });

      const mockHandler = {
        handle: vi
          .fn()
          .mockReturnValueOnce(throwError(() => unauthorizedError))
          .mockReturnValueOnce(of({ data: 'success' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: response => {
            expect(response).toEqual({ data: 'success' });
            expect(loggerService.warn).toHaveBeenCalledWith(
              'Received 401 Unauthorized - attempting reactive token refresh',
            );
            expect(loggerService.info).toHaveBeenCalledWith(
              'Token refresh successful - retrying original request',
            );
            expect(authService.getValidToken).toHaveBeenCalledTimes(1);
            expect(authService.getValidTokenIfAvailable).toHaveBeenCalledTimes(1);
            expect(mockHandler.handle).toHaveBeenCalledTimes(2);
            resolve();
          },
          error: () => {
            expect(true).toBe(false); // Should not error
          },
        });
      });
    });

    it('should handle 401 errors with reactive refresh failure', async () => {
      // First call returns token, then fails with 401, then refresh returns null
      vi.mocked(authService.getValidToken)
        .mockReturnValueOnce(of(mockJwtToken));
      vi.mocked(authService.getValidTokenIfAvailable)
        .mockReturnValueOnce(of(null));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/test`,
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => unauthorizedError)),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: () => {
            expect(true).toBe(false); // Should not succeed
          },
          error: error => {
            expect(error.message).toContain('Token refresh failed - no token available');
            expect(loggerService.warn).toHaveBeenCalledWith(
              'Received 401 Unauthorized - attempting reactive token refresh',
            );
            expect(loggerService.warn).toHaveBeenCalledWith(
              'No token available after refresh attempt - redirecting to login',
            );
            expect(loggerService.warn).toHaveBeenCalledWith(
              'Unauthorized request - redirecting to login',
            );
            expect(authService.logout).toHaveBeenCalled();
            expect(router.navigate).toHaveBeenCalledWith(['/login'], {
              queryParams: { returnUrl: '/test-path', reason: 'session_expired' },
            });
            resolve();
          },
        });
      });
    });

    it('should handle 403 Forbidden errors', async () => {
      vi.mocked(authService.getValidToken).mockReturnValue(of(mockJwtToken));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const forbiddenError = new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        url: `${environment.apiUrl}/test`,
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => forbiddenError)),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: () => {
            expect(true).toBe(false); // Should not succeed
          },
          error: error => {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Server Error: 403');
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'forbidden',
              message: 'You do not have permission to access this resource',
              retryable: false,
            });
            resolve();
          },
        });
      });
    });

    it('should use getValidToken for automatic token refresh', async () => {
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token',
      };

      vi.mocked(authService.getValidToken).mockReturnValue(of(refreshedToken));

      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).toHaveBeenCalledOnce();
          expect(mockRequest.clone).toHaveBeenCalledWith({
            setHeaders: {
              Authorization: `Bearer ${refreshedToken.token}`,
            },
          });
          resolve();
        });
      });
    });
  });
});
