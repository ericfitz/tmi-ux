import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { StepUpService } from '../../services/step-up.service';
import { AuthError, OAuthResponse } from '../../models/auth.models';
import {
  StepUpMismatchDialogComponent,
  StepUpMismatchDialogData,
} from '../step-up-mismatch-dialog/step-up-mismatch-dialog.component';

interface CallbackFragmentParams {
  code?: string;
  state?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
}

@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatProgressSpinnerModule, TranslocoModule],
  templateUrl: './auth-callback.component.html',
  styleUrls: ['./auth-callback.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@93cdce70b08a93f3b99cf3ce5aa90fb4cee5e068: handle OAuth/SAML callback redirect, dispatch auth tokens, and navigate to destination
export class AuthCallbackComponent implements OnInit {
  providerName: string | null = null;

  // SEM@93cdce70b08a93f3b99cf3ce5aa90fb4cee5e068: inject auth, routing, UI, and step-up dependencies (pure)
  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private stepUpService: StepUpService,
    private transloco: TranslocoService,
  ) {}

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: route OAuth callback query params or fragment to the appropriate auth handler
  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(queryParams => {
      const action = queryParams['action'] as string | undefined;
      const providerId = queryParams['providerId'] as string | undefined;
      const providerType = queryParams['providerType'] as 'oauth' | 'saml' | undefined;
      this.providerName = (queryParams['providerName'] as string | undefined) || null;
      const returnUrl = queryParams['returnUrl'] as string | undefined;
      const loginHint = queryParams['loginHint'] as string | undefined;

      // Mode 1: Initiating login - we received provider info from login page
      if (action === 'login' && providerId && providerType) {
        this.initiateLogin(providerId, providerType, returnUrl, loginHint);
        return;
      }

      // Mode 2: Processing OAuth callback with authorization code (PKCE flow)
      const code = queryParams['code'] as string | undefined;
      const state = queryParams['state'] as string | undefined;
      const error = queryParams['error'] as string | undefined;
      const errorDescription = queryParams['error_description'] as string | undefined;

      if (error) {
        this.handleError({
          code: error,
          message: errorDescription || 'Authentication failed',
          retryable: true,
        });
        return;
      }

      if (code) {
        this.handleOAuthCallback({ code, state });
        // Clear query params from URL for security
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      // Mode 3: Check URL fragment for legacy token flow
      this.route.fragment.pipe(take(1)).subscribe((fragment: string | null) => {
        const params = this.parseFragment(fragment);

        if (params.error) {
          this.handleError({
            code: params.error,
            message: params.error_description || 'Authentication failed',
            retryable: true,
          });
          return;
        }

        if (params.access_token) {
          this.handleOAuthCallback({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
            expires_in: params.expires_in ? parseInt(params.expires_in) : undefined,
            state: params.state,
          });
          // Clear fragment from URL for security
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        if (params.code && params.state) {
          this.handleOAuthCallback({ code: params.code, state: params.state });
          // Clear fragment from URL
          window.history.replaceState({}, document.title, window.location.pathname);
          return;
        }

        // No recognized params - redirect to login
        this.logger.warn(
          'AuthCallbackComponent: No valid callback parameters found, redirecting to login',
        );
        void this.router.navigate(['/login']);
      });
    });
  }

  // SEM@d85264ea077414c23e2fda6cd4a13de1e746c66f: parse a URL fragment string into a callback params map (pure)
  private parseFragment(fragment: string | null): CallbackFragmentParams {
    const params: CallbackFragmentParams = {};
    if (fragment) {
      const fragmentPairs = fragment.split('&');
      for (const pair of fragmentPairs) {
        const [key, value] = pair.split('=');
        if (key && value !== undefined) {
          params[key as keyof CallbackFragmentParams] = decodeURIComponent(value);
        }
      }
    }
    return params;
  }

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: redirect the browser to an OAuth or SAML provider to begin login
  private initiateLogin(
    providerId: string,
    providerType: 'oauth' | 'saml',
    returnUrl?: string,
    loginHint?: string,
  ): void {
    if (providerType === 'saml') {
      this.authService.initiateSAMLLogin(providerId, returnUrl);
    } else {
      this.authService.initiateLogin(providerId, returnUrl, loginHint);
    }
    // AuthService will redirect the browser to the OAuth/SAML provider
  }

  // SEM@93cdce70b08a93f3b99cf3ce5aa90fb4cee5e068: complete OAuth token exchange and navigate on success or dispatch step-up mismatch
  private handleOAuthCallback(response: OAuthResponse): void {
    const decodedState = response.state ? this.authService.decodeState(response.state) : null;
    const isStepUp = decodedState?.stepUp === true;

    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        if (success) {
          if (isStepUp) {
            this.snackBar.open(this.transloco.translate('stepUp.redoPrompt'), undefined, {
              duration: 6000,
            });
          }
          // On success, AuthService handles navigation to dashboard/returnUrl
          return;
        }
        if (isStepUp && this.authService.lastAuthError?.code === 'identity_mismatch') {
          this.handleIdentityMismatch(decodedState?.returnUrl);
          return;
        }
        this.handleError({
          code: 'oauth_failed',
          message: 'login.oauthFailed',
          retryable: true,
        });
      },
      error: (err: unknown) => {
        const message = err instanceof Error ? err.message : 'login.unexpectedError';
        this.handleError({
          code: 'oauth_error',
          message,
          retryable: true,
        });
      },
    });
  }

  /**
   * Step-up completed as the wrong identity. The original session is still
   * valid: return the user to where they were, then explain and offer retry.
   * Navigate BEFORE opening the dialog — MatDialog closes on navigation by default.
   */
  // SEM@93cdce70b08a93f3b99cf3ce5aa90fb4cee5e068: navigate to return URL then prompt user to retry step-up with correct identity
  private handleIdentityMismatch(returnUrl?: string): void {
    const target =
      returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/';
    void this.router.navigateByUrl(target).then(() => {
      this.dialog
        .open<StepUpMismatchDialogComponent, StepUpMismatchDialogData, boolean>(
          StepUpMismatchDialogComponent,
          { data: { email: this.authService.userEmail }, width: '420px' },
        )
        .afterClosed()
        .subscribe((retry: boolean | undefined) => {
          if (retry) {
            this.stepUpService
              .beginStepUp(this.authService.userProfile?.provider ?? '')
              .subscribe();
          }
        });
    });
  }

  // SEM@d85264ea077414c23e2fda6cd4a13de1e746c66f: store auth error in session storage and redirect to login page (mutates shared state)
  private handleError(authError: AuthError): void {
    this.logger.error('OAuth callback error:', authError);

    // Store error for LoginComponent to display
    sessionStorage.setItem('auth_error', JSON.stringify(authError));

    // Redirect to login page
    void this.router.navigate(['/login']);
  }
}
