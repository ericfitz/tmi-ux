import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * Theme preference modes
 */
export type ThemeMode = 'automatic' | 'light' | 'dark';

/**
 * Palette types
 */
export type PaletteType = 'normal' | 'colorblind';

/**
 * User theme preferences stored in localStorage
 */
export interface ThemePreferences {
  mode: ThemeMode;
  palette: PaletteType;
}

/**
 * Active theme configuration (resolved from preferences)
 */
export interface ThemeConfig {
  colorScheme: 'light' | 'dark';
  palette: PaletteType;
}

/**
 * Theme Service
 *
 * Manages application-wide theme switching supporting:
 * - Automatic (follows system), Light, and Dark modes
 * - Normal and colorblind-friendly palettes
 * - Real-time system theme change detection
 *
 * This provides 6 effective combinations:
 * 1. Automatic + Normal (follows system light/dark)
 * 2. Automatic + Colorblind (follows system light/dark)
 * 3. Light + Normal
 * 4. Light + Colorblind
 * 5. Dark + Normal
 * 6. Dark + Colorblind
 *
 * @example
 * ```typescript
 * constructor(private themeService: ThemeService) {}
 *
 * ngOnInit(): void {
 *   // Set theme mode
 *   this.themeService.setThemeMode('automatic');
 *
 *   // Set palette
 *   this.themeService.setPalette('colorblind');
 *
 *   // Observe active theme changes
 *   this.themeService.observeTheme().subscribe(theme => {
 *     console.log('Theme changed to:', theme);
 *   });
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly PREFERENCES_STORAGE_KEY = 'user-theme-preferences';
  private readonly DARK_CLASS = 'dark-theme';
  private readonly COLORBLIND_CLASS = 'colorblind-palette';

  private renderer: Renderer2;
  private mediaQueryList: MediaQueryList;
  private systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;

  private _preferences$ = new BehaviorSubject<ThemePreferences>({
    mode: 'automatic',
    palette: 'normal',
  });

  private _activeTheme$ = new BehaviorSubject<ThemeConfig>({
    colorScheme: 'light',
    palette: 'normal',
  });

  constructor(
    private rendererFactory: RendererFactory2,
    private overlayContainer: OverlayContainer,
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    this._loadPreferences();
    this._setupSystemThemeListener();
  }

  /**
   * Get current theme preferences
   */
  getPreferences(): ThemePreferences {
    return this._preferences$.value;
  }

  /**
   * Observe theme preference changes
   */
  observePreferences(): Observable<ThemePreferences> {
    return this._preferences$.asObservable();
  }

  /**
   * Get the currently active theme (resolved from preferences)
   */
  getCurrentTheme(): ThemeConfig {
    return this._activeTheme$.value;
  }

  /**
   * Observe active theme changes
   */
  observeTheme(): Observable<ThemeConfig> {
    return this._activeTheme$.asObservable();
  }

  /**
   * Set the theme mode (automatic, light, or dark)
   */
  setThemeMode(mode: ThemeMode): void {
    const currentPrefs = this._preferences$.value;
    this._updatePreferences({ ...currentPrefs, mode });
  }

  /**
   * Set the palette (normal or colorblind)
   */
  setPalette(palette: PaletteType): void {
    const currentPrefs = this._preferences$.value;
    this._updatePreferences({ ...currentPrefs, palette });
  }

  /**
   * Update both theme mode and palette at once
   */
  setPreferences(preferences: ThemePreferences): void {
    this._updatePreferences(preferences);
  }

  /**
   * Check if dark mode is currently active
   */
  isDarkMode(): boolean {
    return this._activeTheme$.value.colorScheme === 'dark';
  }

  /**
   * Check if colorblind palette is active
   */
  isColorblindMode(): boolean {
    return this._activeTheme$.value.palette === 'colorblind';
  }

  /**
   * Clean up event listeners
   */
  ngOnDestroy(): void {
    if (this.systemThemeListener) {
      this.mediaQueryList.removeEventListener('change', this.systemThemeListener);
    }
  }

  /**
   * Load preferences from localStorage and apply them
   */
  private _loadPreferences(): void {
    const stored = localStorage.getItem(this.PREFERENCES_STORAGE_KEY);

    if (stored) {
      try {
        const preferences = JSON.parse(stored) as ThemePreferences;
        // Validate the loaded preferences
        if (this._isValidPreferences(preferences)) {
          this._preferences$.next(preferences);
        }
      } catch {
        // If parsing fails, try legacy format
        this._loadLegacyPreferences(stored);
      }
    }

    // Apply the initial theme
    this._applyTheme();
  }

  /**
   * Handle legacy theme format for backwards compatibility
   */
  private _loadLegacyPreferences(stored: string): void {
    try {
      const legacy = JSON.parse(stored) as Record<string, unknown>;
      if (legacy['colorScheme'] && legacy['palette']) {
        // Old ThemeConfig format
        const preferences: ThemePreferences = {
          mode: legacy['colorScheme'] === 'dark' ? 'dark' : 'light',
          palette: legacy['palette'] as PaletteType,
        };
        this._preferences$.next(preferences);
      } else if (stored === 'colorblind') {
        // Very old format
        this._preferences$.next({
          mode: 'light',
          palette: 'colorblind',
        });
      }
    } catch {
      // Ignore invalid legacy data
    }
  }

  /**
   * Validate preferences object
   */
  private _isValidPreferences(prefs: unknown): prefs is ThemePreferences {
    return (
      typeof prefs === 'object' &&
      prefs !== null &&
      'mode' in prefs &&
      'palette' in prefs &&
      ['automatic', 'light', 'dark'].includes((prefs as ThemePreferences).mode) &&
      ['normal', 'colorblind'].includes((prefs as ThemePreferences).palette)
    );
  }

  /**
   * Update preferences and apply theme
   */
  private _updatePreferences(preferences: ThemePreferences): void {
    this._preferences$.next(preferences);
    localStorage.setItem(this.PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
    this._applyTheme();
  }

  /**
   * Set up listener for system theme changes
   */
  private _setupSystemThemeListener(): void {
    this.systemThemeListener = () => {
      // Only react to system changes if in automatic mode
      if (this._preferences$.value.mode === 'automatic') {
        this._applyTheme();
      }
    };

    this.mediaQueryList.addEventListener('change', this.systemThemeListener);
  }

  /**
   * Apply the theme based on current preferences
   */
  private _applyTheme(): void {
    const preferences = this._preferences$.value;
    const colorScheme = this._resolveColorScheme(preferences.mode);

    const theme: ThemeConfig = {
      colorScheme,
      palette: preferences.palette,
    };

    // Update the active theme
    this._activeTheme$.next(theme);

    // Apply classes to body
    this._applyThemeClasses(theme);
  }

  /**
   * Resolve the actual color scheme based on mode
   */
  private _resolveColorScheme(mode: ThemeMode): 'light' | 'dark' {
    switch (mode) {
      case 'automatic':
        return this.mediaQueryList.matches ? 'dark' : 'light';
      case 'dark':
        return 'dark';
      case 'light':
      default:
        return 'light';
    }
  }

  /**
   * Apply theme classes to body and overlay container
   */
  private _applyThemeClasses(theme: ThemeConfig): void {
    const body = document.body;
    const overlayElement = this.overlayContainer.getContainerElement();

    // Remove existing theme classes
    this.renderer.removeClass(body, this.DARK_CLASS);
    this.renderer.removeClass(body, this.COLORBLIND_CLASS);
    overlayElement.classList.remove(this.DARK_CLASS, this.COLORBLIND_CLASS);

    // Apply color scheme class
    if (theme.colorScheme === 'dark') {
      this.renderer.addClass(body, this.DARK_CLASS);
      overlayElement.classList.add(this.DARK_CLASS);
    }

    // Apply palette class
    if (theme.palette === 'colorblind') {
      this.renderer.addClass(body, this.COLORBLIND_CLASS);
      overlayElement.classList.add(this.COLORBLIND_CLASS);
    }
  }
}
