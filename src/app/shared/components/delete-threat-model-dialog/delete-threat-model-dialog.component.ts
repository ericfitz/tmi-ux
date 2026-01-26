import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';
import { ScrollIndicatorDirective } from '../../directives/scroll-indicator.directive';

/**
 * Interface for the dialog data
 */
export interface DeleteThreatModelDialogData {
  id: string;
  name: string;
}

@Component({
  selector: 'app-delete-threat-model-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    TranslocoModule,
    ScrollIndicatorDirective,
  ],
  templateUrl: './delete-threat-model-dialog.component.html',
  styleUrls: ['./delete-threat-model-dialog.component.scss'],
})
export class DeleteThreatModelDialogComponent {
  constructor(
    private dialogRef: MatDialogRef<DeleteThreatModelDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeleteThreatModelDialogData,
  ) {}

  /**
   * Confirm deletion - closes dialog with true result
   */
  onConfirmDelete(): void {
    this.dialogRef.close(true);
  }

  /**
   * Cancel deletion - closes dialog with false result
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }
}
