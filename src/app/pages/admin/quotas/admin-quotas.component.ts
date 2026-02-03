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
import { QuotaService } from '@app/core/services/quota.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import {
  EnrichedUserAPIQuota,
  EnrichedWebhookQuota,
  DEFAULT_USER_API_QUOTA,
  DEFAULT_WEBHOOK_QUOTA,
} from '@app/types/quota.types';
import { OAuthProviderInfo } from '@app/auth/models/auth.models';
import { AddQuotaDialogComponent } from './add-quota-dialog/add-quota-dialog.component';
import { ProviderDisplayComponent } from '@app/shared/components/provider-display/provider-display.component';
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

interface EditableUserAPIQuota extends EnrichedUserAPIQuota {
  editing: boolean;
  saving: boolean;
  editValues?: {
    max_requests_per_minute: number;
    max_requests_per_hour: number | null;
  };
}

interface EditableWebhookQuota extends EnrichedWebhookQuota {
  editing: boolean;
  saving: boolean;
  editValues?: {
    max_subscriptions: number;
    max_events_per_minute: number;
    max_subscription_requests_per_minute: number;
    max_subscription_requests_per_day: number;
  };
}

/**
 * Quotas Management Component
 *
 * Displays and manages user API quotas and webhook quotas.
 * Allows inline editing, adding new quotas, and removing custom quotas.
 */
