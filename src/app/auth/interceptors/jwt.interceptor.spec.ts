import '@angular/compiler';

import { HttpRequest, HttpHandler, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, beforeEach, describe, it, expect } from 'vitest';

import { JwtInterceptor } from './jwt.interceptor';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { environment } from '../../../environments/environment';
import { JwtToken } from '../models/auth.models';

describe('JwtInterceptor', () => {
  let interceptor: JwtInterceptor;
  let authService: AuthService;
  let router: Router;
  let loggerService: LoggerService;

  const mockJwtToken: JwtToken = {
    token: 'mock-jwt-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 3600,
    expiresAt: new Date(Date.now() + 3600000)
  };

  beforeEach(() => {
    const mockAuthService = {
      getValidToken: vi.fn(),
      logout: vi.fn(),
      handleAuthError: vi.fn()
    };

    const mockRouter = {
      navigate: vi.fn(),
      url: '/test-path'
    };

    const mockLoggerService = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
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

      const mockRequest = {
        url: `${environment.apiUrl}/test`,
        clone: vi.fn().mockReturnThis()
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' }))
      } as unknown as HttpHandler;

      await new Promise<void>((resolve) => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(mockRequest.clone).toHaveBeenCalledWith({
            setHeaders: {
              Authorization: `Bearer ${mockJwtToken.token}`
            }
          });
          expect(loggerService.debug).toHaveBeenCalledWith('Adding JWT token to request');
          resolve();
        });
      });
    });

    it('should not add Authorization header to non-API requests', async () => {
      const mockRequest = {
        url: 'https://external-api.com/test'
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' }))
      } as unknown as HttpHandler;

      await new Promise<void>((resolve) => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).not.toHaveBeenCalled();
          expect(mockHandler.handle).toHaveBeenCalledWith(mockRequest);
          resolve();
        });
      });
    });

    it('should handle token refresh failure', () => {
      const refreshError = new Error('Token refresh failed - please login again');
      vi.mocked(authService.getValidToken).mockReturnValue(throwError(() => refreshError));

      const mockRequest = {
        url: `${environment.apiUrl}/test`,
        method: 'GET'
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn()
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
        error: (error) => {
          expect(error).toBeInstanceOf(Error);
          // When getValidToken fails, the error gets processed by handleError which creates a Server Error message
          expect(error.message).toContain('Server Error');
        }
      });
    });

    it('should handle 401 errors and trigger logout', async () => {
      vi.mocked(authService.getValidToken).mockReturnValue(of(mockJwtToken));

      const mockRequest = {
        url: `${environment.apiUrl}/test`,
        clone: vi.fn().mockReturnThis(),
        method: 'GET'
      } as unknown as HttpRequest<unknown>;

      const unauthorizedError = new HttpErrorResponse({
        status: 401,
        statusText: 'Unauthorized',
        url: `${environment.apiUrl}/test`
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => unauthorizedError))
      } as unknown as HttpHandler;

      await new Promise<void>((resolve) => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: () => {
            expect(true).toBe(false); // Should not succeed
          },
          error: (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Server Error: 401');
            expect(loggerService.warn).toHaveBeenCalledWith('Unauthorized request - redirecting to login');
            expect(authService.logout).toHaveBeenCalledOnce();
            expect(router.navigate).toHaveBeenCalledWith(['/login'], {
              queryParams: { returnUrl: '/test-path', reason: 'session_expired' }
            });
            resolve();
          }
        });
      });
    });

    it('should handle 403 Forbidden errors', async () => {
      vi.mocked(authService.getValidToken).mockReturnValue(of(mockJwtToken));

      const mockRequest = {
        url: `${environment.apiUrl}/test`,
        clone: vi.fn().mockReturnThis(),
        method: 'GET'
      } as unknown as HttpRequest<unknown>;

      const forbiddenError = new HttpErrorResponse({
        status: 403,
        statusText: 'Forbidden',
        url: `${environment.apiUrl}/test`
      });

      const mockHandler = {
        handle: vi.fn().mockReturnValue(throwError(() => forbiddenError))
      } as unknown as HttpHandler;

      await new Promise<void>((resolve) => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe({
          next: () => {
            expect(true).toBe(false); // Should not succeed
          },
          error: (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error.message).toContain('Server Error: 403');
            expect(authService.handleAuthError).toHaveBeenCalledWith({
              code: 'forbidden',
              message: 'You do not have permission to access this resource',
              retryable: false
            });
            resolve();
          }
        });
      });
    });

    it('should use getValidToken for automatic token refresh', async () => {
      const refreshedToken: JwtToken = {
        ...mockJwtToken,
        token: 'refreshed-token'
      };

      vi.mocked(authService.getValidToken).mockReturnValue(of(refreshedToken));

      const mockRequest = {
        url: `${environment.apiUrl}/test`,
        clone: vi.fn().mockReturnThis()
      } as unknown as HttpRequest<unknown>;

      const mockHandler = {
        handle: vi.fn().mockReturnValue(of({ data: 'test' }))
      } as unknown as HttpHandler;

      await new Promise<void>((resolve) => {
        const result$ = interceptor.intercept(mockRequest, mockHandler);
        result$.subscribe(() => {
          expect(authService.getValidToken).toHaveBeenCalledOnce();
          expect(mockRequest.clone).toHaveBeenCalledWith({
            setHeaders: {
              Authorization: `Bearer ${refreshedToken.token}`
            }
          });
          resolve();
        });
      });
    });
  });
});