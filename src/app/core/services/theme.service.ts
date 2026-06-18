import { DestroyRef, Injectable, Renderer2, RendererFactory2 } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { OverlayContainer } from '@angular/cdk/overlay';
import { BehaviorSubject, Observable } from 'rxjs';
import { UserPreferencesService } from './user-preferences.service';

/**
 * Theme preference modes
 */
// SEM@f345afedad08561c58323a139ef27f2821b84d1c: union type for the three supported theme mode options (pure)
export type ThemeMode = 'automatic' | 'light' | 'dark';

/**
 * Palette types
 */
// SEM@f345afedad08561c58323a139ef27f2821b84d1c: union type for supported color palette variants (pure)
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
// SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: manage app-wide theme mode and palette, applying CSS classes to DOM (mutates shared state)
export class ThemeService {
  private readonly DARK_CLASS = 'dark-theme';
  private readonly COLORBLIND_CLASS = 'colorblind-palette';

  private destroyRef: DestroyRef | null = null;
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: initialize theme service, loading preferences and registering system theme listener (mutates shared state)
  constructor(
    private rendererFactory: RendererFactory2,
    private overlayContainer: OverlayContainer,
    private userPreferencesService: UserPreferencesService,
    destroyRef?: DestroyRef,
  ) {
    this.destroyRef = destroyRef ?? null;
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    this._loadPreferences();
    this._setupSystemThemeListener();
    this._subscribeToUserPreferences();
  }

  /**
   * Get current theme preferences
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: return the current user theme preferences snapshot (pure)
  getPreferences(): ThemePreferences {
    return this._preferences$.value;
  }

  /**
   * Observe theme preference changes
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: subscribe to a stream of theme preference changes (pure)
  observePreferences(): Observable<ThemePreferences> {
    return this._preferences$.asObservable();
  }

  /**
   * Get the currently active theme (resolved from preferences)
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: return the currently resolved active theme config snapshot (pure)
  getCurrentTheme(): ThemeConfig {
    return this._activeTheme$.value;
  }

  /**
   * Observe active theme changes
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: subscribe to a stream of resolved active theme config changes (pure)
  observeTheme(): Observable<ThemeConfig> {
    return this._activeTheme$.asObservable();
  }

  /**
   * Set the theme mode (automatic, light, or dark)
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: update the theme mode preference and persist via user preferences service (mutates shared state)
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
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: update the color palette preference and persist via user preferences service (mutates shared state)
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
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: update both theme mode and palette preferences atomically (mutates shared state)
  setPreferences(preferences: ThemePreferences): void {
    this.userPreferencesService.updatePreferences({
      themeMode: preferences.mode,
      colorBlindMode: preferences.palette === 'colorblind',
    });
  }

  /**
   * Check if dark mode is currently active
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: return whether dark color scheme is currently active (pure)
  isDarkMode(): boolean {
    return this._activeTheme$.value.colorScheme === 'dark';
  }

  /**
   * Check if colorblind palette is active
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: return whether the colorblind palette is currently active (pure)
  isColorblindMode(): boolean {
    return this._activeTheme$.value.palette === 'colorblind';
  }

  /**
   * Clean up event listeners
   */
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: deregister system theme change listener on service destruction (mutates shared state)
  ngOnDestroy(): void {
    if (this.systemThemeListener) {
      this.mediaQueryList.removeEventListener('change', this.systemThemeListener);
    }
  }

  /**
   * Load preferences from UserPreferencesService and apply them
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: load stored theme preferences and apply the initial theme to the DOM (mutates shared state)
  private _loadPreferences(): void {
    const userPrefs = this.userPreferencesService.getThemePreferences();
    this._preferences$.next(userPrefs);

    // Apply the initial theme
    this._applyTheme();
  }

  /**
   * Subscribe to user preferences changes from UserPreferencesService
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: subscribe to user preference changes and trigger theme re-apply (mutates shared state)
  private _subscribeToUserPreferences(): void {
    const source$ = this.userPreferencesService.preferences$;
    const subscription$ = this.destroyRef
      ? source$.pipe(takeUntilDestroyed(this.destroyRef))
      : source$;

    subscription$.subscribe(prefs => {
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
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: register OS-level color scheme change listener to re-apply theme in automatic mode (mutates shared state)
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
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: resolve current preferences into active theme config and apply to DOM (mutates shared state)
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
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: convert theme mode into light or dark color scheme, honoring system preference (pure)
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
  // SEM@f345afedad08561c58323a139ef27f2821b84d1c: apply dark and colorblind CSS classes to body and overlay container (mutates shared state)
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
