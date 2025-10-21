import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Repository } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

/**
 * Interface for repository form values
 */
interface RepositoryFormValues {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  uri: string;
  refType?: 'branch' | 'tag' | 'commit';
  refValue?: string;
  subPath?: string;
}

/**
 * Interface for dialog data
 */
export interface RepositoryEditorDialogData {
  repository?: Repository;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-repository-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './repository-editor-dialog.component.html',
  styleUrls: ['./repository-editor-dialog.component.scss'],
})
export class RepositoryEditorDialogComponent implements OnInit, OnDestroy {
  repositoryForm: FormGroup;
  mode: 'create' | 'edit';

  private _subscriptions: Subscription = new Subscription();

  constructor(
    private dialogRef: MatDialogRef<RepositoryEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: RepositoryEditorDialogData,
  ) {
    this.mode = data.mode;

    this.repositoryForm = this.fb.group({
      name: [data.repository?.name || '', [Validators.required, Validators.maxLength(256)]],
      description: [data.repository?.description || '', Validators.maxLength(1024)],
      type: [data.repository?.type || 'git', Validators.required],
      uri: [
        data.repository?.uri || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      refType: [data.repository?.parameters?.refType || 'branch'],
      refValue: [data.repository?.parameters?.refValue || '', Validators.maxLength(256)],
      subPath: [data.repository?.parameters?.subPath || '', Validators.maxLength(256)],
    });
  }

  ngOnInit(): void {
    // Component initialization complete
  }

  ngOnDestroy(): void {
    this._subscriptions.unsubscribe();
  }

  /**
   * Get URI validation suggestion message (if any)
   */
  getUriSuggestion(): string | null {
    const uriControl = this.repositoryForm.get('uri');
    if (!uriControl) return null;

    const uriSuggestionError = uriControl.errors?.['uriSuggestion'] as
      | { message?: string; severity?: string }
      | undefined;
    if (uriSuggestionError && typeof uriSuggestionError === 'object') {
      return uriSuggestionError.message || null;
    }
    return null;
  }

  /**
   * Close the dialog with the repository data
   */
  onSubmit(): void {
    // Only check for blocking errors (required, maxLength)
    // Allow submission even with URI suggestions
    const nameControl = this.repositoryForm.get('name');
    const descControl = this.repositoryForm.get('description');
    const typeControl = this.repositoryForm.get('type');
    const uriControl = this.repositoryForm.get('uri');
    const refValueControl = this.repositoryForm.get('refValue');
    const subPathControl = this.repositoryForm.get('subPath');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength') ||
      typeControl?.hasError('required') ||
      uriControl?.hasError('required') ||
      uriControl?.hasError('maxlength') ||
      refValueControl?.hasError('maxlength') ||
      subPathControl?.hasError('maxlength');

    if (hasBlockingErrors) {
      return;
    }

    const formValues = this.repositoryForm.getRawValue() as RepositoryFormValues;

    // Build the result with proper structure
    const result = {
      name: formValues.name,
      description: formValues.description,
      type: formValues.type,
      uri: formValues.uri,
      parameters: formValues.refValue
        ? {
            refType: formValues.refType || 'branch',
            refValue: formValues.refValue,
            subPath: formValues.subPath,
          }
        : undefined,
    };

    this.dialogRef.close(result);
  }

  /**
   * Close the dialog without saving
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
