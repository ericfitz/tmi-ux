import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Observable, from, of } from 'rxjs';
import { catchError, finalize, map, shareReplay, switchMap } from 'rxjs/operators';

import { LoggerService } from '../../core/services/logger.service';
import { SKIP_ERROR_HANDLING } from '../../core/tokens/http-context.tokens';
import { environment } from '../../../environments/environment';
import { PkceService } from './pkce.service';
import { StepUpOutcome, StepUpResponse } from '../models/step-up.models';
import { buildStepUpRequestParams, buildStepUpState } from '../utils/step-up.utils';
import { StepUpConfirmDialogComponent } from '../components/step-up-confirm-dialog/step-up-confirm-dialog.component';

/**
 * Orchestrates the OAuth2 step-up flow (tmi-ux#680).
 *
 * Deliberately has NO dependency on AuthService (the interceptor passes the
 * provider id in) to avoid an import cycle through the HTTP interceptor chain.
 *
 * Verifier persistence: PkceService.generatePkceParameters() internally calls
 * storeVerifier(), which writes the full PkceParameters object to sessionStorage
 * under the key 'pkce_verifier'. The callback's token exchange reads it via
 * PkceService.retrieveVerifier(). No additional persistence is needed here.
 */
@Injectable({ providedIn: 'root' })
// SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: orchestrate OAuth2 step-up authentication flow with PKCE and dialog confirmation (mutates shared state)
export class StepUpService {
  private _inFlight$: Observable<StepUpOutcome> | null = null;

  /** Seam for tests: performs the top-level navigation to the IdP */
  navigateTo: (url: string) => void = url => {
    window.location.href = url;
  };

  // SEM@3f355e9ce773da83e165c65de3c84936c0293cb4: inject HTTP, router, dialog, PKCE, and logger dependencies (pure)
  constructor(
    private _http: HttpClient,
    private _router: Router,
    private _dialog: MatDialog,
    private _pkceService: PkceService,
    private _logger: LoggerService,
  ) {}

  /**
   * Initiate a step-up authentication flow for the given provider.
   * XHR/JSON-negotiated counterpart of AuthService.initiateStepUp (top-level redirect).
   *
   * Deduplicates concurrent callers: if a step-up is already in flight,
   * the same observable (via shareReplay(1)) is returned to all callers.
   *
   * @param providerId - The OAuth provider id (e.g. 'github', 'google')
   * @returns Observable<StepUpOutcome> emitting one of:
   *   - 'weak_complete'  — server short-circuited (user already step-up'd)
   *   - 'redirecting'    — user confirmed and browser is navigating to the IdP
   *   - 'cancelled'      — user dismissed the dialog, or an error occurred
   */
  // SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: initiate step-up auth for a provider, deduplicating concurrent calls; return outcome observable (mutates shared state)
  public beginStepUp(providerId: string): Observable<StepUpOutcome> {
    if (this._inFlight$) {
      return this._inFlight$;
    }

    this._inFlight$ = from(this._pkceService.generatePkceParameters()).pipe(
      switchMap(pkceParams => {
        const state = buildStepUpState(this._router.url);
        localStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_provider', providerId);

        const params = buildStepUpRequestParams(
          state,
          pkceParams.codeChallenge,
          pkceParams.codeChallengeMethod,
        );

        return this._http.get<StepUpResponse>(`${environment.apiUrl}/oauth2/step_up`, {
          params,
          headers: { Accept: 'application/json' },
          context: new HttpContext().set(SKIP_ERROR_HANDLING, true),
        });
      }),
      switchMap(response => this._handleStepUpResponse(response)),
      catchError(error => {
        this._logger.error('Step-up initiation failed', error);
        this._clearStepUpStorage();
        return of('cancelled' as const);
      }),
      finalize(() => {
        this._inFlight$ = null;
      }),
      shareReplay(1),
    );

    return this._inFlight$;
  }

  // SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: dispatch step-up server response to weak-complete or user-confirmation dialog paths (mutates shared state)
  private _handleStepUpResponse(response: StepUpResponse): Observable<StepUpOutcome> {
    if (response.result === 'step_up_weak_complete') {
      this._logger.info('Step-up completed via weak short-circuit', {
        provider: response.provider,
      });
      // No callback follows the weak short-circuit (cookies are rotated in
      // place), so the handoff state this flow wrote is now orphaned — clear it.
      this._clearStepUpStorage();
      return of('weak_complete' as const);
    }

    return this._dialog
      .open(StepUpConfirmDialogComponent)
      .afterClosed()
      .pipe(
        map((confirmed: boolean | undefined) => {
          if (confirmed && response.redirect_url) {
            this.navigateTo(response.redirect_url);
            return 'redirecting' as const;
          }
          if (confirmed && !response.redirect_url) {
            this._logger.warn('Step-up redirect confirmed but no redirect_url in response');
          }
          // Cancelled (or confirmed-without-url): no callback will consume the
          // handoff state, so clear it. Only the 'redirecting' path above keeps it.
          this._clearStepUpStorage();
          return 'cancelled' as const;
        }),
      );
  }

  /**
   * Remove the OAuth handoff state this flow wrote to storage. Called on every
   * terminal outcome EXCEPT 'redirecting' — the strong path needs oauth_state,
   * oauth_provider, and the PKCE verifier preserved for the /oauth2/callback
   * token exchange. Clearing on weak/cancel/error prevents a stale handoff from
   * colliding with a later login or identity-link flow that reuses these keys.
   */
  // SEM@5d6ffa25a64745a8483f77e0c73e9c2589f1ac47: remove OAuth handoff state from storage on non-redirecting step-up outcomes (mutates shared state)
  private _clearStepUpStorage(): void {
    localStorage.removeItem('oauth_state');
    localStorage.removeItem('oauth_provider');
    this._pkceService.clearVerifier();
  }
}
