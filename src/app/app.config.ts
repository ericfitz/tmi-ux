import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { LoggerService, LogLevel } from './core/services/logger.service';

// Get locale from URL or localStorage or navigator
function getLocale(): string {
  // Check URL query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const langParam = urlParams.get('lang');
  if (langParam) {
    // Store this choice in localStorage
    localStorage.setItem('preferredLanguage', langParam);
    return langParam;
  }

  // Check localStorage
  const storedLang = localStorage.getItem('preferredLanguage');
  if (storedLang) {
    return storedLang;
  }

  // Check browser locale
  const browserLang = navigator.language || (navigator as any).userLanguage;
  if (browserLang) {
    // Check if the browser locale is one we support
    const supportedLocales = ['en-US', 'de', 'zh', 'ar'];
    
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

  // Default to English
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
