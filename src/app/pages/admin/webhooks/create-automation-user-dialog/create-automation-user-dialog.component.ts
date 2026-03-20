import { Component, DestroyRef, Inject, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { CreateAutomationAccountResponse } from '@app/types/user.types';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

export interface CreateAutomationUserDialogData {
  webhookName: string;
}

/**
 * Create Automation User Dialog Component
 *
 * Dialog for creating an automation (machine) user account
 * associated with a webhook subscription.
 */
@Component({
  selector: 'app-create-automation-user-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.webhooks.createAutomationUserDialog.title'">
      Create Automation User
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="automation-user-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.createAutomationUserDialog.name'">
            Name
          </mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'admin.webhooks.createAutomationUserDialog.namePlaceholder' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.webhooks.createAutomationUserDialog.nameHint'">
            Name for the automation user account
          </mat-hint>
          @if (form.get('name')?.hasError('required')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUserDialog.nameRequired'">
                Name is required
              </span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('minlength')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUserDialog.nameMinLength'">
                Name must be at least 2 characters
              </span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('maxlength')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUserDialog.nameMaxLength'">
                Name must be at most 64 characters
              </span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('pattern')) {
            <mat-error>
              <span [transloco]="'admin.webhooks.createAutomationUserDialog.namePattern'">
                Name must start with a letter and end with a letter or number
              </span>
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.webhooks.createAutomationUserDialog.email'">
            Email (Optional)
          </mat-label>
          <input
            matInput
            formControlName="email"
            type="email"
            [placeholder]="'admin.webhooks.createAutomationUserDialog.emailPlaceholder' | transloco"
          />
          <mat-hint [transloco]="'admin.webhooks.createAutomationUserDialog.emailHint'">
            Optional email address for the automation user
          </mat-hint>
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
        <span [transloco]="'admin.webhooks.createAutomationUserDialog.save'">
          Create Automation User
        </span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .automation-user-form {
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
        padding: 16px 24px 16px 0;
        margin: 0;
      }
    `,
  ],
})
export class CreateAutomationUserDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  saving = false;
  errorMessage = '';

  constructor(
    private dialogRef: MatDialogRef<CreateAutomationUserDialogComponent>,
    @Inject(MAT_DIALOG_DATA) private data: CreateAutomationUserDialogData,
    private userAdminService: UserAdminService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    const webhookName = this.data.webhookName;
    const generatedEmail = this.generateEmail(webhookName);

    this.form = this.fb.group({
      name: [
        webhookName,
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(64),
          Validators.pattern(/^[a-zA-Z][a-zA-Z0-9 _.@-]*[a-zA-Z0-9]$/),
        ],
      ],
      email: [generatedEmail],
    });
  }

  /**
   * Generate an email from the webhook name:
   * lowercase, replace non-alphanumeric sequences with single hyphen,
   * trim leading/trailing hyphens, append @tmi.local
   */
  private generateEmail(webhookName: string): string {
    const slug = webhookName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `${slug}@tmi.local`;
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value as { name: string; email: string };
      const name = formValue.name;
      const email = formValue.email || undefined;

      this.userAdminService
        .createAutomationUser({ name, ...(email && { email }) })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response: CreateAutomationAccountResponse) => {
            this.logger.info('Automation user created', { name: response.user.name });
            this.dialogRef.close(response);
          },
          error: (error: unknown) => {
            this.logger.error('Failed to create automation user', error);
            this.errorMessage = getErrorMessage(
              error,
              'Failed to create automation user. Please try again.',
            );
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
