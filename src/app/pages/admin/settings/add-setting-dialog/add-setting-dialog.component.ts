import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { SettingsAdminService } from '@app/core/services/settings-admin.service';
import { LoggerService } from '@app/core/services/logger.service';
import { SettingType } from '@app/types/settings.types';

/**
 * Add Setting Dialog Component
 *
 * Dialog for creating a new system setting.
 * Provides type-specific value input and client-side key validation.
 */
@Component({
  selector: 'app-add-setting-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'admin.settings.addDialog.title'">Add Setting</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="admin-form">
        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.settings.addDialog.key'">Key</mat-label>
          <input
            matInput
            formControlName="key"
            [placeholder]="'admin.settings.addDialog.keyHint' | transloco"
            required
          />
          <mat-hint [transloco]="'admin.settings.addDialog.keyHint'">
            Lowercase with dots and underscores
          </mat-hint>
          @if (form.get('key')?.hasError('required') && form.get('key')?.touched) {
            <mat-error>
              <span [transloco]="'admin.settings.addDialog.keyRequired'">Key is required</span>
            </mat-error>
          }
          @if (form.get('key')?.hasError('pattern') && form.get('key')?.touched) {
            <mat-error>
              <span [transloco]="'admin.settings.addDialog.keyInvalid'">
                Must start with lowercase letter
              </span>
            </mat-error>
          }
        </mat-form-field>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.settings.addDialog.type'">Type</mat-label>
          <mat-select formControlName="type" required>
            @for (t of settingTypes; track t) {
              <mat-option [value]="t">
                {{ 'admin.settings.types.' + t | transloco }}
              </mat-option>
            }
          </mat-select>
          @if (form.get('type')?.hasError('required') && form.get('type')?.touched) {
            <mat-error>
              <span [transloco]="'admin.settings.addDialog.typeRequired'">Type is required</span>
            </mat-error>
          }
        </mat-form-field>

        <div class="value-field">
          @switch (form.get('type')?.value) {
            @case ('bool') {
              <mat-slide-toggle formControlName="boolValue">
                <span [transloco]="'admin.settings.addDialog.value'">Value</span>
              </mat-slide-toggle>
            }
            @case ('int') {
              <mat-form-field class="full-width">
                <mat-label [transloco]="'admin.settings.addDialog.value'">Value</mat-label>
                <input matInput type="number" formControlName="value" required />
                @if (form.get('value')?.hasError('required') && form.get('value')?.touched) {
                  <mat-error>
                    <span [transloco]="'admin.settings.addDialog.valueRequired'">
                      Value is required
                    </span>
                  </mat-error>
                }
              </mat-form-field>
            }
            @case ('json') {
              <mat-form-field class="full-width">
                <mat-label [transloco]="'admin.settings.addDialog.value'">Value</mat-label>
                <textarea
                  matInput
                  formControlName="value"
                  rows="4"
                  class="json-textarea"
                  required
                ></textarea>
                @if (form.get('value')?.hasError('required') && form.get('value')?.touched) {
                  <mat-error>
                    <span [transloco]="'admin.settings.addDialog.valueRequired'">
                      Value is required
                    </span>
                  </mat-error>
                }
              </mat-form-field>
            }
            @default {
              <mat-form-field class="full-width">
                <mat-label [transloco]="'admin.settings.addDialog.value'">Value</mat-label>
                <input matInput type="text" formControlName="value" required />
                @if (form.get('value')?.hasError('required') && form.get('value')?.touched) {
                  <mat-error>
                    <span [transloco]="'admin.settings.addDialog.valueRequired'">
                      Value is required
                    </span>
                  </mat-error>
                }
              </mat-form-field>
            }
          }
        </div>

        <mat-form-field class="full-width">
          <mat-label [transloco]="'admin.settings.addDialog.description'">Description</mat-label>
          <textarea matInput formControlName="description" rows="2"></textarea>
          <mat-hint [transloco]="'admin.settings.addDialog.descriptionHint'">
            Optional description of this setting
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
        [disabled]="!isFormValid() || saving"
      >
        @if (saving) {
          <mat-spinner diameter="20" class="button-spinner"></mat-spinner>
        }
        <span [transloco]="'admin.settings.addDialog.save'">Create Setting</span>
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

      .value-field {
        min-height: 56px;
      }

      .json-textarea {
        font-family: monospace;
        font-size: 13px;
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
export class AddSettingDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  saving = false;
  errorMessage = '';
  readonly settingTypes: SettingType[] = ['string', 'int', 'bool', 'json'];

  constructor(
    private dialogRef: MatDialogRef<AddSettingDialogComponent>,
    private settingsService: SettingsAdminService,
    private fb: FormBuilder,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      key: [
        '',
        [Validators.required, Validators.pattern(/^[a-z][a-z0-9_.]*$/), Validators.maxLength(256)],
      ],
      type: ['string', Validators.required],
      value: ['', Validators.required],
      boolValue: [false],
      description: ['', Validators.maxLength(2048)],
    });
  }

  isFormValid(): boolean {
    const type = this.form.get('type')?.value as SettingType;
    if (type === 'bool') {
      return this.form.get('key')?.valid === true && this.form.get('type')?.valid === true;
    }
    return this.form.valid;
  }

  private getValueString(): string {
    const type = this.form.get('type')?.value as SettingType;
    if (type === 'bool') {
      return (this.form.get('boolValue')?.value as boolean) ? 'true' : 'false';
    }
    return this.form.get('value')?.value as string;
  }

  onSave(): void {
    if (this.isFormValid() && !this.saving) {
      this.saving = true;
      this.errorMessage = '';

      const key = this.form.get('key')?.value as string;
      const type = this.form.get('type')?.value as SettingType;
      const value = this.getValueString();
      const description = this.form.get('description')?.value as string;

      this.settingsService
        .updateSetting(key, {
          value,
          type,
          ...(description && { description }),
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Setting created successfully', { key });
            this.dialogRef.close(true);
          },
          error: (error: { error?: { message?: string } }) => {
            this.logger.error('Failed to create setting', error);
            this.errorMessage =
              error.error?.message || 'Failed to create setting. Please try again.';
            this.saving = false;
          },
        });
    }
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
