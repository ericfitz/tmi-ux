// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router, UrlTree } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { timmyEnabledGuard } from './timmy-enabled.guard';
import { BrandingConfigService } from '@app/core/services/branding-config.service';
import { LoggerService } from '@app/core/services/logger.service';

describe('timmyEnabledGuard', () => {
  let mockBrandingConfig: {
    timmyEnabled: boolean;
  };
  let mockRouter: {
    createUrlTree: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let envInjector: EnvironmentInjector;

  const fakeUrlTree = {} as UrlTree;
  const mockState = { url: '/tm/tm-123/chat' } as any;

  const routeWithId = {
    paramMap: { get: (key: string) => (key === 'id' ? 'tm-123' : null) },
  } as any;
  const routeWithoutId = {
    paramMap: { get: () => null },
  } as any;

  beforeEach(() => {
    mockBrandingConfig = {
      timmyEnabled: false,
    };

    mockRouter = {
      createUrlTree: vi.fn().mockReturnValue(fakeUrlTree),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    envInjector = createEnvironmentInjector(
      [
        { provide: BrandingConfigService, useValue: mockBrandingConfig },
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

  it('should allow activation when the server advertises timmy_enabled', () => {
    mockBrandingConfig.timmyEnabled = true;

    runInInjectionContext(envInjector, () => {
      const result = timmyEnabledGuard(routeWithId, mockState);

      expect(result).toBe(true);
      expect(mockRouter.createUrlTree).not.toHaveBeenCalled();
    });
  });

  it('should redirect to the threat model page when Timmy is disabled', () => {
    mockBrandingConfig.timmyEnabled = false;

    runInInjectionContext(envInjector, () => {
      const result = timmyEnabledGuard(routeWithId, mockState);

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/tm', 'tm-123']);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  it('should redirect to root when Timmy is disabled and no threat model id is present', () => {
    mockBrandingConfig.timmyEnabled = false;

    runInInjectionContext(envInjector, () => {
      const result = timmyEnabledGuard(routeWithoutId, mockState);

      expect(result).toBe(fakeUrlTree);
      expect(mockRouter.createUrlTree).toHaveBeenCalledWith(['/']);
    });
  });
});
