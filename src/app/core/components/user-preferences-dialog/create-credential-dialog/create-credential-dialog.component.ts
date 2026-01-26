import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { ClientCredentialService } from '@app/core/services/client-credential.service';
import { LoggerService } from '@app/core/services/logger.service';
import {
  ClientCredentialResponse,
  CreateClientCredentialRequest,
} from '@app/types/client-credential.types';

/**
 * Create Client Credential Dialog Component
 *
 * Dialog for creating new client credentials.
 * Collects name, optional description, and optional expiration date.
 */
@Component({
  selector: 'app-create-credential-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'userPreferences.credentials.createDialog.title'">
      Create Client Credential
    </h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="credential-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'userPreferences.credentials.createDialog.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'userPreferences.credentials.createDialog.namePlaceholder' | transloco"
            required
            maxlength="100"
          />
          <mat-hint [transloco]="'userPreferences.credentials.createDialog.nameHint'">
            A descriptive name for this credential
          </mat-hint>
          @if (form.get('name')?.hasError('required')) {
            <mat-error>
              <span [transloco]="'userPreferences.credentials.createDialog.nameRequired'">
                Name is required
              </span>
            </mat-error>
          }
          @if (form.get('name')?.hasError('maxlength')) {
            <mat-error>
              <span [transloco]="'userPreferences.credentials.createDialog.nameTooLong'">
                Name must be 100 characters or less
              </span>
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'userPreferences.credentials.createDialog.description'">
            Description
          </mat-label>
          <textarea
            matInput
            formControlName="description"
            [placeholder]="
              'userPreferences.credentials.createDialog.descriptionPlaceholder' | transloco
            "
            rows="2"
            maxlength="500"
          ></textarea>
          <mat-hint [transloco]="'userPreferences.credentials.createDialog.descriptionHint'">
            Optional: Describe what this credential is used for
          </mat-hint>
          @if (form.get('description')?.hasError('maxlength')) {
            <mat-error>
              <span [transloco]="'userPreferences.credentials.createDialog.descriptionTooLong'">
                Description must be 500 characters or less
              </span>
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'userPreferences.credentials.createDialog.expiresAt'">
            Expiration Date
          </mat-label>
          <input matInput [matDatepicker]="picker" formControlName="expiresAt" [min]="minDate" />
          <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
          <mat-datepicker #picker></mat-datepicker>
          <mat-hint [transloco]="'userPreferences.credentials.createDialog.expiresAtHint'">
            Optional: Leave blank for no expiration
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
        <span [transloco]="'userPreferences.credentials.createDialog.create'">Create</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .credential-form {
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
export class CreateCredentialDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  saving = false;
  errorMessage = '';
  minDate = new Date();

  constructor(
    private dialogRef: MatDialogRef<CreateCredentialDialogComponent>,
    private clientCredentialService: ClientCredentialService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
      expiresAt: [null],
    });
  }

  onSave(): void {
    if (this.form.valid && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const formValue = this.form.value as {
        name: string;
        description: string;
        expiresAt: Date | null;
      };

      const input: CreateClientCredentialRequest = {
        name: formValue.name.trim(),
        ...(formValue.description && { description: formValue.description.trim() }),
        ...(formValue.expiresAt && { expires_at: formValue.expiresAt.toISOString() }),
      };

      this.clientCredentialService
        .create(input)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (credential: ClientCredentialResponse) => {
            this.logger.info('Client credential created successfully');
            this.dialogRef.close(credential);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create client credential', error);
            this.errorMessage =
              error.error?.message || 'Failed to create credential. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(null);
  }
}
