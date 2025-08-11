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
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    TranslocoModule,
  ],
  templateUrl: './validation-error-dialog.component.html',
  styleUrls: ['./validation-error-dialog.component.scss'],
})
export class ValidationErrorDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<ValidationErrorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ValidationErrorData,
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  getErrorAtText(): string {
    const description = this.data.errorDescription || '';
    const errorAtIndex = description.indexOf('Error at');
    return errorAtIndex >= 0 ? description.substring(errorAtIndex) : description;
  }
}