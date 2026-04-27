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
      <button mat-button (click)="ref.close(false)" [transloco]="'common.cancel'">Cancel</button>
      <button
        mat-raised-button
        color="warn"
        (click)="ref.close(true)"
        [transloco]="'documentSources.unlink'"
      >
        Unlink
      </button>
    </mat-dialog-actions>
  `,
})
export class UnlinkConfirmDialogComponent {
  constructor(
    public ref: MatDialogRef<UnlinkConfirmDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: UnlinkConfirmDialogData,
  ) {}
}
