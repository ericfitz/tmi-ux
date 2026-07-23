import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { TranslocoModule } from '@jsverse/transloco';
import { AuthService } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthError, OAuthProviderInfo, SAMLProviderInfo } from '../../models/auth.models';
import { take } from 'rxjs';
import { forkJoin } from 'rxjs';
import {
  TmiLoginDialogComponent,
  TmiLoginDialogData,
  TmiLoginDialogResult,
} from './tmi-login-dialog.component';
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
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrls: ['./login.component.scss'],
})
// SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: display available OAuth and SAML providers and initiate the selected login flow
export class LoginComponent implements OnInit {
  isLoading = false;
  error: string | null = null;
  sessionExpired = false;
  oauthProviders: OAuthProviderInfo[] = [];
  samlProviders: SAMLProviderInfo[] = [];
  providersLoading = true;
  private returnUrl: string | null = null;
  private providerLogos: Map<string, { type: 'image' | 'fontawesome'; value: string }> = new Map();

  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: inject auth, routing, dialog, and logger dependencies (pure)
  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: initialize login page: surface stored auth error and fetch providers
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

    // Get returnUrl and reason from query params
    this.route.queryParams.pipe(take(1)).subscribe(queryParams => {
      this.returnUrl = (queryParams['returnUrl'] as string | undefined) || null;

      // Check if user was redirected due to session expiry
      const reason = queryParams['reason'] as string | undefined;
      if (reason === 'session_expired') {
        this.sessionExpired = true;
      }
    });
  }

  /**
   * Load OAuth and SAML providers from TMI server
   */
  // SEM@7a4991539f0191a93ee57c2dee2dbe4ebda62ac0: fetch OAuth and SAML auth providers in parallel from the server
  private loadProviders(): void {
    this.providersLoading = true;

    // Fetch both OAuth and SAML providers in parallel
    forkJoin({
      oauth: this.authService.getAvailableProviders(),
      saml: this.authService.getAvailableSAMLProviders(),
    }).subscribe({
      // markForCheck is required, not optional. app-root (the router-outlet
      // host) is OnPush, and this forkJoin resolves from an async HTTP
      // callback rather than a template event. Without marking the path
      // dirty, the change-detection tick that follows starts at the OnPush
      // app-root, finds it clean, and prunes this whole subtree — so this
      // CheckAlways component is never checked and the "Loading authentication
      // providers" spinner stays up even though the data arrived. It only
      // rendered intermittently, on loads where some other event happened to
      // dirty an ancestor. markForCheck marks LoginComponent up through
      // app-root so the tick reaches it.
      next: ({ oauth, saml }) => {
        this.oauthProviders = this.sortProviders(oauth);
        this.samlProviders = this.sortProviders(saml);
        this.providersLoading = false;

        // Load provider logos
        this.loadProviderLogos();

        this.cdr.markForCheck();

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
        this.cdr.markForCheck();
        this.logger.error('Failed to load authentication providers', error);
      },
    });
  }

  /**
   * Sort providers alphabetically by name, with 'tmi' provider last
   */
  // SEM@14740c594134dba27c570d9b30032cdd1fe13dd7: sort auth providers alphabetically, placing the tmi provider last (pure)
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
  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: dispatch OAuth login flow for a provider, opening dialog for tmi provider
  loginWithOAuth(providerId: string): void {
    const provider = this.oauthProviders.find(p => p.id === providerId);
    if (!provider) return;

    if (providerId === 'tmi') {
      this.openTmiLoginDialog(provider);
      return;
    }

    this.navigateToOAuth(provider);
  }

  /**
   * Open the TMI login dialog to collect login hint before OAuth navigation
   */
  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: open dialog to collect login hint before navigating to tmi OAuth flow
  private openTmiLoginDialog(provider: OAuthProviderInfo): void {
    const dialogRef = this.dialog.open<
      TmiLoginDialogComponent,
      TmiLoginDialogData,
      TmiLoginDialogResult | undefined
    >(TmiLoginDialogComponent, {
      width: '400px',
      data: { providerName: provider.name },
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === undefined) return;
      this.navigateToOAuth(provider, result.loginHint || undefined);
    });
  }

  /**
   * Navigate to the OAuth callback interstitial page
   */
  // SEM@e272ed8bab654ac3ad855604d60b1df437d8c319: route to the OAuth callback interstitial with provider and return URL
  private navigateToOAuth(provider: OAuthProviderInfo, loginHint?: string): void {
    void this.router.navigate(['/oauth2/callback'], {
      queryParams: {
        action: 'login',
        providerId: provider.id,
        providerName: provider.name,
        providerType: 'oauth',
        returnUrl: this.returnUrl || undefined,
        loginHint: loginHint || undefined,
      },
    });
  }

  /**
   * Initiate SAML login with specified provider
   * Navigates to the interstitial page which will handle the SAML flow
   */
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: route to the SAML callback interstitial to initiate SAML authentication
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
        returnUrl: this.returnUrl || undefined,
      },
    });
  }

  /**
   * Cancel login and return to home page
   */
  // SEM@840ca1c806242cf455ea83c3beda33317a5e8c33: abort login and navigate to the home page
  cancel(): void {
    void this.router.navigate(['/']);
  }

  /**
   * Load provider logos from server or use fallbacks
   */
  // SEM@7a4991539f0191a93ee57c2dee2dbe4ebda62ac0: trigger logo loading for all OAuth and SAML providers (mutates shared state)
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
  // SEM@14740c594134dba27c570d9b30032cdd1fe13dd7: fetch a provider logo from server or fall back to a bundled asset (mutates shared state)
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
  // SEM@3efa15a5c540d76150afd3158f1ec831707947c1: return whether a provider logo is a FontAwesome icon class (pure)
  isFontAwesomeIcon(providerId: string): boolean {
    const logo = this.providerLogos.get(providerId);
    return logo?.type === 'fontawesome';
  }

  /**
   * Get the FontAwesome icon class for a given provider
   */
  // SEM@3efa15a5c540d76150afd3158f1ec831707947c1: return the FontAwesome icon class for a provider (pure)
  getFontAwesomeIcon(providerId: string): string {
    const logo = this.providerLogos.get(providerId);
    return logo?.type === 'fontawesome' ? logo.value : '';
  }

  /**
   * Get the logo path for a given provider
   */
  // SEM@14740c594134dba27c570d9b30032cdd1fe13dd7: return the resolved image path or fallback asset path for a provider logo (pure)
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
  // SEM@be89ab063e8c916c082e957acd07b2451f22636d: return the resolved logo path for a SAML provider (pure)
  getSAMLProviderLogoPath(providerId: string): string {
    return this.getProviderLogoPath(providerId, 'saml');
  }
}
