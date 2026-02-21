import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../imports';
import { ConfirmActionDialogData, ConfirmActionDialogResult } from './confirm-action-dialog.types';

// Re-export types for consumers importing from the component file
export type {
  ConfirmActionDialogData,
  ConfirmActionDialogResult,
} from './confirm-action-dialog.types';

/**
 * Reusable confirm action dialog component.
 *
 * Provides a simple confirmation dialog with a title, message,
 * and cancel/confirm buttons. All strings are translation keys.
 *
 * Usage:
 * ```typescript
 * const dialogRef = this.dialog.open(ConfirmActionDialogComponent, {
 *   width: '450px',
 *   data: {
 *     title: 'editor.deleteMetadataWarning.title',
 *     message: 'editor.deleteMetadataWarning.message',
 *     confirmLabel: 'editor.deleteMetadataWarning.confirm',
 *     confirmIsDestructive: true,
 *   },
 *   disableClose: true,
 * });
 *
 * dialogRef.afterClosed().subscribe(result => {
 *   if (result?.confirmed) {
 *     // Proceed with action
 *   }
 * });
 * ```
 */
@Component({
  selector: 'app-confirm-action-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './confirm-action-dialog.component.html',
  styleUrls: ['./confirm-action-dialog.component.scss'],
})
export class ConfirmActionDialogComponent {
  constructor(
    private _dialogRef: MatDialogRef<ConfirmActionDialogComponent, ConfirmActionDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmActionDialogData,
  ) {}

  /** Get the icon to display (defaults to 'warning'). */
  get icon(): string {
    return this.data.icon || 'warning';
  }

  /** Get the confirm button label translation key. */
  get confirmLabel(): string {
    return this.data.confirmLabel || 'common.confirm';
  }

  /** Get the cancel button label translation key. */
  get cancelLabel(): string {
    return this.data.cancelLabel || 'common.cancel';
  }

  /** Whether the confirm button should use warn color. */
  get isDestructive(): boolean {
    return this.data.confirmIsDestructive !== false;
  }

  /** Handle cancel action. */
  onCancel(): void {
    this._dialogRef.close({ confirmed: false });
  }

  /** Handle confirm action. */
  onConfirm(): void {
    this._dialogRef.close({ confirmed: true });
  }
}
