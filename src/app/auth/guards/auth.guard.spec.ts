// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';

describe('authGuard', () => {
  let mockAuthService: {
    isAuthenticated$: BehaviorSubject<boolean>;
    validateAndUpdateAuthState: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let envInjector: EnvironmentInjector;

  const mockRoute = {} as any;
  const mockState = { url: '/threat-models/123' } as any;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated$: new BehaviorSubject<boolean>(false),
      validateAndUpdateAuthState: vi.fn(),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    envInjector = createEnvironmentInjector(
      [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: LoggerService, useValue: mockLogger },
      ],
      {
        get: () => null,
      } as unknown as EnvironmentInjector,
    );
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should allow access when user is authenticated', () => {
    mockAuthService.isAuthenticated$.next(true);

    runInInjectionContext(envInjector, () => {
      const result$ = authGuard(mockRoute, mockState);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(true);
          expect(mockRouter.navigate).not.toHaveBeenCalled();
        });
      }
    });
  });

  it('should call validateAndUpdateAuthState before checking observable (defense-in-depth)', () => {
    mockAuthService.isAuthenticated$.next(true);

    runInInjectionContext(envInjector, () => {
      authGuard(mockRoute, mockState);

      expect(mockAuthService.validateAndUpdateAuthState).toHaveBeenCalled();
    });
  });

  it('should deny access and redirect to login when not authenticated', () => {
    mockAuthService.isAuthenticated$.next(false);

    runInInjectionContext(envInjector, () => {
      const result$ = authGuard(mockRoute, mockState);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: {
              returnUrl: '/threat-models/123',
              reason: 'session_expired',
            },
          });
        });
      }
    });
  });

  it('should preserve the intended destination URL in returnUrl query param', () => {
    mockAuthService.isAuthenticated$.next(false);
    const deepLinkState = { url: '/threat-models/456/diagrams/789' } as any;

    runInInjectionContext(envInjector, () => {
      const result$ = authGuard(mockRoute, deepLinkState);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe(() => {
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: {
              returnUrl: '/threat-models/456/diagrams/789',
              reason: 'session_expired',
            },
          });
        });
      }
    });
  });

  it('should log when redirecting unauthenticated user', () => {
    mockAuthService.isAuthenticated$.next(false);

    runInInjectionContext(envInjector, () => {
      const result$ = authGuard(mockRoute, mockState);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe(() => {
          expect(mockLogger.debugComponent).toHaveBeenCalledWith(
            'AuthGuard',
            'User is not authenticated, redirecting to login page',
          );
        });
      }
    });
  });

  it('should reflect updated auth state after validateAndUpdateAuthState', () => {
    // Start as authenticated
    mockAuthService.isAuthenticated$.next(true);

    // Simulate validateAndUpdateAuthState detecting an expired token
    mockAuthService.validateAndUpdateAuthState.mockImplementation(() => {
      mockAuthService.isAuthenticated$.next(false);
    });

    runInInjectionContext(envInjector, () => {
      const result$ = authGuard(mockRoute, mockState);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/login'], {
            queryParams: {
              returnUrl: '/threat-models/123',
              reason: 'session_expired',
            },
          });
        });
      }
    });
  });
});
