// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { of, throwError, toArray } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { threatModelResolver } from './threat-model.resolver';
import { ThreatModelService } from '../services/threat-model.service';
import { ThreatModelAuthorizationService } from '../services/threat-model-authorization.service';
import { LoggerService } from '../../../core/services/logger.service';
import type { ThreatModel } from '../models/threat-model.model';

describe('threatModelResolver', () => {
  let mockThreatModelService: {
    getThreatModelById: ReturnType<typeof vi.fn>;
  };
  let mockAuthorizationService: {
    getCurrentUserPermission: ReturnType<typeof vi.fn>;
  };
  let mockRouter: {
    navigate: ReturnType<typeof vi.fn>;
  };
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let envInjector: EnvironmentInjector;

  const mockThreatModel: ThreatModel = {
    id: 'tm-123',
    name: 'Test Model',
    status: 'notStarted',
    owner: { provider_id: 'user1', _subject: 'user1@test.com' },
    authorizations: [],
    assets: [],
    threats: [],
    notes: [],
    diagrams: [],
    documents: [],
    repositories: [],
    metadata: [],
  };

  function createMockRoute(
    id: string | null,
    queryParams: Record<string, string> = {},
  ): ActivatedRouteSnapshot {
    return {
      paramMap: {
        get: (key: string) => (key === 'id' ? id : null),
        keys: id ? ['id'] : [],
      },
      queryParamMap: {
        get: (key: string) => queryParams[key] || null,
        keys: Object.keys(queryParams),
      },
    } as unknown as ActivatedRouteSnapshot;
  }

  function createMockState(url: string): RouterStateSnapshot {
    return { url } as RouterStateSnapshot;
  }

  beforeEach(() => {
    mockThreatModelService = {
      getThreatModelById: vi.fn().mockReturnValue(of(mockThreatModel)),
    };

    mockAuthorizationService = {
      getCurrentUserPermission: vi.fn().mockReturnValue('owner'),
    };

    mockRouter = {
      navigate: vi.fn().mockResolvedValue(true),
    };

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      debugComponent: vi.fn(),
    };

    envInjector = createEnvironmentInjector(
      [
        { provide: ThreatModelService, useValue: mockThreatModelService },
        {
          provide: ThreatModelAuthorizationService,
          useValue: mockAuthorizationService,
        },
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

  describe('missing route ID', () => {
    it('should redirect to dashboard when no threat model ID in route', () => {
      const route = createMockRoute(null);
      const state = createMockState('/threat-models');

      runInInjectionContext(envInjector, () => {
        const result$ = threatModelResolver(route, state);
        result$.subscribe(result => {
          expect(result).toBeNull();
          expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
          expect(mockLogger.error).toHaveBeenCalledWith('No threat model ID provided in route');
        });
      });
    });

    it('should not call getThreatModelById when ID is missing', () => {
      const route = createMockRoute(null);
      const state = createMockState('/threat-models');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(() => {
          expect(mockThreatModelService.getThreatModelById).not.toHaveBeenCalled();
        });
      });
    });
  });

  describe('successful resolution', () => {
    it('should return threat model when service resolves successfully', () => {
      const route = createMockRoute('tm-123');
      const state = createMockState('/threat-models/tm-123');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(result => {
          expect(result).toEqual(mockThreatModel);
          expect(mockThreatModelService.getThreatModelById).toHaveBeenCalledWith('tm-123', false);
        });
      });
    });

    it('should log user permission after successful resolution', () => {
      const route = createMockRoute('tm-123');
      const state = createMockState('/threat-models/tm-123');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(() => {
          expect(mockAuthorizationService.getCurrentUserPermission).toHaveBeenCalled();
          expect(mockLogger.info).toHaveBeenCalledWith('User permission determined', {
            threatModelId: 'tm-123',
            permission: 'owner',
          });
        });
      });
    });

    it('should pass forceRefresh=true when refresh query param is true', () => {
      const route = createMockRoute('tm-123', { refresh: 'true' });
      const state = createMockState('/threat-models/tm-123?refresh=true');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(() => {
          expect(mockThreatModelService.getThreatModelById).toHaveBeenCalledWith('tm-123', true);
        });
      });
    });

    it('should pass forceRefresh=false when refresh query param is absent', () => {
      const route = createMockRoute('tm-123');
      const state = createMockState('/threat-models/tm-123');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(() => {
          expect(mockThreatModelService.getThreatModelById).toHaveBeenCalledWith('tm-123', false);
        });
      });
    });

    it('should pass forceRefresh=false when refresh query param is not "true"', () => {
      const route = createMockRoute('tm-123', { refresh: 'false' });
      const state = createMockState('/threat-models/tm-123?refresh=false');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(() => {
          expect(mockThreatModelService.getThreatModelById).toHaveBeenCalledWith('tm-123', false);
        });
      });
    });

    it('should map null threat model to null', () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(of(null));
      const route = createMockRoute('tm-123');
      const state = createMockState('/threat-models/tm-123');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(result => {
          expect(result).toBeNull();
        });
      });
    });

    it('should map undefined threat model to null', () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(of(undefined));
      const route = createMockRoute('tm-123');
      const state = createMockState('/threat-models/tm-123');

      runInInjectionContext(envInjector, () => {
        threatModelResolver(route, state).subscribe(result => {
          expect(result).toBeNull();
        });
      });
    });
  });

  describe('error handling', () => {
    async function resolveWithError(): Promise<unknown[]> {
      return new Promise<unknown[]>((resolve, reject) => {
        runInInjectionContext(envInjector, () => {
          const route = createMockRoute('tm-123');
          const state = createMockState('/threat-models/tm-123');
          threatModelResolver(route, state)
            .pipe(toArray())
            .subscribe({
              next: values => resolve(values),
              error: err => reject(err instanceof Error ? err : new Error(String(err))),
            });
        });
      });
    }

    it('should redirect with access_denied on 403 error', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => ({ status: 403 })),
      );

      const values = await resolveWithError();

      // EMPTY emits no values
      expect(values).toEqual([]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'access_denied',
          threat_model_id: 'tm-123',
        },
      });
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should redirect with auth_required on 401 error', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => ({ status: 401 })),
      );

      const values = await resolveWithError();

      expect(values).toEqual([]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'auth_required',
          threat_model_id: 'tm-123',
        },
      });
    });

    it('should redirect with load_failed on 500 error', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => ({ status: 500 })),
      );

      const values = await resolveWithError();

      expect(values).toEqual([]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'load_failed',
          threat_model_id: 'tm-123',
        },
      });
    });

    it('should redirect with load_failed on 404 error', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => ({ status: 404 })),
      );

      const values = await resolveWithError();

      expect(values).toEqual([]);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'load_failed',
          threat_model_id: 'tm-123',
        },
      });
    });

    it('should return EMPTY on error to prevent route activation', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => ({ status: 403 })),
      );

      const values = await resolveWithError();

      // EMPTY completes without emitting, so toArray() returns []
      // This prevents route activation (no value = route doesn't activate)
      expect(values).toEqual([]);
    });

    it('should handle plain Error object without status property', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => new Error('Network failure')),
      );

      const values = await resolveWithError();

      expect(values).toEqual([]);
      // Error without status should fall through to the else branch
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'load_failed',
          threat_model_id: 'tm-123',
        },
      });
    });

    it('should handle string error without crashing', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(
        throwError(() => 'Something went wrong'),
      );

      const values = await resolveWithError();

      expect(values).toEqual([]);
      // String error has no status property, falls to else branch
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'load_failed',
          threat_model_id: 'tm-123',
        },
      });
    });

    it('should handle null error by propagating TypeError', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(throwError(() => null));

      // null error: `const httpError = error as { status?: number }` → httpError is null
      // `httpError.status` → TypeError: Cannot read properties of null
      // The TypeError is thrown inside catchError, which means the observable errors out
      await expect(resolveWithError()).rejects.toThrow();
    });

    it('should handle error with status 0 (falsy) as generic error', async () => {
      mockThreatModelService.getThreatModelById.mockReturnValue(throwError(() => ({ status: 0 })));

      const values = await resolveWithError();

      expect(values).toEqual([]);
      // status === 0 is falsy, so 0 === 403 and 0 === 401 are both false
      // Falls to else branch
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/dashboard'], {
        queryParams: {
          error: 'load_failed',
          threat_model_id: 'tm-123',
        },
      });
    });
  });
});
