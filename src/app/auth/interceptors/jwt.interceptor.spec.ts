import '@angular/compiler';

import { HttpRequest, HttpHandler, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { Injector } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi, beforeEach, describe, it, expect } from 'vitest';

import { JwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { AuthSession } from '../models/auth.models';
import {
  IS_AUTH_RETRY,
  IS_LOGOUT_REQUEST,
  SKIP_ERROR_HANDLING,
} from '../../core/tokens/http-context.tokens';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../testing/mocks';

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
  let loggerService: MockLoggerService;

  const mockAuthSession: AuthSession = {
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600000),
  };

  // Helper function to create mock requests
  const createMockRequest = (
    url: string,
    method = 'GET',
    includeClone = false,
    context?: HttpContext,
  ): HttpRequest<unknown> => {
    const request = {
      url,
      method,
      headers: {
        keys: vi.fn().mockReturnValue([]),
        get: vi.fn().mockReturnValue(null),
      },
      context: context ?? new HttpContext(),
    } as any;

    if (includeClone) {
      request.clone = vi.fn().mockImplementation((options: any) => {
        return {
          ...request,
          context: options.context ?? request.context,
        };
      });
    }

    return request as HttpRequest<unknown>;
  };

  beforeEach(() => {
    const mockAuthService = {
      forceRefreshToken: vi.fn(),
      handleAuthError: vi.fn(),
      logout: vi.fn(),
    };

    authService = mockAuthService as unknown as AuthService;
    loggerService = createTypedMockLoggerService();

    const mockInjector = {
      get: vi.fn().mockReturnValue(authService),
    } as unknown as Injector;

    interceptor = new JwtInterceptor(mockInjector, loggerService as unknown as LoggerService);
  });

  describe('Core Functionality', () => {
    it('should be created', () => {
      expect(interceptor).toBeTruthy();
    });

    it('should pass through API requests without modifying headers', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET');

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should pass through non-API requests unchanged', async () => {
      const mockRequest = {
        url: 'https://external-api.com/test',
        context: new HttpContext(),
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should pass through public API endpoints unchanged', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/authorize/github`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'login response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should pass through auth exchange endpoints unchanged', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/token/google`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'exchange response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should pass through auth authorize endpoints unchanged', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/authorize/github`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'authorize response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should pass through root health check endpoint unchanged', async () => {
      const mockRequest = createMockRequest(environment.apiUrl);

      const mockHandler = {
        handle: vi
          .fn()
          .mockReturnValue(of({ status: { code: 'OK', time: '2025-07-28T00:58:26.207Z' } })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should handle 401 errors with refresh and retry success', async () => {
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(mockAuthSession));

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
              'Received 401 Unauthorized - attempting cookie-based token refresh',
            );
            expect(loggerService.info).toHaveBeenCalledWith(
              'Token refresh successful - retrying original request',
            );
            expect(authService.forceRefreshToken).toHaveBeenCalledTimes(1);
            expect(mockHandler.handle).toHaveBeenCalledTimes(2);
            resolve();
          },
          error: () => {
            expect(true).toBe(false); // Should not error
          },
        });
      });
    });

    it('should trigger full logout on refresh failure', async () => {
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(
        throwError(() => new Error('Token refresh failed')),
      );

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
            expect(error.message).toContain('Token refresh failed');
            expect(loggerService.warn).toHaveBeenCalledWith(
              'Received 401 Unauthorized - attempting cookie-based token refresh',
            );
            expect(loggerService.error).toHaveBeenCalledWith(
              'Token refresh failed - triggering logout',
              expect.any(Error),
            );
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'token_refresh_failed',
              message: 'Unable to refresh authentication token',
              retryable: false,
            });
            expect(authService.logout).toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should trigger logout on 401 if request is already a retry (prevents infinite loop)', async () => {
      const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/test`,
        'GET',
        true,
        retryContext,
      );

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
            expect(error.status).toBe(401);
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(loggerService.warn).toHaveBeenCalledWith(
              '401 on retry request - triggering logout',
              expect.objectContaining({
                url: `${environment.apiUrl}/test`,
                method: 'GET',
              }),
            );
            expect(authService.logout).toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should handle 403 Forbidden errors', async () => {
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
            expect(error).toBeInstanceOf(HttpErrorResponse);
            expect(error.status).toBe(403);
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
  });

  describe('Retry Logic Edge Cases (Security)', () => {
    it('should preserve POST request body when retrying after 401', async () => {
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(mockAuthSession));

      const postBody = { name: 'test-model', description: 'important data' };
      const mockRequest = createMockRequest(`${environment.apiUrl}/threat-models`, 'POST', true);
      (mockRequest as any).body = postBody;

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/threat-models`,
      });

      const mockHandler = {
        handle: vi
          .fn()
          .mockReturnValueOnce(throwError(() => unauthorizedError))
          .mockReturnValueOnce(of({ data: 'created' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        interceptor.intercept(mockRequest, mockHandler).subscribe({
          next: () => {
            // Verify the retry request was cloned from original (preserves body)
            expect(mockRequest.clone).toHaveBeenCalledTimes(1);
            // The clone is called with only context (no setHeaders)
            const retryCloneArgs = vi.mocked(mockRequest.clone).mock.calls[0][0];
            expect(retryCloneArgs.context).toBeDefined();
            expect(retryCloneArgs.context.get(IS_AUTH_RETRY)).toBe(true);
            expect(retryCloneArgs).not.toHaveProperty('setHeaders');
            // The clone is called on the ORIGINAL request, so body is preserved
            expect(mockHandler.handle).toHaveBeenCalledTimes(2);
            resolve();
          },
          error: () => {
            expect(true).toBe(false);
          },
        });
      });
    });

    it('should set IS_AUTH_RETRY context on retried request to prevent infinite loop', async () => {
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(mockAuthSession));

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
        interceptor.intercept(mockRequest, mockHandler).subscribe({
          next: () => {
            // Verify the retry clone was called with IS_AUTH_RETRY context
            const retryCloneArgs = vi.mocked(mockRequest.clone).mock.calls[0][0];
            expect(retryCloneArgs.context).toBeDefined();
            expect(retryCloneArgs.context.get(IS_AUTH_RETRY)).toBe(true);
            expect(retryCloneArgs).not.toHaveProperty('setHeaders');
            resolve();
          },
          error: () => {
            expect(true).toBe(false);
          },
        });
      });
    });

    it('should emit unauthorized_after_refresh auth error on retry 401', async () => {
      const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/test`,
        'GET',
        true,
        retryContext,
      );

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/test`,
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => unauthorizedError)),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        interceptor.intercept(mockRequest, mockHandler).subscribe({
          next: () => {
            expect(true).toBe(false);
          },
          error: () => {
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'unauthorized_after_refresh',
              message: 'Authentication failed after token refresh',
              retryable: false,
            });
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should pass through non-401/403 errors without retry or auth error emission', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/test`, 'GET', true);

      const serverError = new HttpErrorResponse({
        status: 500,
        statusText: 'Internal Server Error',
        url: `${environment.apiUrl}/test`,
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => serverError)),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        interceptor.intercept(mockRequest, mockHandler).subscribe({
          next: () => {
            expect(true).toBe(false);
          },
          error: error => {
            expect(error.status).toBe(500);
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(authService.handleAuthError).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should handle errors on public endpoints without retry logic', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/callback`);

      const serverError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/oauth2/callback`,
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => serverError)),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        interceptor.intercept(mockRequest, mockHandler).subscribe({
          next: () => {
            expect(true).toBe(false);
          },
          error: error => {
            expect(error.status).toBe(401);
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'unauthorized',
              message: 'Authentication required',
              retryable: true,
            });
            resolve();
          },
        });
      });
    });
  });

  describe('IS_LOGOUT_REQUEST handling', () => {
    it('should pass through logout requests without auth handling', async () => {
      const logoutContext = new HttpContext().set(IS_LOGOUT_REQUEST, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/me/logout`,
        'POST',
        false,
        logoutContext,
      );

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ success: true })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: () => {
            expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
            resolve();
          },
          error: () => {
            expect(true).toBe(false); // Should not error
          },
        });
      });
    });

    it('should not retry 401 on logout requests', async () => {
      const logoutContext = new HttpContext().set(IS_LOGOUT_REQUEST, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/me/logout`,
        'POST',
        false,
        logoutContext,
      );

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/me/logout`,
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
          error: () => {
            // Error passes through without refresh attempt or logout loop
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(authService.logout).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });
  });

  describe('SKIP_ERROR_HANDLING handling', () => {
    it('should pass through requests with SKIP_ERROR_HANDLING without auth retry', async () => {
      const skipContext = new HttpContext().set(SKIP_ERROR_HANDLING, true);
      const mockRequest = createMockRequest(`${environment.apiUrl}/me`, 'GET', false, skipContext);

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/me`,
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
          error: () => {
            // Error passes through without refresh attempt or logout
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(authService.handleAuthError).not.toHaveBeenCalled();
            expect(authService.logout).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });
  });
});
