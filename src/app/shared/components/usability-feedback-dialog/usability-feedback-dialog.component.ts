import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../imports';
import { LoggerService } from '../../../core/services/logger.service';
import {
  UsabilityFeedbackSentiment,
  UsabilityFeedbackService,
} from '../../../core/services/usability-feedback.service';

const VERBATIM_MAX = 2048;

export interface UsabilityFeedbackDialogData {
  /**
   * Surface identifier. Must match the server's pattern
   * `^[a-z][a-z0-9_.-]{0,31}$`.
   */
  surface: string;
  /** Pre-selected sentiment, if any. Otherwise the user picks. */
  initialSentiment?: UsabilityFeedbackSentiment;
  /**
   * Optional pre-captured screenshot (data URL, image/jpeg or image/png).
   * The caller is expected to capture before opening the dialog so the
   * capture excludes the dialog overlay itself. Showing the thumbnail in
   * the dialog lets the user inspect and remove it before submission.
   */
  screenshot?: string;
}

export interface UsabilityFeedbackDialogResult {
  submitted: boolean;
}

/**
 * Small dialog that captures a thumbs-up / thumbs-down plus an optional
 * verbatim comment and submits it to /usability_feedback via the
 * UsabilityFeedbackService. Designed to be opened from any surface that
 * wants to solicit usability sentiment.
 */
@Component({
  selector: 'app-usability-feedback-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ReactiveFormsModule, TranslocoModule],
  templateUrl: './usability-feedback-dialog.component.html',
  styleUrls: ['./usability-feedback-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsabilityFeedbackDialogComponent {
  readonly form: FormGroup;
  readonly maxVerbatim = VERBATIM_MAX;
  submitting = false;
  screenshot: string | null;

  constructor(
    private readonly _dialogRef: MatDialogRef<
      UsabilityFeedbackDialogComponent,
      UsabilityFeedbackDialogResult
    >,
    @Inject(MAT_DIALOG_DATA) public readonly data: UsabilityFeedbackDialogData,
    fb: FormBuilder,
    private readonly _feedback: UsabilityFeedbackService,
    private readonly _snack: MatSnackBar,
    private readonly _transloco: TranslocoService,
    private readonly _logger: LoggerService,
    private readonly _cdr: ChangeDetectorRef,
  ) {
    this.screenshot = data.screenshot ?? null;
    this.form = fb.group({
      sentiment: [data.initialSentiment ?? null, Validators.required],
      verbatim: ['', [Validators.maxLength(VERBATIM_MAX)]],
    });
  }

  setSentiment(sentiment: UsabilityFeedbackSentiment): void {
    this.form.get('sentiment')!.setValue(sentiment);
  }

  get sentiment(): UsabilityFeedbackSentiment | null {
    return this.form.get('sentiment')!.value;
  }

  removeScreenshot(): void {
    this.screenshot = null;
    this._cdr.markForCheck();
  }

  onCancel(): void {
    this._dialogRef.close({ submitted: false });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    const { sentiment, verbatim } = this.form.value as {
      sentiment: UsabilityFeedbackSentiment;
      verbatim: string;
    };

    this.submitting = true;
    this._feedback
      .submit({
        sentiment,
        surface: this.data.surface,
        verbatim,
        screenshot: this.screenshot ?? undefined,
      })
      .subscribe({
        next: () => {
          this._snack.open(
            this._transloco.translate('usabilityFeedback.snackbarSubmitted'),
            undefined,
            { duration: 4000 },
          );
          this._dialogRef.close({ submitted: true });
        },
        error: err => {
          this._logger.error('Usability feedback submit failed', err);
          this.submitting = false;
          this._snack.open(
            this._transloco.translate('usabilityFeedback.snackbarFailed'),
            undefined,
            { duration: 6000 },
          );
        },
      });
  }
}
