import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

/**
 * Interface for diagram form values
 */
interface DiagramFormValues {
  name: string;
  type: string;
}

/**
 * Interface for dialog data
 */
export interface CreateDiagramDialogData {
  threatModelName: string;
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
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoModule,
  ],
  templateUrl: './create-diagram-dialog.component.html',
  styleUrls: ['./create-diagram-dialog.component.scss'],
})
export class CreateDiagramDialogComponent {
  diagramForm: FormGroup;

  // Available diagram types (initially only DFD-1.0.0)
  readonly diagramTypes = [{ value: 'DFD-1.0.0', label: 'DFD-1.0.0' }];

  constructor(
    private dialogRef: MatDialogRef<CreateDiagramDialogComponent>,
    private fb: FormBuilder,
    private translocoService: TranslocoService,
    @Inject(MAT_DIALOG_DATA) public data: CreateDiagramDialogData,
  ) {
    // Get the localized 'Data Flow Diagram' string
    const dfdLabel = this.translocoService.translate('threatModels.dataFlowDiagram');
    // Create default name: "Threat Model Name — Data Flow Diagram"
    const defaultName = `${this.data.threatModelName} — ${dfdLabel}`;
    
    this.diagramForm = this.fb.group({
      type: [{ value: 'DFD-1.0.0', disabled: true }, [Validators.required]],
      name: [defaultName, [Validators.required, Validators.maxLength(100)]],
    });
  }

  /**
   * Close the dialog with the diagram data
   */
  onSubmit(): void {
    if (this.diagramForm.invalid) {
      return;
    }

    const formValues = this.diagramForm.getRawValue() as DiagramFormValues;
    this.dialogRef.close({
      name: formValues.name,
      type: formValues.type,
    });
  }

  /**
   * Close the dialog without creating a diagram
   */
  onCancel(): void {
    this.dialogRef.close();
  }
}
