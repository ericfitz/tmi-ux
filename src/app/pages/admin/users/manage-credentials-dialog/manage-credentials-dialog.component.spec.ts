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

import {
  ManageCredentialsDialogComponent,
  ManageCredentialsDialogData,
} from './manage-credentials-dialog.component';
import type { ClientCredentialInfo } from '@app/types/client-credential.types';

describe('ManageCredentialsDialogComponent', () => {
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockUserAdminService: Record<string, ReturnType<typeof vi.fn>>;
  let mockTransloco: TranslocoService;
  let mockLogger: Record<string, ReturnType<typeof vi.fn>>;
  let envInjector: EnvironmentInjector;

  const data: ManageCredentialsDialogData = { internalUuid: 'uuid-1', userName: 'Bot' };

  const credentials: ClientCredentialInfo[] = [
    { id: 'cred-1', name: 'CI Key', client_id: 'client-1', created_at: '2024-01-01' },
    { id: 'cred-2', name: 'Deploy Key', client_id: 'client-2', created_at: '2024-01-02' },
  ] as ClientCredentialInfo[];

  // SEM@dbadf722798f788abc017ecdcf6998ca55d12ed5: build a ManageCredentialsDialogComponent with mocked dependencies for testing (pure)
  function build(): ManageCredentialsDialogComponent {
    const component = runInInjectionContext(
      envInjector,
      () =>
        new ManageCredentialsDialogComponent(
          data,
          mockDialog as never,
          mockUserAdminService as never,
          mockTransloco,
          mockLogger as never,
        ),
    );
    component.ngOnInit();
    return component;
  }

  beforeEach(() => {
    mockDialog = { open: vi.fn() };
    mockUserAdminService = {
      listUserCredentials: vi.fn(() => of({ credentials })),
      createUserCredential: vi.fn(() => of({ client_id: 'c', client_secret: 's' })),
      deleteUserCredential: vi.fn(() => of(undefined)),
    };
    mockTransloco = { translate: vi.fn((key: string) => key) } as unknown as TranslocoService;
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
    vi.unstubAllGlobals();
  });

  describe('initialization', () => {
    it('loads the user credentials on init', () => {
      const component = build();

      expect(mockUserAdminService['listUserCredentials']).toHaveBeenCalledWith('uuid-1');
      expect(component.credentials).toEqual(credentials);
      expect(component.loading).toBe(false);
    });

    it('records an error message when loading fails', () => {
      mockUserAdminService['listUserCredentials'].mockReturnValue(
        throwError(() => new Error('network')),
      );
      const component = build();

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.errorMessage).toBeTruthy();
      expect(component.loading).toBe(false);
    });
  });

  describe('onAddCredential', () => {
    it('does not create a credential when the create dialog is dismissed', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(undefined) });
      const component = build();

      component.onAddCredential();

      expect(mockUserAdminService['createUserCredential']).not.toHaveBeenCalled();
    });

    it('creates a credential and shows the secret dialog when the form is submitted', () => {
      mockDialog.open
        .mockReturnValueOnce({ afterClosed: () => of({ name: 'New Key' }) }) // create dialog
        .mockReturnValueOnce({ afterClosed: () => of(undefined) }); // secret dialog
      const component = build();
      mockUserAdminService['listUserCredentials'].mockClear();

      component.onAddCredential();

      expect(mockUserAdminService['createUserCredential']).toHaveBeenCalledWith('uuid-1', {
        name: 'New Key',
      });
      // The secret dialog is opened and the list is refreshed.
      expect(mockDialog.open).toHaveBeenCalledTimes(2);
      expect(mockUserAdminService['listUserCredentials']).toHaveBeenCalled();
    });
  });

  describe('onDeleteCredential', () => {
    it('deletes the credential and reloads when the user confirms', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      const component = build();
      mockUserAdminService['listUserCredentials'].mockClear();

      component.onDeleteCredential(credentials[0]);

      expect(mockUserAdminService['deleteUserCredential']).toHaveBeenCalledWith('uuid-1', 'cred-1');
      expect(mockUserAdminService['listUserCredentials']).toHaveBeenCalled();
    });

    it('does not delete when the user cancels the confirm prompt', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
      const component = build();

      component.onDeleteCredential(credentials[0]);

      expect(mockUserAdminService['deleteUserCredential']).not.toHaveBeenCalled();
    });

    it('records an error when deletion fails', () => {
      vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
      mockUserAdminService['deleteUserCredential'].mockReturnValue(
        throwError(() => new Error('boom')),
      );
      const component = build();

      component.onDeleteCredential(credentials[0]);

      expect(mockLogger['error']).toHaveBeenCalled();
      expect(component.errorMessage).toBeTruthy();
    });
  });
});
