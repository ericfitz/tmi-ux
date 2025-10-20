import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Document } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';

/**
 * Interface for document form values
 */
interface DocumentFormValues {
  name: string;
  url: string;
  description?: string;
}

/**
 * Interface for dialog data
 */
export interface DocumentEditorDialogData {
  document?: Document;
  mode: 'create' | 'edit';
}

@Component({
  selector: 'app-document-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './document-editor-dialog.component.html',
  styleUrls: ['./document-editor-dialog.component.scss'],
})
export class DocumentEditorDialogComponent implements OnInit, OnDestroy {
  documentForm: FormGroup;
  mode: 'create' | 'edit';

  private _subscriptions: Subscription = new Subscription();

  constructor(
    private dialogRef: MatDialogRef<DocumentEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: DocumentEditorDialogData,
  ) {
    this.mode = data.mode;

    this.documentForm = this.fb.group({
      name: [data.document?.name || '', [Validators.required, Validators.maxLength(256)]],
      url: [
        data.document?.url || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      description: [data.document?.description || '', Validators.maxLength(1024)],
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
    const urlControl = this.documentForm.get('url');
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
   * Close the dialog with the document data
   */
  onSubmit(): void {
    // Only check for blocking errors (required, maxLength)
    // Allow submission even with URI suggestions
    const nameControl = this.documentForm.get('name');
    const urlControl = this.documentForm.get('url');
    const descControl = this.documentForm.get('description');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      urlControl?.hasError('required') ||
      urlControl?.hasError('maxlength') ||
      descControl?.hasError('maxlength');

    if (hasBlockingErrors) {
      return;
    }

    const formValues = this.documentForm.getRawValue() as DocumentFormValues;
    this.dialogRef.close(formValues);
  }

  /**
   * Close the dialog without saving
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