@Component({
  selector: 'app-admin-quotas',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ProviderDisplayComponent,
  ],
  templateUrl: './admin-quotas.component.html',
  styleUrl: './admin-quotas.component.scss',
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
export class AdminQuotasComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private filterSubject$ = new Subject<string>();

  @ViewChild('userAPIPaginator') userAPIPaginator!: MatPaginator;
  @ViewChild('webhookPaginator') webhookPaginator!: MatPaginator;

  userAPIQuotas: EditableUserAPIQuota[] = [];
  webhookQuotas: EditableWebhookQuota[] = [];
  filteredUserAPIQuotas: EditableUserAPIQuota[] = [];
  filteredWebhookQuotas: EditableWebhookQuota[] = [];
  totalUserAPIQuotas = 0;
  totalWebhookQuotas = 0;
  availableProviders: OAuthProviderInfo[] = [];

  // User API Quota pagination state
  userAPIPageIndex = 0;
  userAPIPageSize = DEFAULT_PAGE_SIZE;

  // Webhook Quota pagination state
  webhookPageIndex = 0;
  webhookPageSize = DEFAULT_PAGE_SIZE;

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  filterText = '';
  loadingUserAPI = false;
  loadingWebhook = false;

  readonly defaultUserAPIQuota = DEFAULT_USER_API_QUOTA;
  readonly defaultWebhookQuota = DEFAULT_WEBHOOK_QUOTA;

  constructor(
    private quotaService: QuotaService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadProviders();

    // Initialize pagination state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.userAPIPageIndex = paginationState.pageIndex;
      this.userAPIPageSize = paginationState.pageSize;
      // Webhook quotas share the same page size but start at page 0
      this.webhookPageSize = paginationState.pageSize;
      this.filterText = (params[PAGINATION_QUERY_PARAMS.FILTER] as string | undefined) || '';
      this.loadAllQuotas();
    });

    // Set up debounced filter changes
    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(filterValue => {
        this.filterText = filterValue;
        this.userAPIPageIndex = 0;
        this.webhookPageIndex = 0;
        this.loadAllQuotas();
        this.updateUrl();
      });
  }

  loadProviders(): void {
    this.authService
      .getAvailableProviders()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: providers => {
          // Add hardcoded TMI provider at the beginning
          const tmiProvider: OAuthProviderInfo = {
            id: 'tmi',
            name: 'TMI',
            icon: 'TMI-Logo.svg',
            auth_url: '',
            redirect_uri: '',
            client_id: '',
          };
          this.availableProviders = [tmiProvider, ...providers];
          this.logger.debug('Providers loaded for quotas list', {
            count: this.availableProviders.length,
          });
        },
        error: error => {
          this.logger.error('Failed to load providers', error);
        },
      });
  }

  loadAllQuotas(): void {
    this.loadUserAPIQuotas();
    this.loadWebhookQuotas();
  }

  loadUserAPIQuotas(): void {
    this.loadingUserAPI = true;
    const offset = calculateOffset(this.userAPIPageIndex, this.userAPIPageSize);

    this.quotaService
      .listEnrichedUserAPIQuotas(this.userAPIPageSize, offset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.userAPIQuotas = response.quotas.map(quota => ({
            ...quota,
            editing: false,
            saving: false,
          }));
          this.totalUserAPIQuotas = response.total;
          this.applyFilter();
          this.loadingUserAPI = false;
          this.logger.info('User API quotas loaded', {
            count: response.quotas.length,
            total: response.total,
            page: this.userAPIPageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load user API quotas', error);
          this.loadingUserAPI = false;
        },
      });
  }

  loadWebhookQuotas(): void {
    this.loadingWebhook = true;
    const offset = calculateOffset(this.webhookPageIndex, this.webhookPageSize);

    this.quotaService
      .listEnrichedWebhookQuotas(this.webhookPageSize, offset)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.webhookQuotas = response.quotas.map(quota => ({
            ...quota,
            editing: false,
            saving: false,
          }));
          this.totalWebhookQuotas = response.total;
          this.applyFilter();
          this.loadingWebhook = false;
          this.logger.info('Webhook quotas loaded', {
            count: response.quotas.length,
            total: response.total,
            page: this.webhookPageIndex,
          });
        },
        error: error => {
          this.logger.error('Failed to load webhook quotas', error);
          this.loadingWebhook = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  onUserAPIPageChange(event: PageEvent): void {
    this.userAPIPageIndex = event.pageIndex;
    this.userAPIPageSize = event.pageSize;
    this.loadUserAPIQuotas();
    this.updateUrl();
  }

  onWebhookPageChange(event: PageEvent): void {
    this.webhookPageIndex = event.pageIndex;
    this.webhookPageSize = event.pageSize;
    this.loadWebhookQuotas();
  }

  private updateUrl(): void {
    const queryParams = buildPaginationQueryParams(
      {
        pageIndex: this.userAPIPageIndex,
        pageSize: this.userAPIPageSize,
        total: this.totalUserAPIQuotas,
      },
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
      this.filteredUserAPIQuotas = [...this.userAPIQuotas];
      this.filteredWebhookQuotas = [...this.webhookQuotas];
      return;
    }

    this.filteredUserAPIQuotas = this.userAPIQuotas.filter(
      quota =>
        quota.user_email.toLowerCase().includes(filter) ||
        quota.user_name?.toLowerCase().includes(filter) ||
        quota.provider.toLowerCase().includes(filter) ||
        quota.user_id.toLowerCase().includes(filter),
    );

    this.filteredWebhookQuotas = this.webhookQuotas.filter(
      quota =>
        quota.user_email.toLowerCase().includes(filter) ||
        quota.user_name?.toLowerCase().includes(filter) ||
        quota.provider.toLowerCase().includes(filter) ||
        quota.owner_id.toLowerCase().includes(filter),
    );
  }

  onAddQuota(): void {
    const dialogRef = this.dialog.open(AddQuotaDialogComponent, {
      width: '800px',
      maxWidth: '90vw',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(result => {
        if (result) {
          this.loadAllQuotas();
        }
      });
  }

  // User API Quota methods
  onEditUserAPIQuota(quota: EditableUserAPIQuota): void {
    quota.editing = true;
    quota.editValues = {
      max_requests_per_minute: quota.max_requests_per_minute,
      max_requests_per_hour: quota.max_requests_per_hour ?? null,
    };
  }

  onCancelEditUserAPIQuota(quota: EditableUserAPIQuota): void {
    quota.editing = false;
    quota.editValues = undefined;
  }

  onSaveUserAPIQuota(quota: EditableUserAPIQuota): void {
    if (!quota.editValues) return;

    quota.saving = true;
    this.quotaService
      .updateUserAPIQuota(quota.user_id, quota.editValues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          quota.max_requests_per_minute = updated.max_requests_per_minute;
          quota.max_requests_per_hour = updated.max_requests_per_hour ?? null;
          quota.modified_at = updated.modified_at;
          quota.editing = false;
          quota.editValues = undefined;
          quota.saving = false;
          this.logger.info('User API quota updated', { userId: quota.user_id });
        },
        error: error => {
          quota.saving = false;
          this.logger.error('Failed to update user API quota', error);
        },
      });
  }

  onDeleteUserAPIQuota(quota: EditableUserAPIQuota): void {
    const confirmed = confirm(
      `Are you sure you want to remove custom API quota for ${quota.user_email}? This will revert to system defaults.`,
    );

    if (confirmed) {
      this.quotaService
        .deleteUserAPIQuota(quota.user_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('User API quota deleted', { userId: quota.user_id });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.userAPIQuotas.length - 1;
            const newTotal = this.totalUserAPIQuotas - 1;
            this.userAPIPageIndex = adjustPageAfterDeletion(
              this.userAPIPageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadUserAPIQuotas();
            this.updateUrl();
          },
          error: error => {
            this.logger.error('Failed to delete user API quota', error);
          },
        });
    }
  }

  // Webhook Quota methods
  onEditWebhookQuota(quota: EditableWebhookQuota): void {
    quota.editing = true;
    quota.editValues = {
      max_subscriptions: quota.max_subscriptions,
      max_events_per_minute: quota.max_events_per_minute,
      max_subscription_requests_per_minute: quota.max_subscription_requests_per_minute,
      max_subscription_requests_per_day: quota.max_subscription_requests_per_day,
    };
  }

  onCancelEditWebhookQuota(quota: EditableWebhookQuota): void {
    quota.editing = false;
    quota.editValues = undefined;
  }

  onSaveWebhookQuota(quota: EditableWebhookQuota): void {
    if (!quota.editValues) return;

    quota.saving = true;
    this.quotaService
      .updateWebhookQuota(quota.owner_id, quota.editValues)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          quota.max_subscriptions = updated.max_subscriptions;
          quota.max_events_per_minute = updated.max_events_per_minute;
          quota.max_subscription_requests_per_minute = updated.max_subscription_requests_per_minute;
          quota.max_subscription_requests_per_day = updated.max_subscription_requests_per_day;
          quota.modified_at = updated.modified_at;
          quota.editing = false;
          quota.editValues = undefined;
          quota.saving = false;
          this.logger.info('Webhook quota updated', { userId: quota.owner_id });
        },
        error: error => {
          quota.saving = false;
          this.logger.error('Failed to update webhook quota', error);
        },
      });
  }

  onDeleteWebhookQuota(quota: EditableWebhookQuota): void {
    const confirmed = confirm(
      `Are you sure you want to remove custom webhook quota for ${quota.user_email}? This will revert to system defaults.`,
    );

    if (confirmed) {
      this.quotaService
        .deleteWebhookQuota(quota.owner_id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.logger.info('Webhook quota deleted', { userId: quota.owner_id });

            // Adjust page if we deleted the last item on the current page
            const itemsOnPageAfterDelete = this.webhookQuotas.length - 1;
            const newTotal = this.totalWebhookQuotas - 1;
            this.webhookPageIndex = adjustPageAfterDeletion(
              this.webhookPageIndex,
              itemsOnPageAfterDelete,
              newTotal,
            );

            this.loadWebhookQuotas();
          },
          error: error => {
            this.logger.error('Failed to delete webhook quota', error);
          },
        });
    }
  }

  getProviderInfo(providerId: string): OAuthProviderInfo | null {
    return this.availableProviders.find(p => p.id === providerId) || null;
  }

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }
}
