// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import type { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { of, throwError } from 'rxjs';

import {
  PickedUser,
  UserPickerDialogComponent,
  UserPickerDialogData,
} from './user-picker-dialog.component';

describe('UserPickerDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockAuthService: {
    isAdmin: boolean;
    userIdp: string;
    getAvailableSAMLProviders: ReturnType<typeof vi.fn>;
  };
  let mockUserAdminService: { list: ReturnType<typeof vi.fn> };
  let mockSamlUserService: { list: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  const user: PickedUser = {
    internal_uuid: 'uuid-1',
    name: 'Alice',
    email: 'alice@example.com',
    provider: 'tmi',
    provider_user_id: 'alice-pid',
  };

  const samlUser = {
    internal_uuid: 'saml-uuid-1',
    name: 'Carol',
    email: 'carol@corp.example.com',
  };

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: construct and initialize a UserPickerDialogComponent for testing (pure)
  function build(data: UserPickerDialogData): UserPickerDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new UserPickerDialogComponent(
          mockDialogRef as never,
          data,
          mockAuthService as never,
          mockUserAdminService as never,
          mockSamlUserService as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: invoke the component's private searchUsers with its resolved SAML idp and capture emitted results (pure)
  function search(component: UserPickerDialogComponent, term: string): PickedUser[] {
    let results: PickedUser[] = [];
    const internals = component as unknown as {
      _samlIdp$: { value: string | null };
      searchUsers(term: string, samlIdp: string | null): { subscribe(cb: unknown): void };
    };
    internals.searchUsers(term, internals._samlIdp$.value).subscribe((r: PickedUser[]) => {
      results = r;
    });
    return results;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockAuthService = {
      isAdmin: true,
      userIdp: 'tmi',
      getAvailableSAMLProviders: vi.fn(() => of([])),
    };
    mockUserAdminService = { list: vi.fn(() => of({ users: [user], total: 1 })) };
    mockSamlUserService = {
      list: vi.fn(() => of({ idp: 'saml_okta', users: [samlUser], total: 1 })),
    };
    envInjector = createEnvironmentInjector([], {
      get: () => ({ onDestroy: () => () => {} }),
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create', () => {
    expect(build({ title: 'Pick a user' })).toBeTruthy();
  });

  describe('searchUsers', () => {
    it('searches the admin user list for admins', () => {
      const component = build({ title: 'Pick' });

      const results = search(component, 'ali');

      expect(mockUserAdminService.list).toHaveBeenCalledWith({ email: 'ali', limit: 10 });
      expect(mockSamlUserService.list).not.toHaveBeenCalled();
      expect(results).toEqual([user]);
    });

    it('returns empty results without API calls for non-admin non-SAML users', () => {
      mockAuthService.isAdmin = false;

      const component = build({ title: 'Pick' });
      const results = search(component, 'ali');

      expect(mockUserAdminService.list).not.toHaveBeenCalled();
      expect(mockSamlUserService.list).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('searches the SAML directory for non-admin SAML users, stamping the provider', () => {
      mockAuthService.isAdmin = false;
      mockAuthService.userIdp = 'saml_okta';
      mockAuthService.getAvailableSAMLProviders = vi.fn(() => of([{ id: 'saml_okta' }]));

      const component = build({ title: 'Pick' });
      const results = search(component, 'car');

      expect(mockSamlUserService.list).toHaveBeenCalledWith('saml_okta', {
        email: 'car',
        limit: 10,
      });
      expect(mockUserAdminService.list).not.toHaveBeenCalled();
      expect(results).toEqual([{ ...samlUser, provider: 'saml_okta' }]);
    });

    it('does not use the SAML directory when the user provider is not a SAML provider', () => {
      mockAuthService.isAdmin = false;
      mockAuthService.userIdp = 'google';
      mockAuthService.getAvailableSAMLProviders = vi.fn(() => of([{ id: 'saml_okta' }]));

      const component = build({ title: 'Pick' });
      const results = search(component, 'car');

      expect(mockSamlUserService.list).not.toHaveBeenCalled();
      expect(results).toEqual([]);
    });

    it('merges admin and SAML results, deduplicating by internal_uuid', () => {
      mockAuthService.isAdmin = true;
      mockAuthService.userIdp = 'saml_okta';
      mockAuthService.getAvailableSAMLProviders = vi.fn(() => of([{ id: 'saml_okta' }]));
      const duplicate = { internal_uuid: 'uuid-1', name: 'Alice', email: 'alice@example.com' };
      mockSamlUserService.list = vi.fn(() =>
        of({ idp: 'saml_okta', users: [duplicate, samlUser], total: 2 }),
      );

      const component = build({ title: 'Pick' });
      const results = search(component, 'al');

      expect(results.map(u => u.internal_uuid)).toEqual(['uuid-1', 'saml-uuid-1']);
    });

    it('filters out the excluded user id', () => {
      const component = build({ title: 'Pick', excludeUserId: 'uuid-1' });

      const results = search(component, 'ali');

      expect(results).toEqual([]);
    });

    it('returns SAML results when the admin lookup errors', () => {
      mockAuthService.isAdmin = true;
      mockAuthService.userIdp = 'saml_okta';
      mockAuthService.getAvailableSAMLProviders = vi.fn(() => of([{ id: 'saml_okta' }]));
      mockUserAdminService.list = vi.fn(() => throwError(() => new Error('forbidden')));

      const component = build({ title: 'Pick' });
      const results = search(component, 'car');

      expect(results).toEqual([{ ...samlUser, provider: 'saml_okta' }]);
    });
  });

  describe('displayUser', () => {
    it('formats a user as "name (email)"', () => {
      const component = build({ title: 'Pick' });

      expect(component.displayUser(user)).toBe('Alice (alice@example.com)');
    });

    it('returns an empty string for a null user', () => {
      const component = build({ title: 'Pick' });

      expect(component.displayUser(null)).toBe('');
    });
  });

  describe('onUserSelected', () => {
    it('stores the selected user from the autocomplete event', () => {
      const component = build({ title: 'Pick' });
      const event = { option: { value: user } } as MatAutocompleteSelectedEvent;

      component.onUserSelected(event);

      expect(component.selectedUser).toBe(user);
    });
  });

  describe('onClearUser', () => {
    it('resets the selected user, role and search field', () => {
      const component = build({ title: 'Pick' });
      component.selectedUser = user;
      component.selectedRole = 'reader';
      component.customRole = 'auditor';

      component.onClearUser();

      expect(component.selectedUser).toBeNull();
      expect(component.selectedRole).toBe('');
      expect(component.customRole).toBe('');
      expect(component.userSearchControl.value).toBe('');
    });
  });

  describe('onConfirm', () => {
    it('does nothing when no user is selected', () => {
      const component = build({ title: 'Pick' });

      component.onConfirm();

      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('closes with the bare user when no role selector is shown', () => {
      const component = build({ title: 'Pick' });
      component.selectedUser = user;

      component.onConfirm();

      expect(mockDialogRef.close).toHaveBeenCalledWith(user);
    });

    it('closes with user and role when the role selector is shown', () => {
      const component = build({ title: 'Pick', showRoleSelector: true, roles: ['reader'] });
      component.selectedUser = user;
      component.selectedRole = 'reader';

      component.onConfirm();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        user,
        role: 'reader',
        customRole: undefined,
      });
    });

    it('includes the custom role when one is entered', () => {
      const component = build({ title: 'Pick', showRoleSelector: true, roles: ['other'] });
      component.selectedUser = user;
      component.selectedRole = 'other';
      component.customRole = 'auditor';

      component.onConfirm();

      expect(mockDialogRef.close).toHaveBeenCalledWith({
        user,
        role: 'other',
        customRole: 'auditor',
      });
    });
  });

  describe('onCancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ title: 'Pick' });

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
