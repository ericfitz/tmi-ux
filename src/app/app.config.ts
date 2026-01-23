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
  SecurityContext,
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { BidiModule } from '@angular/cdk/bidi';
import { MAT_DIALOG_DEFAULT_OPTIONS } from '@angular/material/dialog';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import {
  provideMarkdown,
  MARKED_OPTIONS,
  MERMAID_OPTIONS,
  MarkedRenderer,
  MarkedOptions,
} from 'ngx-markdown';
import mermaid from 'mermaid';
import type { MermaidConfig } from 'mermaid';
import DOMPurify from 'dompurify';

import { routes } from './app.routes';
import { TranslocoRootModule } from './i18n/transloco.module';
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
): () => Promise<void> {
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

// Marked configuration with security and syntax highlighting
function markedOptionsFactory(): MarkedOptions {
  const renderer = new MarkedRenderer();

  // Override the renderer's heading method to add IDs
  renderer.heading = function (args): string {
    const text = this.parser.parseInline(args.tokens);
    const level = args.depth;
    // Generate ID from heading text (lowercase, replace spaces with hyphens)
    // Use DOMPurify to strip HTML tags to avoid incomplete multi-character sanitization
    // vulnerability (text is already rendered HTML at this point from parseInline)
    const id = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] })
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim();

    return `<h${level} id="${id}">${text}</h${level}>`;
  };

  // Override the renderer's link method to open external links in new tab
  renderer.link = function (token): string {
    const href = token.href;
    const title = token.title;
    const text = this.parser.parseInline(token.tokens);

    // Check if this is an external link (starts with http:// or https://)
    const isExternal = href && /^https?:\/\//i.test(href);

    // Build the anchor tag with proper attributes
    let html = '<a href="' + href + '"';
    if (title) {
      html += ' title="' + title + '"';
    }
    if (isExternal) {
      html += ' target="_blank" rel="noopener noreferrer"';
    }
    html += '>' + text + '</a>';

    return html;
  };

  // Override the renderer's html method to sanitize output
  const originalHtml = renderer.html.bind(renderer);
  renderer.html = (args): string => {
    const html = originalHtml(args);
    return DOMPurify.sanitize(html, {
      // Allow all standard markdown HTML elements
      ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'strong',
        'em',
        'del',
        'a',
        'img',
        'code',
        'pre',
        'ul',
        'ol',
        'li',
        'blockquote',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
        'input',
        'span',
        'div',
        'svg',
        'path',
        'g',
        'rect',
        'circle',
        'line',
        'polygon',
        'text',
        'tspan',
      ],
      ALLOWED_ATTR: [
        'href',
        'src',
        'alt',
        'title',
        'class',
        'id',
        'type',
        'checked',
        'disabled',
        'data-line',
        'data-sourcepos',
        'style',
        'viewBox',
        'xmlns',
        'width',
        'height',
        'fill',
        'stroke',
        'stroke-width',
        'd',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'points',
        'transform',
        'target',
        'rel',
      ],
      ALLOWED_URI_REGEXP:
        /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
  };

  return {
    renderer,
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Convert \n to <br>
    pedantic: false,
  };
}

// Mermaid configuration
function mermaidOptionsFactory(): MermaidConfig {
  const config: MermaidConfig = {
    theme: 'default',
    startOnLoad: false,
    securityLevel: 'strict', // Prevent XSS in mermaid diagrams
    maxTextSize: 50000,
  };

  // Expose mermaid globally for ngx-markdown (it checks for window.mermaid)
  if (typeof window !== 'undefined') {
    (window as unknown as { mermaid: typeof mermaid }).mermaid = mermaid;
  }

  // Initialize mermaid with the config
  mermaid.initialize(config);

  return config;
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
    // Configure markdown with DOMPurify sanitization (handled in markedOptionsFactory)
    // Mermaid rendering is enabled via MERMAID_OPTIONS provider below
    provideMarkdown({
      sanitize: SecurityContext.NONE, // We handle sanitization via DOMPurify in the renderer
    }),
    {
      provide: MARKED_OPTIONS,
      useFactory: markedOptionsFactory,
    },
    {
      provide: MERMAID_OPTIONS,
      useFactory: mermaidOptionsFactory,
    },
    // Register HTTP interceptors (order matters - first registered runs first)
    // 1. JwtInterceptor - adds Authorization header first so it's visible in logs
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
    // 2. HttpLoggingInterceptor - logs all HTTP requests/responses with auth header present
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
    // Initialize Material Icons
    {
      provide: APP_INITIALIZER,
      useFactory: initializeMaterialIcons,
      deps: [MatIconRegistry, DomSanitizer],
      multi: true,
    },
    // Initialize user preferences (must run before theme service)
    {
      provide: APP_INITIALIZER,
      useFactory: initializeUserPreferences,
      deps: [UserPreferencesService],
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
