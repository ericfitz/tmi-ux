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
} from '@angular/core';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { TranslocoRootModule } from './i18n/transloco.module';
import { JwtInterceptor } from './auth/interceptors/jwt.interceptor';

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

export const appConfig: ApplicationConfig = {
  providers: [
    // Still provide LOCALE_ID for date and number formatting
    { provide: LOCALE_ID, useValue: getBasicLocale() },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi(), withFetch()),
    provideAnimations(),
    // Add Transloco root module
    importProvidersFrom(TranslocoRootModule),
    // Register JWT Interceptor
    {
      provide: HTTP_INTERCEPTORS,
      useClass: JwtInterceptor,
      multi: true,
    },
  ],
};
