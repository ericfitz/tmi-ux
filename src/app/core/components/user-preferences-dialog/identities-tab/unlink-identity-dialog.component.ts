import { Component, Inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

export interface UnlinkIdentityDialogData {
  /** Display label of the identity being unlinked (email or provider/sub). */
  identityLabel: string;
}

@Component({
  selector: 'app-unlink-identity-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslocoModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>
      {{ 'identities.unlink.confirmTitle' | transloco: { identity: data.identityLabel } }}
    </h2>
    <mat-dialog-content>
      <p [transloco]="'identities.unlink.confirmBody'">
        That identity will no longer be able to sign in to this account.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        cdkFocusInitial
        (click)="ref.close(false)"
        [transloco]="'common.cancel'"
        data-testid="unlink-identity-cancel"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="ref.close(true)"
        [transloco]="'identities.unlink.action'"
        data-testid="unlink-identity-confirm"
      >
        Unlink
      </button>
    </mat-dialog-actions>
  `,
})
// SEM@8436b9549fdd78cb2c4df17aef56eb7433de330e: confirm dialog for unlinking a linked OAuth identity from the account
export class UnlinkIdentityDialogComponent {
  // SEM@8436b9549fdd78cb2c4df17aef56eb7433de330e: inject dialog ref and identity label data for the unlink confirm dialog (pure)
  constructor(
    public ref: MatDialogRef<UnlinkIdentityDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: UnlinkIdentityDialogData,
  ) {}
}
