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
// SEM@c7fdda9a5579025128240fafba77e4d5cb14fd1c: manage linked identity operations against /me/identities endpoints with step-up error mapping
export class IdentityLinkService {
  /** Where the IdP round-trip redirects back to with link_pending={token}. */
  readonly linkCallbackUrl = `${window.location.origin}/oauth2/link/callback`;

  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: inject API and logger dependencies (pure)
  constructor(
    private api: ApiService,
    private logger: LoggerService,
  ) {}

  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: fetch all linked identities for the current user (reads DB)
  listIdentities(): Observable<MyIdentitiesResponse> {
    return this.api.get<MyIdentitiesResponse>('me/identities').pipe(this.mapStepUp());
  }

  // SEM@c7fdda9a5579025128240fafba77e4d5cb14fd1c: initiate an identity link flow for the given identity provider
  startLink(idp: string): Observable<IdentityLinkStartResponse> {
    // POST with query params + empty body (ApiService.post takes no params arg).
    const qs = new URLSearchParams({ idp, client_callback: this.linkCallbackUrl }).toString();
    return this.api
      .post<IdentityLinkStartResponse>(`me/identities/link/start?${qs}`, {})
      .pipe(this.mapStepUp());
  }

  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: fetch the pending identity link record by its token (reads DB)
  getPending(token: string): Observable<PendingIdentityLinkResponse> {
    return this.api
      .get<PendingIdentityLinkResponse>(`me/identities/link/pending/${encodeURIComponent(token)}`)
      .pipe(this.mapStepUp());
  }

  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: confirm a pending identity link and return the linked identity
  confirmLink(token: string): Observable<LinkedIdentity> {
    return this.api
      .post<LinkedIdentity>('me/identities/link/confirm', { token })
      .pipe(this.mapStepUp());
  }

  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: delete a linked identity by ID for the current user
  unlink(id: string): Observable<void> {
    return this.api.delete<void>(`me/identities/${encodeURIComponent(id)}`).pipe(this.mapStepUp());
  }

  /** Rethrow the step-up 401 as StepUpRequiredError; pass everything else through. */
  // SEM@3160f3d7c492fb8085a6e447c2347d549e527ecc: convert a step-up 401 HTTP error into a StepUpRequiredError for callers (pure)
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
