import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Interface for the dialog data
 */
export interface RenameDiagramDialogData {
  id: string;
  name: string;
}

/**
 * Interface for diagram form values
 */
interface DiagramFormValues {
  name: string;
}

@Component({
  selector: 'app-rename-diagram-dialog',
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
  templateUrl: './rename-diagram-dialog.component.html',
  styleUrls: ['./rename-diagram-dialog.component.scss'],
})
export class RenameDiagramDialogComponent {
  diagramForm: FormGroup;
  diagramId: string;

  constructor(
    private dialogRef: MatDialogRef<RenameDiagramDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: RenameDiagramDialogData,
  ) {
    this.diagramId = data.id;
    this.diagramForm = this.fb.group({
      name: [data.name, [Validators.required, Validators.maxLength(100)]],
    });
  }

  /**
   * Close the dialog with the new diagram name
   */
  onSubmit(): void {
    if (this.diagramForm.invalid) {
      return;
    }

    const formValues = this.diagramForm.getRawValue() as DiagramFormValues;

    // Only close with the new name if it's different from the original
    if (formValues.name !== this.data.name) {
      this.dialogRef.close(formValues.name);
    } else {
      // If name hasn't changed, just close the dialog without returning a value
      this.dialogRef.close();
    }
  }

  /**
   * Close the dialog without renaming the diagram
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
