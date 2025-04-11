import { NgModule } from '@angular/core';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import {
  TranslocoModule,
  provideTransloco,
  TranslocoLoader,
} from '@jsverse/transloco';
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
  imports: [HttpClientTestingModule],
  exports: [TranslocoModule],
  providers: [
    provideTransloco({
      config: {
        availableLangs: ['en-US', 'de', 'zh', 'ar'],
        defaultLang: 'en-US',
        fallbackLang: 'en-US',
        reRenderOnLangChange: true,
        prodMode: false,
        missingHandler: {
          useFallbackTranslation: true
        }
      },
      loader: TestLoader
    })
  ]
})
export class TranslocoTestingModule {}