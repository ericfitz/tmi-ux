import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// Import locale data for date/number localization
import { registerLocaleData } from '@angular/common';
import localeAr from '@angular/common/locales/ar';
import localeDe from '@angular/common/locales/de';
import localeEn from '@angular/common/locales/en';
import localeZh from '@angular/common/locales/zh';

// Register all locales
registerLocaleData(localeEn, 'en-US');
registerLocaleData(localeDe, 'de');
registerLocaleData(localeZh, 'zh');
registerLocaleData(localeAr, 'ar');

// Register RTL for Arabic
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.getAttribute('lang') === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
  }
});

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));
