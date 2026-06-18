import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  ContentTokenNotLinkedError,
  type ContentProviderId,
  type PickerTokenResponse,
} from '../models/content-provider.types';

/**
 * Mints short-lived picker tokens. Always hits the endpoint — server may
 * refresh underlying credentials per request, and the response is non-cacheable
 * per the OpenAPI spec.
 */
@Injectable({ providedIn: 'root' })
// SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: fetch short-lived picker tokens for content providers via the API
export class PickerTokenService {
  // SEM@3279bf56cfe067d881cec5428814425252b4b5d8: inject ApiService and LoggerService dependencies (pure)
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  // SEM@2bb8e215d328a4dfa2120c7644203ee293a9a7d0: fetch a short-lived picker token for a content provider from the API
  mint(providerId: ContentProviderId): Observable<PickerTokenResponse> {
    return this.apiService.post<PickerTokenResponse>(`me/picker_tokens/${providerId}`, {}).pipe(
      tap(() => this.logger.debug('Picker token minted', { providerId })),
      catchError((err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return throwError(() => new ContentTokenNotLinkedError(providerId));
        }
        this.logger.error('Failed to mint picker token', err);
        return throwError(() => err);
      }),
    );
  }
}
