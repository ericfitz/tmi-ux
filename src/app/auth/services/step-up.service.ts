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
import { buildStepUpState } from '../utils/step-up.utils';
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
export class StepUpService {
  private _inFlight$: Observable<StepUpOutcome> | null = null;

  /** Seam for tests: performs the top-level navigation to the IdP */
  navigateTo: (url: string) => void = url => {
    window.location.href = url;
  };

  constructor(
    private _http: HttpClient,
    private _router: Router,
    private _dialog: MatDialog,
    private _pkceService: PkceService,
    private _logger: LoggerService,
  ) {}

  /**
   * Initiate a step-up authentication flow for the given provider.
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
  public beginStepUp(providerId: string): Observable<StepUpOutcome> {
    if (this._inFlight$) {
      return this._inFlight$;
    }

    this._inFlight$ = from(this._pkceService.generatePkceParameters()).pipe(
      switchMap(pkceParams => {
        const state = buildStepUpState(this._router.url);
        localStorage.setItem('oauth_state', state);
        localStorage.setItem('oauth_provider', providerId);

        const params: Record<string, string> = {
          client_callback: `${window.location.origin}/oauth2/callback`,
          state,
          code_challenge: pkceParams.codeChallenge,
          code_challenge_method: 'S256',
        };

        return this._http.get<StepUpResponse>(`${environment.apiUrl}/oauth2/step_up`, {
          params,
          headers: { Accept: 'application/json' },
          context: new HttpContext().set(SKIP_ERROR_HANDLING, true),
        });
      }),
      switchMap(response => this._handleStepUpResponse(response)),
      catchError(error => {
        this._logger.error('Step-up initiation failed', error);
        return of('cancelled' as const);
      }),
      finalize(() => {
        this._inFlight$ = null;
      }),
      shareReplay(1),
    );

    return this._inFlight$;
  }

  private _handleStepUpResponse(response: StepUpResponse): Observable<StepUpOutcome> {
    if (response.result === 'step_up_weak_complete') {
      this._logger.info('Step-up completed via weak short-circuit', {
        provider: response.provider,
      });
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
          return 'cancelled' as const;
        }),
      );
  }
}
