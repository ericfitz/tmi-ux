import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { LoggerService, LogLevel } from './core/services/logger.service';

// Get locale from URL or localStorage or navigator
function getLocale(): string {
  const supportedLocales = ['en-US', 'de', 'zh', 'ar'];
  
  // Check URL query parameter (highest priority - explicit user choice)
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam) {
    // Validate the language parameter
    if (supportedLocales.includes(langParam)) {
      // Store this explicit choice in localStorage
      localStorage.setItem('preferredLanguage', langParam);
      // Remove the query parameter to keep the URL clean
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('lang');
      window.history.replaceState({}, '', newUrl.toString());
      return langParam;
    }
  }

  // Check localStorage (second priority - previously selected language)
  const storedLang = localStorage.getItem('preferredLanguage');
  if (storedLang && supportedLocales.includes(storedLang)) {
    return storedLang;
  }

  // Check browser locale (third priority - browser preference)
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (browserLang) {
    // First try exact match
    if (supportedLocales.includes(browserLang)) {
      return browserLang;
    }
    
    // Then try base language match (e.g., 'en' from 'en-US')
    const baseLang = browserLang.split('-')[0];
    const baseMatch = supportedLocales.find(locale => locale.startsWith(baseLang));
    if (baseMatch) {
      return baseMatch;
    }
  }

  // Default to English (lowest priority - fallback)
  return 'en-US';
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: LOCALE_ID, useValue: getLocale() },
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations()
  ]
};
