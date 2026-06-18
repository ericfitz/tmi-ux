// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';

import { AddQuotaDialogComponent } from './add-quota-dialog.component';
import type { AdminUser } from '@app/types/user.types';

describe('AddQuotaDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };
  let mockQuotaService: Record<string, ReturnType<typeof vi.fn>>;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  const user: AdminUser = {
    internal_uuid: 'uuid-1',
    email: 'admin@example.com',
  } as AdminUser;

  // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: build a bare AddQuotaDialogComponent instance for testing (pure)
  function build(): AddQuotaDialogComponent {
    return runInInjectionContext(
      envInjector,
      () =>
        new AddQuotaDialogComponent(
          mockDialogRef as never,
          new FormBuilder(),
          mockQuotaService as never,
          mockLogger as never,
        ),
    );
  }

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
    mockQuotaService = {
      listUsers: vi.fn(() => of({ users: [user] })),
      updateUserAPIQuota: vi.fn(() => of({})),
      updateWebhookQuota: vi.fn(() => of({})),
    };
    mockLogger = {
      debug: vi.fn(),
      debugComponent: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    envInjector = createEnvironmentInjector([], {
      get: () => null,
    } as unknown as EnvironmentInjector);
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create with default quota values', () => {
    const component = build();

    expect(component).toBeTruthy();
    expect(component.quotaForm.get('max_requests_per_minute')?.value).toBeGreaterThan(0);
    expect(component.quotaForm.get('max_subscriptions')?.value).toBeGreaterThan(0);
  });

  describe('quota form validation', () => {
    it('is invalid when a required quota is below 1', () => {
      const component = build();
      component.quotaForm.patchValue({ max_requests_per_minute: 0 });

      expect(component.quotaForm.get('max_requests_per_minute')?.hasError('min')).toBe(true);
    });
  });

  describe('searchUsers', () => {
    it('clears results for a search shorter than 2 characters', () => {
      const component = build();
      component.filteredUsers = [user];

      component.searchUsers('a');

      expect(component.filteredUsers).toEqual([]);
      expect(mockQuotaService['listUsers']).not.toHaveBeenCalled();
    });

    it('queries the quota service and stores the results', () => {
      const component = build();

      component.searchUsers('admin');

      expect(mockQuotaService['listUsers']).toHaveBeenCalledWith({ email: 'admin', limit: 20 });
      expect(component.filteredUsers).toEqual([user]);
      expect(component.searchingUsers).toBe(false);
    });

    it('clears the searching flag and logs on error', () => {
      mockQuotaService['listUsers'].mockReturnValue(throwError(() => new Error('network')));
      const component = build();

      component.searchUsers('admin');

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.searchingUsers).toBe(false);
    });
  });

  describe('onSelectUser / onClearUser', () => {
    it('selects a user and fills the search field', () => {
      const component = build();

      component.onSelectUser(user);

      expect(component.selectedUser).toBe(user);
      expect(component.userSearchForm.get('searchText')?.value).toBe('admin@example.com');
      expect(component.filteredUsers).toEqual([]);
    });

    it('clears the selected user', () => {
      const component = build();
      component.onSelectUser(user);

      component.onClearUser();

      expect(component.selectedUser).toBeNull();
      expect(component.userSearchForm.get('searchText')?.value).toBe('');
    });
  });

  describe('onSave', () => {
    it('does nothing when no user is selected', () => {
      const component = build();

      component.onSave();

      expect(mockQuotaService['updateUserAPIQuota']).not.toHaveBeenCalled();
    });

    it('creates both quotas and closes the dialog on success', () => {
      const component = build();
      component.onSelectUser(user);

      component.onSave();

      expect(mockQuotaService['updateUserAPIQuota']).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ max_requests_per_minute: expect.any(Number) }),
      );
      expect(mockQuotaService['updateWebhookQuota']).toHaveBeenCalledWith(
        'uuid-1',
        expect.objectContaining({ max_subscriptions: expect.any(Number) }),
      );
      expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    });

    it('does not close the dialog when the API quota update fails', () => {
      mockQuotaService['updateUserAPIQuota'].mockReturnValue(throwError(() => new Error('boom')));
      const component = build();
      component.onSelectUser(user);

      component.onSave();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });

    it('does not close the dialog when the webhook quota update fails', () => {
      // API quota succeeds, the chained webhook quota update fails.
      mockQuotaService['updateWebhookQuota'].mockReturnValue(throwError(() => new Error('boom')));
      const component = build();
      component.onSelectUser(user);

      component.onSave();

      expect(mockQuotaService['updateUserAPIQuota']).toHaveBeenCalled();
      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.saving).toBe(false);
      expect(mockDialogRef.close).not.toHaveBeenCalled();
    });
  });

  describe('onCancel', () => {
    it('closes the dialog', () => {
      const component = build();

      component.onCancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });
});
