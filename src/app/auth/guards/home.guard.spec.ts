// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { homeGuard } from './home.guard';
import { AuthService } from '../services/auth.service';
import { LoggerService } from '../../core/services/logger.service';

describe('homeGuard', () => {
  let mockAuthService: {
    isAuthenticated: boolean;
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

  const mockRoute = {} as any;
  const mockState = { url: '/' } as any;

  beforeEach(() => {
    mockAuthService = {
      isAuthenticated: false,
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

  it('should allow access to home page for unauthenticated users', () => {
    mockAuthService.isAuthenticated = false;

    runInInjectionContext(envInjector, () => {
      const result = homeGuard(mockRoute, mockState);

      expect(result).toBe(true);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  it('should redirect authenticated users to their landing page', () => {
    mockAuthService.isAuthenticated = true;
    mockAuthService.getLandingPage.mockReturnValue('/intake');

    runInInjectionContext(envInjector, () => {
      const result = homeGuard(mockRoute, mockState);

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/intake']);
    });
  });

  it('should use role-based landing page from AuthService', () => {
    mockAuthService.isAuthenticated = true;
    mockAuthService.getLandingPage.mockReturnValue('/admin');

    runInInjectionContext(envInjector, () => {
      const result = homeGuard(mockRoute, mockState);

      expect(result).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin']);
    });
  });

  it('should log when redirecting authenticated user', () => {
    mockAuthService.isAuthenticated = true;

    runInInjectionContext(envInjector, () => {
      homeGuard(mockRoute, mockState);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'HomeGuard',
        'User is authenticated, redirecting to landing page',
      );
    });
  });
});
