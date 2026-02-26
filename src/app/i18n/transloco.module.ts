import { NgModule, APP_INITIALIZER } from '@angular/core';
import { TranslocoModule, provideTransloco, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

import { TranslocoHttpLoader } from './transloco-loader.service';
import { environment } from '../../environments/environment';
import {
  SUPPORTED_LANGUAGE_CODES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  detectPreferredLanguage,
} from './language-config';

// This function initializes Transloco during app startup
export function preloadTranslations(transloco: TranslocoService): () => Promise<unknown> {
  return () => {
    // Get preferred language (skip URL params — LanguageService handles those)
    const langToLoad = detectPreferredLanguage(null);

    // Set active language
    transloco.setActiveLang(langToLoad);

    // Set document language
    document.documentElement.lang = langToLoad;

    // Set RTL if needed
    const langConfig = SUPPORTED_LANGUAGES.find(l => l.code === langToLoad);
    document.documentElement.dir = langConfig?.rtl ? 'rtl' : 'ltr';

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
        availableLangs: SUPPORTED_LANGUAGE_CODES,
        defaultLang: DEFAULT_LANGUAGE,
        fallbackLang: DEFAULT_LANGUAGE,
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
