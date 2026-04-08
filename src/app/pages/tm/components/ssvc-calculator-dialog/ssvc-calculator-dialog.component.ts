import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { SSVCScore } from '../../models/threat-model.model';
import {
  SsvcCalculatorDialogData,
  SsvcCalculatorDialogResult,
} from './ssvc-calculator-dialog.types';
import {
  SsvcDecision,
  SsvcDecisionPoint,
  SsvcExploitation,
  SsvcPublicSafetyImpact,
  SsvcTechnicalImpact,
  SsvcUtility,
  SSVC_DECISION_POINTS,
  buildSsvcVector,
  getSupplierDecision,
  parseSsvcVector,
} from './ssvc-decision-tree';

@Component({
  selector: 'app-ssvc-calculator-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './ssvc-calculator-dialog.component.html',
  styleUrl: './ssvc-calculator-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SsvcCalculatorDialogComponent implements OnInit {
  /** All decision points for template rendering */
  decisionPoints: SsvcDecisionPoint[] = SSVC_DECISION_POINTS;

  /** Selected values per step index (null = not yet selected) */
  selections: (string | null)[] = [null, null, null, null];

  /** Current step index (0-3 for decision points, 4 for summary) */
  currentStep = 0;

  /** Computed decision outcome */
  decision: SsvcDecision | null = null;

  /** Decision CSS class for color coding */
  decisionClass = '';

  /** Whether the dialog was opened in edit mode */
  isEditMode = false;

  /** Current text direction */
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  /** Total number of decision point steps (not counting summary) */
  readonly totalSteps = SSVC_DECISION_POINTS.length;

  constructor(
    public dialogRef: MatDialogRef<SsvcCalculatorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: SsvcCalculatorDialogData,
    private _cdr: ChangeDetectorRef,
    private _logger: LoggerService,
    private _languageService: LanguageService,
    private _destroyRef: DestroyRef,
  ) {}

  ngOnInit(): void {
    // Watch for text direction changes
    this._languageService.direction$.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(dir => {
      this.currentDirection = dir;
      this._cdr.markForCheck();
    });

    // Initialize from existing entry if editing
    if (this.data?.existingEntry) {
      this._initializeFromEntry(this.data.existingEntry);
    }
  }

  /** Whether the current step has a selection */
  get isCurrentStepComplete(): boolean {
    return this.currentStep < this.totalSteps && this.selections[this.currentStep] !== null;
  }

  /** Whether all decision points have been selected */
  get isAllComplete(): boolean {
    return this.selections.every(s => s !== null);
  }

  /** Handle value selection on the current step */
  onValueSelect(shortName: string): void {
    const previousValue = this.selections[this.currentStep];
    this.selections[this.currentStep] = shortName;

    // If the value changed, invalidate all downstream steps
    if (previousValue !== null && previousValue !== shortName) {
      for (let i = this.currentStep + 1; i < this.totalSteps; i++) {
        this.selections[i] = null;
      }
    }

    this._recalculate();
  }

  /** Advance to the next step */
  next(): void {
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
    }
  }

  /** Go back to the previous step */
  back(): void {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
  }

  /** Navigate directly to a specific step (only if that step or earlier steps are complete) */
  goToStep(index: number): void {
    // Allow navigating to any step up to and including the first incomplete step
    if (index <= this._firstIncompleteStep()) {
      this.currentStep = index;
    }
  }

  /** Apply the result and close the dialog */
  apply(): void {
    if (!this.isAllComplete || !this.decision) return;

    const vector = buildSsvcVector(
      this.selections[0] as SsvcExploitation,
      this.selections[1] as SsvcUtility,
      this.selections[2] as SsvcTechnicalImpact,
      this.selections[3] as SsvcPublicSafetyImpact,
    );

    const result: SsvcCalculatorDialogResult = {
      entry: {
        vector,
        decision: this.decision,
        methodology: 'Supplier',
      },
    };

    this.dialogRef.close(result);
  }

  /** Close the dialog without saving */
  cancel(): void {
    this.dialogRef.close();
  }

  /** Find the index of the first step without a selection (public for template access) */
  _firstIncompleteStep(): number {
    const idx = this.selections.findIndex(s => s === null);
    return idx === -1 ? this.totalSteps : idx;
  }

  /** Recalculate decision from current selections */
  private _recalculate(): void {
    if (this.isAllComplete) {
      this.decision = getSupplierDecision(
        this.selections[0] as SsvcExploitation,
        this.selections[1] as SsvcUtility,
        this.selections[2] as SsvcTechnicalImpact,
        this.selections[3] as SsvcPublicSafetyImpact,
      );
    } else {
      this.decision = null;
    }
    this._updateDecisionClass();
    this._cdr.markForCheck();
  }

  /** Map decision to CSS class for color coding */
  private _updateDecisionClass(): void {
    switch (this.decision) {
      case 'Defer':
        this.decisionClass = 'decision-defer';
        break;
      case 'Scheduled':
        this.decisionClass = 'decision-scheduled';
        break;
      case 'Out-of-Cycle':
        this.decisionClass = 'decision-out-of-cycle';
        break;
      case 'Immediate':
        this.decisionClass = 'decision-immediate';
        break;
      default:
        this.decisionClass = '';
    }
  }

  /** Initialize selections from an existing SSVC entry */
  private _initializeFromEntry(entry: SSVCScore): void {
    const parsed = parseSsvcVector(entry.vector);
    if (!parsed) {
      this._logger.error(
        'SsvcCalculatorDialog',
        'Could not parse existing SSVC vector',
        entry.vector,
      );
      return;
    }

    this.isEditMode = true;
    this.selections = [
      parsed.exploitation,
      parsed.utility,
      parsed.technicalImpact,
      parsed.publicSafetyImpact,
    ];
    // Show the summary step in edit mode
    this.currentStep = this.totalSteps;
    this._recalculate();
  }
}
