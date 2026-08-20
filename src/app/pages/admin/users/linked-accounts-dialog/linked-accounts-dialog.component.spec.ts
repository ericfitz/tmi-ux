// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { of, throwError } from 'rxjs';
import type { TranslocoService } from '@jsverse/transloco';
import type { MatSnackBar } from '@angular/material/snack-bar';

import {
  LinkedAccountsDialogComponent,
  LinkedAccountsDialogData,
} from './linked-accounts-dialog.component';
import type { AdminUserIdentitiesResponse } from '@app/types/user.types';

describe('LinkedAccountsDialogComponent', () => {
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockUserAdminService: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let mockSnackBar: MatSnackBar;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  const data: LinkedAccountsDialogData = { internalUuid: 'uuid-1', userName: 'Alice' };

  const identities: AdminUserIdentitiesResponse = {
    primary: { provider: 'google', email: 'alice@example.com', name: 'Alice' },
    linked: [
      {
        id: 'ident-1',
        provider: 'github',
        provider_user_id: 'gh_123',
        email: 'alice@users.noreply.github.com',
        name: 'Alice',
        linked_at: '2024-02-01T00:00:00Z',
      },
      {
        id: 'ident-2',
        provider: 'gitlab',
        provider_user_id: 'gl_456',
        linked_at: '2024-03-01T00:00:00Z',
      },
    ],
  };

  function build(): LinkedAccountsDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new LinkedAccountsDialogComponent(
          data,
          mockDialog as never,
          mockUserAdminService as never,
          mockTransloco,
          mockSnackBar,
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialog = { open: vi.fn() };
    mockUserAdminService = {
      listUserIdentities: vi.fn(() => of(identities)),
      unlinkUserIdentity: vi.fn(() => of(undefined)),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
    mockSnackBar = { open: vi.fn() } as unknown as MatSnackBar;
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

  describe('initialization', () => {
    it('loads identities on init and synthesizes the primary row first', () => {
      const component = build();

      expect(mockUserAdminService['listUserIdentities']).toHaveBeenCalledWith('uuid-1');
      expect(component.rows()).toHaveLength(3);
      expect(component.rows()[0]).toEqual({
        id: 'primary',
        provider: 'google',
        label: 'alice@example.com',
        linkedAt: null,
        isPrimary: true,
      });
      expect(component.loading()).toBe(false);
    });

    it('labels linked rows by email, falling back to name then provider_user_id', () => {
      const component = build();

      expect(component.rows()[1].label).toBe('alice@users.noreply.github.com');
      expect(component.rows()[2].label).toBe('gl_456');
    });

    it('handles a response with no linked identities', () => {
      mockUserAdminService['listUserIdentities'].mockReturnValue(
        of({ primary: identities.primary }),
      );
      const component = build();

      expect(component.rows()).toHaveLength(1);
      expect(component.rows()[0].isPrimary).toBe(true);
    });

    it('records an error message when loading fails', () => {
      mockUserAdminService['listUserIdentities'].mockReturnValue(
        throwError(() => new Error('network')),
      );
      const component = build();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.errorMessage()).toBeTruthy();
      expect(component.loading()).toBe(false);
    });
  });

  describe('onUnlink', () => {
    it('unlinks and reloads when the confirm dialog returns true', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      const component = build();
      mockUserAdminService['listUserIdentities'].mockClear();

      component.onUnlink(component.rows()[1]);

      expect(mockUserAdminService['unlinkUserIdentity']).toHaveBeenCalledWith('uuid-1', 'ident-1');
      expect(mockSnackBar.open).toHaveBeenCalled();
      expect(mockUserAdminService['listUserIdentities']).toHaveBeenCalled();
    });

    it('does not unlink when the confirm dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(false) });
      const component = build();

      component.onUnlink(component.rows()[1]);

      expect(mockUserAdminService['unlinkUserIdentity']).not.toHaveBeenCalled();
    });

    it('records an error when unlinking fails', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(true) });
      mockUserAdminService['unlinkUserIdentity'].mockReturnValue(
        throwError(() => new Error('boom')),
      );
      const component = build();

      component.onUnlink(component.rows()[1]);

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.errorMessage()).toBeTruthy();
    });
  });
});
