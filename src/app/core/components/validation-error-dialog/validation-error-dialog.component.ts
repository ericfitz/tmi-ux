import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { TranslocoModule } from '@jsverse/transloco';

export interface ValidationErrorData {
  error: string;
  errorDescription: string;
}

@Component({
  selector: 'app-validation-error-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, TranslocoModule],
  templateUrl: './validation-error-dialog.component.html',
  styleUrls: ['./validation-error-dialog.component.scss'],
})
// SEM@105f247a2ed33bcaaf1812a1fda2e3b366669528: display a validation error code and description; allows dismissal
export class ValidationErrorDialogComponent {
  // SEM@90328ae99f4ffe2514f68ce6de8b4efc887896d3: inject dialog ref and validation error data
  constructor(
    private dialogRef: MatDialogRef<ValidationErrorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ValidationErrorData,
  ) {}

  // SEM@90328ae99f4ffe2514f68ce6de8b4efc887896d3: close the validation error dialog
  onClose(): void {
    this.dialogRef.close();
  }

  // SEM@90328ae99f4ffe2514f68ce6de8b4efc887896d3: extract the 'Error at' substring from a validation error description (pure)
  getErrorAtText(): string {
    const description = this.data.errorDescription || '';
    const errorAtIndex = description.indexOf('Error at');
    return errorAtIndex >= 0 ? description.substring(errorAtIndex) : description;
  }
}
