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
// SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: provide localized paginator labels for Angular Material with live language switching
export class PaginatorIntlService extends MatPaginatorIntl implements OnDestroy {
  private destroy$ = new Subject<void>();

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: initialize paginator labels and subscribe to locale changes (mutates shared state)
  constructor(private transloco: TranslocoService) {
    super();
    this.initTranslations();
    this.subscribeToLangChanges();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: complete the destroy subject to unsubscribe all active subscriptions (mutates shared state)
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: initialize paginator label translations on service construction (mutates shared state)
  private initTranslations(): void {
    this.updateLabels();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: subscribe to locale changes and refresh paginator labels on each change (mutates shared state)
  private subscribeToLangChanges(): void {
    this.transloco.langChanges$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateLabels();
      this.changes.next();
    });
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: translate and assign all paginator UI labels for the current locale (mutates shared state)
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
