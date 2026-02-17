import '@angular/compiler';

import { HttpRequest, HttpHandler, HttpErrorResponse, HttpContext } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi, beforeEach, describe, it, expect } from 'vitest';

import { JwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { JwtToken } from '../models/auth.models';
import { IS_AUTH_RETRY } from '../../core/tokens/http-context.tokens';
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
        // Return a new mock request with the updated properties
        return {
          ...request,
          headers: options.setHeaders
            ? { ...request.headers, Authorization: options.setHeaders.Authorization }
            : request.headers,
          context: options.context ?? request.context,
        };
      });
    }

    return request as HttpRequest<unknown>;
  };

  beforeEach(() => {
    const mockAuthService = {
      getValidToken: vi.fn(),
      forceRefreshToken: vi.fn(),
      handleAuthError: vi.fn(),
    };

    authService = mockAuthService as unknown as AuthService;
    loggerService = createTypedMockLoggerService();

    interceptor = new JwtInterceptor(authService, loggerService as unknown as LoggerService);
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
          expect(authService.getValidToken).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to public API endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/authorize/github`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'login response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to auth exchange endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/token/google`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'exchange response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should not add Authorization header to auth authorize endpoints', async () => {
      const mockRequest = createMockRequest(`${environment.apiUrl}/oauth2/authorize/github`);

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'authorize response' })),
      } as unknown as HttpHandler;

      await new Promise<void>(resolve => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).not.toHaveBeenCalled();
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
          expect(authService.getValidToken).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should handle token refresh failure', () => {
      // Mock to return error (no token available)
      vi.mocked(authService.getValidToken).mockReturnValue(
        throwError(() => new Error('No token available')),
      );

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
          // When no token is available, JWT interceptor returns a descriptive error
          expect(error.message).toContain('No token available');
        },
      });
    });

    it('should handle 401 errors with forced refresh success', async () => {
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token',
      };

      // First call returns token, then fails with 401, then forceRefreshToken succeeds
      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(refreshedToken));

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
              'Received 401 Unauthorized - attempting forced token refresh',
            );
            expect(loggerService.info).toHaveBeenCalledWith(
              'Forced token refresh successful - retrying original request',
            );
            expect(authService.getValidToken).toHaveBeenCalledTimes(1);
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

    it('should handle 401 errors with forced refresh failure (propagates error without logout)', async () => {
      // First call returns token, then fails with 401, then forceRefreshToken fails
      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));
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
            // Error propagates but NO logout occurs
            expect(error.message).toContain('Token refresh failed');
            expect(loggerService.warn).toHaveBeenCalledWith(
              'Received 401 Unauthorized - attempting forced token refresh',
            );
            expect(loggerService.error).toHaveBeenCalledWith(
              'Forced token refresh failed - propagating error',
              expect.any(Error),
            );
            // handleAuthError is called to notify subscribers
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'token_refresh_failed',
              message: 'Unable to refresh authentication token',
              retryable: true,
            });
            resolve();
          },
        });
      });
    });

    it('should not retry on 401 if request is already a retry (prevents infinite loop)', async () => {
      // Create a request that's already marked as a retry
      const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/test`,
        'GET',
        true,
        retryContext,
      );

      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));

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
            // Should NOT attempt refresh - just propagate error
            expect(error.status).toBe(401);
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            expect(loggerService.warn).toHaveBeenCalledWith(
              '401 on retry request - propagating error without logout',
              expect.objectContaining({
                url: `${environment.apiUrl}/test`,
                method: 'GET',
              }),
            );
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

  describe('Retry Logic Edge Cases (Security)', () => {
    it('should preserve POST request body when retrying after 401', async () => {
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token',
      };

      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(refreshedToken));

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
            expect(mockRequest.clone).toHaveBeenCalledTimes(2);
            // Second clone call is the retry with new token
            const retryCloneArgs = vi.mocked(mockRequest.clone).mock.calls[1][0];
            expect(retryCloneArgs.setHeaders.Authorization).toBe(`Bearer ${refreshedToken.token}`);
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
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token',
      };

      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));
      vi.mocked(authService.forceRefreshToken).mockReturnValueOnce(of(refreshedToken));

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
            const retryCloneArgs = vi.mocked(mockRequest.clone).mock.calls[1][0];
            expect(retryCloneArgs.context).toBeDefined();
            expect(retryCloneArgs.context.get(IS_AUTH_RETRY)).toBe(true);
            resolve();
          },
          error: () => {
            expect(true).toBe(false);
          },
        });
      });
    });

    it('should emit unauthorized_after_refresh auth error on retry 401', async () => {
      // Create a request already marked as retry
      const retryContext = new HttpContext().set(IS_AUTH_RETRY, true);
      const mockRequest = createMockRequest(
        `${environment.apiUrl}/test`,
        'GET',
        true,
        retryContext,
      );

      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));

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
            // Verify handleAuthError called with correct error code
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'unauthorized_after_refresh',
              message: 'Authentication failed after token refresh',
              retryable: false,
            });
            // forceRefreshToken should NOT be called again
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            resolve();
          },
        });
      });
    });

    it('should pass through non-401/403 errors without retry or auth error emission', async () => {
      vi.mocked(authService.getValidToken).mockReturnValueOnce(of(mockJwtToken));

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
            // No retry attempted
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            // No auth error emitted
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
            // Public endpoints don't use getValidToken or forceRefreshToken
            expect(authService.getValidToken).not.toHaveBeenCalled();
            expect(authService.forceRefreshToken).not.toHaveBeenCalled();
            // But handleAuthError IS still called via handleError
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
});
