import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Translation, TranslocoLoader } from '@jsverse/transloco';

@Injectable({ providedIn: 'root' })
// SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch translation JSON files from the assets directory via HTTP
export class TranslocoHttpLoader implements TranslocoLoader {
  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: inject HttpClient for translation file fetching
  constructor(private http: HttpClient) {}

  // SEM@3903a03b300b2abc9dee4a0db1c8c5ef2d92be40: fetch the translation bundle for a given locale from assets
  getTranslation(lang: string): Observable<Record<string, unknown>> {
    return this.http.get<Translation>(`/assets/i18n/${lang}.json`);
  }
}
