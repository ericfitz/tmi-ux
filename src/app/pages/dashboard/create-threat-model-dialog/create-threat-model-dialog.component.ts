import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { environment } from '../../../../environments/environment';

export interface CreateThreatModelDialogResult {
  name: string;
  description: string;
  framework: 'STRIDE' | 'CIA' | 'LINDDUN' | 'DIE' | 'PLOT4ai';
  isConfidential: boolean;
}

// SEM@6b35da8ffade83ef6579f36d41c97823a2565785: union of valid threat modeling framework name literals (pure)
type FrameworkOption = 'STRIDE' | 'CIA' | 'LINDDUN' | 'DIE' | 'PLOT4ai';

@Component({
  selector: 'app-create-threat-model-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'createThreatModel.title'">Create Threat Model</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="create-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.name'">Name</mat-label>
          <input
            matInput
            formControlName="name"
            data-testid="create-tm-name-input"
            [placeholder]="'createThreatModel.namePlaceholder' | transloco"
            maxlength="256"
            cdkFocusInitial
          />
          @if (form.get('name')?.hasError('required') && form.get('name')?.touched) {
            <mat-error [transloco]="'createThreatModel.nameRequired'">Name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'common.description'">Description</mat-label>
          <textarea
            matInput
            formControlName="description"
            data-testid="create-tm-description-input"
            [placeholder]="'createThreatModel.descriptionPlaceholder' | transloco"
            maxlength="1024"
            rows="3"
          ></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label [transloco]="'createThreatModel.framework'">Framework</mat-label>
          <mat-select formControlName="framework" data-testid="create-tm-framework-select">
            @for (fw of frameworkOptions; track fw) {
              <mat-option [value]="fw">{{ fw }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (showConfidential) {
          <div class="confidential-section">
            <mat-slide-toggle
              formControlName="isConfidential"
              data-testid="create-tm-confidential-toggle"
              color="primary"
            >
              <span [transloco]="'createThreatModel.confidentialLabel'">Confidential</span>
            </mat-slide-toggle>
            <p class="confidential-hint" [transloco]="'createThreatModel.confidentialHint'">
              Confidential threat models are not automatically shared with the Security Reviewers
              group. This setting cannot be changed after creation.
            </p>
          </div>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button (click)="onCancel()">
        <span [transloco]="'common.cancel'">Cancel</span>
      </button>
      <button
        mat-flat-button
        color="primary"
        data-testid="create-tm-submit"
        (click)="onCreate()"
        [disabled]="form.invalid"
      >
        <span [transloco]="'common.create'">Create</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .create-form {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 400px;
      }

      .full-width {
        width: 100%;
      }

      .confidential-section {
        margin-top: 8px;
      }

      .confidential-hint {
        margin: 8px 0 0 0;
        font-size: 12px;
        color: var(--theme-text-secondary);
        line-height: 1.4;
      }
    `,
  ],
})
// SEM@de32c6e2bb816be8b98cbdd5c31310be7afc44a8: dialog for collecting name, framework, and confidentiality to create a threat model
export class CreateThreatModelDialogComponent {
  readonly frameworkOptions: FrameworkOption[] = ['STRIDE', 'CIA', 'LINDDUN', 'DIE', 'PLOT4ai'];
  readonly showConfidential = environment.enableConfidentialThreatModels ?? false;

  form: FormGroup;

  // SEM@de32c6e2bb816be8b98cbdd5c31310be7afc44a8: build the threat model creation form with validation and environment defaults
  constructor(
    public dialogRef: MatDialogRef<CreateThreatModelDialogComponent>,
    private fb: FormBuilder,
  ) {
    const defaultFramework =
      (environment.defaultThreatModelFramework as FrameworkOption) || 'STRIDE';

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(256)]],
      description: ['', [Validators.maxLength(2048)]],
      framework: [defaultFramework],
      isConfidential: [false],
    });
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: validate and close dialog with threat model creation result
  onCreate(): void {
    if (this.form.invalid) {
      return;
    }

    const value = this.form.value as {
      name: string;
      description: string;
      framework: FrameworkOption;
      isConfidential: boolean;
    };

    const result: CreateThreatModelDialogResult = {
      name: value.name.trim(),
      description: value.description?.trim() || '',
      framework: value.framework,
      isConfidential: this.showConfidential ? value.isConfidential : false,
    };

    this.dialogRef.close(result);
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: close the dialog without a result (pure)
  onCancel(): void {
    this.dialogRef.close();
  }
}
