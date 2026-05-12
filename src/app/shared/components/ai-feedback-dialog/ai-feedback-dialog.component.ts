import { ChangeDetectionStrategy, Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import { DIALOG_IMPORTS } from '../../imports';
import { LoggerService } from '../../../core/services/logger.service';
import {
  AiArtifactFeedbackService,
  ArtifactFeedbackSentiment,
  ArtifactFeedbackTargetType,
  FALSE_POSITIVE_TAXONOMY,
  FalsePositiveReason,
  FalsePositiveSubreason,
} from '../../../core/services/ai-artifact-feedback.service';

const VERBATIM_MAX = 2048;

export interface AiFeedbackDialogData {
  threatModelId: string;
  targetType: ArtifactFeedbackTargetType;
  targetId: string;
  /** Required when targetType === 'threat_classification'. */
  targetField?: string;
  /** Pre-selected sentiment, if any. */
  initialSentiment?: ArtifactFeedbackSentiment;
}

export interface AiFeedbackDialogResult {
  submitted: boolean;
}

const FALSE_POSITIVE_REASONS = Object.keys(FALSE_POSITIVE_TAXONOMY) as FalsePositiveReason[];

@Component({
  selector: 'app-ai-feedback-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ReactiveFormsModule, TranslocoModule],
  templateUrl: './ai-feedback-dialog.component.html',
  styleUrls: ['./ai-feedback-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiFeedbackDialogComponent implements OnInit {
  readonly form: FormGroup;
  readonly maxVerbatim = VERBATIM_MAX;
  readonly reasons = FALSE_POSITIVE_REASONS;
  submitting = false;

  constructor(
    private readonly _dialogRef: MatDialogRef<AiFeedbackDialogComponent, AiFeedbackDialogResult>,
    @Inject(MAT_DIALOG_DATA) public readonly data: AiFeedbackDialogData,
    fb: FormBuilder,
    private readonly _feedback: AiArtifactFeedbackService,
    private readonly _snack: MatSnackBar,
    private readonly _transloco: TranslocoService,
    private readonly _logger: LoggerService,
  ) {
    this.form = fb.group({
      sentiment: [data.initialSentiment ?? null, Validators.required],
      verbatim: ['', [Validators.maxLength(VERBATIM_MAX)]],
      falsePositiveReason: [null as FalsePositiveReason | null],
      falsePositiveSubreason: [null as FalsePositiveSubreason | null],
    });
  }

  ngOnInit(): void {
    this.form.valueChanges.subscribe(() => this._applyDynamicValidators());
    this._applyDynamicValidators();
  }

  /** True when the user is filing a false-positive on a threat. */
  get showFalsePositiveTaxonomy(): boolean {
    return this.form.get('sentiment')!.value === 'down' && this.data.targetType === 'threat';
  }

  get availableSubreasons(): FalsePositiveSubreason[] {
    const reason = this.form.get('falsePositiveReason')!.value as FalsePositiveReason | null;
    return reason ? FALSE_POSITIVE_TAXONOMY[reason].subreasons : [];
  }

  get verbatimRequired(): boolean {
    const reason = this.form.get('falsePositiveReason')!.value as FalsePositiveReason | null;
    return !!reason && FALSE_POSITIVE_TAXONOMY[reason].verbatimRequired;
  }

  setSentiment(sentiment: ArtifactFeedbackSentiment): void {
    this.form.get('sentiment')!.setValue(sentiment);
    if (sentiment === 'up') {
      this.form.get('falsePositiveReason')!.setValue(null);
      this.form.get('falsePositiveSubreason')!.setValue(null);
    }
  }

  onCancel(): void {
    this._dialogRef.close({ submitted: false });
  }

  onSubmit(): void {
    if (this.form.invalid || this.submitting) return;
    const v = this.form.value as {
      sentiment: ArtifactFeedbackSentiment;
      verbatim: string;
      falsePositiveReason: FalsePositiveReason | null;
      falsePositiveSubreason: FalsePositiveSubreason | null;
    };

    this.submitting = true;
    this._feedback
      .submit(this.data.threatModelId, {
        sentiment: v.sentiment,
        targetType: this.data.targetType,
        targetId: this.data.targetId,
        targetField: this.data.targetField,
        verbatim: v.verbatim,
        falsePositiveReason: v.falsePositiveReason ?? undefined,
        falsePositiveSubreason: v.falsePositiveSubreason ?? undefined,
      })
      .subscribe({
        next: () => {
          this._snack.open(this._transloco.translate('aiFeedback.snackbarSubmitted'), undefined, {
            duration: 4000,
          });
          this._dialogRef.close({ submitted: true });
        },
        error: err => {
          this._logger.error('AI feedback submit failed', err);
          this.submitting = false;
          this._snack.open(this._transloco.translate('aiFeedback.snackbarFailed'), undefined, {
            duration: 6000,
          });
        },
      });
  }

  private _applyDynamicValidators(): void {
    const verbatim = this.form.get('verbatim')!;
    const reason = this.form.get('falsePositiveReason')!;
    const subreason = this.form.get('falsePositiveSubreason')!;

    const validators = [Validators.maxLength(VERBATIM_MAX)];
    if (this.verbatimRequired) {
      validators.push(Validators.required);
    }
    verbatim.setValidators(validators);
    verbatim.updateValueAndValidity({ emitEvent: false });

    if (this.showFalsePositiveTaxonomy) {
      reason.setValidators([Validators.required]);
    } else {
      reason.clearValidators();
      if (reason.value !== null) reason.setValue(null, { emitEvent: false });
    }
    reason.updateValueAndValidity({ emitEvent: false });

    if (this.availableSubreasons.length > 0) {
      subreason.setValidators([Validators.required]);
    } else {
      subreason.clearValidators();
      if (subreason.value !== null) subreason.setValue(null, { emitEvent: false });
    }
    subreason.updateValueAndValidity({ emitEvent: false });
  }
}
