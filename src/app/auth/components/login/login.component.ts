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

interface LoginFragmentParams {
  returnUrl?: string;
  code?: string;
  state?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  token_type?: string;
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
  private providerLogos: Map<string, { type: 'image' | 'fontawesome'; value: string }> = new Map();

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

    // Check query params FIRST for PKCE flow (RFC 7636 compliant)
    // Then fall back to fragments for backward compatibility
    this.route.queryParams.pipe(take(1)).subscribe(queryParams => {
      const code = queryParams['code'] as string | undefined;
      const state = queryParams['state'] as string | undefined;
      const error = queryParams['error'] as string | undefined;
      const errorDescription = queryParams['error_description'] as string | undefined;
      this.returnUrl = (queryParams['returnUrl'] as string | undefined) || '/dashboard';

      // PKCE flow: authorization code in query params
      if (code || error) {
        if (error) {
          this.handleLoginError({
            code: error,
            message: errorDescription || 'Authentication failed',
            retryable: true,
          });
        } else if (code) {
          // this.logger.info('Detected OAuth authorization code callback (PKCE)', { code, state });
          this.handleOAuthCallback({ code, state });
        }
        // Clear query params from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return; // PKCE flow handled, skip fragment parsing
      }

      // Fall back to fragment parsing for backward compatibility (direct token delivery)
      this.route.fragment.pipe(take(1)).subscribe((fragment: string | null) => {
        // this.logger.debug('LoginComponent received fragment', fragment);

        // Parse fragment into key-value pairs
        const params: LoginFragmentParams = {};
        if (fragment) {
          const fragmentPairs = fragment.split('&');
          for (const pair of fragmentPairs) {
            const [key, value] = pair.split('=');
            if (key && value !== undefined) {
              params[key as keyof LoginFragmentParams] = decodeURIComponent(value);
            }
          }
        }

        // Update returnUrl if provided in fragment
        if (params.returnUrl) {
          this.returnUrl = params.returnUrl;
        }

        const fragmentCode = params.code;
        const fragmentState = params.state;
        const accessToken = params.access_token;
        const refreshToken = params.refresh_token;
        const expiresIn = params.expires_in;
        const fragmentError = params.error;
        const fragmentErrorDescription = params.error_description;

        // Handle TMI OAuth callback with tokens (direct token delivery)
        if (accessToken) {
          this.handleOAuthCallback({
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_in: expiresIn ? parseInt(expiresIn) : undefined,
            state: fragmentState,
          });
          // Clear fragment from URL to prevent token exposure (security best practice)
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        // Handle authorization code flow callback (fragment-based, legacy)
        else if (fragmentCode && fragmentState) {
          // this.logger.info('Detected OAuth authorization code callback (fragment)', { code: fragmentCode, state: fragmentState });
          this.handleOAuthCallback({ code: fragmentCode, state: fragmentState });
          // Clear fragment from URL
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        // Handle OAuth errors in fragment
        else if (fragmentError) {
          this.handleLoginError({
            code: fragmentError,
            message: fragmentErrorDescription || 'Authentication failed',
            retryable: true,
          });
          // Clear fragment even on error to prevent information leakage
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
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

  /**
   * Cancel login and return to home page
   */
  cancel(): void {
    void this.router.navigate(['/']);
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
    // Get provider name for logging
    const providerName =
      type === 'oauth'
        ? this.oauthProviders.find(p => p.id === providerId)?.name
        : this.samlProviders.find(p => p.id === providerId)?.name;

    // Check if iconPath is a FontAwesome reference (starts with 'fa-')
    if (iconPath.startsWith('fa-')) {
      this.providerLogos.set(providerId, { type: 'fontawesome', value: iconPath });
      this.logger.info(
        `[${type.toUpperCase()}] Provider icon resolved`,
        `Provider: ${providerName} (${providerId})`,
        `Original icon path: ${iconPath}`,
        `Icon source: FontAwesome class "${iconPath}"`,
      );
      return;
    }

    // Determine the full icon URL
    // If icon path is an absolute URL (starts with http:// or https://), use as-is
    // If icon path is relative (doesn't start with http:// or https://), prepend API server URL
    const isAbsoluteUrl = iconPath.startsWith('http://') || iconPath.startsWith('https://');
    const fullIconUrl = isAbsoluteUrl
      ? iconPath
      : `${environment.apiUrl}${iconPath.startsWith('/') ? '' : '/'}${iconPath}`;

    // this.logger.info(
    //   `[${type.toUpperCase()}] Provider icon loading`,
    //   `Provider: ${providerName} (${providerId})`,
    //   `Original icon path: ${iconPath}`,
    //   `Resolved URL: ${fullIconUrl}`,
    //   `URL type: ${isAbsoluteUrl ? 'Absolute URL' : 'Server-relative (prepended with API URL)'}`,
    // );

    // Try to load the image from the server
    const img = new Image();
    img.onload = () => {
      // Successfully loaded from server
      this.providerLogos.set(providerId, { type: 'image', value: fullIconUrl });
      // this.logger.info(
      //   `[${type.toUpperCase()}] Provider icon loaded successfully`,
      //   `Provider: ${providerName} (${providerId})`,
      //   `Icon source: ${fullIconUrl}`,
      // );
    };
    img.onerror = () => {
      // Failed to load from server, use fallback from tmi-ux server
      let fallback: string;
      if (providerId === 'test') {
        fallback = 'assets/signin-logos/tmi.svg';
      } else {
        fallback =
          type === 'oauth' ? 'assets/signin-logos/oauth.svg' : 'assets/signin-logos/saml.svg';
      }
      this.providerLogos.set(providerId, { type: 'image', value: fallback });
      this.logger.info(
        `[${type.toUpperCase()}] Provider icon failed to load, using fallback`,
        `Provider: ${providerName} (${providerId})`,
        `Failed URL: ${fullIconUrl}`,
        `Fallback icon: ${fallback}`,
      );
    };
    img.src = fullIconUrl;
  }

  /**
   * Check if provider uses FontAwesome icon
   */
  isFontAwesomeIcon(providerId: string): boolean {
    const logo = this.providerLogos.get(providerId);
    return logo?.type === 'fontawesome';
  }

  /**
   * Get the FontAwesome icon class for a given provider
   */
  getFontAwesomeIcon(providerId: string): string {
    const logo = this.providerLogos.get(providerId);
    return logo?.type === 'fontawesome' ? logo.value : '';
  }

  /**
   * Get the logo path for a given provider
   */
  getProviderLogoPath(providerId: string, type: 'oauth' | 'saml' = 'oauth'): string {
    const logo = this.providerLogos.get(providerId);
    if (logo?.type === 'image') return logo.value;

    // Fallback logic
    if (providerId === 'test') return 'assets/signin-logos/tmi.svg';
    return type === 'oauth' ? 'assets/signin-logos/oauth.svg' : 'assets/signin-logos/saml.svg';
  }

  /**
   * Get the logo path for a given SAML provider
   */
  getSAMLProviderLogoPath(providerId: string): string {
    return this.getProviderLogoPath(providerId, 'saml');
  }
}
