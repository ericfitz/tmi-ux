import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, take } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { WebhookSubscription } from '@app/types/webhook.types';
import { WebhookService } from '@app/core/services/webhook.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import { AddWebhookDialogComponent } from './add-webhook-dialog/add-webhook-dialog.component';
import { HmacSecretDialogComponent } from './hmac-secret-dialog/hmac-secret-dialog.component';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '@app/types/pagination.types';
import {
  calculateOffset,
  parsePaginationFromUrl,
  buildPaginationQueryParams,
  adjustPageAfterDeletion,
} from '@app/shared/utils/pagination.util';

/**
 * Webhooks Management Component
 *
 * Displays and manages webhook subscriptions.
 * Allows adding and removing webhooks for the authenticated user.
 */
@Component({
  selector: 'app-admin-webhooks',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './admin-webhooks.component.html',
  styleUrl: './admin-webhooks.component.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminWebhooksComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  webhooks: WebhookSubscription[] = [];
  filteredWebhooks: WebhookSubscription[] = [];
  totalWebhooks = 0;

  // Pagination state
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loading = false;

  constructor(
    private webhookService: WebhookService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    // Initialize pagination state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadWebhooks();
    });

    // Set up debounced filter changes
    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.pageIndex = 0;
        this.loadWebhooks();
        this.updateUrl();
      });
  }

  loadWebhooks(): void {
    this.loading = true;
    const offset = calculateOffset(this.pageIndex, this.pageSize);

    this.webhookService
      .list({ limit: this.pageSize, offset })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.webhooks = response.subscriptions;
          this.totalWebhooks = response.total;
          this.applyFilter();
          this.loading = false;
          this.logger.debug('Webhooks loaded', {
            count: response.subscriptions.length,
            total: response.total,
            page: this.pageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load webhooks', error);
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadWebhooks();
    this.updateUrl();
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      { pageIndex: this.pageIndex, pageSize: this.pageSize, total: this.totalWebhooks },
      this.filterText,
      DEFAULT_PAGE_SIZE,
    );

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  applyFilter(): void {
    const filter = this.filterText.toLowerCase().trim();
    if (!filter) {
      this.filteredWebhooks = [...this.webhooks];
      return;
    }

    this.filteredWebhooks = this.webhooks.filter(
      webhook =>
        webhook.name.toLowerCase().includes(filter) ||
        webhook.url.toLowerCase().includes(filter) ||
        webhook.status.toLowerCase().includes(filter),
    );
  }

  onAddWebhook(): void {
    const dialogRef = this.dialog.open(AddWebhookDialogComponent, {
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: WebhookSubscription | undefined) => {
        if (result) {
          this.loadWebhooks();
          // Show HMAC secret dialog if secret was returned
          if (result.secret) {
            this.showHmacSecretDialog(result.secret);
          }
        }
      });
  }

  private showHmacSecretDialog(secret: string): void {
    this.dialog.open(HmacSecretDialogComponent, {
      width: '600px',
      disableClose: true,
      data: { secret },
    });
  }

  onDeleteWebhook(webhook: WebhookSubscription): void {
    const confirmed = confirm(`Are you sure you want to delete the webhook "${webhook.name}"?`);

    if (confirmed) {
      this.webhookService
        .delete(webhook.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Webhook deleted', { id: webhook.id });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.webhooks.length - 1;
            const newTotal = this.totalWebhooks - 1;
            this.pageIndex = adjustPageAfterDeletion(
              this.pageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadWebhooks();
            this.updateUrl();
          },
          error: error => {
            this.logger.error('Failed to delete webhook', error);
          },
        });
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'active':
        return 'check';
      case 'pending_verification':
        return 'pending_actions';
      case 'pending_delete':
        return 'auto_delete';
      default:
        return 'help';
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'active':
        return 'success';
      case 'pending_verification':
        return 'warn';
      case 'pending_delete':
        return 'error';
      default:
        return '';
    }
  }

  getEventsTooltip(events: string[]): string {
    return events.join('\n');
  }

  openWebhookUrl(url: string): void {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate([this.authService.getLandingPage()]);
    }
  }
}
