/**
 * Application Bootstrap Entry Point
 *
 * This file serves as the main entry point for the Angular application.
 * It bootstraps the standalone AppComponent and handles initial application setup.
 *
 * Key functionality:
 * - Bootstraps the Angular application using the standalone component pattern
 * - Registers locale data for internationalization support (en, de, zh, ar, th)
 * - Sets up RTL (right-to-left) text direction for Arabic language
 * - Provides error handling for application bootstrap failures
 * - Uses self-executing async function to avoid global scope pollution
 */

import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Import locale data for date/number localization
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeTh from '@angular/common/locales/th';
import localeZh from '@angular/common/locales/zh';

// Register all locales
registerLocaleData(localeEn, 'en-US');
registerLocaleData(localeDe, 'de');
registerLocaleData(localeZh, 'zh');
registerLocaleData(localeAr, 'ar');
registerLocaleData(localeTh, 'th');

// Register RTL for Arabic
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.getAttribute('lang') === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
  }
});

// Use a self-executing function to avoid exposing the logger in global scope
void (async () => {
  try {
    await bootstrapApplication(AppComponent, appConfig);
  } catch (err) {
    // We need to use console.error here since LoggerService isn't available yet
    console.error('Application bootstrap failed:', err);
  }
})();
