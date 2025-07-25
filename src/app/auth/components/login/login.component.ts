import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { AuthService, ProviderInfo } from '../../services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { AuthError, OAuthResponse } from '../../models/auth.models';
import { take } from 'rxjs';

interface LoginQueryParams {
  returnUrl?: string;
  code?: string;
  state?: string;
  error?: string;
  error_description?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatProgressSpinnerModule, MatIconModule, MatCardModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  isLoading = false;
  error: string | null = null;
  availableProviders: ProviderInfo[] = [];
  private returnUrl: string | null = null;

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.logger.info('LoginComponent initialized');
    
    // Get available providers from auth service
    this.availableProviders = this.authService.getAvailableProviders();

    this.route.queryParams.pipe(take(1)).subscribe((params: LoginQueryParams) => {
      this.returnUrl = params.returnUrl || '/tm';
      const code = params.code;
      const state = params.state;
      const errorParam = params.error;
      const errorDescription = params.error_description;

      if (code && state) {
        this.handleOAuthCallback({ code, state });
      } else if (errorParam) {
        this.handleLoginError({
          code: errorParam,
          message: errorDescription || 'Authentication failed',
          retryable: true,
        });
      } else if (this.availableProviders.length === 1 && !this.hasCallbackParams(params)) {
        // Auto-login if only one provider available and not handling callback
        this.login(this.availableProviders[0].id);
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
            message: 'OAuth authentication failed. Please try again.',
            retryable: true,
          });
        }
      },
      error: (err: unknown) => {
        this.isLoading = false;
        const authError: AuthError = {
          code: 'oauth_error',
          message:
            err instanceof Error ? err.message : 'An unexpected error occurred during OAuth.',
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
