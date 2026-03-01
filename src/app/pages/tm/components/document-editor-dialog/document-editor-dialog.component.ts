import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Subscription } from 'rxjs';

import { Document } from '../../models/threat-model.model';
import { FormValidationService } from '../../../../shared/services/form-validation.service';
import { getUriSuggestionFromControl } from '@app/shared/utils/form-validation.util';

/**
 * Interface for document form values
 */
interface DocumentFormValues {
  name: string;
  uri: string;
  description?: string;
  include_in_report?: boolean;
}

/**
 * Interface for dialog data
 */
export interface DocumentEditorDialogData {
  document?: Document;
  mode: 'create' | 'edit';
  isReadOnly?: boolean;
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
    MatIconModule,
    MatCheckboxModule,
    MatTooltipModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './document-editor-dialog.component.html',
  styleUrls: ['./document-editor-dialog.component.scss'],
})
export class DocumentEditorDialogComponent implements OnInit, OnDestroy {
  documentForm: FormGroup;
  mode: 'create' | 'edit';
  isReadOnly: boolean;

  private _subscriptions: Subscription = new Subscription();

  constructor(
    private dialogRef: MatDialogRef<DocumentEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: DocumentEditorDialogData,
  ) {
    this.mode = data.mode;
    this.isReadOnly = data.isReadOnly || false;

    this.documentForm = this.fb.group({
      name: [data.document?.name || '', [Validators.required, Validators.maxLength(256)]],
      uri: [
        data.document?.uri || '',
        [
          Validators.required,
          Validators.maxLength(1024),
          FormValidationService.validators.uriGuidance,
        ],
      ],
      description: [data.document?.description || '', Validators.maxLength(2048)],
      include_in_report: [data.mode === 'create' ? true : data.document?.include_in_report],
    });

    if (this.isReadOnly) {
      this.documentForm.disable();
    }
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
    return getUriSuggestionFromControl(this.documentForm.get('uri'));
  }

  /**
   * Close the dialog with the document data
   */
  onSubmit(): void {
    // Only check for blocking errors (required, maxLength)
    // Allow submission even with URI suggestions
    const nameControl = this.documentForm.get('name');
    const uriControl = this.documentForm.get('uri');
    const descControl = this.documentForm.get('description');

    const hasBlockingErrors =
      nameControl?.hasError('required') ||
      nameControl?.hasError('maxlength') ||
      uriControl?.hasError('required') ||
      uriControl?.hasError('maxlength') ||
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
