// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

import '@angular/compiler';

import { vi, expect, beforeEach, afterEach, describe, it } from 'vitest';
import { RendererFactory2, Renderer2 } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ThemeService, ThemeMode, PaletteType, ThemePreferences } from './theme.service';

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
  let mockLocalStorage: {
    getItem: ReturnType<typeof vi.fn>;
    setItem: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock localStorage
    mockLocalStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    global.localStorage = mockLocalStorage as any;

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

    // Create service
    service = new ThemeService(
      mockRendererFactory as unknown as RendererFactory2,
      mockOverlayContainer as unknown as OverlayContainer,
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
      mockLocalStorage.getItem.mockReturnValue(null);

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      expect(service2.getPreferences()).toEqual({
        mode: 'automatic',
        palette: 'normal',
      });

      service2.ngOnDestroy();
    });

    it('should load preferences from localStorage', () => {
      const storedPrefs: ThemePreferences = {
        mode: 'dark',
        palette: 'colorblind',
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(storedPrefs));

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
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
      expect(mockLocalStorage.setItem).toHaveBeenCalled();
    });

    it('should update mode to light', () => {
      service.setThemeMode('light');

      expect(service.getPreferences().mode).toBe('light');
    });

    it('should update mode to automatic', () => {
      service.setThemeMode('automatic');

      expect(service.getPreferences().mode).toBe('automatic');
    });

    it('should persist preferences to localStorage', () => {
      service.setThemeMode('dark');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'user-theme-preferences',
        JSON.stringify({
          mode: 'dark',
          palette: 'normal',
        }),
      );
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

    it('should persist preferences to localStorage', () => {
      service.setPalette('colorblind');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'user-theme-preferences',
        JSON.stringify({
          mode: 'automatic',
          palette: 'colorblind',
        }),
      );
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
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as Function;

      service.setThemeMode('automatic');

      // Trigger system theme change
      mockMediaQueryList.matches = true;
      changeHandler(new Event('change') as any);

      expect(mockRenderer.addClass).toHaveBeenCalledWith(document.body, 'dark-theme');
    });

    it('should not react to system theme changes in light mode', () => {
      // Capture the change handler before clearing mocks
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as Function;

      service.setThemeMode('light');
      vi.clearAllMocks();

      // Trigger system theme change
      mockMediaQueryList.matches = true;
      changeHandler(new Event('change') as any);

      // Should not add dark class since mode is explicitly light
      expect(mockRenderer.addClass).not.toHaveBeenCalledWith(document.body, 'dark-theme');
    });

    it('should not react to system theme changes in dark mode', () => {
      // Capture the change handler before clearing mocks
      const changeHandler = mockMediaQueryList.addEventListener.mock.calls[0][1] as Function;

      service.setThemeMode('dark');
      vi.clearAllMocks();

      // Trigger system theme change
      mockMediaQueryList.matches = false;
      changeHandler(new Event('change') as any);

      // Should still have dark class since mode is explicitly dark
      expect(mockRenderer.removeClass).not.toHaveBeenCalledWith(document.body, 'dark-theme');
    });
  });

  describe('Legacy Preferences Loading', () => {
    it('should fall back to defaults when legacy format fails validation', () => {
      // When a valid JSON is stored but doesn't match ThemePreferences schema,
      // the service falls back to defaults since _isValidPreferences returns false
      const legacyConfig = {
        colorScheme: 'dark',
        palette: 'colorblind',
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(legacyConfig));

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      // Falls back to defaults since legacy handling only works for parse errors
      const prefs = service2.getPreferences();
      expect(prefs.mode).toBe('automatic');
      expect(prefs.palette).toBe('normal');

      service2.ngOnDestroy();
    });

    it('should fall back to defaults for non-JSON string', () => {
      // Non-JSON strings will fail to parse and fall back to defaults
      mockLocalStorage.getItem.mockReturnValue('colorblind');

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      // Falls back to defaults since the string doesn't match expected legacy format
      const prefs = service2.getPreferences();
      expect(prefs.mode).toBe('automatic');
      expect(prefs.palette).toBe('normal');

      service2.ngOnDestroy();
    });

    it('should ignore invalid stored preferences', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json{');

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      // Should fall back to defaults
      expect(service2.getPreferences()).toEqual({
        mode: 'automatic',
        palette: 'normal',
      });

      service2.ngOnDestroy();
    });

    it('should ignore preferences with invalid mode', () => {
      const invalidPrefs = {
        mode: 'invalid-mode',
        palette: 'normal',
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(invalidPrefs));

      const service2 = new ThemeService(
        mockRendererFactory as unknown as RendererFactory2,
        mockOverlayContainer as unknown as OverlayContainer,
      );

      // Should fall back to defaults
      expect(service2.getPreferences()).toEqual({
        mode: 'automatic',
        palette: 'normal',
      });

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
