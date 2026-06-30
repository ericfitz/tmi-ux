import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  DIALOG_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

/** Result returned when the user confirms survey creation */
export interface CreateSurveyDialogResult {
  name: string;
  version: string;
}

/**
 * Dialog for collecting survey name and version before creating a new survey.
 * Does not call any API — returns the form values for the caller to handle.
 */
@Component({
  selector: 'app-create-survey-dialog',
  standalone: true,
  imports: [
    ...DIALOG_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'adminSurveys.createDialog.title' | transloco }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="create-survey-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'adminSurveys.createDialog.nameLabel' | transloco }}</mat-label>
          <input
            matInput
            formControlName="name"
            [placeholder]="'adminSurveys.createDialog.namePlaceholder' | transloco"
            cdkFocusInitial
            data-testid="create-survey-name-input"
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error>{{ 'adminSurveys.createDialog.nameRequired' | transloco }}</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'adminSurveys.createDialog.versionLabel' | transloco }}</mat-label>
          <input
            matInput
            formControlName="version"
            [placeholder]="'adminSurveys.createDialog.versionPlaceholder' | transloco"
            data-testid="create-survey-version-input"
          />
          <mat-hint>{{ 'adminSurveys.createDialog.versionHint' | transloco }}</mat-hint>
          @if (form.get('version')?.hasError('required') && form.get('version')?.touched) {
            <mat-error>{{ 'adminSurveys.createDialog.versionRequired' | transloco }}</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()" data-testid="create-survey-cancel-button">
        {{ 'common.cancel' | transloco }}
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="onCreate()"
        [disabled]="!form.valid"
        data-testid="create-survey-submit-button"
      >
        {{ 'adminSurveys.createSurvey' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      .create-survey-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        min-width: 400px;
        padding: 16px 0;
      }

      .full-width {
        width: 100%;
      }

      mat-dialog-actions {
        padding: 16px 24px;
        margin: 0;
      }
    `,
  ],
})
// SEM@6297e6cb099bef2dccad14f9ce7b634369834014: dialog component for collecting survey template name and version before creation
export class CreateSurveyDialogComponent implements OnInit {
  form!: FormGroup;

  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: inject dialog reference and form builder for the create-survey dialog
  constructor(
    private dialogRef: MatDialogRef<CreateSurveyDialogComponent, CreateSurveyDialogResult>,
    private fb: FormBuilder,
  ) {}

  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: build the reactive form with name and version fields for survey creation (mutates shared state)
  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(256)]],
      version: ['1', [Validators.required, Validators.maxLength(50)]],
    });
  }

  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: validate the form and close the dialog with the trimmed survey name and version
  onCreate(): void {
    if (this.form.valid) {
      const { name, version } = this.form.value as CreateSurveyDialogResult;
      this.dialogRef.close({ name: name.trim(), version: version.trim() });
    }
  }

  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: dismiss the create-survey dialog without returning a result
  onCancel(): void {
    this.dialogRef.close();
  }
}
