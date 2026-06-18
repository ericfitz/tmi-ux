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
import { of } from 'rxjs';

import { UserPickerDialogComponent, UserPickerDialogData } from './user-picker-dialog.component';
import type { AdminUser } from '@app/types/user.types';

describe('UserPickerDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockUserAdminService: { list: ReturnType<typeof vi.fn> };
  let envInjector: EnvironmentInjector;

  const user: AdminUser = {
    internal_uuid: 'uuid-1',
    name: 'Alice',
    email: 'alice@example.com',
  } as AdminUser;

  // SEM@03e5c5f70bd2b59edee41faf9772e5f114bffc49: construct and initialize a UserPickerDialogComponent for testing (pure)
  function build(data: UserPickerDialogData): UserPickerDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new UserPickerDialogComponent(mockDialogRef as never, data, mockUserAdminService as never),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockUserAdminService = { list: vi.fn(() => of({ users: [user] })) };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create', () => {
    expect(build({ title: 'Pick a user' })).toBeTruthy();
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
