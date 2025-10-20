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

import { Source } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

/**
 * Interface for source code form values
 */
interface SourceCodeFormValues {
  name: string;
  description?: string;
  type: 'git' | 'svn' | 'mercurial' | 'other';
  url: string;
  refType?: 'branch' | 'tag' | 'commit';
  refValue?: string;
  subPath?: string;
}

/**
 * Interface for dialog data
 */
export interface SourceCodeEditorDialogData {
  sourceCode?: Source;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-source-code-editor-dialog',
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
  templateUrl: './source-code-editor-dialog.component.html',
  styleUrls: ['./source-code-editor-dialog.component.scss'],
})
export class SourceCodeEditorDialogComponent implements OnInit, OnDestroy {
  sourceCodeForm: FormGroup;
  mode: 'create' | 'edit';

  private _subscriptions: Subscription = new Subscription();

  constructor(
    private dialogRef: MatDialogRef<SourceCodeEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: SourceCodeEditorDialogData,
  ) {
    this.mode = data.mode;

    this.sourceCodeForm = this.fb.group({
      name: [data.sourceCode?.name || '', [Validators.required, Validators.maxLength(256)]],
      description: [data.sourceCode?.description || '', Validators.maxLength(1024)],
      type: [data.sourceCode?.type || 'git', Validators.required],
      url: [
        data.sourceCode?.url || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      refType: [data.sourceCode?.parameters?.refType || 'branch'],
      refValue: [data.sourceCode?.parameters?.refValue || '', Validators.maxLength(256)],
      subPath: [data.sourceCode?.parameters?.subPath || '', Validators.maxLength(256)],
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
    const urlControl = this.sourceCodeForm.get('url');
    if (!urlControl) return null;

    const uriSuggestionError = urlControl.errors?.['uriSuggestion'] as
      | { message?: string; severity?: string }
      | undefined;
    if (uriSuggestionError && typeof uriSuggestionError === 'object') {
      return uriSuggestionError.message || null;
    }
    return null;
  }

  /**
   * Close the dialog with the source code data
   */
  onSubmit(): void {
    // Only check for blocking errors (required, maxLength)
    // Allow submission even with URI suggestions
    const nameControl = this.sourceCodeForm.get('name');
    const descControl = this.sourceCodeForm.get('description');
    const typeControl = this.sourceCodeForm.get('type');
    const urlControl = this.sourceCodeForm.get('url');
    const refValueControl = this.sourceCodeForm.get('refValue');
    const subPathControl = this.sourceCodeForm.get('subPath');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength') ||
      typeControl?.hasError('required') ||
      urlControl?.hasError('required') ||
      urlControl?.hasError('maxlength') ||
      refValueControl?.hasError('maxlength') ||
      subPathControl?.hasError('maxlength');

    if (hasBlockingErrors) {
      return;
    }

    const formValues = this.sourceCodeForm.getRawValue() as SourceCodeFormValues;

    // Build the result with proper structure
    const result = {
      name: formValues.name,
      description: formValues.description,
      type: formValues.type,
      url: formValues.url,
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
