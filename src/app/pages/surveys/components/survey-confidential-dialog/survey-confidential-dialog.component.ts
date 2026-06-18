import { Component } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';

@Component({
  selector: 'app-survey-confidential-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  template: `
    <h2 mat-dialog-title [transloco]="'surveys.confidentialDialog.title'">
      Confidential Submission
    </h2>

    <mat-dialog-content>
      <p [transloco]="'surveys.confidentialDialog.description'">
        Should this submission be marked as confidential? Confidential submissions are not
        automatically shared with the Security Reviewers group. This setting cannot be changed after
        the response is created.
      </p>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button cdkFocusInitial (click)="onNo()" data-testid="confidential-no-button">
        <span [transloco]="'surveys.confidentialDialog.no'">No</span>
      </button>
      <button
        mat-flat-button
        color="primary"
        (click)="onYes()"
        data-testid="confidential-yes-button"
      >
        <span [transloco]="'surveys.confidentialDialog.yes'">Yes, mark as confidential</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      mat-dialog-content p {
        line-height: 1.5;
        color: var(--theme-text-primary);
      }
    `,
  ],
})
// SEM@6b35da8ffade83ef6579f36d41c97823a2565785: dialog that prompts the user to mark a submission as confidential
export class SurveyConfidentialDialogComponent {
  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: inject the dialog reference for closing with a result (pure)
  constructor(public dialogRef: MatDialogRef<SurveyConfidentialDialogComponent>) {}

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: close the dialog signaling the user confirmed confidential marking (pure)
  onYes(): void {
    this.dialogRef.close(true);
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: close the dialog signaling the user declined confidential marking (pure)
  onNo(): void {
    this.dialogRef.close(false);
  }
}
