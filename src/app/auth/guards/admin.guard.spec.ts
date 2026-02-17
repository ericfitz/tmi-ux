// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { adminGuard } from './admin.guard';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { UserProfile } from '../models/auth.models';

describe('adminGuard', () => {
  let mockAuthService: {
    refreshUserProfile: ReturnType<typeof vi.fn>;
    getLandingPage: ReturnType<typeof vi.fn>;
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

  beforeEach(() => {
    mockAuthService = {
      refreshUserProfile: vi.fn(),
      getLandingPage: vi.fn().mockReturnValue('/intake'),
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

  it('should grant access when user is an admin', () => {
    const adminProfile: UserProfile = {
      provider: 'google',
      provider_id: '123',
      display_name: 'Admin',
      email: 'admin@example.com',
      groups: null,
      jwt_groups: null,
      is_admin: true,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(adminProfile));

    runInInjectionContext(envInjector, () => {
      const result$ = adminGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(true);
          expect(mockLogger.info).toHaveBeenCalledWith('Admin access granted');
          expect(mockRouter.navigate).not.toHaveBeenCalled();
        });
      }
    });
  });

  it('should deny access and redirect when user is not an admin', () => {
    const regularProfile: UserProfile = {
      provider: 'google',
      provider_id: '456',
      display_name: 'Regular',
      email: 'regular@example.com',
      groups: null,
      jwt_groups: null,
      is_admin: false,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(regularProfile));

    runInInjectionContext(envInjector, () => {
      const result$ = adminGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockLogger.warn).toHaveBeenCalledWith(
            'Admin access denied: User is not an administrator',
          );
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake'], {
            queryParams: { error: 'admin_required' },
          });
        });
      }
    });
  });

  it('should deny access when is_admin is undefined', () => {
    const profileWithoutAdmin: UserProfile = {
      provider: 'google',
      provider_id: '789',
      display_name: 'User',
      email: 'user@example.com',
      groups: null,
      jwt_groups: null,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(profileWithoutAdmin));

    runInInjectionContext(envInjector, () => {
      const result$ = adminGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake'], {
            queryParams: { error: 'admin_required' },
          });
        });
      }
    });
  });

  it('should deny access and redirect on profile refresh error', () => {
    mockAuthService.refreshUserProfile.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    runInInjectionContext(envInjector, () => {
      const result$ = adminGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockLogger.error).toHaveBeenCalledWith(
            'Failed to verify admin status',
            expect.any(Error),
          );
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake'], {
            queryParams: { error: 'admin_check_failed' },
          });
        });
      }
    });
  });

  it('should always refresh profile from server (not use cached data)', () => {
    const adminProfile: UserProfile = {
      provider: 'google',
      provider_id: '123',
      display_name: 'Admin',
      email: 'admin@example.com',
      groups: null,
      jwt_groups: null,
      is_admin: true,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(adminProfile));

    runInInjectionContext(envInjector, () => {
      adminGuard({} as any, {} as any);

      // Verify it calls refreshUserProfile, not a cached profile observable
      expect(mockAuthService.refreshUserProfile).toHaveBeenCalled();
    });
  });
});
