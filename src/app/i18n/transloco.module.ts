import { NgModule, APP_INITIALIZER } from '@angular/core';
import { TranslocoModule, provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { TranslocoHttpLoader } from './transloco-loader.service';
import { environment } from '../../environments/environment';

// Function to get the initial language
function getInitialLang(): string {
  const supportedLangs = [
    'en-US',
    'ar-SA',
    'bn-BD',
    'de-DE',
    'es-ES',
    'fr-FR',
    'he-IL',
    'hi-IN',
    'id-ID',
    'ja-JP',
    'ko-KR',
    'pt-BR',
    'ru-RU',
    'th-TH',
    'ur-PK',
    'zh-CN',
  ];

  // Check localStorage for saved preference
  const savedLang = localStorage.getItem('preferredLanguage');
  if (savedLang && supportedLangs.includes(savedLang)) {
    return savedLang;
  }

  // Check browser language
  const browserLang = navigator.language;
  if (browserLang) {
    // Try exact match
    if (supportedLangs.includes(browserLang)) {
      return browserLang;
    }

    // Try base language match
    const baseLang = browserLang.split('-')[0];
    const baseMatch = supportedLangs.find(l => l.startsWith(baseLang));
    if (baseMatch) {
      return baseMatch;
    }
  }

  // Default to English
  return 'en-US';
}

// This function initializes Transloco during app startup
export function preloadTranslations(transloco: TranslocoService): () => Promise<unknown> {
  return () => {
    // Get preferred language
    const langToLoad = getInitialLang();

    // Set active language
    transloco.setActiveLang(langToLoad);

    // Set document language
    document.documentElement.lang = langToLoad;

    // Set RTL if needed
    const rtlLanguages = ['ar-SA', 'he-IL', 'ur-PK'];
    if (rtlLanguages.includes(langToLoad)) {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }

    // Always preload English as the fallback language
    const loadPromises: Promise<unknown>[] = [firstValueFrom(transloco.load('en-US'))];

    // Only load the preferred language if it's not English
    if (langToLoad !== 'en-US') {
      loadPromises.push(firstValueFrom(transloco.load(langToLoad)));
    }

    // Return a promise that resolves when all required languages are loaded
    return Promise.all(loadPromises).then(() => null);
  };
}

@NgModule({
  exports: [TranslocoModule],
  providers: [
    provideTransloco({
      config: {
        availableLangs: [
          'en-US',
          'ar-SA',
          'bn-BD',
          'de-DE',
          'es-ES',
          'fr-FR',
          'he-IL',
          'hi-IN',
          'id-ID',
          'ja-JP',
          'ko-KR',
          'pt-BR',
          'ru-RU',
          'th-TH',
          'ur-PK',
          'zh-CN',
        ],
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        reRenderOnLangChange: true,
        prodMode: environment.production,
        // Lazy load translations on demand - only preload English
        missingHandler: {
          useFallbackTranslation: true,
        },
      },
      loader: TranslocoHttpLoader,
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: preloadTranslations,
      deps: [TranslocoService],
      multi: true,
    },
  ],
})
export class TranslocoRootModule {}
