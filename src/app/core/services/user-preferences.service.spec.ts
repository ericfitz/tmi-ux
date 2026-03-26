// This project uses vitest for all unit tests, with native vitest syntax
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project

import '@angular/compiler';

import {
  EnvironmentInjector,
  createEnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

import { UserPreferencesService, type UserPreferencesData } from './user-preferences.service';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import { AUTH_SERVICE } from '../interfaces';
import { BrandingConfigService } from './branding-config.service';

describe('UserPreferencesService', () => {
  let service: UserPreferencesService;
  let envInjector: EnvironmentInjector;
  let mockApiService: {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
  };
  let mockAuthService: {
    isAuthenticated: boolean;
  };
  let mockLogger: {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
  };
  let mockBrandingConfigService: Record<string, unknown>;

  const DEFAULT_PREFERENCES: UserPreferencesData = {
    animations: true,
    themeMode: 'automatic',
    colorBlindMode: false,
    showDeveloperTools: false,
    dashboardListView: false,
    hoverShowMetadata: false,
    pageSize: 'usLetter',
    marginSize: 'standard',
  };

  beforeEach(() => {
    localStorage.clear();

    mockApiService = {
      get: vi.fn().mockReturnValue(of({})),
      put: vi.fn().mockReturnValue(of({})),
    };

    mockAuthService = {
      isAuthenticated: false,
    };

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    mockBrandingConfigService = {};
    Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
      get: vi.fn().mockReturnValue(null),
      configurable: true,
    });

    envInjector = createEnvironmentInjector(
      [
        { provide: ApiService, useValue: mockApiService },
        { provide: AUTH_SERVICE, useValue: mockAuthService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: BrandingConfigService, useValue: mockBrandingConfigService },
      ],
      {
        get: () => null,
      } as unknown as EnvironmentInjector,
    );

    service = runInInjectionContext(envInjector, () => new UserPreferencesService());
  });

  afterEach(() => {
    service.ngOnDestroy();
    envInjector.destroy();
    localStorage.clear();
  });

  describe('getPreferences', () => {
    it('should return default preferences before initialization', () => {
      expect(service.getPreferences()).toEqual(DEFAULT_PREFERENCES);
    });
  });

  describe('initialize', () => {
    it('should load from localStorage when not authenticated', async () => {
      localStorage.setItem(
        'tmi_preferences_v2',
        JSON.stringify({ animations: false, themeMode: 'dark' }),
      );

      await service.initialize();

      const prefs = service.getPreferences();
      expect(prefs.animations).toBe(false);
      expect(prefs.themeMode).toBe('dark');
      expect(prefs.colorBlindMode).toBe(false);
    });

    it('should merge partial localStorage data with defaults', async () => {
      localStorage.setItem('tmi_preferences_v2', JSON.stringify({ animations: false }));

      await service.initialize();

      const prefs = service.getPreferences();
      expect(prefs.animations).toBe(false);
      expect(prefs.themeMode).toBe('automatic');
      expect(prefs.pageSize).toBe('usLetter');
    });

    it('should use defaults when localStorage has invalid JSON', async () => {
      localStorage.setItem('tmi_preferences_v2', 'not valid json{{{');

      await service.initialize();

      expect(service.getPreferences()).toEqual(DEFAULT_PREFERENCES);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should load from server when authenticated', async () => {
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockReturnValue(
        of({ 'tmi-ux': { ...DEFAULT_PREFERENCES, animations: false } }),
      );

      await service.initialize();

      expect(service.getPreferences().animations).toBe(false);
    });

    it('should sync local to server when server has no preferences', async () => {
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockReturnValue(of({}));

      await service.initialize();

      expect(service.getPreferences()).toEqual(DEFAULT_PREFERENCES);
    });

    it('should handle server error gracefully and fall back to localStorage', async () => {
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockReturnValue(throwError(() => new Error('Server down')));
      localStorage.setItem('tmi_preferences_v2', JSON.stringify({ animations: false }));

      await service.initialize();

      expect(service.getPreferences().animations).toBe(false);
    });

    it('should use defaults when initialization fails completely', async () => {
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockImplementation(() => {
        throw new Error('Sync error');
      });

      await service.initialize();

      expect(service.getPreferences()).toEqual(DEFAULT_PREFERENCES);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  describe('server default theme', () => {
    it('should use server default theme for new user with no localStorage and no server prefs', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('dark');
    });

    it('should use "automatic" when server default theme is null', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue(null),
        configurable: true,
      });

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('automatic');
    });

    it('should not override existing localStorage preferences with server default', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });
      localStorage.setItem('tmi_preferences_v2', JSON.stringify({ themeMode: 'light' }));

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('light');
    });

    it('should use server default theme when initialization fails completely', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockImplementation(() => {
        throw new Error('Sync error');
      });

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('dark');
    });

    it('should not override server user preferences with server default theme', async () => {
      Object.defineProperty(mockBrandingConfigService, 'defaultTheme', {
        get: vi.fn().mockReturnValue('dark'),
        configurable: true,
      });
      mockAuthService.isAuthenticated = true;
      mockApiService.get.mockReturnValue(
        of({ 'tmi-ux': { ...DEFAULT_PREFERENCES, themeMode: 'light' } }),
      );

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('light');
    });
  });

  describe('legacy migration', () => {
    it('should migrate from tmi_user_preferences key', async () => {
      localStorage.setItem(
        'tmi_user_preferences',
        JSON.stringify({
          animations: false,
          themeMode: 'dark',
          colorBlindMode: true,
          pageSize: 'A4',
          marginSize: 'wide',
          showDeveloperTools: true,
          dashboardListView: true,
        }),
      );

      await service.initialize();

      const prefs = service.getPreferences();
      expect(prefs.animations).toBe(false);
      expect(prefs.themeMode).toBe('dark');
      expect(prefs.colorBlindMode).toBe(true);
      expect(prefs.pageSize).toBe('A4');
      expect(prefs.marginSize).toBe('wide');
      expect(prefs.showDeveloperTools).toBe(true);
      expect(prefs.dashboardListView).toBe(true);
    });

    it('should migrate from user-theme-preferences key', async () => {
      localStorage.setItem(
        'user-theme-preferences',
        JSON.stringify({ mode: 'light', palette: 'colorblind' }),
      );

      await service.initialize();

      const prefs = service.getPreferences();
      expect(prefs.themeMode).toBe('light');
      expect(prefs.colorBlindMode).toBe(true);
    });

    it('should let theme preferences override user preferences for themeMode', async () => {
      localStorage.setItem('tmi_user_preferences', JSON.stringify({ themeMode: 'dark' }));
      localStorage.setItem('user-theme-preferences', JSON.stringify({ mode: 'light' }));

      await service.initialize();

      expect(service.getPreferences().themeMode).toBe('light');
    });

    it('should remove legacy keys after migration', async () => {
      localStorage.setItem('tmi_user_preferences', JSON.stringify({ animations: false }));
      localStorage.setItem('user-theme-preferences', JSON.stringify({ mode: 'dark' }));

      await service.initialize();

      expect(localStorage.getItem('tmi_user_preferences')).toBeNull();
      expect(localStorage.getItem('user-theme-preferences')).toBeNull();
    });

    it('should handle corrupted legacy JSON gracefully', async () => {
      localStorage.setItem('tmi_user_preferences', '{{invalid json');

      await service.initialize();

      expect(service.getPreferences()).toEqual(DEFAULT_PREFERENCES);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should propagate wrong types from legacy data without validation', async () => {
      localStorage.setItem('tmi_user_preferences', JSON.stringify({ animations: 'yes' }));

      await service.initialize();

      // The value 'yes' (string) is assigned to animations (expected boolean)
      expect(service.getPreferences().animations).toBe('yes');
    });

    it('should not migrate when new storage key already exists', async () => {
      localStorage.setItem('tmi_preferences_v2', JSON.stringify({ animations: false }));
      localStorage.setItem('tmi_user_preferences', JSON.stringify({ animations: true }));

      await service.initialize();

      expect(service.getPreferences().animations).toBe(false);
    });
  });

  describe('updatePreferences', () => {
    it('should merge partial update with current preferences', () => {
      service.updatePreferences({ animations: false });

      const prefs = service.getPreferences();
      expect(prefs.animations).toBe(false);
      expect(prefs.themeMode).toBe('automatic');
    });

    it('should save to localStorage immediately', () => {
      service.updatePreferences({ themeMode: 'dark' });

      const stored = JSON.parse(localStorage.getItem('tmi_preferences_v2')!);
      expect(stored.themeMode).toBe('dark');
    });

    it('should emit updated preferences via observable', () => {
      const emitted: UserPreferencesData[] = [];
      service.preferences$.subscribe(prefs => emitted.push(prefs));

      service.updatePreferences({ colorBlindMode: true });

      expect(emitted.length).toBeGreaterThanOrEqual(2);
      expect(emitted[emitted.length - 1].colorBlindMode).toBe(true);
    });

    it('should not trigger server sync when not authenticated', () => {
      mockAuthService.isAuthenticated = false;

      service.updatePreferences({ animations: false });

      expect(mockApiService.put).not.toHaveBeenCalled();
    });

    it('should handle localStorage quota exceeded gracefully', () => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      expect(() => service.updatePreferences({ animations: false })).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });

  describe('getThemePreferences', () => {
    it('should return colorblind palette when colorBlindMode is true', () => {
      service.updatePreferences({ colorBlindMode: true });
      expect(service.getThemePreferences().palette).toBe('colorblind');
    });

    it('should return normal palette when colorBlindMode is false', () => {
      service.updatePreferences({ colorBlindMode: false });
      expect(service.getThemePreferences().palette).toBe('normal');
    });

    it('should return current theme mode', () => {
      service.updatePreferences({ themeMode: 'dark' });
      expect(service.getThemePreferences().mode).toBe('dark');
    });
  });

  describe('debounced server sync', () => {
    it('should debounce multiple rapid updates to single server call', () => {
      vi.useFakeTimers();
      mockAuthService.isAuthenticated = true;

      service.updatePreferences({ animations: false });
      service.updatePreferences({ themeMode: 'dark' });
      service.updatePreferences({ colorBlindMode: true });

      expect(mockApiService.put).not.toHaveBeenCalled();

      vi.advanceTimersByTime(600);

      expect(mockApiService.put).toHaveBeenCalledTimes(1);
      const putCall = mockApiService.put.mock.calls[0];
      expect(putCall[1]['tmi-ux'].colorBlindMode).toBe(true);

      vi.useRealTimers();
    });

    it('should handle server sync failure silently', () => {
      vi.useFakeTimers();
      mockAuthService.isAuthenticated = true;
      mockApiService.put.mockReturnValue(throwError(() => new Error('Server error')));

      service.updatePreferences({ animations: false });
      vi.advanceTimersByTime(600);

      expect(service.getPreferences().animations).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('ngOnDestroy', () => {
    it('should complete destroy subject and stop sync', () => {
      const destroy$ = (service as unknown as { destroy$: Subject<void> }).destroy$;
      let completed = false;
      destroy$.subscribe({ complete: () => (completed = true) });

      service.ngOnDestroy();

      expect(completed).toBe(true);
    });
  });
});
