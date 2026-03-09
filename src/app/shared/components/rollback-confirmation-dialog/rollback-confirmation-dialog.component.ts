import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../imports';
import {
  AUDIT_OBJECT_TYPE_TRANSLATION_KEY,
  ROLLBACK_TYPES_REQUIRING_CONFIRMATION,
  RollbackConfirmationDialogData,
  RollbackConfirmationDialogResult,
} from './rollback-confirmation-dialog.types';

export type {
  RollbackConfirmationDialogData,
  RollbackConfirmationDialogResult,
} from './rollback-confirmation-dialog.types';

@Component({
  selector: 'app-rollback-confirmation-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './rollback-confirmation-dialog.component.html',
  styleUrls: ['./rollback-confirmation-dialog.component.scss'],
})
export class RollbackConfirmationDialogComponent {
  confirmationInput = '';

  constructor(
    private _dialogRef: MatDialogRef<
      RollbackConfirmationDialogComponent,
      RollbackConfirmationDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public data: RollbackConfirmationDialogData,
    private transloco: TranslocoService,
  ) {}

  get objectTypeTranslationKey(): string {
    return AUDIT_OBJECT_TYPE_TRANSLATION_KEY[this.data.objectType];
  }

  get requiresTypedConfirmation(): boolean {
    return ROLLBACK_TYPES_REQUIRING_CONFIRMATION.includes(this.data.objectType);
  }

  get confirmationValue(): string {
    return this.transloco.translate('auditTrail.rollback.confirmationValue');
  }

  get isConfirmationValid(): boolean {
    return this.confirmationInput.toLowerCase().trim() === this.confirmationValue.toLowerCase();
  }

  get canRollback(): boolean {
    if (!this.requiresTypedConfirmation) {
      return true;
    }
    return this.isConfirmationValid;
  }

  onCancel(): void {
    this._dialogRef.close({ confirmed: false });
  }

  onConfirmRollback(): void {
    if (this.canRollback) {
      this._dialogRef.close({ confirmed: true });
    }
  }
}
