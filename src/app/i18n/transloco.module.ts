import { NgModule, APP_INITIALIZER } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { 
  TranslocoModule, 
  TRANSLOCO_CONFIG, 
  TranslocoConfig,
  provideTransloco,
  TranslocoService
} from '@jsverse/transloco';
import { TranslocoHttpLoader } from './transloco-loader';
import { environment } from '../../environments/environment';
import { firstValueFrom } from 'rxjs';

// Function to get the initial language
function getInitialLang(): string {
  const supportedLangs = ['en-US', 'de', 'zh', 'ar'];
  
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
export function preloadTranslations(transloco: TranslocoService): () => Promise<any> {
  return () => {
    // Get preferred language
    const langToLoad = getInitialLang();
    
    // Set active language and load it
    transloco.setActiveLang(langToLoad);
    
    // Set document language
    document.documentElement.lang = langToLoad;
    
    // Set RTL if needed
    if (langToLoad === 'ar') {
      document.documentElement.dir = 'rtl';
    } else {
      document.documentElement.dir = 'ltr';
    }
    
    // Preload the default language and return Promise
    return firstValueFrom(transloco.load(langToLoad));
  };
}

@NgModule({
  imports: [
    HttpClientModule
  ],
  exports: [
    TranslocoModule
  ],
  providers: [
    provideTransloco({
      config: {
        availableLangs: ['en-US', 'de', 'zh', 'ar'],
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        reRenderOnLangChange: true,
        prodMode: environment.production,
        missingHandler: {
          useFallbackTranslation: true
        }
      },
      loader: TranslocoHttpLoader
    }),
    {
      provide: APP_INITIALIZER,
      useFactory: preloadTranslations,
      deps: [TranslocoService],
      multi: true
    }
  ]
})
export class TranslocoRootModule {}