/**
 * Custom MatPaginatorIntl implementation with Transloco i18n support.
 * Provides localized labels for the Angular Material paginator component.
 */

import { Injectable, OnDestroy } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Injectable()
export class PaginatorIntlService extends MatPaginatorIntl implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(private transloco: TranslocoService) {
    super();
    this.initTranslations();
    this.subscribeToLangChanges();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initTranslations(): void {
    this.updateLabels();
  }

  private subscribeToLangChanges(): void {
    this.transloco.langChanges$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateLabels();
      this.changes.next();
    });
  }

  private updateLabels(): void {
    this.itemsPerPageLabel = this.transloco.translate('pagination.itemsPerPage');
    this.nextPageLabel = this.transloco.translate('pagination.nextPage');
    this.previousPageLabel = this.transloco.translate('pagination.previousPage');
    this.firstPageLabel = this.transloco.translate('pagination.firstPage');
    this.lastPageLabel = this.transloco.translate('pagination.lastPage');
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return this.transloco.translate('pagination.rangeEmpty', { length });
    }

    const startIndex = page * pageSize;
    const endIndex = Math.min(startIndex + pageSize, length);

    return this.transloco.translate('pagination.rangeLabel', {
      startIndex: startIndex + 1,
      endIndex,
      length,
    });
  };
}
