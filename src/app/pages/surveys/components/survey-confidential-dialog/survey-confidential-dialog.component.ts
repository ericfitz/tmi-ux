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
      <button mat-button (click)="onNo()">
        <span [transloco]="'surveys.confidentialDialog.no'">No</span>
      </button>
      <button mat-raised-button color="primary" (click)="onYes()">
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
export class SurveyConfidentialDialogComponent {
  constructor(public dialogRef: MatDialogRef<SurveyConfidentialDialogComponent>) {}

  onYes(): void {
    this.dialogRef.close(true);
  }

  onNo(): void {
    this.dialogRef.close(false);
  }
}
