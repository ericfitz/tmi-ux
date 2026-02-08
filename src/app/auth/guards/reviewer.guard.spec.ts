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

import { reviewerGuard } from './reviewer.guard';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';
import { UserProfile } from '../models/auth.models';

describe('reviewerGuard', () => {
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
      // Use a minimal parent injector
      {
        get: () => null,
      } as unknown as EnvironmentInjector,
    );
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should grant access when user is a security reviewer', () => {
    const reviewerProfile: UserProfile = {
      provider: 'google',
      provider_id: '123',
      display_name: 'Reviewer',
      email: 'reviewer@example.com',
      groups: null,
      is_security_reviewer: true,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(reviewerProfile));

    runInInjectionContext(envInjector, () => {
      const result$ = reviewerGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(true);
          expect(mockLogger.info).toHaveBeenCalledWith('Security reviewer access granted');
          expect(mockRouter.navigate).not.toHaveBeenCalled();
        });
      }
    });
  });

  it('should deny access and redirect when user is not a security reviewer', () => {
    const regularProfile: UserProfile = {
      provider: 'google',
      provider_id: '456',
      display_name: 'Regular',
      email: 'regular@example.com',
      groups: null,
      is_security_reviewer: false,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(regularProfile));

    runInInjectionContext(envInjector, () => {
      const result$ = reviewerGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockLogger.warn).toHaveBeenCalled();
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
        });
      }
    });
  });

  it('should deny access and redirect on profile refresh error', () => {
    mockAuthService.refreshUserProfile.mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    runInInjectionContext(envInjector, () => {
      const result$ = reviewerGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockLogger.error).toHaveBeenCalled();
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
        });
      }
    });
  });

  it('should deny access when is_security_reviewer is undefined', () => {
    const profileWithoutReviewer: UserProfile = {
      provider: 'google',
      provider_id: '789',
      display_name: 'User',
      email: 'user@example.com',
      groups: null,
    };
    mockAuthService.refreshUserProfile.mockReturnValue(of(profileWithoutReviewer));

    runInInjectionContext(envInjector, () => {
      const result$ = reviewerGuard({} as any, {} as any);

      if (result$ instanceof Object && 'subscribe' in result$) {
        result$.subscribe((allowed: boolean) => {
          expect(allowed).toBe(false);
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
        });
      }
    });
  });
});
