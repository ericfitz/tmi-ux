import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Interface for diagram form values
 */
interface DiagramFormValues {
  name: string;
}

@Component({
  selector: 'app-create-diagram-dialog',
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
  templateUrl: './create-diagram-dialog.component.html',
  styleUrl: './create-diagram-dialog.component.scss',
})
export class CreateDiagramDialogComponent {
  diagramForm: FormGroup;

  constructor(
    private dialogRef: MatDialogRef<CreateDiagramDialogComponent>,
    private fb: FormBuilder,
  ) {
    this.diagramForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(100)]],
    });
  }

  /**
   * Close the dialog with the diagram name
   */
  onSubmit(): void {
    if (this.diagramForm.invalid) {
      return;
    }

    const formValues = this.diagramForm.getRawValue() as DiagramFormValues;
    this.dialogRef.close(formValues.name);
  }

  /**
   * Close the dialog without creating a diagram
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
