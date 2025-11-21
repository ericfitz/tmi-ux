import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthError, OAuthResponse, OAuthProviderInfo } from '../../models/auth.models';
import { take } from 'rxjs';

interface LoginQueryParams {
  returnUrl?: string;
  code?: string;
  state?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  error?: string;
  error_description?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    MatCardModule,
    TranslocoModule,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  isLoading = false;
  error: string | null = null;
  availableProviders: OAuthProviderInfo[] = [];
  providersLoading = true;
  private returnUrl: string | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    // this.logger.info('LoginComponent initialized');

    // Load available providers from TMI server
    this.loadProviders();

    this.route.queryParams.pipe(take(1)).subscribe((params: LoginQueryParams) => {
      // this.logger.debug('LoginComponent received query params', params);

      this.returnUrl = params.returnUrl || '/dashboard';
      const code = params.code;
      const state = params.state;
      const accessToken = params.access_token;
      const refreshToken = params.refresh_token;
      const expiresIn = params.expires_in;
      const errorParam = params.error;
      const errorDescription = params.error_description;

      // Handle TMI OAuth callback with tokens
      if (accessToken) {
        this.handleOAuthCallback({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: expiresIn ? parseInt(expiresIn) : undefined,
          state,
        });
      }
      // Handle authorization code flow callback
      else if (code && state) {
        this.logger.info('Detected OAuth authorization code callback', { code, state });
        this.handleOAuthCallback({ code, state });
      }
      // Handle OAuth errors
      else if (errorParam) {
        this.handleLoginError({
          code: errorParam,
          message: errorDescription || 'Authentication failed',
          retryable: true,
        });
      }
    });
  }

  /**
   * Load OAuth providers from TMI server
   */
  private loadProviders(): void {
    this.providersLoading = true;
    this.authService.getAvailableProviders().subscribe({
      next: providers => {
        this.availableProviders = this.sortProviders(providers);
        this.providersLoading = false;
        // this.logger.debugComponent('Auth', `Loaded ${providers.length} OAuth providers`, {
        //   providers: providers.map(p => ({ id: p.id, name: p.name })),
        // });
      },
      error: error => {
        this.providersLoading = false;
        this.error = 'Failed to load authentication providers';
        this.logger.error('Failed to load OAuth providers', error);
      },
    });
  }

  /**
   * Sort providers alphabetically by name, with 'test' provider last
   */
  private sortProviders(providers: OAuthProviderInfo[]): OAuthProviderInfo[] {
    const sorted = [...providers];

    return sorted.sort((a, b) => {
      // Test provider goes last
      if (a.id === 'test') return 1;
      if (b.id === 'test') return -1;

      // All other providers are sorted alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Generic login method - works with any configured provider
   */
  login(providerId?: string): void {
    this.isLoading = true;
    this.error = null;

    const provider = this.availableProviders.find(p => p.id === providerId);
    const providerName = provider?.name || providerId || 'default provider';

    this.logger.info(`Initiating login with ${providerName}`);
    this.logger.debugComponent('Auth', 'Starting OAuth flow', {
      providerId,
      providerName,
      authUrl: provider?.auth_url ? provider.auth_url.replace(/\?.*$/, '') : 'unknown', // Remove query params for logging
    });

    this.authService.initiateLogin(providerId, this.returnUrl || undefined);
  }

  private handleOAuthCallback(response: OAuthResponse): void {
    this.isLoading = true;
    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        this.isLoading = false;
        if (success) {
          this.logger.info('OAuth callback successful');
          // Navigation is now handled by AuthService which has the decoded returnUrl
        } else {
          this.handleLoginError({
            code: 'oauth_failed',
            message: 'login.oauthFailed',
            retryable: true,
          });
        }
      },
      error: (err: unknown) => {
        this.isLoading = false;
        const authError: AuthError = {
          code: 'oauth_error',
          message: err instanceof Error ? err.message : 'login.unexpectedError',
          retryable: true,
        };
        this.authService.handleAuthError(authError); // Propagate error through auth service
        this.handleLoginError(authError);
      },
    });
  }

  private handleLoginError(authError: AuthError): void {
    this.isLoading = false;
    this.error = authError.message;
    this.logger.error('Login error:', authError);
    this.authService.handleAuthError(authError); // Propagate error through auth service
  }

  /**
   * Get the logo path for a given OAuth provider
   */
  getProviderLogoPath(providerId: string): string | null {
    const logoMap: Record<string, string> = {
      google: 'assets/signin-logos/google-signin-logo.svg',
      github: 'assets/signin-logos/github-signin-logo.svg',
      microsoft: 'assets/signin-logos/microsoft-signin-logo.svg',
      gitlab: 'assets/signin-logos/gitlab-signin-logo.svg',
      test: 'assets/signin-logos/test-signin-logo.svg',
    };

    return logoMap[providerId] || null;
  }
}
