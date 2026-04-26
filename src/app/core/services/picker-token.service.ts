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
export class PickerTokenService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  mint(providerId: ContentProviderId): Observable<PickerTokenResponse> {
    return this.apiService.post<PickerTokenResponse>(`me/picker_tokens/${providerId}`, {}).pipe(
      tap(() => this.logger.debug('Picker token minted', { providerId })),
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 404) {
          return throwError(() => new ContentTokenNotLinkedError(providerId));
        }
        this.logger.error('Failed to mint picker token', err);
        return throwError(() => err);
      }),
    );
  }
}
