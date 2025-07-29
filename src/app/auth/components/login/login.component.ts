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
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatCardModule, TranslocoModule],
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
    this.logger.info('LoginComponent initialized');
    
    // Load available providers from TMI server
    this.loadProviders();

    this.route.queryParams.pipe(take(1)).subscribe((params: LoginQueryParams) => {
      this.returnUrl = params.returnUrl || '/tm';
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
          state 
        });
      }
      // Handle old-style callback with code (for local provider)
      else if (code && state) {
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
        this.availableProviders = providers;
        this.providersLoading = false;
        this.logger.debugComponent('Auth', `Loaded ${providers.length} OAuth providers`, { 
          providers: providers.map(p => ({ id: p.id, name: p.name })) 
        });

        // Auto-login if only one provider available and not handling callback
        const queryParams = this.route.snapshot.queryParams as LoginQueryParams;
        const hasCallbackParams = queryParams.code || 
                                 queryParams.access_token || 
                                 queryParams.error;
        if (providers.length === 1 && !hasCallbackParams) {
          this.login(providers[0].id);
        }
      },
      error: error => {
        this.providersLoading = false;
        this.error = 'Failed to load authentication providers';
        this.logger.error('Failed to load OAuth providers', error);
      }
    });
  }

  /**
   * Check if we have callback parameters
   */
  private hasCallbackParams(params: LoginQueryParams): boolean {
    return !!(params.code || params.error);
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
      authUrl: provider?.auth_url ? provider.auth_url.replace(/\?.*$/, '') : 'unknown' // Remove query params for logging
    });
    
    this.authService.initiateLogin(providerId);
  }

  private handleOAuthCallback(response: OAuthResponse): void {
    this.isLoading = true;
    this.logger.info('Handling OAuth callback in LoginComponent');
    this.authService.handleOAuthCallback(response).subscribe({
      next: success => {
        this.isLoading = false;
        if (success) {
          this.logger.info('OAuth callback successful, navigating to return URL');
          void this.router.navigateByUrl(this.returnUrl || '/tm');
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
          message:
            err instanceof Error ? err.message : 'login.unexpectedError',
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
}
