import { Component, OnInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { CreateAdministratorRequest } from '@app/types/administrator.types';
import { AdministratorService } from '@app/core/services/administrator.service';
import { AuthService } from '@app/auth/services/auth.service';
import { LoggerService } from '@app/core/services/logger.service';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';

/**
 * Add Administrator Dialog Component
 *
 * Dialog for creating new administrator grants.
 * Allows selection of provider and subject (user email or group name).
 */
@Component({
  selector: 'app-add-administrator-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ProviderDisplayComponent,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.administrators.addDialog.title'">Add Administrator</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="admin-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.administrators.addDialog.provider'">Provider</mat-label>
          <mat-select formControlName="provider" required>
            @for (provider of availableProviders; track provider.id) {
              <mat-option [value]="provider.id">
                <app-provider-display [providerInfo]="provider" />
              </mat-option>
            }
          </mat-select>
          <mat-error *ngIf="form.get('provider')?.hasError('required')">
            <span [transloco]="'admin.administrators.addDialog.providerRequired'"
              >Provider is required</span
            >
          </mat-error>
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.administrators.addDialog.subject'">Subject</mat-label>
          <input
            matInput
            formControlName="subject"
            [placeholder]="'admin.administrators.addDialog.subjectPlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.administrators.addDialog.subjectHint'"
            >Enter user email or group name</mat-hint
          >
          <mat-error *ngIf="form.get('subject')?.hasError('required')">
            <span [transloco]="'admin.administrators.addDialog.subjectRequired'"
              >Subject is required</span
            >
          </mat-error>
        </mat-form-field>

        @if (errorMessage) {
          <mat-error class="form-error">
            {{ errorMessage }}
          </mat-error>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-raised-button
        color="primary"
        (click)="onSave()"
        [disabled]="!form.valid || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'admin.administrators.addDialog.save'">Add Administrator</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .admin-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 400px;
        padding: 16px 0;
      }

      .full-width {
        width: 100%;
      }

      .form-error {
        color: var(--theme-error);
        font-size: 12px;
        margin-top: 8px;
      }

      .button-spinner {
        display: inline-block;
        margin-right: 8px;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        margin: 0;
      }
    `,
  ],
})
export class AddAdministratorDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  form!: FormGroup;
  availableProviders: OAuthProviderInfo[] = [];
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<AddAdministratorDialogComponent>,
    private administratorService: AdministratorService,
    private authService: AuthService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      provider: ['', Validators.required],
      subject: ['', Validators.required],
    });

    this.authService
      .getAvailableProviders()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: providers => {
          this.availableProviders = providers;
        },
        error: error => {
          this.logger.error('Failed to load available providers', error);
          this.errorMessage = 'Failed to load available providers';
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value as { provider: string; subject: string };
      const provider = formValue.provider;
      const subject = formValue.subject;

      const request: CreateAdministratorRequest = {
        provider,
        ...(this.isEmail(subject) ? { user_id: subject } : { group_id: subject }),
      };

      this.administratorService
        .create(request)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Administrator created successfully');
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create administrator', error);
            this.errorMessage =
              error.error?.message || 'Failed to create administrator. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }

  private isEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }
}
