import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { MonoTypeOperatorFunction, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { ApiService } from '@app/core/services/api.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  IdentityLinkStartResponse,
  LinkedIdentity,
  MyIdentitiesResponse,
  PendingIdentityLinkResponse,
  StepUpRequiredError,
} from '../models/identity-link.types';

/**
 * Wraps the /me/identities* endpoints. Step-up-protected calls that return
 * 401 + WWW-Authenticate: insufficient_user_authentication are rethrown as
 * StepUpRequiredError so callers can run AuthService.initiateStepUp and retry.
 * All other HTTP errors pass through unchanged (callers branch on error.error).
 */
@Injectable({ providedIn: 'root' })
export class IdentityLinkService {
  /** Where the IdP round-trip redirects back to with link_pending={token}. */
  readonly linkCallbackUrl = `${window.location.origin}/oauth2/link/callback`;

  constructor(
    private api: ApiService,
    private logger: LoggerService,
  ) {}

  listIdentities(): Observable<MyIdentitiesResponse> {
    return this.api.get<MyIdentitiesResponse>('me/identities').pipe(this.mapStepUp());
  }

  startLink(idp: string): Observable<IdentityLinkStartResponse> {
    return this.api
      .get<IdentityLinkStartResponse>('me/identities/link/start', {
        idp,
        client_callback: this.linkCallbackUrl,
      })
      .pipe(this.mapStepUp());
  }

  getPending(token: string): Observable<PendingIdentityLinkResponse> {
    return this.api
      .get<PendingIdentityLinkResponse>(`me/identities/link/pending/${encodeURIComponent(token)}`)
      .pipe(this.mapStepUp());
  }

  confirmLink(token: string): Observable<LinkedIdentity> {
    return this.api
      .post<LinkedIdentity>('me/identities/link/confirm', { token })
      .pipe(this.mapStepUp());
  }

  unlink(id: string): Observable<void> {
    return this.api.delete<void>(`me/identities/${encodeURIComponent(id)}`).pipe(this.mapStepUp());
  }

  /** Rethrow the step-up 401 as StepUpRequiredError; pass everything else through. */
  private mapStepUp<T>(): MonoTypeOperatorFunction<T> {
    return catchError<T, Observable<T>>((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        const challenge = err.headers?.get('WWW-Authenticate') ?? '';
        if (challenge.includes('insufficient_user_authentication')) {
          this.logger.info('Identity-link call requires step-up re-authentication');
          return throwError(() => new StepUpRequiredError());
        }
      }
      return throwError(() => err);
    });
  }
}
