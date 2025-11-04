import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Interface for the dialog data
 */
export interface RenameDiagramDialogData {
  id: string;
  name: string;
  isReadOnly?: boolean;
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
    MatIconModule,
    MatTooltipModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './rename-diagram-dialog.component.html',
  styleUrls: ['./rename-diagram-dialog.component.scss'],
})
export class RenameDiagramDialogComponent {
  diagramForm: FormGroup;
  diagramId: string;
  isReadOnly: boolean;

  constructor(
    private dialogRef: MatDialogRef<RenameDiagramDialogComponent>,
    private fb: FormBuilder,
    @Inject(MAT_DIALOG_DATA) public data: RenameDiagramDialogData,
  ) {
    this.diagramId = data.id;
    this.isReadOnly = data.isReadOnly || false;

    this.diagramForm = this.fb.group({
      name: [data.name, [Validators.required, Validators.maxLength(100)]],
    });

    if (this.isReadOnly) {
      this.diagramForm.disable();
    }
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
