// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  PermissionsDialogComponent,
  type PermissionsDialogData,
  type AuthorizationWithSubject,
} from './permissions-dialog.component';
import type { MatDialogRef } from '@angular/material/dialog';
import type { Authorization, User } from '../../models/threat-model.model';
import type { AuthService } from '@app/auth/services/auth.service';
import type { ProviderAdapterService } from '../../services/providers/provider-adapter.service';
import { AuthorizationPrepareService } from '../../services/providers/authorization-prepare.service';
import type { LoggerService } from '@app/core/services/logger.service';
import type { OAuthProviderInfo } from '@app/auth/models/auth.models';
import type {
  PermissionsAutocompleteService,
  AutocompleteSuggestion,
} from '../../services/permissions-autocomplete.service';

describe('PermissionsDialogComponent', () => {
  let component: PermissionsDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockAuthService: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
    getAvailableSAMLProviders: ReturnType<typeof vi.fn>;
    userIdp: string;
  };
  let mockProviderAdapter: {
    getDefaultSubject: ReturnType<typeof vi.fn>;
    getBuiltInProviders: ReturnType<typeof vi.fn>;
    isValidForPrincipalType: ReturnType<typeof vi.fn>;
    transformProviderForApi: ReturnType<typeof vi.fn>;
  };
  let mockAutocompleteService: {
    search: ReturnType<typeof vi.fn>;
  };
  let dialogData: PermissionsDialogData;
  let authorizationPrepare: AuthorizationPrepareService;
  let mockLogger: { warn: ReturnType<typeof vi.fn> };

  const mockOwner: User = {
    principal_type: 'user',
    provider: 'google',
    provider_id: 'owner@test.com',
    email: 'owner@test.com',
    display_name: 'Owner',
  };

  const mockProviders: OAuthProviderInfo[] = [
    { id: 'google', name: 'Google', icon: 'google' } as OAuthProviderInfo,
    { id: 'github', name: 'GitHub', icon: 'github' } as OAuthProviderInfo,
  ];

  // SEM@18b5b056436f5b56f58815b0bb5bfe9b18b41346: build a test Authorization fixture with optional field overrides (pure)
  function createPermission(overrides: Partial<Authorization> = {}): Authorization {
    return {
      principal_type: 'user',
      provider: 'google',
      provider_id: 'user@test.com',
      email: 'user@test.com',
      role: 'reader',
      ...overrides,
    };
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthService = {
      getAvailableProviders: vi.fn().mockReturnValue(of(mockProviders)),
      getAvailableSAMLProviders: vi.fn().mockReturnValue(of([])),
      userIdp: 'tmi',
    };
    mockProviderAdapter = {
      getDefaultSubject: vi.fn().mockReturnValue(null),
      getBuiltInProviders: vi
        .fn()
        .mockReturnValue([
          { id: 'tmi', name: 'TMI', icon: '', auth_url: '', redirect_uri: '', client_id: '' },
        ]),
      isValidForPrincipalType: vi.fn().mockReturnValue(true),
      transformProviderForApi: vi.fn((provider: string) => provider),
    };

    mockAutocompleteService = {
      search: vi.fn().mockReturnValue(of([])),
    };

    dialogData = {
      permissions: [createPermission()],
      owner: { ...mockOwner },
    };

    mockLogger = { warn: vi.fn() };

    // The real prepare service, so the save gate is exercised against the same
    // validation the API submission path uses
    authorizationPrepare = new AuthorizationPrepareService(
      mockProviderAdapter as unknown as ProviderAdapterService,
      { warn: vi.fn() } as unknown as LoggerService,
    );

    component = new PermissionsDialogComponent(
      mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
      dialogData,
      mockAuthService as unknown as AuthService,
      mockProviderAdapter as unknown as ProviderAdapterService,
      mockAutocompleteService as unknown as PermissionsAutocompleteService,
      authorizationPrepare,
      mockLogger as unknown as LoggerService,
    );
  });

  describe('ngOnInit', () => {
    it('should set displayedColumns with actions when not read-only', () => {
      // Mock the table to avoid renderRows error
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.displayedColumns).toContain('actions');
      expect(component.displayedColumns).toEqual([
        'principal_type',
        'provider',
        'subject',
        'role',
        'actions',
      ]);
    });

    it('should set displayedColumns without actions when read-only', () => {
      dialogData.isReadOnly = true;
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.displayedColumns).not.toContain('actions');
    });

    it('should copy permissions data to data source', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.permissionsDataSource.data).toHaveLength(1);
      expect(component.permissionsDataSource.data[0].provider_id).toBe('user@test.com');
    });

    it('should initialize _subject from email or provider_id', () => {
      dialogData.permissions = [
        createPermission({ email: 'a@test.com', provider_id: 'pid' }),
        createPermission({ email: undefined, provider_id: 'fallback-id' }),
        createPermission({ email: '', provider_id: '' }),
      ];
      component = new PermissionsDialogComponent(
        mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
        dialogData,
        mockAuthService as unknown as AuthService,
        mockProviderAdapter as unknown as ProviderAdapterService,
        mockAutocompleteService as unknown as PermissionsAutocompleteService,
        authorizationPrepare,
        mockLogger as unknown as LoggerService,
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const data = component.permissionsDataSource.data as AuthorizationWithSubject[];
      expect(data[0]['_subject']).toBe('a@test.com');
      expect(data[1]['_subject']).toBe('fallback-id');
      expect(data[2]['_subject']).toBe('');
    });
  });

  describe('addPermission', () => {
    it('should add a new permission with reader role (safe default)', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.availableProviders = mockProviders;
      component.ngOnInit();

      component.addPermission();

      const lastPerm =
        component.permissionsDataSource.data[component.permissionsDataSource.data.length - 1];
      expect(lastPerm.role).toBe('reader');
      expect(lastPerm.principal_type).toBe('user');
    });

    it('should use first available provider as default', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.availableProviders = mockProviders;
      component.ngOnInit();

      component.addPermission();

      const lastPerm =
        component.permissionsDataSource.data[component.permissionsDataSource.data.length - 1];
      expect(lastPerm.provider).toBe('google');
    });

    it('should initialize _subject as empty string on new permission', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.availableProviders = mockProviders;
      component.ngOnInit();

      component.addPermission();

      const lastPerm = component.permissionsDataSource.data[
        component.permissionsDataSource.data.length - 1
      ] as AuthorizationWithSubject;
      expect(lastPerm['_subject']).toBe('');
    });

    it('should fallback to google when no providers available', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.availableProviders = [];
      component.ngOnInit();

      component.addPermission();

      const lastPerm =
        component.permissionsDataSource.data[component.permissionsDataSource.data.length - 1];
      // Hardcoded fallback to 'google' — potentially wrong for non-Google deployments
      expect(lastPerm.provider).toBe('google');
    });
  });

  describe('deletePermission', () => {
    it('should remove permission at valid index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      expect(component.permissionsDataSource.data).toHaveLength(1);

      component.deletePermission(0);

      expect(component.permissionsDataSource.data).toHaveLength(0);
    });

    it('should not crash on negative index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.deletePermission(-1)).not.toThrow();
      expect(component.permissionsDataSource.data).toHaveLength(1);
    });

    it('should not crash on out-of-bounds index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.deletePermission(999)).not.toThrow();
      expect(component.permissionsDataSource.data).toHaveLength(1);
    });
  });

  describe('setAsOwner', () => {
    it('should set user permission as owner', () => {
      const onOwnerChange = vi.fn();
      dialogData.onOwnerChange = onOwnerChange;
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.setAsOwner(0);

      expect(component.data.owner.provider_id).toBe('user@test.com');
      expect(onOwnerChange).toHaveBeenCalledWith(
        expect.objectContaining({ provider_id: 'user@test.com' }),
      );
    });

    it('should prevent group from becoming owner', () => {
      dialogData.permissions = [createPermission({ principal_type: 'group' })];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const originalOwner = { ...component.data.owner };
      component.setAsOwner(0);

      // Owner should NOT change
      expect(component.data.owner.provider_id).toBe(originalOwner.provider_id);
      expect(mockLogger.warn).toHaveBeenCalledWith('Only users can be set as owner');
    });

    it('should not crash on negative index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.setAsOwner(-1)).not.toThrow();
    });

    it('should not crash on out-of-bounds index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.setAsOwner(999)).not.toThrow();
    });

    it('should not call onOwnerChange if callback is not provided', () => {
      dialogData.onOwnerChange = undefined;
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.setAsOwner(0)).not.toThrow();
    });
    // #895: the typed subject lives only in _subject until save parses it, so an
    // unsaved row promoted to owner used to yield provider_id: '' and a 400 that
    // discarded every other permission edit in the dialog.
    it('should take the owner from the subject typed into an unsaved row', () => {
      const onOwnerChange = vi.fn();
      dialogData.onOwnerChange = onOwnerChange;
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      (component.permissionsDataSource.data[1] as AuthorizationWithSubject)._subject =
        'test-reviewer';

      component.setAsOwner(1);

      expect(component.data.owner).toEqual(
        expect.objectContaining({
          principal_type: 'user',
          provider_id: 'test-reviewer',
          display_name: 'test-reviewer',
          email: '',
        }),
      );
      expect(onOwnerChange).toHaveBeenCalledWith(
        expect.objectContaining({ provider_id: 'test-reviewer' }),
      );
      expect(component.rowIssue(1)).toBeUndefined();
    });

    // An email subject parses to email with an empty provider_id, which the API accepts on an
    // authorization entry but not on an owner (Principal.provider_id is required, minLength 1).
    it('should give an email subject a non-empty provider_id as well', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      (component.permissionsDataSource.data[1] as AuthorizationWithSubject)._subject =
        'new@test.com';

      component.setAsOwner(1);

      expect(component.data.owner).toEqual(
        expect.objectContaining({
          provider_id: 'new@test.com',
          email: 'new@test.com',
          display_name: 'new@test.com',
        }),
      );
    });

    // A saved row's provider_id is the identity the server assigned (an OAuth sub, not the
    // email the subject field shows), so promoting it must not rewrite it from the subject.
    it('should keep the persisted identity when promoting a saved row', () => {
      dialogData.permissions = [
        createPermission({ provider_id: 'oauth-sub-11223344', email: 'saved@test.com' }),
      ];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.setAsOwner(0);

      expect(component.data.owner).toEqual(
        expect.objectContaining({
          provider_id: 'oauth-sub-11223344',
          email: 'saved@test.com',
        }),
      );
    });

    // The save path submits what the user typed, so promoting must follow it: preferring
    // the row's persisted identity here would transfer ownership to the principal the row
    // used to name, silently and with the new name still on screen.
    it('should follow the retyped subject on a saved row rather than its stale identity', () => {
      dialogData.permissions = [
        createPermission({ provider_id: 'oauth-sub-alice', email: 'alice@test.com' }),
      ];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      (component.permissionsDataSource.data[0] as AuthorizationWithSubject)._subject =
        'bob@test.com';

      component.setAsOwner(0);

      expect(component.data.owner).toEqual(
        expect.objectContaining({
          provider_id: 'bob@test.com',
          email: 'bob@test.com',
        }),
      );
    });

    it('should block promoting a saved row whose subject has been cleared', () => {
      dialogData.permissions = [
        createPermission({ provider_id: 'oauth-sub-alice', email: 'alice@test.com' }),
      ];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      (component.permissionsDataSource.data[0] as AuthorizationWithSubject)._subject = '';
      const originalOwner = { ...component.data.owner };

      component.setAsOwner(0);

      expect(component.data.owner.provider_id).toBe(originalOwner.provider_id);
      expect(component.rowIssue(0)).toBe('missing_subject');
    });

    it('should block promoting a row with no subject and flag it instead', () => {
      const onOwnerChange = vi.fn();
      dialogData.onOwnerChange = onOwnerChange;
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      const originalOwner = { ...component.data.owner };

      component.setAsOwner(1);

      expect(component.data.owner.provider_id).toBe(originalOwner.provider_id);
      expect(onOwnerChange).not.toHaveBeenCalled();
      expect(component.rowIssue(1)).toBe('missing_subject');
      expect(component.validationIssueKeys()).toEqual(['threatModels.permissionsSubjectRequired']);
    });

    it('should treat a whitespace-only subject as no subject', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      (component.permissionsDataSource.data[1] as AuthorizationWithSubject)._subject = '   ';
      const originalOwner = { ...component.data.owner };

      component.setAsOwner(1);

      expect(component.data.owner.provider_id).toBe(originalOwner.provider_id);
      expect(component.rowIssue(1)).toBe('missing_subject');
    });
  });

  describe('save validation gate', () => {
    it('should not close the dialog when a row has no subject', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(component.rowIssue(1)).toBe('missing_subject');
      expect(component.rowIssue(0)).toBeUndefined();
      expect(component.validationIssueKeys()).toEqual(['threatModels.permissionsSubjectRequired']);
    });

    it('should report the row whose provider rejects its principal type', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(false);

      component.save();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(component.validationIssueKeys()).toEqual([
        'threatModels.permissionsProviderPrincipalUnsupported',
      ]);
    });

    it('should clear a row issue once that row is edited', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      component.save();
      expect(component.rowIssue(1)).toBe('missing_subject');

      (component.permissionsDataSource.data[1] as AuthorizationWithSubject)['_subject'] =
        'new@test.com';
      component.onSubjectInput(1, {
        target: { value: 'new@test.com' },
      } as unknown as Event);

      expect(component.rowIssue(1)).toBeUndefined();
    });

    it('should close the dialog once the incomplete row is filled in', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      component.save();
      expect(mockDialogRef.close).not.toHaveBeenCalled();

      (component.permissionsDataSource.data[1] as AuthorizationWithSubject)['_subject'] =
        'new@test.com';
      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledTimes(1);
      expect(component.validationIssues.size).toBe(0);
    });

    it('should keep outstanding issues visible when another row is added', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      component.save();
      expect(component.rowIssue(1)).toBe('missing_subject');

      // The new row is appended, so index 1 still refers to the same offending row
      component.addPermission();

      expect(component.rowIssue(1)).toBe('missing_subject');
    });

    it('should re-index outstanding issues when an earlier row is deleted', () => {
      dialogData.permissions = [createPermission(), createPermission()];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      component.save();
      expect(component.rowIssue(2)).toBe('missing_subject');

      component.deletePermission(0);

      expect(component.rowIssue(1)).toBe('missing_subject');
      expect(component.rowIssue(2)).toBeUndefined();
    });

    it('should drop the recorded issue when the offending row itself is deleted', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();
      component.addPermission();
      component.save();
      expect(component.validationIssues.size).toBe(1);

      component.deletePermission(1);

      expect(component.validationIssues.size).toBe(0);
    });
  });

  describe('save', () => {
    it('should close dialog with permissions and owner', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        permissions: expect.any(Array),
        owner: dialogData.owner,
      });
    });

    it('should populate _subject from email when no cached subject', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.save();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.permissions[0]._subject).toBe('user@test.com');
    });

    it('should use cached _subject when available', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      // Simulate a cached _subject
      (component.permissionsDataSource.data[0] as AuthorizationWithSubject)['_subject'] =
        'cached@test.com';

      component.save();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.permissions[0]._subject).toBe('cached@test.com');
    });

    it('should use provider_id when email is missing and no cached subject', () => {
      dialogData.permissions = [
        createPermission({ email: undefined, provider_id: 'provider-user-id' }),
      ];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.save();

      const result = mockDialogRef.close.mock.calls[0][0];
      expect(result.permissions[0]._subject).toBe('provider-user-id');
    });

    it('should refuse to submit when all subject fields are falsy', () => {
      dialogData.permissions = [createPermission({ email: '', provider_id: '' })];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.save();

      // The API rejects an entry with neither provider_id nor email, taking every
      // other permission edit in the dialog down with it
      expect(mockDialogRef.close).not.toHaveBeenCalled();
      expect(component.rowIssue(0)).toBe('missing_subject');
    });
  });

  describe('getSubjectValue', () => {
    it('should return cached _subject when set', () => {
      const auth = createPermission();
      (auth as AuthorizationWithSubject)['_subject'] = 'cached';

      expect(component.getSubjectValue(auth)).toBe('cached');
    });

    it('should return email when no cached subject', () => {
      const auth = createPermission({ email: 'user@example.com' });

      expect(component.getSubjectValue(auth)).toBe('user@example.com');
    });

    it('should return provider_id when no cached subject and no email', () => {
      const auth = createPermission({ email: undefined, provider_id: 'provider-id' });

      expect(component.getSubjectValue(auth)).toBe('provider-id');
    });
  });

  describe('updatePermissionRole', () => {
    it('should update role at valid index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.updatePermissionRole(0, { value: 'writer' });

      expect(component.permissionsDataSource.data[0].role).toBe('writer');
    });

    it('should not crash on out-of-bounds index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(() => component.updatePermissionRole(999, { value: 'writer' })).not.toThrow();
    });
  });

  describe('isProviderAvailable', () => {
    it('should return true for available provider', () => {
      component.availableProviders = mockProviders;
      expect(component.isProviderAvailable('google')).toBe(true);
    });

    it('should return false for unknown provider', () => {
      component.availableProviders = mockProviders;
      expect(component.isProviderAvailable('unknown')).toBe(false);
    });

    it('should return false when no providers loaded', () => {
      component.availableProviders = [];
      expect(component.isProviderAvailable('google')).toBe(false);
    });
  });

  describe('isNewPermission', () => {
    it('should identify newly added permission', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.addPermission();
      const newPerm = component.permissionsDataSource.data[1];

      expect(component.isNewPermission(newPerm)).toBe(true);
    });

    it('should identify existing permission', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.isNewPermission(component.permissionsDataSource.data[0])).toBe(false);
    });
  });

  describe('close', () => {
    it('should close dialog without result', () => {
      component.close();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('loadProviders (built-in providers)', () => {
    it('should include TMI in available providers after loading', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.availableProviders).toHaveLength(3); // 2 OAuth + 1 TMI
      expect(component.availableProviders.some(p => p.id === 'tmi')).toBe(true);
    });

    it('should deduplicate when server returns a provider matching a built-in', () => {
      const serverProviders: OAuthProviderInfo[] = [
        { id: 'google', name: 'Google', icon: 'google' } as OAuthProviderInfo,
        { id: 'tmi', name: 'TMI Provider', icon: '' } as OAuthProviderInfo,
      ];
      mockAuthService.getAvailableProviders.mockReturnValue(of(serverProviders));
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const tmiEntries = component.availableProviders.filter(p => p.id === 'tmi');
      expect(tmiEntries).toHaveLength(1);
      expect(tmiEntries[0].name).toBe('TMI'); // built-in version wins
      expect(component.availableProviders).toHaveLength(2); // google + tmi
    });

    it('should include built-in providers even when OAuth loading fails', () => {
      mockAuthService.getAvailableProviders.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.availableProviders).toHaveLength(1);
      expect(component.availableProviders[0].id).toBe('tmi');
    });

    it('should merge SAML providers into the available provider list', () => {
      mockAuthService.getAvailableSAMLProviders.mockReturnValue(
        of([{ id: 'saml_okta', name: 'Okta', icon: '' }]),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.availableProviders.map(p => p.id)).toContain('saml_okta');
    });

    it('should still load OAuth and built-in providers when SAML loading fails', () => {
      mockAuthService.getAvailableSAMLProviders.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.availableProviders.map(p => p.id)).toContain('tmi');
    });
  });

  describe('isAutocompleteActive', () => {
    it('is active for TMI rows', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.isAutocompleteActive(createPermission({ provider: 'tmi' }))).toBe(true);
    });

    it('is active for rows matching the signed-in user SAML provider', () => {
      mockAuthService.userIdp = 'saml_okta';
      mockAuthService.getAvailableSAMLProviders.mockReturnValue(
        of([{ id: 'saml_okta', name: 'Okta', icon: '' }]),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.isAutocompleteActive(createPermission({ provider: 'saml_okta' }))).toBe(
        true,
      );
    });

    it('is inactive for SAML rows not matching the signed-in user provider', () => {
      mockAuthService.userIdp = 'tmi';
      mockAuthService.getAvailableSAMLProviders.mockReturnValue(
        of([{ id: 'saml_okta', name: 'Okta', icon: '' }]),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.isAutocompleteActive(createPermission({ provider: 'saml_okta' }))).toBe(
        false,
      );
    });

    it('is inactive for other providers', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.isAutocompleteActive(createPermission({ provider: 'google' }))).toBe(false);
    });
  });

  describe('updatePermissionProvider (principal type auto-constraint)', () => {
    it('should not change principal type when TMI is selected (supports both)', () => {
      mockProviderAdapter.isValidForPrincipalType.mockReturnValue(true);
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.permissionsDataSource.data[0].principal_type).toBe('user');

      component.updatePermissionProvider(0, { value: 'tmi' });

      expect(component.permissionsDataSource.data[0].principal_type).toBe('user');
    });

    it('should not change principal type when provider supports it', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.updatePermissionProvider(0, { value: 'google' });

      expect(component.permissionsDataSource.data[0].principal_type).toBe('user');
    });
  });

  describe('autocomplete', () => {
    it('should trigger search on subject input for TMI provider', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      dialogData.permissions = [createPermission({ provider: 'tmi', principal_type: 'user' })];
      component = new PermissionsDialogComponent(
        mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
        dialogData,
        mockAuthService as unknown as AuthService,
        mockProviderAdapter as unknown as ProviderAdapterService,
        mockAutocompleteService as unknown as PermissionsAutocompleteService,
        authorizationPrepare,
        mockLogger as unknown as LoggerService,
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const mockEvent = { target: { value: 'alice' } } as unknown as Event;
      component.onSubjectInput(0, mockEvent);

      // The trigger$ subject should have emitted — verify by checking
      // that after debounce the search would be called
      // (Direct unit test of the method behavior)
      expect(component.autocompleteSuggestions).toEqual([]);
    });

    it('should not trigger search for non-TMI provider', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const mockEvent = { target: { value: 'alice' } } as unknown as Event;
      component.onSubjectInput(0, mockEvent);

      expect(component.autocompleteSuggestions).toEqual([]);
      expect(mockAutocompleteService.search).not.toHaveBeenCalled();
    });

    it('should set _subject on autocomplete selection', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const suggestion: AutocompleteSuggestion = {
        displayLabel: 'Alice Smith (alice@example.com)',
        value: 'alice-pid',
      };
      const mockEvent = {
        option: { value: suggestion },
      } as unknown as import('@angular/material/autocomplete').MatAutocompleteSelectedEvent;

      component.onAutocompleteSelected(0, mockEvent);

      const auth = component.permissionsDataSource.data[0] as AuthorizationWithSubject;
      expect(auth['_subject']).toBe('alice-pid');
    });

    it('should report autocomplete active for TMI provider', () => {
      const auth = createPermission({ provider: 'tmi' });
      expect(component.isAutocompleteActive(auth)).toBe(true);
    });

    it('should report autocomplete inactive for non-TMI provider', () => {
      const auth = createPermission({ provider: 'google' });
      expect(component.isAutocompleteActive(auth)).toBe(false);
    });
  });
});
