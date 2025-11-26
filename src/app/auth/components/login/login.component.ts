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
import {
  AuthError,
  OAuthResponse,
  OAuthProviderInfo,
  SAMLProviderInfo,
} from '../../models/auth.models';
import { take } from 'rxjs';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';

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
  oauthProviders: OAuthProviderInfo[] = [];
  samlProviders: SAMLProviderInfo[] = [];
  providersLoading = true;
  private returnUrl: string | null = null;
  private providerLogos: Map<string, string> = new Map();

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
        // this.logger.info('Detected OAuth authorization code callback', { code, state });
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
   * Load OAuth and SAML providers from TMI server
   */
  private loadProviders(): void {
    this.providersLoading = true;

    // Fetch both OAuth and SAML providers in parallel
    forkJoin({
      oauth: this.authService.getAvailableProviders(),
      saml: this.authService.getAvailableSAMLProviders(),
    }).subscribe({
      next: ({ oauth, saml }) => {
        this.oauthProviders = this.sortProviders(oauth);
        this.samlProviders = this.sortProviders(saml);
        this.providersLoading = false;

        // Load provider logos
        this.loadProviderLogos();

        // this.logger.debugComponent('Auth', `Loaded providers`, {
        //   oauthCount: oauth.length,
        //   samlCount: saml.length,
        //   oauthProviders: oauth.map(p => ({ id: p.id, name: p.name })),
        //   samlProviders: saml.map(p => ({ id: p.id, name: p.name })),
        // });
      },
      error: error => {
        this.providersLoading = false;
        this.error = 'Failed to load authentication providers';
        this.logger.error('Failed to load authentication providers', error);
      },
    });
  }

  /**
   * Sort providers alphabetically by name, with 'test' provider last
   */
  private sortProviders<T extends { id: string; name: string }>(providers: T[]): T[] {
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
   * Initiate OAuth login with specified provider
   */
  loginWithOAuth(providerId: string): void {
    this.isLoading = true;
    this.error = null;

    this.authService.initiateLogin(providerId, this.returnUrl || undefined);
  }

  /**
   * Initiate SAML login with specified provider
   */
  loginWithSAML(providerId: string): void {
    this.isLoading = true;
    this.error = null;

    this.authService.initiateSAMLLogin(providerId, this.returnUrl || undefined);
  }

  private handleOAuthCallback(response: OAuthResponse): void {
    this.isLoading = true;
    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        this.isLoading = false;
        if (success) {
          // this.logger.info('OAuth callback successful');
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
   * Load provider logos from server or use fallbacks
   */
  private loadProviderLogos(): void {
    // Load OAuth provider logos
    this.oauthProviders.forEach(provider => {
      this.loadProviderLogo(provider.id, provider.icon, 'oauth');
    });

    // Load SAML provider logos
    this.samlProviders.forEach(provider => {
      this.loadProviderLogo(provider.id, provider.icon, 'saml');
    });
  }

  /**
   * Load a single provider logo from server or use fallback
   */
  private loadProviderLogo(providerId: string, iconPath: string, type: 'oauth' | 'saml'): void {
    // If icon path is relative (starts with /), prepend server URL
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const fullIconUrl = iconPath.startsWith('/') ? `${environment.apiUrl}${iconPath}` : iconPath;

    // Try to load the image from the server
    const img = new Image();
    img.onload = () => {
      // Successfully loaded from server
      this.providerLogos.set(providerId, fullIconUrl);
    };
    img.onerror = () => {
      // Failed to load from server, use fallback
      let fallback: string;
      if (providerId === 'test') {
        fallback = 'assets/signin-logos/tmi.svg';
      } else {
        fallback = type === 'oauth' ? 'assets/signin-logos/oauth.svg' : 'assets/signin-logos/saml.svg';
      }
      this.providerLogos.set(providerId, fallback);
    };
    img.src = fullIconUrl;
  }

  /**
   * Get the logo path for a given provider
   */
  getProviderLogoPath(providerId: string): string {
    const logo = this.providerLogos.get(providerId);
    if (logo) return logo;
    return providerId === 'test'
      ? 'assets/signin-logos/tmi.svg'
      : 'assets/signin-logos/oauth.svg';
  }

  /**
   * Get the logo path for a given SAML provider
   */
  getSAMLProviderLogoPath(providerId: string): string {
    const logo = this.providerLogos.get(providerId);
    if (logo) return logo;
    return providerId === 'test'
      ? 'assets/signin-logos/tmi.svg'
      : 'assets/signin-logos/saml.svg';
  }
}
