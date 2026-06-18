/**
 * Help Dialog Component
 *
 * This component provides a help dialog for the DFD editor that demonstrates
 * pan and zoom interactions using CSS animations.
 *
 * Key functionality:
 * - Displays animated demonstrations of pan and zoom gestures
 * - Shows localized instructions for each interaction
 * - Follows standard dialog pattern with title, content, and actions
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Dialog component for displaying DFD editor help with animated demonstrations
 */
@Component({
  selector: 'app-help-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule, TranslocoModule],
  templateUrl: './help-dialog.component.html',
  styleUrls: ['./help-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@6d984cf45eb9ae42a5507b92d4440679f24902af: display animated pan and zoom gesture instructions for the DFD editor
export class HelpDialogComponent {
  // SEM@6d984cf45eb9ae42a5507b92d4440679f24902af: inject dialog ref for the help dialog (pure)
  constructor(private _dialogRef: MatDialogRef<HelpDialogComponent>) {}

  /**
   * Close the dialog
   */
  // SEM@6d984cf45eb9ae42a5507b92d4440679f24902af: close the help dialog
  onClose(): void {
    this._dialogRef.close();
  }
}
