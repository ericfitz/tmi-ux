import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { UserPreferencesService } from './user-preferences.service';

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
 * Note: Theme preferences are now managed by UserPreferencesService and synced to server.
 * This service handles theme application and system theme detection only.
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
  private readonly DARK_CLASS = 'dark-theme';
  private readonly COLORBLIND_CLASS = 'colorblind-palette';

  private renderer: Renderer2;
  private mediaQueryList: MediaQueryList;
  private systemThemeListener: ((event: MediaQueryListEvent) => void) | null = null;
  private destroy$ = new Subject<void>();

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
    private userPreferencesService: UserPreferencesService,
  ) {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    this._loadPreferences();
    this._setupSystemThemeListener();
    this._subscribeToUserPreferences();
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
    const palette = this._preferences$.value.palette;
    this.userPreferencesService.updatePreferences({
      themeMode: mode,
      colorBlindMode: palette === 'colorblind',
    });
  }

  /**
   * Set the palette (normal or colorblind)
   */
  setPalette(palette: PaletteType): void {
    const mode = this._preferences$.value.mode;
    this.userPreferencesService.updatePreferences({
      themeMode: mode,
      colorBlindMode: palette === 'colorblind',
    });
  }

  /**
   * Update both theme mode and palette at once
   */
  setPreferences(preferences: ThemePreferences): void {
    this.userPreferencesService.updatePreferences({
      themeMode: preferences.mode,
      colorBlindMode: preferences.palette === 'colorblind',
    });
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
   * Clean up event listeners and subscriptions
   */
  ngOnDestroy(): void {
    if (this.systemThemeListener) {
      this.mediaQueryList.removeEventListener('change', this.systemThemeListener);
    }
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load preferences from UserPreferencesService and apply them
   */
  private _loadPreferences(): void {
    const userPrefs = this.userPreferencesService.getThemePreferences();
    this._preferences$.next(userPrefs);

    // Apply the initial theme
    this._applyTheme();
  }

  /**
   * Subscribe to user preferences changes from UserPreferencesService
   */
  private _subscribeToUserPreferences(): void {
    this.userPreferencesService.preferences$.pipe(takeUntil(this.destroy$)).subscribe(prefs => {
      const themePrefs: ThemePreferences = {
        mode: prefs.themeMode,
        palette: prefs.colorBlindMode ? 'colorblind' : 'normal',
      };

      this._preferences$.next(themePrefs);
      this._applyTheme();
    });
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
