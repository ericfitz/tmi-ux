import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';

export interface StepUpMismatchDialogData {
  email: string;
}

/**
 * Shown when step-up re-authentication completed as a different identity
 * (400 identity_mismatch from /oauth2/token). Closes with true (try again)
 * or undefined (cancel). The original session remains valid.
 */
@Component({
  selector: 'app-step-up-mismatch-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, A11yModule, TranslocoModule],
  templateUrl: './step-up-mismatch-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StepUpMismatchDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public data: StepUpMismatchDialogData) {}
}
