import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '@app/shared/imports';
import { RevisionNotesDialogResult } from './revision-notes-dialog.types';

// Re-export types for consumers importing from the component file
export type { RevisionNotesDialogResult } from './revision-notes-dialog.types';

/**
 * Dialog for collecting revision notes when returning a survey response for revision.
 *
 * Usage:
 * ```typescript
 * const dialogRef = this.dialog.open(RevisionNotesDialogComponent, {
 *   width: '500px',
 *   disableClose: true,
 * });
 *
 * dialogRef.afterClosed().subscribe(result => {
 *   if (result) {
 *     this.returnForRevision(result.notes);
 *   }
 * });
 * ```
 */
@Component({
  selector: 'app-revision-notes-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './revision-notes-dialog.component.html',
  styleUrls: ['./revision-notes-dialog.component.scss'],
})
// SEM@7bfe234f7ba9c41ac14cd1af5922df9366576f17: dialog for capturing reviewer revision notes before returning a survey response
export class RevisionNotesDialogComponent {
  /** Revision notes input */
  revisionNotes = '';

  // SEM@7bfe234f7ba9c41ac14cd1af5922df9366576f17: inject dialog reference for closing with revision notes result
  constructor(
    private _dialogRef: MatDialogRef<RevisionNotesDialogComponent, RevisionNotesDialogResult>,
  ) {}

  /**
   * Whether the form is valid for submission.
   */
  get canSubmit(): boolean {
    return this.revisionNotes.trim().length > 0;
  }

  /**
   * Handle cancel action.
   */
  // SEM@7bfe234f7ba9c41ac14cd1af5922df9366576f17: dismiss the revision notes dialog without returning a result
  onCancel(): void {
    this._dialogRef.close();
  }

  /**
   * Handle confirm action.
   */
  // SEM@7bfe234f7ba9c41ac14cd1af5922df9366576f17: close the dialog and return trimmed revision notes if input is valid
  onConfirm(): void {
    if (this.canSubmit) {
      this._dialogRef.close({ notes: this.revisionNotes.trim() });
    }
  }
}
