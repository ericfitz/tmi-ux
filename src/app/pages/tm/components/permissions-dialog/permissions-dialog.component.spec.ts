// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import {
  PermissionsDialogComponent,
  type PermissionsDialogData,
} from './permissions-dialog.component';
import type { MatDialogRef } from '@angular/material/dialog';
import type { Authorization, User } from '../../models/threat-model.model';
import type { AuthService } from '@app/auth/services/auth.service';
import type { ProviderAdapterService } from '../../services/providers/provider-adapter.service';
import type { OAuthProviderInfo } from '@app/auth/models/auth.models';

describe('PermissionsDialogComponent', () => {
  let component: PermissionsDialogComponent;
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockAuthService: {
    getAvailableProviders: ReturnType<typeof vi.fn>;
  };
  let mockProviderAdapter: {
    getDefaultSubject: ReturnType<typeof vi.fn>;
    getBuiltInProviders: ReturnType<typeof vi.fn>;
    isValidForPrincipalType: ReturnType<typeof vi.fn>;
  };
  let dialogData: PermissionsDialogData;

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

  function createPermission(overrides: Partial<Authorization> = {}): Authorization {
    return {
      principal_type: 'user',
      provider: 'google',
      provider_id: 'user@test.com',
      email: 'user@test.com',
      role: 'reader',
      ...overrides,
    } as Authorization;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthService = {
      getAvailableProviders: vi.fn().mockReturnValue(of(mockProviders)),
    };
    mockProviderAdapter = {
      getDefaultSubject: vi.fn().mockReturnValue(null),
      getBuiltInProviders: vi
        .fn()
        .mockReturnValue([
          { id: 'tmi', name: 'TMI', icon: '', auth_url: '', redirect_uri: '', client_id: '' },
        ]),
      isValidForPrincipalType: vi.fn().mockReturnValue(true),
    };

    dialogData = {
      permissions: [createPermission()],
      owner: { ...mockOwner },
    };

    component = new PermissionsDialogComponent(
      mockDialogRef as unknown as MatDialogRef<PermissionsDialogComponent>,
      dialogData,
      mockAuthService as unknown as AuthService,
      mockProviderAdapter as unknown as ProviderAdapterService,
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
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      dialogData.permissions = [createPermission({ principal_type: 'group' })];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const originalOwner = { ...component.data.owner };
      component.setAsOwner(0);

      // Owner should NOT change
      expect(component.data.owner.provider_id).toBe(originalOwner.provider_id);
      expect(consoleSpy).toHaveBeenCalledWith('Only users can be set as owner');

      consoleSpy.mockRestore();
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
      (component.permissionsDataSource.data[0] as Record<string, unknown>)._subject =
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

    it('should handle empty string when all subject fields are falsy', () => {
      dialogData.permissions = [createPermission({ email: '', provider_id: '' })];
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.save();

      const result = mockDialogRef.close.mock.calls[0][0];
      // '' || '' || '' evaluates to ''
      expect(result.permissions[0]._subject).toBe('');
    });
  });

  describe('getSubjectValue', () => {
    it('should return cached _subject when set', () => {
      const auth = createPermission();
      (auth as Record<string, unknown>)._subject = 'cached';

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

  describe('updatePermissionSubject', () => {
    it('should trim whitespace from subject input', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const event = { target: { value: '  user@test.com  ' } } as unknown as Event;
      component.updatePermissionSubject(0, event);

      const auth = component.permissionsDataSource.data[0] as Record<string, unknown>;
      expect(auth._subject).toBe('user@test.com');
    });

    it('should not crash on out-of-bounds index', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      const event = { target: { value: 'test' } } as unknown as Event;
      expect(() => component.updatePermissionSubject(999, event)).not.toThrow();
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

    it('should include built-in providers even when OAuth loading fails', () => {
      mockAuthService.getAvailableProviders.mockReturnValue(
        throwError(() => new Error('API error')),
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.availableProviders).toHaveLength(1);
      expect(component.availableProviders[0].id).toBe('tmi');
    });
  });

  describe('updatePermissionProvider (principal type auto-constraint)', () => {
    it('should auto-constrain principal type to group when TMI is selected', () => {
      mockProviderAdapter.isValidForPrincipalType.mockImplementation(
        (provider: string, type: string) => {
          if (provider === 'tmi') return type === 'group';
          return true;
        },
      );
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      expect(component.permissionsDataSource.data[0].principal_type).toBe('user');

      component.updatePermissionProvider(0, { value: 'tmi' });

      expect(component.permissionsDataSource.data[0].principal_type).toBe('group');
    });

    it('should not change principal type when provider supports it', () => {
      component.permissionsTable = { renderRows: vi.fn() } as never;
      component.ngOnInit();

      component.updatePermissionProvider(0, { value: 'google' });

      expect(component.permissionsDataSource.data[0].principal_type).toBe('user');
    });
  });
});
