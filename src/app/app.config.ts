import { ApplicationConfig, provideZoneChangeDetection, LOCALE_ID, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';

import { routes } from './app.routes';
import { LoggerService, LogLevel } from './core/services/logger.service';
import { TranslocoRootModule } from './i18n/transloco.module';

// We still need LOCALE_ID for date formatting with Angular's pipes
function getBasicLocale(): string {
  const storedLang = localStorage.getItem('preferredLanguage');
  const supportedLocales = ['en-US', 'de', 'zh', 'ar'];
  
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
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    // Add Transloco root module
    importProvidersFrom(TranslocoRootModule)
  ]
};
