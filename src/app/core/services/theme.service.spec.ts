// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { RendererFactory2 } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject } from 'rxjs';
import { ThemeService, ThemePreferences } from './theme.service';
import { UserPreferencesService } from './user-preferences.service';
import type { UserPreferencesData } from './user-preferences.service';

describe('ThemeService', () => {
  let service: ThemeService;
  let mockRendererFactory: {
    createRenderer: ReturnType<typeof vi.fn>;
  };
  let mockRenderer: {
    addClass: ReturnType<typeof vi.fn>;
    removeClass: ReturnType<typeof vi.fn>;
  };
  let mockOverlayContainer: {
    getContainerElement: ReturnType<typeof vi.fn>;
  };
  let mockOverlayElement: {
    classList: {
      add: ReturnType<typeof vi.fn>;
      remove: ReturnType<typeof vi.fn>;
    };
  };
  let mockMediaQueryList: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let mockUserPreferencesService: {
    preferences$: BehaviorSubject<UserPreferencesData>;
    getPreferences: ReturnType<typeof vi.fn>;
    updatePreferences: ReturnType<typeof vi.fn>;
    getThemePreferences: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock renderer
    mockRenderer = {
      addClass: vi.fn(),
      removeClass: vi.fn(),
    };

    mockRendererFactory = {
      createRenderer: vi.fn().mockReturnValue(mockRenderer),
    };

    // Mock overlay element
    mockOverlayElement = {
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
    };

    mockOverlayContainer = {
      getContainerElement: vi.fn().mockReturnValue(mockOverlayElement),
    };

    // Mock media query
    mockMediaQueryList = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    // Mock window.matchMedia
    global.window.matchMedia = vi.fn().mockReturnValue(mockMediaQueryList);

    // Mock UserPreferencesService
    mockUserPreferencesService = {
      preferences$: new BehaviorSubject<UserPreferencesData>({
        animations: true,
        themeMode: 'automatic',
        colorBlindMode: false,
        showDeveloperTools: false,
        dashboardListView: false,
        pageSize: 'usLetter',
        marginSize: 'standard',
      }),
      getPreferences: vi.fn().mockReturnValue({
        animations: true,
        themeMode: 'automatic',
        colorBlindMode: false,
        showDeveloperTools: false,
        dashboardListView: false,
        pageSize: 'usLetter',
        marginSize: 'standard',
      }),
      updatePreferences: vi.fn(),
      getThemePreferences: vi.fn().mockReturnValue({
        mode: 'automatic',
        palette: 'normal',
      }),
    };

    // Create service
    service = new ThemeService(
      mockRendererFactory as unknown as RendererFactory2,
      mockOverlayContainer as unknown as OverlayContainer,
      mockUserPreferencesService as unknown as UserPreferencesService,
    );
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should create renderer', () => {
      expect(mockRendererFactory.createRenderer).toHaveBeenCalledWith(null, null);
    });

    it('should set up media query listener', () => {
      expect(window.matchMedia).toHaveBeenCalledWith('(prefers-color-scheme: dark)');
      expect(mockMediaQueryList.addEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });

    it('should initialize with default preferences when no stored preferences exist', () => {
      const mockPrefsService = {
        ...mockUserPreferencesService,
        getThemePreferences: vi.fn().mockReturnValue({
          mode: 'automatic',
          palette: 'normal',
        }),
      };

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
        mockPrefsService as unknown as UserPreferencesService,
      );

      expect(service2.getPreferences()).toEqual({
        mode: 'automatic',
        palette: 'normal',
      });

      service2.ngOnDestroy();
    });

    it('should load preferences from UserPreferencesService', () => {
      const storedPrefs: ThemePreferences = {
        mode: 'dark',
        palette: 'colorblind',
      };

      const mockPrefsService = {
        ...mockUserPreferencesService,
        getThemePreferences: vi.fn().mockReturnValue(storedPrefs),
      };

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
        mockPrefsService as unknown as UserPreferencesService,
      );

      expect(service2.getPreferences()).toEqual(storedPrefs);

      service2.ngOnDestroy();
    });

    it('should apply theme on initialization', () => {
      expect(mockRenderer.removeClass).toHaveBeenCalled();
      expect(mockOverlayElement.classList.remove).toHaveBeenCalled();
    });
  });

  describe('getPreferences()', () => {
    it('should return current preferences', () => {
      const prefs = service.getPreferences();

      expect(prefs).toEqual({
        mode: 'automatic',
        palette: 'normal',
      });
    });
  });

  describe('observePreferences()', () => {
    it('should emit current preferences', () => {
      service.observePreferences().subscribe(prefs => {
        expect(prefs).toEqual({
          mode: 'automatic',
          palette: 'normal',
        });
      });
    });

    it('should emit updates when preferences change', () => {
      const emissions: ThemePreferences[] = [];

      service.observePreferences().subscribe(prefs => {
        emissions.push(prefs);
      });

      service.setThemeMode('dark');

      expect(emissions).toHaveLength(2); // Initial + update
      expect(emissions[1]).toEqual({
        mode: 'dark',
        palette: 'normal',
      });
    });
  });

  describe('getCurrentTheme()', () => {
    it('should return current theme with light color scheme by default', () => {
      mockMediaQueryList.matches = false;

      const theme = service.getCurrentTheme();

      expect(theme.colorScheme).toBe('light');
      expect(theme.palette).toBe('normal');
    });
  });

  describe('observeTheme()', () => {
    it('should emit current theme', () => {
      service.observeTheme().subscribe(theme => {
        expect(theme).toHaveProperty('colorScheme');
        expect(theme).toHaveProperty('palette');
      });
    });

    it('should emit updates when theme changes', () => {
      const emissions: any[] = [];

      service.observeTheme().subscribe(theme => {
        emissions.push(theme);
      });

      service.setThemeMode('dark');

      expect(emissions).toHaveLength(2); // Initial + update
      expect(emissions[1].colorScheme).toBe('dark');
    });
  });

  describe('setThemeMode()', () => {
    it('should update mode to dark', () => {
      service.setThemeMode('dark');

      expect(service.getPreferences().mode).toBe('dark');
      expect(mockUserPreferencesService.updatePreferences).toHaveBeenCalled();
    });

    it('should update mode to light', () => {
      service.setThemeMode('light');

      expect(service.getPreferences().mode).toBe('light');
    });

    it('should update mode to automatic', () => {
      service.setThemeMode('automatic');

      expect(service.getPreferences().mode).toBe('automatic');
    });

    it('should persist preferences via UserPreferencesService', () => {
      service.setThemeMode('dark');

      expect(mockUserPreferencesService.updatePreferences).toHaveBeenCalledWith({
        themeMode: 'dark',
        colorBlindMode: false,
      });
    });

    it('should apply dark class when mode is dark', () => {
      service.setThemeMode('dark');

      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'dark-theme');
      expect(mockOverlayElement.classList.add).toHaveBeenCalledWith('dark-theme');
    });

    it('should remove dark class when mode is light', () => {
      service.setThemeMode('light');

      expect(mockRenderer.removeClass).toHaveBeenCalledWith(document.body, 'dark-theme');
      expect(mockOverlayElement.classList.remove).toHaveBeenCalledWith(
        'dark-theme',
        'colorblind-palette',
      );
    });
  });

  describe('setPalette()', () => {
    it('should update palette to colorblind', () => {
      service.setPalette('colorblind');

      expect(service.getPreferences().palette).toBe('colorblind');
    });

    it('should update palette to normal', () => {
      service.setPalette('normal');

      expect(service.getPreferences().palette).toBe('normal');
    });

    it('should persist preferences via UserPreferencesService', () => {
      service.setPalette('colorblind');

      expect(mockUserPreferencesService.updatePreferences).toHaveBeenCalledWith({
        themeMode: 'automatic',
        colorBlindMode: true,
      });
    });

    it('should apply colorblind class when palette is colorblind', () => {
      service.setPalette('colorblind');

      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'colorblind-palette');
      expect(mockOverlayElement.classList.add).toHaveBeenCalledWith('colorblind-palette');
    });
  });

  describe('setPreferences()', () => {
    it('should update both mode and palette', () => {
      const prefs: ThemePreferences = {
        mode: 'dark',
        palette: 'colorblind',
      };

      service.setPreferences(prefs);

      expect(service.getPreferences()).toEqual(prefs);
    });

    it('should apply both dark and colorblind classes', () => {
      service.setPreferences({
        mode: 'dark',
        palette: 'colorblind',
      });

      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'dark-theme');
      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'colorblind-palette');
      expect(mockOverlayElement.classList.add).toHaveBeenCalledWith('dark-theme');
      expect(mockOverlayElement.classList.add).toHaveBeenCalledWith('colorblind-palette');
    });
  });

  describe('isDarkMode()', () => {
    it('should return false for light mode', () => {
      service.setThemeMode('light');

      expect(service.isDarkMode()).toBe(false);
    });

    it('should return true for dark mode', () => {
      service.setThemeMode('dark');

      expect(service.isDarkMode()).toBe(true);
    });

    it('should return true when automatic mode with dark system preference', () => {
      mockMediaQueryList.matches = true;

      // Create new service to pick up mocked media query
      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      service2.setThemeMode('automatic');

      expect(service2.isDarkMode()).toBe(true);

      service2.ngOnDestroy();
    });
  });

  describe('isColorblindMode()', () => {
    it('should return false for normal palette', () => {
      service.setPalette('normal');

      expect(service.isColorblindMode()).toBe(false);
    });

    it('should return true for colorblind palette', () => {
      service.setPalette('colorblind');

      expect(service.isColorblindMode()).toBe(true);
    });
  });

  describe('System Theme Changes', () => {
    it('should react to system theme changes in automatic mode', () => {
      // Capture the change handler before any mode changes
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as (
        event: MediaQueryListEvent,
      ) => void;

      service.setThemeMode('automatic');

      // Trigger system theme change
      mockMediaQueryList.matches = true;
      changeHandler(new Event('change') as MediaQueryListEvent);

      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'dark-theme');
    });

    it('should not react to system theme changes in light mode', () => {
      // Capture the change handler before clearing mocks
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as (
        event: MediaQueryListEvent,
      ) => void;

      service.setThemeMode('light');
      vi.clearAllMocks();

      // Trigger system theme change
      mockMediaQueryList.matches = true;
      changeHandler(new Event('change') as MediaQueryListEvent);

      // Should not add dark class since mode is explicitly light
      expect(mockRenderer.addClass).not.toHaveBeenCalledWith(document.body, 'dark-theme');
    });

    it('should not react to system theme changes in dark mode', () => {
      // Capture the change handler before clearing mocks
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as (
        event: MediaQueryListEvent,
      ) => void;

      service.setThemeMode('dark');
      vi.clearAllMocks();

      // Trigger system theme change
      mockMediaQueryList.matches = false;
      changeHandler(new Event('change') as MediaQueryListEvent);

      // Should still have dark class since mode is explicitly dark
      expect(mockRenderer.removeClass).not.toHaveBeenCalledWith(document.body, 'dark-theme');
    });
  });

  describe('Preferences from UserPreferencesService', () => {
    it('should load theme preferences from UserPreferencesService', () => {
      const mockPrefsService = {
        ...mockUserPreferencesService,
        getThemePreferences: vi.fn().mockReturnValue({
          mode: 'dark',
          palette: 'colorblind',
        }),
      };

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
        mockPrefsService as unknown as UserPreferencesService,
      );

      const prefs = service2.getPreferences();
      expect(prefs.mode).toBe('dark');
      expect(prefs.palette).toBe('colorblind');

      service2.ngOnDestroy();
    });

    it('should use defaults when UserPreferencesService returns defaults', () => {
      const mockPrefsService = {
        ...mockUserPreferencesService,
        getThemePreferences: vi.fn().mockReturnValue({
          mode: 'automatic',
          palette: 'normal',
        }),
      };

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
        mockPrefsService as unknown as UserPreferencesService,
      );

      const prefs = service2.getPreferences();
      expect(prefs.mode).toBe('automatic');
      expect(prefs.palette).toBe('normal');

      service2.ngOnDestroy();
    });

    it('should react to preference changes from UserPreferencesService', () => {
      const prefsSubject = new BehaviorSubject<UserPreferencesData>({
        animations: true,
        themeMode: 'automatic',
        colorBlindMode: false,
        showDeveloperTools: false,
        dashboardListView: false,
        pageSize: 'usLetter',
        marginSize: 'standard',
      });

      const mockPrefsService = {
        ...mockUserPreferencesService,
        preferences$: prefsSubject,
        getThemePreferences: vi.fn().mockReturnValue({
          mode: 'automatic',
          palette: 'normal',
        }),
      };

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
        mockPrefsService as unknown as UserPreferencesService,
      );

      // Update preferences externally
      prefsSubject.next({
        animations: true,
        themeMode: 'dark',
        colorBlindMode: true,
        showDeveloperTools: false,
        dashboardListView: false,
        pageSize: 'usLetter',
        marginSize: 'standard',
      });

      // ThemeService should react to the change
      const prefs = service2.getPreferences();
      expect(prefs.mode).toBe('dark');
      expect(prefs.palette).toBe('colorblind');

      service2.ngOnDestroy();
    });
  });

  describe('Cleanup', () => {
    it('should remove event listener on destroy', () => {
      service.ngOnDestroy();

      expect(mockMediaQueryList.removeEventListener).toHaveBeenCalledWith(
        'change',
        expect.any(Function),
      );
    });
  });
});
