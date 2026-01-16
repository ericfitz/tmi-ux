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

// Import Prism for syntax highlighting in markdown code blocks
import 'prismjs';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-scss';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';

// Mermaid is imported and configured in app.config.ts for diagram rendering

// Import locale data for date/number localization
// These must match the languages defined in language.service.ts
// Note: Some regional variants (e.g., bn-BD, ur-PK) don't exist in Angular,
// so we use the base locale (bn, ur) and register it under the regional code
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar-SA';
import localeBn from '@angular/common/locales/bn';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeEs from '@angular/common/locales/es';
import localeFr from '@angular/common/locales/fr';
import localeHe from '@angular/common/locales/he';
import localeHi from '@angular/common/locales/hi';
import localeId from '@angular/common/locales/id';
import localeJa from '@angular/common/locales/ja';
import localeKo from '@angular/common/locales/ko';
import localePt from '@angular/common/locales/pt';
import localeRu from '@angular/common/locales/ru';
import localeTh from '@angular/common/locales/th';
import localeUr from '@angular/common/locales/ur';
import localeZh from '@angular/common/locales/zh';

// Register all locales - codes must match those in language.service.ts
registerLocaleData(localeEn, 'en-US');
registerLocaleData(localeAr, 'ar-SA');
registerLocaleData(localeBn, 'bn-BD');
registerLocaleData(localeDe, 'de-DE');
registerLocaleData(localeEs, 'es-ES');
registerLocaleData(localeFr, 'fr-FR');
registerLocaleData(localeHe, 'he-IL');
registerLocaleData(localeHi, 'hi-IN');
registerLocaleData(localeId, 'id-ID');
registerLocaleData(localeJa, 'ja-JP');
registerLocaleData(localeKo, 'ko-KR');
registerLocaleData(localePt, 'pt-BR');
registerLocaleData(localeRu, 'ru-RU');
registerLocaleData(localeTh, 'th-TH');
registerLocaleData(localeUr, 'ur-PK');
registerLocaleData(localeZh, 'zh-CN');

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
