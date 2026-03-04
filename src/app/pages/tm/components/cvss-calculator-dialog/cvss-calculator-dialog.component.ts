import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  Inject,
  OnInit,
  Optional,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { identity, MonoTypeOperatorFunction } from 'rxjs';
import { Cvss3P1, Cvss4P0 } from 'ae-cvss-calculator';
import type {
  ComponentCategory,
  VectorComponent,
  VectorComponentValue,
} from 'ae-cvss-calculator/dist/types/src/CvssVector';

import { DIALOG_IMPORTS, DATA_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import {
  CvssCalculatorDialogData,
  CvssCalculatorDialogResult,
  CvssVersion,
  MetricGroup,
  MetricDefinition,
} from './cvss-calculator-dialog.types';

/** Union of the CVSS vector instances we support */
type CvssInstance = Cvss3P1 | Cvss4P0;

@Component({
  selector: 'app-cvss-calculator-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, ...DATA_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './cvss-calculator-dialog.component.html',
  styleUrls: ['./cvss-calculator-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CvssCalculatorDialogComponent implements OnInit {
  selectedVersion: CvssVersion = '3.1';
  metricGroups: MetricGroup[] = [];
  vectorString = '';
  currentScore: number | null = null;
  severityClass = '';
  severityLabel = '';
  isEditMode = false;
  isValid = false;
  currentDirection: 'ltr' | 'rtl' = 'ltr';

  private _cvssInstance: CvssInstance | null = null;

  constructor(
    public dialogRef: MatDialogRef<CvssCalculatorDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CvssCalculatorDialogData,
    private _cdr: ChangeDetectorRef,
    private _logger: LoggerService,
    private _languageService: LanguageService,
    private _translocoService: TranslocoService,
    private _snackBar: MatSnackBar,
    @Optional() private _destroyRef?: DestroyRef,
  ) {}

  ngOnInit(): void {
    this._languageService.direction$.pipe(this._untilDestroyed()).subscribe(direction => {
      this.currentDirection = direction;
      this._cdr.markForCheck();
    });

    if (this.data.existingEntry) {
      this.isEditMode = true;
      this.selectedVersion = this._detectVersion(this.data.existingEntry.vector);
      this._initializeFromVector(this.data.existingEntry.vector);
    } else {
      this._initializeFresh();
    }
  }

  onVersionChange(version: CvssVersion): void {
    if (version === this.selectedVersion) return;
    this.selectedVersion = version;
    this._initializeFresh();
  }

  onMetricChange(metricShortName: string, valueShortName: string): void {
    if (!this._cvssInstance) return;
    this._cvssInstance.applyComponentString(metricShortName, valueShortName);
    this._updateSelectedValue(metricShortName, valueShortName);
    this._recalculate();
  }

  apply(): void {
    if (!this.isValid || this.currentScore === null) return;
    const result: CvssCalculatorDialogResult = {
      entry: {
        vector: this.vectorString,
        score: this.currentScore,
      },
      editIndex: this.data.existingIndex,
    };
    this.dialogRef.close(result);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  copyVector(): void {
    navigator.clipboard.writeText(this.vectorString).then(
      () => {
        this._snackBar.open(
          this._translocoService.translate('common.copiedToClipboard'),
          undefined,
          { duration: 2000 },
        );
      },
      err => this._logger.error('Failed to copy vector to clipboard', err),
    );
  }

  getGroupSummary(group: MetricGroup): string {
    const set = group.metrics.filter(m => m.selectedValue && m.selectedValue !== 'X').length;
    return this._translocoService.translate('cvssCalculator.metricsSet', {
      count: set,
      total: group.metrics.length,
    });
  }

  private _detectVersion(vector: string): CvssVersion {
    if (vector.startsWith('CVSS:4.0')) return '4.0';
    return '3.1';
  }

  private _initializeFresh(): void {
    this._cvssInstance = this.selectedVersion === '4.0' ? new Cvss4P0() : new Cvss3P1();
    this._buildMetricGroups();
    this._recalculate();
  }

  private _initializeFromVector(vector: string): void {
    try {
      this._cvssInstance =
        this.selectedVersion === '4.0' ? new Cvss4P0(vector) : new Cvss3P1(vector);
      this._buildMetricGroups();
      this._recalculate();
    } catch (e) {
      this._logger.error('Failed to parse CVSS vector', e);
      this._snackBar.open(
        this._translocoService.translate('cvssCalculator.parseError'),
        undefined,
        { duration: 3000 },
      );
      this._initializeFresh();
    }
  }

  private _buildMetricGroups(): void {
    if (!this._cvssInstance) return;
    const registered = this._cvssInstance.getRegisteredComponents();
    this.metricGroups = [];

    registered.forEach(
      (components: VectorComponent<VectorComponentValue>[], category: ComponentCategory) => {
        const isBase = category.name.toLowerCase().includes('base');
        const metrics: MetricDefinition[] = components.map(
          (comp: VectorComponent<VectorComponentValue>) => ({
            shortName: comp.shortName,
            name: comp.name,
            description: comp.description,
            subCategory: comp.subCategory,
            values: comp.values
              .filter((v: VectorComponentValue) => !v.hide)
              .map((v: VectorComponentValue) => ({
                shortName: v.shortName,
                name: v.name,
                description: v.description,
              })),
            selectedValue: this._getCurrentValue(comp.shortName),
          }),
        );

        this.metricGroups.push({
          categoryName: category.name,
          categoryDescription: category.description,
          metrics,
          isBase,
        });
      },
    );
  }

  private _getCurrentValue(metricShortName: string): string | null {
    if (!this._cvssInstance) return null;
    const value = this._cvssInstance.getComponentByStringOpt(metricShortName);
    return value?.shortName ?? null;
  }

  private _updateSelectedValue(metricShortName: string, valueShortName: string): void {
    for (const group of this.metricGroups) {
      for (const metric of group.metrics) {
        if (metric.shortName === metricShortName) {
          metric.selectedValue = valueShortName;
          return;
        }
      }
    }
  }

  private _recalculate(): void {
    if (!this._cvssInstance) return;

    try {
      const scores = this._cvssInstance.calculateScores();
      this.currentScore =
        scores.overall !== undefined && scores.overall >= 0 ? scores.overall : null;
      this.vectorString = this._cvssInstance.toString();
    } catch {
      this.currentScore = null;
      this.vectorString = '';
    }

    this._updateSeverity();
    this._updateValidity();
    this._cdr.markForCheck();
  }

  private _updateSeverity(): void {
    if (this.currentScore === null) {
      this.severityClass = 'severity-none';
      this.severityLabel = 'common.none';
      return;
    }
    const score = this.currentScore;
    if (score === 0) {
      this.severityClass = 'severity-none';
      this.severityLabel = 'common.none';
    } else if (score < 4.0) {
      this.severityClass = 'severity-low';
      this.severityLabel = 'threatEditor.threatSeverity.low';
    } else if (score < 7.0) {
      this.severityClass = 'severity-medium';
      this.severityLabel = 'threatEditor.threatSeverity.medium';
    } else if (score < 9.0) {
      this.severityClass = 'severity-high';
      this.severityLabel = 'threatEditor.threatSeverity.high';
    } else {
      this.severityClass = 'severity-critical';
      this.severityLabel = 'threatEditor.threatSeverity.critical';
    }
  }

  private _updateValidity(): void {
    if (!this._cvssInstance) {
      this.isValid = false;
      return;
    }
    this.isValid = this._cvssInstance.isBaseFullyDefined();
  }

  private _untilDestroyed<T>(): MonoTypeOperatorFunction<T> {
    return this._destroyRef ? takeUntilDestroyed<T>(this._destroyRef) : identity;
  }
}
