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
export class RevisionNotesDialogComponent {
  /** Revision notes input */
  revisionNotes = '';

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
  onCancel(): void {
    this._dialogRef.close();
  }

  /**
   * Handle confirm action.
   */
  onConfirm(): void {
    if (this.canSubmit) {
      this._dialogRef.close({ notes: this.revisionNotes.trim() });
    }
  }
}
