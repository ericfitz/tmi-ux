import '@angular/compiler';

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { AdminUsersComponent } from './admin-users.component';
import { of, EMPTY, Subject } from 'rxjs';
import { CreateAutomationAccountResponse } from '@app/types/user.types';

describe('AdminUsersComponent', () => {
  describe('onCreateAutomationUser', () => {
    let component: AdminUsersComponent;
    let mockDialog: { open: ReturnType<typeof vi.fn> };
    let mockUserAdminService: {
      list: ReturnType<typeof vi.fn>;
      createAutomationUser: ReturnType<typeof vi.fn>;
    };
    let mockRouter: { navigate: ReturnType<typeof vi.fn> };
    let mockRoute: { queryParams: typeof EMPTY };
    let mockLogger: {
      info: ReturnType<typeof vi.fn>;
      error: ReturnType<typeof vi.fn>;
      debug: ReturnType<typeof vi.fn>;
      debugComponent: ReturnType<typeof vi.fn>;
    };
    let mockAuthService: { getAvailableProviders: ReturnType<typeof vi.fn>; isAdmin: boolean };
    let mockSnackBar: { open: ReturnType<typeof vi.fn> };
    let mockTransloco: { translate: ReturnType<typeof vi.fn> };
    let mockLanguageService: { currentLanguage$: ReturnType<typeof of> };

    beforeEach(() => {
      mockDialog = { open: vi.fn() };
      mockUserAdminService = {
        list: vi.fn().mockReturnValue(of({ users: [], total: 0 })),
        createAutomationUser: vi.fn(),
      };
      mockRouter = { navigate: vi.fn().mockResolvedValue(true) };
      mockRoute = { queryParams: EMPTY };
      mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        debugComponent: vi.fn(),
      };
      mockAuthService = {
        getAvailableProviders: vi.fn().mockReturnValue(of([])),
        isAdmin: true,
      };
      mockSnackBar = { open: vi.fn() };
      mockTransloco = { translate: vi.fn().mockImplementation((key: string) => key) };
      mockLanguageService = { currentLanguage$: of({ code: 'en-US', name: 'English' }) };

      const mockDestroyRef = { onDestroy: vi.fn() };
      const injector = Injector.create({
        providers: [{ provide: DestroyRef, useValue: mockDestroyRef }],
      });

      component = runInInjectionContext(injector, () => {
        return new AdminUsersComponent(
          mockUserAdminService as never,
          mockRouter as never,
          mockRoute as never,
          mockLogger as never,
          mockAuthService as never,
          mockDialog as never,
          mockSnackBar as never,
          mockTransloco as never,
          mockLanguageService as never,
        );
      });
    });

    it('should open CreateAutomationUserDialogComponent with no suggested name', () => {
      const afterClosedSubject = new Subject<null>();
      mockDialog.open.mockReturnValue({ afterClosed: () => afterClosedSubject.asObservable() });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      const [dialogComponent, config] = mockDialog.open.mock.calls[0];
      expect(dialogComponent.name).toBe('CreateAutomationUserDialogComponent');
      expect(config.width).toBe('500px');
      expect(config.data).toEqual({});
    });

    it('should open CredentialSecretDialogComponent when automation user is created', () => {
      const mockResponse: CreateAutomationAccountResponse = {
        user: {
          internal_uuid: 'test-uuid',
          provider: 'tmi',
          provider_user_id: 'test',
          email: 'test@tmi.local',
          name: 'test-bot',
          is_admin: false,
          automation: true,
        },
        client_credential: {
          id: 'cred-id',
          client_id: 'client-123',
          client_secret: 'secret-456',
          name: 'test-bot',
          created_at: '2026-04-15T00:00:00Z',
        },
      };

      const credDialogAfterClosed = new Subject<void>();
      mockDialog.open
        .mockReturnValueOnce({ afterClosed: () => of(mockResponse) })
        .mockReturnValueOnce({ afterClosed: () => credDialogAfterClosed.asObservable() });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(2);
      const [credComponent, credConfig] = mockDialog.open.mock.calls[1];
      expect(credComponent.name).toBe('CredentialSecretDialogComponent');
      expect(credConfig.data).toEqual({
        clientId: 'client-123',
        clientSecret: 'secret-456',
      });
      expect(credConfig.disableClose).toBe(true);
    });

    it('should reload users after credential dialog closes', () => {
      const mockResponse: CreateAutomationAccountResponse = {
        user: {
          internal_uuid: 'test-uuid',
          provider: 'tmi',
          provider_user_id: 'test',
          email: 'test@tmi.local',
          name: 'test-bot',
          is_admin: false,
          automation: true,
        },
        client_credential: {
          id: 'cred-id',
          client_id: 'client-123',
          client_secret: 'secret-456',
          name: 'test-bot',
          created_at: '2026-04-15T00:00:00Z',
        },
      };

      mockDialog.open
        .mockReturnValueOnce({ afterClosed: () => of(mockResponse) })
        .mockReturnValueOnce({ afterClosed: () => of(undefined) });

      const listSpy = mockUserAdminService.list.mockReturnValue(of({ users: [], total: 0 }));

      component.onCreateAutomationUser();

      // loadUsers is called during init + once after credential dialog closes
      expect(listSpy).toHaveBeenCalled();
    });

    it('should not open credential dialog when creation dialog is cancelled', () => {
      mockDialog.open.mockReturnValue({ afterClosed: () => of(null) });

      component.onCreateAutomationUser();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
    });
  });
});
