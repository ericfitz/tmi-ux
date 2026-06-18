import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

export interface UnlinkConfirmDialogData {
  sourceName: string;
}

@Component({
  selector: 'app-unlink-confirm-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, TranslocoModule],
  template: `
    <h2 mat-dialog-title>
      {{ 'documentSources.tabConfirmUnlink.title' | transloco: { source: data.sourceName } }}
    </h2>
    <mat-dialog-content>
      <p [transloco]="'documentSources.tabConfirmUnlink.body'">Unlinking will remove access...</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        cdkFocusInitial
        (click)="ref.close(false)"
        [transloco]="'common.cancel'"
        data-testid="unlink-cancel-button"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="warn"
        (click)="ref.close(true)"
        [transloco]="'documentSources.unlink'"
        data-testid="unlink-confirm-button"
      >
        Unlink
      </button>
    </mat-dialog-actions>
  `,
})
// SEM@9d9282a4131a5afdbcd3cfd14a6ca1992e4b8a24: confirm dialog that asks user to confirm unlinking a content provider account
export class UnlinkConfirmDialogComponent {
  // SEM@9d9282a4131a5afdbcd3cfd14a6ca1992e4b8a24: initialize unlink-confirm dialog with its dialog ref and provider name data (pure)
  constructor(
    public ref: MatDialogRef<UnlinkConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: UnlinkConfirmDialogData,
  ) {}
}
