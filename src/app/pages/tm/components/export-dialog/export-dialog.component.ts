import { Component, Inject, OnInit, OnDestroy } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { Subject, takeUntil } from 'rxjs';

import { DIALOG_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '../../../../core/services/logger.service';
import { ThreatModel } from '../../models/threat-model.model';
import { ExportDialogData, ExportDialogResult } from './export-dialog.types';

// Re-export types for consumers importing from the component file
export type { ExportDialogData, ExportDialogResult } from './export-dialog.types';

type ExportState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-export-dialog',
  standalone: true,
  imports: [...DIALOG_IMPORTS, TranslocoModule],
  templateUrl: './export-dialog.component.html',
  styleUrls: ['./export-dialog.component.scss'],
})
export class ExportDialogComponent implements OnInit, OnDestroy {
  state: ExportState = 'loading';

  private _blob: Blob | null = null;
  private _filename = '';
  private _destroy$ = new Subject<void>();

  constructor(
    private _dialogRef: MatDialogRef<ExportDialogComponent, ExportDialogResult>,
    @Inject(MAT_DIALOG_DATA) public data: ExportDialogData,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.fetchData();
  }

  ngOnDestroy(): void {
    this._destroy$.next();
    this._destroy$.complete();
  }

  /** Trigger the fetch (used on init and retry). */
  fetchData(): void {
    this.state = 'loading';
    this._blob = null;

    this.data.fetchObservable.pipe(takeUntil(this._destroy$)).subscribe({
      next: (threatModel: ThreatModel | undefined) => {
        if (!threatModel) {
          this.logger.error('Export fetch returned no data');
          this.state = 'error';
          return;
        }

        try {
          const filename = this.generateFilename(threatModel.name);
          const normalized = this.normalizeDates(threatModel);
          const jsonContent = JSON.stringify(normalized, null, 2);
          this._blob = new Blob([jsonContent], { type: 'application/json' });
          this._filename = filename;
          this.state = 'ready';
        } catch (error) {
          this.logger.error('Error preparing export blob', error);
          this.state = 'error';
        }
      },
      error: (error: unknown) => {
        this.logger.error('Export fetch failed', error);
        this.state = 'error';
      },
    });
  }

  /** User clicked Save — close with the prepared blob. */
  onSave(): void {
    if (this._blob) {
      this._dialogRef.close({ blob: this._blob, filename: this._filename });
    }
  }

  /** User clicked Cancel or Retry failed. */
  onCancel(): void {
    this._dialogRef.close(undefined);
  }

  /**
   * Generate filename: sanitized threat model name (max 63 chars) + "-threat-model.json"
   */
  private generateFilename(name: string): string {
    const sanitized = name
      .trim()
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const truncated = sanitized.length > 63 ? sanitized.substring(0, 63) : sanitized;
    return `${truncated}-threat-model.json`;
  }

  /**
   * Normalize date fields to ISO 8601 format for consistent export.
   */
  private normalizeDates(threatModel: ThreatModel): ThreatModel {
    const normalizeDate = (dateString: string): string => {
      if (!dateString) return new Date().toISOString();
      try {
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
      } catch {
        return new Date().toISOString();
      }
    };

    const normalizeSub = <T extends { created_at: string; modified_at: string }>(
      items: T[] | undefined,
    ): T[] | undefined =>
      items?.map(item => ({
        ...item,
        created_at: normalizeDate(item.created_at),
        modified_at: normalizeDate(item.modified_at),
      }));

    return {
      ...threatModel,
      created_at: normalizeDate(threatModel.created_at),
      modified_at: normalizeDate(threatModel.modified_at),
      diagrams: normalizeSub(threatModel.diagrams),
      threats: normalizeSub(threatModel.threats),
      notes: normalizeSub(threatModel.notes),
      assets: normalizeSub(threatModel.assets),
      documents: normalizeSub(threatModel.documents),
      repositories: normalizeSub(threatModel.repositories),
    };
  }
}
