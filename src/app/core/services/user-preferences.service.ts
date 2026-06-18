import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { catchError, debounceTime, map, takeUntil, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { AUTH_SERVICE } from '../interfaces';
import { BrandingConfigService } from './branding-config.service';
import { LoggerService } from './logger.service';
import type { ThemeMode, PaletteType } from './theme.service';

// SEM@8d11f33679dbe57f2877a8858c52d771eec3313a: union type for diagram auto-layout orientation: automatic, horizontal, or vertical (pure)
export type AutoLayoutOrientation = 'automatic' | 'horizontal' | 'vertical';

/**
 * User preferences synced to server (roamable across devices)
 */
export interface UserPreferencesData {
  animations: boolean;
  themeMode: ThemeMode;
  colorBlindMode: boolean;
  showDeveloperTools: boolean;
  dashboardListView: boolean;
  hoverShowMetadata: boolean;
  showShapeBordersWithIcons: boolean;
  autoLayoutEnabled: boolean;
  autoLayoutOrientation: AutoLayoutOrientation;
  pageSize: 'usLetter' | 'A4';
  marginSize: 'narrow' | 'standard' | 'wide';
}

/**
 * Server API format for /me/preferences
 */
interface ServerPreferences extends Record<string, UserPreferencesData> {
  'tmi-ux': UserPreferencesData;
}

/**
 * Default preferences
 */
const DEFAULT_PREFERENCES: UserPreferencesData = {
  animations: true,
  themeMode: 'automatic',
  colorBlindMode: false,
  showDeveloperTools: false,
  dashboardListView: false,
  hoverShowMetadata: false,
  showShapeBordersWithIcons: true,
  autoLayoutEnabled: true,
  autoLayoutOrientation: 'automatic',
  pageSize: 'usLetter',
  marginSize: 'standard',
};

/**
 * LocalStorage key for cached preferences
 */
const STORAGE_KEY = 'tmi_preferences_v2';

/**
 * Legacy localStorage keys to migrate from
 */
const LEGACY_KEYS = {
  userPreferences: 'tmi_user_preferences',
  themePreferences: 'user-theme-preferences',
} as const;

/**
 * Legacy format for user preferences (from tmi_user_preferences key)
 */
interface LegacyUserPreferences {
  animations?: boolean;
  themeMode?: ThemeMode;
  colorBlindMode?: boolean;
  pageSize?: 'usLetter' | 'A4';
  marginSize?: 'narrow' | 'standard' | 'wide';
  showDeveloperTools?: boolean;
  dashboardListView?: boolean;
}

/**
 * Legacy format for theme preferences (from user-theme-preferences key)
 */
interface LegacyThemePreferences {
  mode?: ThemeMode;
  palette?: PaletteType;
}

/**
 * User Preferences Service
 *
 * Manages user preferences with server sync and localStorage cache:
 * - Loads preferences from server on app init (if authenticated)
 * - Caches preferences in localStorage for instant load and offline support
 * - Syncs changes to server with debouncing (500ms)
 * - Migrates from legacy localStorage keys
 * - Handles offline gracefully (no user-visible errors)
 *
 * Note: Language preference is NOT managed here - it remains localStorage-only
 * in LanguageService to respect browser/device language settings.
 */
@Injectable({
  providedIn: 'root',
})
// SEM@8d11f33679dbe57f2877a8858c52d771eec3313a: store and sync user preferences between localStorage cache and server with debounced writes
export class UserPreferencesService {
  private readonly apiService = inject(ApiService);
  private readonly authService = inject(AUTH_SERVICE);
  private readonly logger = inject(LoggerService);
  private readonly brandingConfigService = inject(BrandingConfigService);

  private readonly preferencesSubject = new BehaviorSubject<UserPreferencesData>(
    DEFAULT_PREFERENCES,
  );
  private readonly syncSubject = new Subject<UserPreferencesData>();
  private readonly destroy$ = new Subject<void>();

  /**
   * Observable stream of current preferences
   */
  readonly preferences$: Observable<UserPreferencesData> = this.preferencesSubject.asObservable();

  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: wire debounced server-sync pipeline on service init (mutates shared state)
  constructor() {
    // Set up debounced server sync
    this.syncSubject
      .pipe(
        debounceTime(500),
        tap(prefs => this.syncToServer(prefs)),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /**
   * Initialize preferences service
   * Should be called via APP_INITIALIZER before other services
   */
  // SEM@722a83b7ed334166eeffb7936fedfd6410c51a41: load user preferences from cache then server, seeding defaults if absent (reads DB)
  async initialize(): Promise<void> {
    this.logger.debug('UserPreferencesService: Initializing');

    try {
      // Load from localStorage cache first
      let preferences = this.loadFromLocalStorage();

      // Try to load from server if authenticated
      if (this.authService.isAuthenticated) {
        const serverPrefs = await this.loadFromServer();
        if (serverPrefs) {
          preferences = serverPrefs;
          this.logger.debug('UserPreferencesService: Loaded from server');
        } else {
          // Server has no preferences, sync local to server
          this.logger.debug('UserPreferencesService: Server empty, syncing local preferences');
          this.syncSubject.next(preferences);
        }
      }

      // Update state and cache
      this.preferencesSubject.next(preferences);
      this.saveToLocalStorage(preferences);

      this.logger.debug('UserPreferencesService: Initialized successfully');
    } catch (error) {
      this.logger.warn('UserPreferencesService: Initialization failed, using defaults', error);
      this.preferencesSubject.next(this.applyServerDefaultTheme(DEFAULT_PREFERENCES));
    }
  }

  /**
   * Get current preferences (synchronous)
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: fetch the current user preferences snapshot synchronously (pure)
  getPreferences(): UserPreferencesData {
    return this.preferencesSubject.value;
  }

  /**
   * Update preferences (partial update supported)
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: update user preferences locally and queue debounced server sync (mutates shared state)
  updatePreferences(partial: Partial<UserPreferencesData>): void {
    const updated = {
      ...this.preferencesSubject.value,
      ...partial,
    };

    // Update state and cache immediately (instant feedback)
    this.preferencesSubject.next(updated);
    this.saveToLocalStorage(updated);

    // Queue debounced server sync if authenticated
    if (this.authService.isAuthenticated) {
      this.syncSubject.next(updated);
    }
  }

  /**
   * Get theme preferences (convenience method for ThemeService)
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: convert stored preferences to a theme mode and palette pair (pure)
  getThemePreferences(): { mode: ThemeMode; palette: PaletteType } {
    const prefs = this.getPreferences();
    return {
      mode: prefs.themeMode,
      palette: prefs.colorBlindMode ? 'colorblind' : 'normal',
    };
  }

  /**
   * Load preferences from localStorage with migration
   */
  // SEM@8d11f33679dbe57f2877a8858c52d771eec3313a: fetch user preferences from localStorage, migrating legacy keys if needed (reads DB)
  private loadFromLocalStorage(): UserPreferencesData {
    try {
      // Try new storage key first
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<UserPreferencesData>;
        return this.mergeWithFieldMigrations(parsed);
      }

      // Try migrating from legacy keys
      const migrated = this.migrateFromLegacy();
      if (migrated) {
        this.logger.debug('UserPreferencesService: Migrated from legacy storage');
        return migrated;
      }
    } catch (error) {
      this.logger.warn('UserPreferencesService: Failed to load from localStorage', error);
    }

    return this.applyServerDefaultTheme(DEFAULT_PREFERENCES);
  }

  /**
   * Merge persisted preferences with defaults, applying per-field migration
   * for fields added after a user already had a preferences blob.
   *
   * autoLayoutEnabled: existing users (blob present, field absent) default to
   * `false` so saved diagrams aren't surprise-rearranged on first load. New
   * users (no blob at all) get the regular default of `true`.
   */
  // SEM@8d11f33679dbe57f2877a8858c52d771eec3313a: merge partial preferences with defaults, applying per-field migration rules (pure)
  private mergeWithFieldMigrations(parsed: Partial<UserPreferencesData>): UserPreferencesData {
    const merged = { ...DEFAULT_PREFERENCES, ...parsed };
    if (parsed.autoLayoutEnabled === undefined) {
      merged.autoLayoutEnabled = false;
    }
    return merged;
  }

  /**
   * Apply server-configured default theme when user has no saved preference.
   * Only modifies the themeMode field; all other defaults remain unchanged.
   */
  // SEM@3ab268cba5795031f4bde5e2423d5f9734bb35af: override theme mode in defaults with the server-configured branding theme (pure)
  private applyServerDefaultTheme(defaults: UserPreferencesData): UserPreferencesData {
    const serverTheme = this.brandingConfigService.defaultTheme;
    if (!serverTheme) {
      return defaults;
    }
    return { ...defaults, themeMode: serverTheme };
  }

  /**
   * Save preferences to localStorage
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: store user preferences to localStorage (mutates shared state)
  private saveToLocalStorage(preferences: UserPreferencesData): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      this.logger.warn('UserPreferencesService: Failed to save to localStorage', error);
    }
  }

  /**
   * Load preferences from server
   * Returns null if server has no preferences
   */
  // SEM@8d11f33679dbe57f2877a8858c52d771eec3313a: fetch user preferences from the server API, returning null if absent (reads DB)
  private async loadFromServer(): Promise<UserPreferencesData | null> {
    try {
      const response = await this.apiService
        .get<ServerPreferences>('/me/preferences')
        .pipe(
          map(serverPrefs => {
            // Server returns {} if no preferences exist
            if (!serverPrefs || !serverPrefs['tmi-ux']) {
              return null;
            }
            return this.mergeWithFieldMigrations(serverPrefs['tmi-ux']);
          }),
          catchError(error => {
            this.logger.warn('UserPreferencesService: Failed to load from server', error);
            return of(null);
          }),
        )
        .toPromise();

      return response || null;
    } catch (error) {
      this.logger.warn('UserPreferencesService: Server load error', error);
      return null;
    }
  }

  /**
   * Sync preferences to server (debounced)
   */
  // SEM@a7d070cec042b44aeb8938d8dbe3942da8ee7dcf: store user preferences to the server API when authenticated (mutates shared state)
  private syncToServer(preferences: UserPreferencesData): void {
    if (!this.authService.isAuthenticated) {
      return;
    }

    const serverPrefs: ServerPreferences = {
      'tmi-ux': preferences,
    };

    this.apiService
      .put<ServerPreferences>('/me/preferences', serverPrefs)
      .pipe(
        tap(() => {
          this.logger.debug('UserPreferencesService: Synced to server');
        }),
        catchError(error => {
          this.logger.warn('UserPreferencesService: Failed to sync to server', error);
          // Don't throw - preferences still work from localStorage
          return of(null);
        }),
      )
      .subscribe();
  }

  /**
   * Migrate from legacy localStorage keys
   */
  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: migrate user preferences from legacy localStorage keys, removing old entries (mutates shared state)
  private migrateFromLegacy(): UserPreferencesData | null {
    try {
      const oldUserPrefs = localStorage.getItem(LEGACY_KEYS.userPreferences);
      const oldThemePrefs = localStorage.getItem(LEGACY_KEYS.themePreferences);

      if (!oldUserPrefs && !oldThemePrefs) {
        return null;
      }

      const migrated: UserPreferencesData = { ...DEFAULT_PREFERENCES };

      // Migrate from tmi_user_preferences
      if (oldUserPrefs) {
        const parsed = JSON.parse(oldUserPrefs) as LegacyUserPreferences;
        if (parsed.animations !== undefined) migrated.animations = parsed.animations;
        if (parsed.themeMode !== undefined) migrated.themeMode = parsed.themeMode;
        if (parsed.colorBlindMode !== undefined) migrated.colorBlindMode = parsed.colorBlindMode;
        if (parsed.pageSize !== undefined) migrated.pageSize = parsed.pageSize;
        if (parsed.marginSize !== undefined) migrated.marginSize = parsed.marginSize;
        if (parsed.showDeveloperTools !== undefined)
          migrated.showDeveloperTools = parsed.showDeveloperTools;
        if (parsed.dashboardListView !== undefined)
          migrated.dashboardListView = parsed.dashboardListView;
      }

      // Migrate from user-theme-preferences
      if (oldThemePrefs) {
        const parsed = JSON.parse(oldThemePrefs) as LegacyThemePreferences;
        if (parsed.mode !== undefined) migrated.themeMode = parsed.mode;
        if (parsed.palette !== undefined) {
          migrated.colorBlindMode = parsed.palette === 'colorblind';
        }
      }

      // Clean up legacy keys
      localStorage.removeItem(LEGACY_KEYS.userPreferences);
      localStorage.removeItem(LEGACY_KEYS.themePreferences);
      // Note: preferredLanguage NOT removed - still used by LanguageService

      return migrated;
    } catch (error) {
      this.logger.warn('UserPreferencesService: Failed to migrate from legacy storage', error);
      return null;
    }
  }

  /**
   * Cleanup on service destroy
   */
  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: complete the destroy subject to cancel all active subscriptions (mutates shared state)
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
