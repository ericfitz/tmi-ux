import { NgModule } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TranslocoModule, provideTransloco, TranslocoLoader } from '@jsverse/transloco';
import { Observable, of } from 'rxjs';

// Mock loader that implements the TranslocoLoader interface
class TestLoader implements TranslocoLoader {
  getTranslation(_lang: string): Observable<Record<string, string>> {
    return of({
      // Add mock translations for dates in TOS and Privacy components
      'tos.lastUpdatedDate': '2025-04-06',
      'privacy.lastUpdatedDate': '2025-04-06',
    });
  }
}

@NgModule({
  exports: [TranslocoModule],
  providers: [
    provideHttpClient(),
    provideHttpClientTesting(),
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
        prodMode: false,
        missingHandler: {
          useFallbackTranslation: true,
        },
      },
      loader: TestLoader,
    }),
  ],
})
export class TranslocoTestingModule {}
