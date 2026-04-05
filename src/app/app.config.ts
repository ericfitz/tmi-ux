/**
 * Application Configuration
 *
 * This file defines the main application configuration for the Angular standalone application.
 * It configures all global providers and services needed throughout the application.
 *
 * Key functionality:
 * - Configures routing with component input binding support
 * - Sets up HTTP client with fetch API and JWT interceptors
 * - Provides animations support for Angular Material components
 * - Configures internationalization with Transloco and locale support
 * - Sets up zone.js change detection with event coalescing for performance
 * - Determines locale from user preferences with fallback to English
 * - Registers JWT interceptor for automatic token attachment to HTTP requests
 */

import {
  provideHttpClient,
  withInterceptorsFromDi,
  withFetch,
  HTTP_INTERCEPTORS,
} from '@angular/common/http';
import {
  ApplicationConfig,
  provideZoneChangeDetection,
  LOCALE_ID,
  importProvidersFrom,
  APP_INITIALIZER,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { BidiModule } from '@angular/cdk/bidi';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { routes } from './app.routes';
import { TranslocoRootModule } from './i18n/transloco.module';
import { CacheControlInterceptor } from './core/interceptors/cache-control.interceptor';
import { CredentialsInterceptor } from './core/interceptors/credentials.interceptor';
import { HttpLoggingInterceptor } from './core/interceptors/http-logging.interceptor';
import { JwtInterceptor } from './auth/interceptors/jwt.interceptor';
import { SecurityConfigService } from './core/services/security-config.service';
import { DialogDirectionService } from './core/services/dialog-direction.service';
import {
  AUTH_SERVICE,
  THREAT_MODEL_SERVICE,
  COLLABORATION_NOTIFICATION_SERVICE,
} from './core/interfaces';
import { AuthService } from './auth/services/auth.service';
import { ThreatModelService } from './pages/tm/services/threat-model.service';
import { ThemeService } from './core/services/theme.service';
import { UserPreferencesService } from './core/services/user-preferences.service';
import { WebSocketAdapter } from './core/services/websocket.adapter';
import { AppNotificationService } from './pages/dfd/application/services/app-notification.service';
import { TokenValidityGuardService } from './auth/services/token-validity-guard.service';
import { BrandingConfigService } from './core/services/branding-config.service';

// We still need LOCALE_ID for date formatting with Angular's pipes
function getBasicLocale(): string {
  const storedLang = localStorage.getItem('preferredLanguage');
  const supportedLocales = ['en-US', 'de', 'zh', 'ar', 'th'];

  if (storedLang && supportedLocales.includes(storedLang)) {
    return storedLang;
  }

  // Default to English
  return 'en-US';
}

// Security initialization function
function initializeSecurityMonitoring(securityConfig: SecurityConfigService): () => void {
  return () => {
    securityConfig.monitorSecurityViolations();
  };
}

// Dialog direction initialization function
function initializeDialogDirection(_dialogDirection: DialogDirectionService): () => void {
  return () => {
    // Service initialization happens in constructor
  };
}

// Material Icons initialization function
function initializeMaterialIcons(
  iconRegistry: MatIconRegistry,
  _sanitizer: DomSanitizer,
): () => void {
  return () => {
    // Register the Material Symbols Outlined font set
    // The alias 'material-symbols-outlined' maps to the CSS class 'material-symbols-outlined'
    // which applies font-family: 'Material Symbols Outlined' via SCSS
    iconRegistry.registerFontClassAlias('material-symbols-outlined', 'material-symbols-outlined');
    iconRegistry.setDefaultFontSetClass('material-symbols-outlined');
  };
}

// User preferences initialization function
function initializeUserPreferences(
  userPreferencesService: UserPreferencesService,
  _brandingConfigService: BrandingConfigService,
): () => Promise<void> {
  // BrandingConfigService is a dep so Angular constructs the singleton before this factory
  // runs. Both initializers execute concurrently; defaultTheme will be null if branding init
  // hasn't resolved yet, in which case UserPreferencesService falls back to 'automatic'.
  return () => userPreferencesService.initialize();
}

// Theme initialization function
function initializeTheme(_themeService: ThemeService): () => void {
  return () => {
    // Theme service automatically loads and applies saved theme preference in constructor
  };
}

// WebSocket-Auth integration initialization function
function initializeWebSocketAuth(
  websocketAdapter: WebSocketAdapter,
  authService: AuthService,
): () => void {
  return () => {
    // Wire up WebSocketAdapter with AuthService for activity-based token refresh
    websocketAdapter.setAuthService(authService);
  };
}

// Auth status check initialization function
// Calls GET /me to detect an existing session cookie on page load.
// Runs via APP_INITIALIZER so the HTTP call happens after DI is complete,
// not during AuthService construction (which would cause circular deps).
function initializeAuthStatus(authService: AuthService): () => Promise<void> {
  return () => authService.checkAuthStatus();
}

// Token validity guard initialization function
function initializeTokenValidityGuard(tokenValidityGuard: TokenValidityGuardService): () => void {
  return () => {
    // Start monitoring for token expiry across visibility changes, timer drift, and cross-tab events
    tokenValidityGuard.startMonitoring();
  };
}

// Branding configuration initialization function
function initializeBrandingConfig(
  brandingConfigService: BrandingConfigService,
): () => Promise<void> {
  return () => brandingConfigService.initialize();
}

export const appConfig: ApplicationConfig = {
  providers: [
    // Still provide LOCALE_ID for date and number formatting
    { provide: LOCALE_ID, useValue: getBasicLocale() },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    provideAnimations(),
    // Add Bidi module for RTL/LTR support
    importProvidersFrom(BidiModule),
    // Configure Material Dialog to respect document direction
    {
      provide: MAT_DIALOG_DEFAULT_OPTIONS,
      useValue: {
        hasBackdrop: true,
        disableClose: false,
        autoFocus: true,
        restoreFocus: true,
        direction: undefined, // Will use document direction
      },
    },
    // Add Transloco root module
    importProvidersFrom(TranslocoRootModule),
    // Markdown/Mermaid/DOMPurify providers are lazy-loaded via provideMarkdownConfig()
    // in tm.routes.ts and triage.routes.ts to reduce initial bundle size
    // Register HTTP interceptors (order matters - first registered runs first)
    // 1. CredentialsInterceptor - adds withCredentials for cross-origin cookie auth
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CredentialsInterceptor,
      multi: true,
    },
    // 2. AuthInterceptor - handles 401 errors with cookie-based refresh/retry
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
    // 3. CacheControlInterceptor - prevents caching of sensitive API responses (AUTH-VULN-006)
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CacheControlInterceptor,
      multi: true,
    },
    // 4. HttpLoggingInterceptor - logs all HTTP requests/responses with all headers present
    {
      provide: HTTP_INTERCEPTORS,
      useClass: HttpLoggingInterceptor,
      multi: true,
    },
    // Initialize security monitoring
    {
      provide: APP_INITIALIZER,
      useFactory: initializeSecurityMonitoring,
      deps: [SecurityConfigService],
      multi: true,
    },
    // Initialize dialog direction service
    {
      provide: APP_INITIALIZER,
      useFactory: initializeDialogDirection,
      deps: [DialogDirectionService],
      multi: true,
    },
    // Initialize branding configuration (fetches server /config, pre-loads logo)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeBrandingConfig,
      deps: [BrandingConfigService],
      multi: true,
    },
    // Initialize Material Icons
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMaterialIcons,
      deps: [MatIconRegistry, DomSanitizer],
      multi: true,
    },
    // Check auth status via GET /me (detects existing session cookie on page load)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeAuthStatus,
      deps: [AuthService],
      multi: true,
    },
    // Initialize user preferences (must run after auth status check and before theme service)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserPreferences,
      deps: [UserPreferencesService, BrandingConfigService],
      multi: true,
    },
    // Initialize theme service
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTheme,
      deps: [ThemeService],
      multi: true,
    },
    // Initialize WebSocket-Auth integration for activity-based token refresh
    {
      provide: APP_INITIALIZER,
      useFactory: initializeWebSocketAuth,
      deps: [WebSocketAdapter, AuthService],
      multi: true,
    },
    // Initialize token validity guard for zombie session prevention
    // This monitors visibility changes, timer drift, and cross-tab logout events
    {
      provide: APP_INITIALIZER,
      useFactory: initializeTokenValidityGuard,
      deps: [TokenValidityGuardService],
      multi: true,
    },
    // Provide services with interface tokens to satisfy DI requirements
    {
      provide: AUTH_SERVICE,
      useExisting: AuthService,
    },
    {
      provide: THREAT_MODEL_SERVICE,
      useExisting: ThreatModelService,
    },
    {
      provide: COLLABORATION_NOTIFICATION_SERVICE,
      useExisting: AppNotificationService,
    },
  ],
};
