import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { LoggerService } from './logger.service';
import {
  MicrosoftAccountNotLinkedError,
  MicrosoftGraphPermissionRejectedError,
  MicrosoftGraphUnavailableError,
  MicrosoftPickerGrantBadRequestError,
  MicrosoftPickerGrantServerError,
  type MicrosoftPickerGrantRequest,
  type MicrosoftPickerGrantResponse,
} from '../models/content-provider.types';

/**
 * Wrapper for `POST /me/microsoft/picker_grants`. Maps HTTP status codes to
 * typed error classes consumed by `MicrosoftFilePickerService` and the
 * document editor dialog.
 */
@Injectable({ providedIn: 'root' })
export class MicrosoftPickerGrantService {
  constructor(
    private apiService: ApiService,
    private logger: LoggerService,
  ) {}

  grant(driveId: string, itemId: string): Observable<MicrosoftPickerGrantResponse> {
    const body: MicrosoftPickerGrantRequest = { drive_id: driveId, item_id: itemId };
    return this.apiService
      .post<MicrosoftPickerGrantResponse>(
        'me/microsoft/picker_grants',
        body as unknown as Record<string, unknown>,
      )
      .pipe(
        tap(res =>
          this.logger.debug('Microsoft picker grant succeeded', {
            permissionId: res.permission_id,
          }),
        ),
        catchError((err: unknown) => throwError(() => this._mapError(err))),
      );
  }

  private _mapError(err: unknown): Error {
    if (err instanceof HttpErrorResponse) {
      switch (err.status) {
        case 400:
          return new MicrosoftPickerGrantBadRequestError();
        case 404:
          return new MicrosoftAccountNotLinkedError();
        case 422:
          return new MicrosoftGraphPermissionRejectedError();
        case 503:
          return new MicrosoftGraphUnavailableError();
        default:
          if (err.status >= 500) {
            return new MicrosoftPickerGrantServerError();
          }
          this.logger.warn('Unmapped Microsoft picker grant error', {
            status: err.status,
            url: err.url,
          });
          return err;
      }
    }
    return err instanceof Error ? err : new Error(String(err));
  }
}
