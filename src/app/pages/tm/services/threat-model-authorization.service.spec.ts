// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { ThreatModelAuthorizationService } from './threat-model-authorization.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Authorization, User } from '../models/threat-model.model';

describe('ThreatModelAuthorizationService', () => {
  let service: ThreatModelAuthorizationService;
  let mockLogger: {
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    debugComponent: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    userProfile$: BehaviorSubject<any>;
    userIdp: string | null;
    providerId: string | null;
    userEmail: string | null;
    userGroups: string[];
  };

  const mockOwner: User = {
    provider: 'google',
    provider_id: 'google-123',
    email: 'owner@example.com',
  };

  const mockUserAuthorization: Authorization = {
    principal_type: 'user',
    provider: 'google',
    provider_id: 'google-456',
    role: 'writer',
  };

  const mockGroupAuthorization: Authorization = {
    principal_type: 'group',
    provider: 'google',
    provider_id: 'team-1',
    role: 'reader',
  };

  const mockEveryoneAuthorization: Authorization = {
    principal_type: 'group',
    provider: 'google',
    provider_id: 'everyone',
    role: 'reader',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debugComponent: vi.fn(),
    };

    mockAuthService = {
      userProfile$: new BehaviorSubject<any>({
        display_name: 'Test User',
        provider_id: 'google-456',
      }),
      userIdp: 'google',
      providerId: 'google-456',
      userEmail: 'user@example.com',
      userGroups: [],
    };

    service = new ThreatModelAuthorizationService(
      mockLogger as unknown as LoggerService,
      mockAuthService as unknown as AuthService,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should initialize with null authorization', () => {
      service.authorization$.subscribe(auth => {
        expect(auth).toBeNull();
      });
    });

    it('should initialize with null current threat model ID', () => {
      expect(service.currentThreatModelId).toBeNull();
    });

    it('should subscribe to user profile changes', () => {
      expect(mockAuthService.userProfile$.observers.length).toBeGreaterThan(0);
    });
  });

  describe('authorization$', () => {
    it('should emit authorization data when set', () => {
      const authorizations = [mockUserAuthorization];

      service.setAuthorization('tm-123', authorizations, mockOwner);

      service.authorization$.subscribe(auth => {
        expect(auth).toEqual(authorizations);
      });
    });

    it('should emit null when cleared', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);
      service.clearAuthorization();

      service.authorization$.subscribe(auth => {
        expect(auth).toBeNull();
      });
    });
  });

  describe('currentUserPermission$', () => {
    it('should emit permission when user is owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      service.currentUserPermission$.subscribe(permission => {
        expect(permission).toBe('owner');
      });
    });

    it('should emit permission when user has authorization', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      service.currentUserPermission$.subscribe(permission => {
        expect(permission).toBe('writer');
      });
    });

    it('should emit null when user has no access', () => {
      service.setAuthorization('tm-123', [], mockOwner);

      service.currentUserPermission$.subscribe(permission => {
        expect(permission).toBeNull();
      });
    });

    it('should use distinctUntilChanged to avoid duplicate emissions', () => {
      const emissions: (string | null)[] = [];

      service.currentUserPermission$.subscribe(permission => {
        emissions.push(permission);
      });

      // Set authorization twice with same value
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);
      service.updateAuthorization([mockUserAuthorization]);

      // Should only emit twice: initial null + one update
      expect(emissions.length).toBe(2);
    });
  });

  describe('canEdit$', () => {
    it('should emit true when user is owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      service.canEdit$.subscribe(canEdit => {
        expect(canEdit).toBe(true);
      });
    });

    it('should emit true when user is writer', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      service.canEdit$.subscribe(canEdit => {
        expect(canEdit).toBe(true);
      });
    });

    it('should emit false when user is only reader', () => {
      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      service.canEdit$.subscribe(canEdit => {
        expect(canEdit).toBe(false);
      });
    });
  });

  describe('canManagePermissions$', () => {
    it('should emit true when user is owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      service.canManagePermissions$.subscribe(canManage => {
        expect(canManage).toBe(true);
      });
    });

    it('should emit false when user is writer', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      service.canManagePermissions$.subscribe(canManage => {
        expect(canManage).toBe(false);
      });
    });

    it('should emit false when user is reader', () => {
      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      service.canManagePermissions$.subscribe(canManage => {
        expect(canManage).toBe(false);
      });
    });
  });

  describe('setAuthorization()', () => {
    it('should set threat model ID', () => {
      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.currentThreatModelId).toBe('tm-123');
    });

    it('should set owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      // Owner should be recognized
      expect(service.getCurrentUserPermission()).toBe('owner');
    });

    it('should emit authorization data', () => {
      const authorizations = [mockUserAuthorization];

      service.setAuthorization('tm-123', authorizations, mockOwner);

      service.authorization$.subscribe(auth => {
        expect(auth).toEqual(authorizations);
      });
    });

    it('should handle null authorization', () => {
      service.setAuthorization('tm-123', null, mockOwner);

      service.authorization$.subscribe(auth => {
        expect(auth).toBeNull();
      });
    });

    it('should log debug information', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'ThreatModelAuthorizationService',
        'setAuthorization called',
        expect.objectContaining({
          threatModelId: 'tm-123',
        }),
      );
    });
  });

  describe('updateAuthorization()', () => {
    it('should update authorization data', () => {
      service.setAuthorization('tm-123', [], mockOwner);

      const newAuth = [mockUserAuthorization];
      service.updateAuthorization(newAuth);

      service.authorization$.subscribe(auth => {
        expect(auth).toEqual(newAuth);
      });
    });

    it('should log update with permission info', () => {
      service.setAuthorization('tm-123', [], mockOwner);
      service.updateAuthorization([mockUserAuthorization]);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Authorization updated',
        expect.objectContaining({
          threatModelId: 'tm-123',
          authorizationCount: 1,
        }),
      );
    });

    it('should warn when no threat model ID is set', () => {
      service.updateAuthorization([mockUserAuthorization]);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot update authorization - no threat model ID set',
      );
    });

    it('should not update when no threat model ID is set', () => {
      service.updateAuthorization([mockUserAuthorization]);

      service.authorization$.subscribe(auth => {
        expect(auth).toBeNull();
      });
    });
  });

  describe('clearAuthorization()', () => {
    it('should clear threat model ID', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);
      service.clearAuthorization();

      expect(service.currentThreatModelId).toBeNull();
    });

    it('should clear authorization data', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);
      service.clearAuthorization();

      service.authorization$.subscribe(auth => {
        expect(auth).toBeNull();
      });
    });

    it('should log debug information', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);
      service.clearAuthorization();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'ThreatModelAuthorizationService',
        'Authorization cleared',
      );
    });
  });

  describe('Permission Calculation - Owner', () => {
    it('should grant owner permission when user matches owner by provider and provider_id', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('owner');
    });

    it('should grant owner permission via email fallback when provider_id contains email', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-456';
      mockAuthService.userEmail = 'owner@example.com';

      const ownerWithEmailInProviderId: User = {
        provider: 'google',
        provider_id: 'owner@example.com',
        email: 'owner@example.com',
      };

      service.setAuthorization('tm-123', [], ownerWithEmailInProviderId);

      expect(service.getCurrentUserPermission()).toBe('owner');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Owner matched via email fallback - backend is storing email in provider_id field',
        expect.any(Object),
      );
    });

    it('should not grant owner permission when provider does not match', () => {
      mockAuthService.userIdp = 'github';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });

    it('should not grant owner permission when provider_id does not match', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-999';

      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });
  });

  describe('Permission Calculation - User Authorization', () => {
    it('should grant writer permission when user has direct authorization', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('writer');
    });

    it('should return null when user has no matching authorization', () => {
      const otherUserAuth: Authorization = {
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-999',
        role: 'writer',
      };

      service.setAuthorization('tm-123', [otherUserAuth], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });

    it('should return highest permission when user has multiple authorizations', () => {
      const readerAuth: Authorization = {
        ...mockUserAuthorization,
        role: 'reader',
      };

      service.setAuthorization('tm-123', [readerAuth, mockUserAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('writer');
    });
  });

  describe('Permission Calculation - Group Authorization', () => {
    it('should grant reader permission via "everyone" group', () => {
      service.setAuthorization('tm-123', [mockEveryoneAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('reader');
    });

    it('should match "everyone" group case-insensitively', () => {
      const uppercaseEveryoneAuth: Authorization = {
        ...mockEveryoneAuthorization,
        provider_id: 'EVERYONE',
      };

      service.setAuthorization('tm-123', [uppercaseEveryoneAuth], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('reader');
    });

    it('should grant permission when user is member of group', () => {
      mockAuthService.userGroups = ['team-1'];

      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('reader');
    });

    it('should not grant permission when user is not member of group', () => {
      mockAuthService.userGroups = ['team-2'];

      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });

    it('should grant highest permission when user is in multiple groups', () => {
      mockAuthService.userGroups = ['team-1', 'team-2'];

      const writerGroupAuth: Authorization = {
        principal_type: 'group',
        provider: 'google',
        provider_id: 'team-2',
        role: 'writer',
      };

      service.setAuthorization('tm-123', [mockGroupAuthorization, writerGroupAuth], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('writer');
    });
  });

  describe('Permission Calculation - Edge Cases', () => {
    it('should return null when no user is authenticated', () => {
      mockAuthService.userIdp = null;
      mockAuthService.providerId = null;

      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Cannot calculate user permission - no authenticated user',
      );
    });

    it('should return null when authorizations is empty array', () => {
      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });

    it('should return null when authorizations is null', () => {
      service.setAuthorization('tm-123', null, mockOwner);

      expect(service.getCurrentUserPermission()).toBeNull();
    });

    it('should short-circuit when owner role found in authorization', () => {
      const ownerAuth: Authorization = {
        principal_type: 'user',
        provider: 'google',
        provider_id: 'google-456',
        role: 'owner',
      };

      // Even if there are more authorizations, should stop at owner
      service.setAuthorization('tm-123', [ownerAuth, mockUserAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('owner');
    });
  });

  describe('getCurrentUserPermission()', () => {
    it('should return current permission synchronously', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(service.getCurrentUserPermission()).toBe('writer');
    });

    it('should return null when no authorization is set', () => {
      expect(service.getCurrentUserPermission()).toBeNull();
    });
  });

  describe('canEdit()', () => {
    it('should return true for owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.canEdit()).toBe(true);
    });

    it('should return true for writer', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(service.canEdit()).toBe(true);
    });

    it('should return false for reader', () => {
      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      expect(service.canEdit()).toBe(false);
    });

    it('should return false when no permission', () => {
      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.canEdit()).toBe(false);
    });
  });

  describe('canManagePermissions()', () => {
    it('should return true for owner', () => {
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';

      service.setAuthorization('tm-123', [], mockOwner);

      expect(service.canManagePermissions()).toBe(true);
    });

    it('should return false for writer', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      expect(service.canManagePermissions()).toBe(false);
    });

    it('should return false for reader', () => {
      service.setAuthorization('tm-123', [mockGroupAuthorization], mockOwner);

      expect(service.canManagePermissions()).toBe(false);
    });
  });

  describe('User Profile Changes', () => {
    it('should recalculate permissions when user profile changes', () => {
      service.setAuthorization('tm-123', [mockUserAuthorization], mockOwner);

      // Initial permission
      expect(service.getCurrentUserPermission()).toBe('writer');

      // Change user to owner
      mockAuthService.userIdp = 'google';
      mockAuthService.providerId = 'google-123';
      mockAuthService.userProfile$.next({
        display_name: 'Owner',
        provider_id: 'google-123',
      });

      // Should recalculate and now be owner
      expect(service.getCurrentUserPermission()).toBe('owner');
    });

    it('should not recalculate when no threat model is set', () => {
      mockAuthService.userProfile$.next({
        display_name: 'Test User',
        provider_id: 'google-456',
      });

      // Should not cause errors
      expect(service).toBeTruthy();
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe on destroy', () => {
      service.ngOnDestroy();

      // Should not have active subscriptions to user profile
      expect(mockAuthService.userProfile$.observers.length).toBe(0);
    });

    it('should log debug information on destroy', () => {
      service.ngOnDestroy();

      expect(mockLogger.debugComponent).toHaveBeenCalledWith(
        'ThreatModelAuthorizationService',
        'ThreatModelAuthorizationService destroyed',
      );
    });
  });
});
