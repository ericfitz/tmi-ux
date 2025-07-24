import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Source } from '../../models/threat-model.model';

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
export class SourceCodeEditorDialogComponent {
  sourceCodeForm: FormGroup;
  mode: 'create' | 'edit';

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
      url: [data.sourceCode?.url || '', [Validators.required, Validators.maxLength(1024)]],
      refType: [data.sourceCode?.parameters?.refType || 'branch'],
      refValue: [data.sourceCode?.parameters?.refValue || '', Validators.maxLength(256)],
      subPath: [data.sourceCode?.parameters?.subPath || '', Validators.maxLength(256)],
    });
  }

  /**
   * Close the dialog with the source code data
   */
  onSubmit(): void {
    if (this.sourceCodeForm.invalid) {
      return;
    }

    const formValues = this.sourceCodeForm.getRawValue() as SourceCodeFormValues;
    
    // Build the result with proper structure
    const result = {
      name: formValues.name,
      description: formValues.description,
      type: formValues.type,
      url: formValues.url,
      parameters: formValues.refValue ? {
        refType: formValues.refType || 'branch',
        refValue: formValues.refValue,
        subPath: formValues.subPath,
      } : undefined,
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