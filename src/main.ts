/// <reference types="@angular/localize" />

import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Import locale data
import '@angular/common/locales/global/de';
import '@angular/common/locales/global/zh';
import '@angular/common/locales/global/ar';

// Register RTL for Arabic
document.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.getAttribute('lang') === 'ar') {
    document.documentElement.setAttribute('dir', 'rtl');
  } else {
    document.documentElement.setAttribute('dir', 'ltr');
  }
});

bootstrapApplication(AppComponent, appConfig)
  .catch((err) => console.error(err));
