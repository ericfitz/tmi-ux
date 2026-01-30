import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../imports';
import {
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
  OBJECT_TYPE_ICON,
  OBJECT_TYPE_TRANSLATION_KEY,
  REFERENCE_ONLY_TYPES,
  TYPES_REQUIRING_CONFIRMATION,
} from './delete-confirmation-dialog.types';

// Re-export types for consumers importing from the component file
export type {
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from './delete-confirmation-dialog.types';

/**
 * Reusable delete confirmation dialog component.
 *
 * Provides configurable confirmation for deleting various object types
 * with optional typed confirmation requirement.
 *
 * Usage:
 * ```typescript
 * const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
 *   width: '500px',
 *   data: {
 *     id: 'abc-123',
 *     name: 'My Threat Model',
 *     objectType: 'threatModel',
 *   },
 *   disableClose: true,
 * });
 *
 * dialogRef.afterClosed().subscribe(result => {
 *   if (result?.confirmed) {
 *     // Proceed with deletion
 *   }
 * });
 * ```
 */
@Component({
  selector: 'app-delete-confirmation-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './delete-confirmation-dialog.component.html',
  styleUrls: ['./delete-confirmation-dialog.component.scss'],
})
export class DeleteConfirmationDialogComponent {
  /** User's typed confirmation input */
  confirmationInput = '';

  /** The required confirmation value (from i18n) */
  readonly confirmationValue = 'gone forever';

  constructor(
    private _dialogRef: MatDialogRef<
      DeleteConfirmationDialogComponent,
      DeleteConfirmationDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public data: DeleteConfirmationDialogData,
  ) {}

  /**
   * Get the Material icon for the current object type.
   */
  get objectTypeIcon(): string {
    return OBJECT_TYPE_ICON[this.data.objectType];
  }

  /**
   * Get the translation key for the object type name.
   */
  get objectTypeTranslationKey(): string {
    return OBJECT_TYPE_TRANSLATION_KEY[this.data.objectType];
  }

  /**
   * Determine if typed confirmation is required based on object type and config.
   */
  get requiresTypedConfirmation(): boolean {
    if (this.data.requireTypedConfirmation !== undefined) {
      return this.data.requireTypedConfirmation;
    }
    return TYPES_REQUIRING_CONFIRMATION.includes(this.data.objectType);
  }

  /**
   * Determine if sub-entities warning should be shown.
   * Only applicable for threat models.
   */
  get showSubEntitiesWarning(): boolean {
    if (this.data.objectType !== 'threatModel') {
      return false;
    }
    return this.data.showSubEntitiesWarning !== false;
  }

  /**
   * Determine if reference-only warning should be shown.
   * Only applicable for documents and repositories.
   */
  get showReferenceOnlyWarning(): boolean {
    if (!REFERENCE_ONLY_TYPES.includes(this.data.objectType)) {
      return false;
    }
    return this.data.showReferenceOnlyWarning !== false;
  }

  /**
   * Check if the confirmation input matches the required value.
   * Comparison is case-insensitive and trimmed.
   */
  get isConfirmationValid(): boolean {
    return this.confirmationInput.toLowerCase().trim() === this.confirmationValue.toLowerCase();
  }

  /**
   * Determine if the delete button should be enabled.
   */
  get canDelete(): boolean {
    if (!this.requiresTypedConfirmation) {
      return true;
    }
    return this.isConfirmationValid;
  }

  /**
   * Handle cancel action.
   */
  onCancel(): void {
    this._dialogRef.close({ confirmed: false });
  }

  /**
   * Handle delete confirmation action.
   */
  onConfirmDelete(): void {
    if (this.canDelete) {
      this._dialogRef.close({ confirmed: true });
    }
  }
}
