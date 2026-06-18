import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { TranslocoModule } from '@jsverse/transloco';

/**
 * Confirms the user wants to leave the page for a fresh IdP sign-in
 * (strong step-up path). Closes with true (re-authenticate) or undefined.
 */
@Component({
  selector: 'app-step-up-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, A11yModule, TranslocoModule],
  templateUrl: './step-up-confirm-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@f0cbf56cdd766324ff656d4dcae789fc6db4c69d: dialog that confirms user intent to re-authenticate via IdP for step-up
export class StepUpConfirmDialogComponent {}
