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
import { AuthError, OAuthProviderInfo, SAMLProviderInfo } from '../../models/auth.models';
import { take } from 'rxjs';
import { forkJoin } from 'rxjs';
import { environment } from '../../../../environments/environment';

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
    // Check for error from callback redirect (stored in sessionStorage)
    const storedError = sessionStorage.getItem('auth_error');
    if (storedError) {
      try {
        const authError = JSON.parse(storedError) as AuthError;
        this.error = authError.message;
        this.logger.error('Login error from callback:', authError);
      } catch {
        this.error = 'Authentication failed';
      }
      sessionStorage.removeItem('auth_error');
    }

    // Load available providers from TMI server
    this.loadProviders();

    // Get returnUrl from query params
    this.route.queryParams.pipe(take(1)).subscribe(queryParams => {
      this.returnUrl = (queryParams['returnUrl'] as string | undefined) || '/dashboard';
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
   * Sort providers alphabetically by name, with 'tmi' provider last
   */
  private sortProviders<T extends { id: string; name: string }>(providers: T[]): T[] {
    const sorted = [...providers];

    return sorted.sort((a, b) => {
      // TMI provider goes last
      if (a.id === 'tmi') return 1;
      if (b.id === 'tmi') return -1;

      // All other providers are sorted alphabetically by name
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Initiate OAuth login with specified provider
   * Navigates to the interstitial page which will handle the OAuth flow
   */
  loginWithOAuth(providerId: string): void {
    const provider = this.oauthProviders.find(p => p.id === providerId);
    if (!provider) return;

    // Navigate to interstitial which will initiate the OAuth flow
    void this.router.navigate(['/oauth2/callback'], {
      queryParams: {
        action: 'login',
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'oauth',
        returnUrl: this.returnUrl || '/dashboard',
      },
    });
  }

  /**
   * Initiate SAML login with specified provider
   * Navigates to the interstitial page which will handle the SAML flow
   */
  loginWithSAML(providerId: string): void {
    const provider = this.samlProviders.find(p => p.id === providerId);
    if (!provider) return;

    // Navigate to interstitial which will initiate the SAML flow
    void this.router.navigate(['/oauth2/callback'], {
      queryParams: {
        action: 'login',
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'saml',
        returnUrl: this.returnUrl || '/dashboard',
      },
    });
  }

  /**
   * Cancel login and return to home page
   */
  cancel(): void {
    void this.router.navigate(['/']);
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
      if (providerId === 'tmi') {
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
    if (providerId === 'tmi') return 'assets/signin-logos/tmi.svg';
    return type === 'oauth' ? 'assets/signin-logos/oauth.svg' : 'assets/signin-logos/saml.svg';
  }

  /**
   * Get the logo path for a given SAML provider
   */
  getSAMLProviderLogoPath(providerId: string): string {
    return this.getProviderLogoPath(providerId, 'saml');
  }
}
