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
export class HelpDialogComponent {
  constructor(private _dialogRef: MatDialogRef<HelpDialogComponent>) {}

  /**
   * Close the dialog
   */
  onClose(): void {
    this._dialogRef.close();
  }
}
