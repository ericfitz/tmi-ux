import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { Threat } from '../../models/threat-model.model';

/**
 * Interface for threat form values
 */
interface ThreatFormValues {
  name: string;
  description: string;
}

/**
 * Dialog data interface
 */
export interface ThreatEditorDialogData {
  threat?: Threat;
  threatModelId: string;
  mode: 'create' | 'edit' | 'view';
}

@Component({
  selector: 'app-threat-editor-dialog',
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
  templateUrl: './threat-editor-dialog.component.html',
  styleUrls: ['./threat-editor-dialog.component.scss'],
})
export class ThreatEditorDialogComponent implements OnInit {
  threatForm: FormGroup;
  dialogTitle: string = '';
  isViewOnly: boolean = false;

  constructor(
    private dialogRef: MatDialogRef<ThreatEditorDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: ThreatEditorDialogData,
  ) {
    this.threatForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
      description: ['', Validators.maxLength(500)],
    });
  }

  ngOnInit(): void {
    // Set dialog mode
    this.isViewOnly = this.data.mode === 'view';

    // Set dialog title based on mode
    if (this.data.mode === 'create') {
      this.dialogTitle = 'threatModels.createNewThreat';
    } else if (this.data.mode === 'edit') {
      this.dialogTitle = 'threatModels.editThreat';
    } else {
      this.dialogTitle = 'threatModels.viewThreat';
    }

    // If editing or viewing, populate form with threat data
    if (this.data.threat) {
      this.threatForm.patchValue({
        name: this.data.threat.name,
        description: this.data.threat.description || '',
      });

      // If view only, disable the form
      if (this.isViewOnly) {
        this.threatForm.disable();
      }
    }
  }

  /**
   * Close the dialog with the threat data
   */
  onSubmit(): void {
    if (this.threatForm.invalid) {
      return;
    }

    const formValues = this.threatForm.getRawValue() as ThreatFormValues;

    // Return the form values to be used to create or update the threat
    this.dialogRef.close({
      name: formValues.name,
      description: formValues.description,
    });
  }

  /**
   * Close the dialog without creating or updating a threat
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
