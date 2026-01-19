import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoModule } from '@jsverse/transloco';
import { take } from 'rxjs';

import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthError, OAuthResponse } from '../../models/auth.models';

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
export class AuthCallbackComponent implements OnInit {
  providerName: string | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.pipe(take(1)).subscribe(queryParams => {
      const action = queryParams['action'] as string | undefined;
      const providerId = queryParams['providerId'] as string | undefined;
      const providerType = queryParams['providerType'] as 'oauth' | 'saml' | undefined;
      this.providerName = (queryParams['providerName'] as string | undefined) || null;
      const returnUrl = queryParams['returnUrl'] as string | undefined;

      // Mode 1: Initiating login - we received provider info from login page
      if (action === 'login' && providerId && providerType) {
        this.initiateLogin(providerId, providerType, returnUrl);
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

  private initiateLogin(
    providerId: string,
    providerType: 'oauth' | 'saml',
    returnUrl?: string,
  ): void {
    if (providerType === 'saml') {
      this.authService.initiateSAMLLogin(providerId, returnUrl);
    } else {
      this.authService.initiateLogin(providerId, returnUrl);
    }
    // AuthService will redirect the browser to the OAuth/SAML provider
  }

  private handleOAuthCallback(response: OAuthResponse): void {
    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        if (!success) {
          this.handleError({
            code: 'oauth_failed',
            message: 'login.oauthFailed',
            retryable: true,
          });
        }
        // On success, AuthService handles navigation to dashboard/returnUrl
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

  private handleError(authError: AuthError): void {
    this.logger.error('OAuth callback error:', authError);

    // Store error for LoginComponent to display
    sessionStorage.setItem('auth_error', JSON.stringify(authError));

    // Redirect to login page
    void this.router.navigate(['/login']);
  }
}
