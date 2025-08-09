import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { TranslocoModule } from '@jsverse/transloco';
import { LocalOAuthProviderService } from '../../services/local-oauth-provider.service';

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
            <i class="fa-solid fa-laptop-code local-icon"></i>
            <div>
              <mat-card-title>{{ 'login.local.title' | transloco }}</mat-card-title>
              <mat-card-subtitle>{{ 'login.local.subtitle' | transloco }}</mat-card-subtitle>
            </div>
          </div>
        </mat-card-header>
        <mat-card-content>
          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="login-form">
            <mat-form-field appearance="outline" class="email-field">
              <mat-label>{{ 'login.local.emailLabel' | transloco }}</mat-label>
              <input
                matInput
                type="email"
                formControlName="email"
                [placeholder]="'login.local.emailLabel' | transloco"
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
    private localProvider: LocalOAuthProviderService,
    private router: Router,
    private fb: FormBuilder,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.state = (params['state'] as string) || '';
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      const email = this.loginForm.get('email')?.value as string;
      const code = this.localProvider.generateAuthCodeForEmail(email);
      void this.router.navigate(['/auth/callback'], {
        queryParams: { code, state: this.state },
      });
    }
  }
}
