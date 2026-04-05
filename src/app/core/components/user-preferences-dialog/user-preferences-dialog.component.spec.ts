// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { of } from 'rxjs';

import { UserPreferencesDialogComponent } from './user-preferences-dialog.component';
import { LoggerService } from '../../services/logger.service';
import { IAuthService } from '../../interfaces';
import { UserProfile } from '@app/auth/models/auth.models';
import { createTypedMockLoggerService, type MockLoggerService } from '../../../../testing/mocks';

interface MockDialogRef {
  close: ReturnType<typeof vi.fn>;
}

describe('UserPreferencesDialogComponent', () => {
  let component: UserPreferencesDialogComponent;
  let dialogRef: MockDialogRef;
  let loggerService: MockLoggerService;
  let envInjector: EnvironmentInjector;
  let clientCredentialService: { list: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();

    dialogRef = { close: vi.fn() };
    loggerService = createTypedMockLoggerService();

    const authService = { getUser: vi.fn(), getUserProfile: vi.fn() };
    const dialog = { open: vi.fn() };
    const themeService = { currentTheme$: { subscribe: vi.fn() }, setTheme: vi.fn() };
    const userPreferencesService = {
      getPreferences: vi.fn().mockReturnValue({
        animations: true,
        themeMode: 'system',
        colorBlindMode: false,
        dashboardListView: false,
        hoverShowMetadata: true,
        pageSize: 'usLetter',
        marginSize: 'standard',
        showDeveloperTools: false,
      }),
    };
    const threatModelAuthService = { getCurrentRole: vi.fn() };
    clientCredentialService = { list: vi.fn().mockReturnValue(of([])), delete: vi.fn() };
    const userService = { requestDeleteChallenge: vi.fn(), confirmDeleteAccount: vi.fn() };
    const snackBar = { open: vi.fn() };
    const transloco = { translate: vi.fn((key: string) => key) };

    envInjector = createEnvironmentInjector([], {
      get: (token: unknown) => {
        if (token === EnvironmentInjector) return envInjector;
        return undefined;
      },
    } as EnvironmentInjector);

    runInInjectionContext(envInjector, () => {
      component = new UserPreferencesDialogComponent(
        dialogRef as any,
        {},
        authService as unknown as IAuthService,
        loggerService as unknown as LoggerService,
        dialog as any,
        themeService as any,
        userPreferencesService as any,
        threatModelAuthService as any,
        clientCredentialService as any,
        userService as any,
        snackBar as any,
        transloco as any,
      );
    });
  });

  afterEach(() => {
    envInjector.destroy();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('formatDate', () => {
    it('should format date with month, day, and year', () => {
      const result = component.formatDate('2026-03-15T10:00:00Z');
      expect(result).toContain('Mar');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  describe('formatLastUsed', () => {
    it('should return "Never" for null input', () => {
      expect(component.formatLastUsed(null)).toBe('Never');
    });

    it('should return "Never" for undefined input', () => {
      expect(component.formatLastUsed(undefined)).toBe('Never');
    });

    it('should return "Just now" for recent timestamps', () => {
      const now = new Date();
      now.setMinutes(now.getMinutes() - 5);
      expect(component.formatLastUsed(now.toISOString())).toBe('Just now');
    });

    it('should return hours ago for timestamps within 24 hours', () => {
      const date = new Date();
      date.setHours(date.getHours() - 3);
      expect(component.formatLastUsed(date.toISOString())).toBe('3 hrs ago');
    });

    it('should return days ago for timestamps within 7 days', () => {
      const date = new Date();
      date.setDate(date.getDate() - 3);
      expect(component.formatLastUsed(date.toISOString())).toBe('3 days ago');
    });

    it('should return date with year for timestamps older than 7 days', () => {
      const result = component.formatLastUsed('2025-01-15T10:00:00Z');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2025');
    });
  });

  describe('formatExpires', () => {
    it('should return empty string for null input', () => {
      expect(component.formatExpires(null)).toBe('');
    });

    it('should return empty string for undefined input', () => {
      expect(component.formatExpires(undefined)).toBe('');
    });

    it('should format future date with year', () => {
      const result = component.formatExpires('2027-12-31T12:00:00Z');
      expect(result).toContain('Dec');
      expect(result).toContain('31');
      expect(result).toContain('2027');
    });
  });

  describe('isExpired', () => {
    it('should return true for past dates', () => {
      expect(component.isExpired('2020-01-01T00:00:00Z')).toBe(true);
    });

    it('should return false for future dates', () => {
      expect(component.isExpired('2099-12-31T00:00:00Z')).toBe(false);
    });
  });

  describe('row type predicates', () => {
    it('should identify content rows', () => {
      expect(component.isContentRow(0, { type: 'content' })).toBe(true);
      expect(component.isContentRow(0, { type: 'metadata' })).toBe(false);
    });

    it('should identify metadata rows', () => {
      expect(component.isMetadataRow(0, { type: 'metadata' })).toBe(true);
      expect(component.isMetadataRow(0, { type: 'content' })).toBe(false);
    });
  });

  describe('credentialColumns', () => {
    it('should have 3 columns', () => {
      expect(component.credentialColumns).toEqual(['credential', 'lastUsed', 'actions']);
    });

    it('should have metadata columns', () => {
      expect(component.credentialMetadataColumns).toEqual(['metadata']);
    });
  });

  describe('credentialRows', () => {
    it('should start as empty array', () => {
      expect(component.credentialRows).toEqual([]);
    });
  });

  describe('canManageCredentials', () => {
    it('should default to false', () => {
      expect(component.canManageCredentials).toBe(false);
    });

    it('should be true when user is admin', () => {
      component['updateCredentialsAccess']({
        email: 'admin@example.com',
        is_admin: true,
        is_security_reviewer: false,
        groups: null,
      } as UserProfile);
      expect(component.canManageCredentials).toBe(true);
    });

    it('should be true when user is security reviewer', () => {
      component['updateCredentialsAccess']({
        email: 'reviewer@example.com',
        is_admin: false,
        is_security_reviewer: true,
        groups: null,
      } as UserProfile);
      expect(component.canManageCredentials).toBe(true);
    });

    it('should be false when user is neither admin nor security reviewer', () => {
      component['updateCredentialsAccess']({
        email: 'user@example.com',
        is_admin: false,
        is_security_reviewer: false,
        groups: null,
      } as UserProfile);
      expect(component.canManageCredentials).toBe(false);
    });

    it('should be false when profile is null', () => {
      component['updateCredentialsAccess'](null);
      expect(component.canManageCredentials).toBe(false);
    });

    it('should load credentials when access is granted', () => {
      clientCredentialService.list.mockClear();
      component['updateCredentialsAccess']({
        email: 'admin@example.com',
        is_admin: true,
        groups: null,
      } as UserProfile);
      expect(clientCredentialService.list).toHaveBeenCalled();
    });

    it('should not load credentials when access is denied', () => {
      clientCredentialService.list.mockClear();
      component['updateCredentialsAccess']({
        email: 'user@example.com',
        is_admin: false,
        is_security_reviewer: false,
        groups: null,
      } as UserProfile);
      expect(clientCredentialService.list).not.toHaveBeenCalled();
    });
  });
});
