import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../../services/auth.service';
import { UserProfile } from '../../models/auth.models';
import { LoggerService } from '../../../core/services/logger.service';

@Component({
  selector: 'app-local-user-select',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    TranslocoModule,
  ],
  template: `
    <div class="local-auth-container">
      <mat-card class="auth-card">
        <mat-card-header>
          <div class="header-with-icon">
            <span class="material-symbols-outlined local-icon">computer</span>
            <div>
              <mat-card-title>{{ 'login.local.title' | transloco }}</mat-card-title>
              <mat-card-subtitle>{{ 'login.local.subtitle' | transloco }}</mat-card-subtitle>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content>
          <form
            [formGroup]="loginForm"
            (ngSubmit)="onSubmit()"
            (submit)="onFormSubmit($event)"
            class="login-form"
          >
            <mat-form-field appearance="outline" class="email-field">
              <mat-label>{{ 'common.emailLabel' | transloco }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="'common.emailLabel' | transloco"
                autocomplete="email"
              />
              <mat-error *ngIf="loginForm.get('email')?.hasError('required')">
                {{ 'login.local.emailRequired' | transloco }}
              </mat-error>
              <mat-error *ngIf="loginForm.get('email')?.hasError('email')">
                {{ 'login.local.emailInvalid' | transloco }}
              </mat-error>
            </mat-form-field>
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="loginForm.invalid"
              class="login-button"
              (click)="onButtonClick($event)"
            >
              {{ 'login.local.loginButton' | transloco }}
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .local-auth-container {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 40px 20px;
        max-width: 100%;
      }

      .auth-card {
        max-width: 400px;
        width: 100%;
      }

      .header-with-icon {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .local-icon {
        font-size: 32px;
        color: #6c757d;
      }

      .login-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        margin-top: 16px;
      }

      .email-field {
        width: 100%;
      }

      .login-button {
        align-self: stretch;
        padding: 12px 0;
        font-size: 16px;
        font-weight: 500;
      }
    `,
  ],
})
export class LocalUserSelectComponent implements OnInit {
  loginForm: FormGroup;
  private state: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private authService: AuthService,
    private transloco: TranslocoService,
    private logger: LoggerService,
  ) {
    this.loginForm = this.fb.group({
      email: ['local@test.tmi', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    this.logger.debugComponent('LocalUserSelect', 'LocalUserSelectComponent initialized');
    this.logger.debugComponent('LocalUserSelect', 'Current URL', window.location.href);
    this.logger.debugComponent('LocalUserSelect', 'Initial form value', this.loginForm.value);
    this.logger.debugComponent('LocalUserSelect', 'Initial form valid', this.loginForm.valid);

    // Check for debug info from previous page
    const debugInfo = localStorage.getItem('local_auth_debug');
    if (debugInfo) {
      this.logger.debugComponent('LocalUserSelect', 'Local auth debug info', JSON.parse(debugInfo));
      localStorage.removeItem('local_auth_debug');
    }

    // Check stored OAuth state
    this.logger.debugComponent(
      'LocalUserSelect',
      'Stored OAuth state',
      localStorage.getItem('oauth_state'),
    );
    this.logger.debugComponent(
      'LocalUserSelect',
      'Stored OAuth provider',
      localStorage.getItem('oauth_provider'),
    );

    this.route.queryParams.subscribe(params => {
      this.state = (params['state'] as string) || '';
      this.logger.debugComponent('LocalUserSelect', 'State from query params', this.state);
      this.logger.debugComponent('LocalUserSelect', 'All query params', params);
    });
  }

  onButtonClick(event: Event): void {
    this.logger.debugComponent('LocalUserSelect', 'Button clicked!', event);
    // Don't prevent default - let form submission happen naturally
  }

  onFormSubmit(event: Event): void {
    this.logger.debugComponent('LocalUserSelect', 'Form submit event!', event);
    // Form submit event handler
  }

  onSubmit(): void {
    this.logger.debugComponent('LocalUserSelect', 'LocalUserSelectComponent.onSubmit called');
    if (this.loginForm.valid) {
      const email = this.loginForm.get('email')?.value as string;
      this.logger.debugComponent('LocalUserSelect', 'Form is valid, email', email);

      // For local development, bypass OAuth flow entirely
      const userName = this.transloco.translate('login.local.userName') || 'Local User';
      const userProfile: UserProfile = {
        id: '0',
        email: email,
        name: userName,
        providers: [{ provider: 'local', is_primary: true }],
        picture: undefined,
      };
      this.logger.debugComponent('LocalUserSelect', 'Creating local token for user', userProfile);

      // Create a 7-day token directly
      const sevenDaysInMinutes = 7 * 24 * 60;
      const success = this.authService.createLocalTokenWithExpiry(userProfile, sevenDaysInMinutes);
      this.logger.debugComponent('LocalUserSelect', 'Token creation result', success);

      if (success) {
        this.logger.debugComponent('LocalUserSelect', 'Navigating to /tm');
        void this.router.navigate(['/tm']);
      } else {
        this.logger.debugComponent(
          'LocalUserSelect',
          'Token creation failed, navigating back to login',
        );
        void this.router.navigate(['/login'], {
          queryParams: { error: 'local_auth_failed' },
        });
      }
    } else {
      this.logger.debugComponent('LocalUserSelect', 'Form is invalid');
    }
  }
}
