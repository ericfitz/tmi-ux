import { Component, DestroyRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
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
import { navigateFromAdminPage } from '../shared/admin-navigation.util';
import { HmacSecretDialogComponent } from './hmac-secret-dialog/hmac-secret-dialog.component';
import {
  CreateAutomationUserDialogComponent,
  CreateAutomationUserDialogData,
} from '../shared/create-automation-user-dialog/create-automation-user-dialog.component';
import {
  CredentialSecretDialogComponent,
  CredentialSecretDialogData,
} from '@app/core/components/user-preferences-dialog/credential-secret-dialog/credential-secret-dialog.component';
import { UserAdminService } from '@app/core/services/user-admin.service';
import { CreateAutomationAccountResponse } from '@app/types/user.types';
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
// SEM@913973c2390b7180140950023b498e5c44ca2678: page component for listing, filtering, and managing webhook subscriptions
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

  // SEM@16a12de16f46596ddb6d847a588d043dcdbea3f7: inject routing, dialog, and service dependencies for the webhooks admin page (pure)
  constructor(
    private webhookService: WebhookService,
    private router: Router,
    private route: ActivatedRoute,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
    private clipboard: Clipboard,
    private userAdminService: UserAdminService,
  ) {}

  // SEM@bfb60b51b1f44fb69eb7f7fbac7656849e9750be: initialize pagination state from URL params and subscribe to filter changes (mutates shared state)
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

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: fetch paginated webhook subscriptions from the API and apply the current filter (reads DB)
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

  // SEM@36c98b471f199ad07ab7f890bf1fd25427d95e56: dispatch a filter text change to the debounced filter subject (mutates shared state)
  onFilterChange(value: string): void {
    this.filterSubject$.next(value);
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle pagination event by updating page state and reloading webhooks (mutates shared state)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadWebhooks();
    this.updateUrl();
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: sync current pagination and filter state to URL query params (mutates shared state)
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

  // SEM@36c98b471f199ad07ab7f890bf1fd25427d95e56: filter the loaded webhook list by name, URL, or status text (mutates shared state)
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

  // SEM@16a12de16f46596ddb6d847a588d043dcdbea3f7: open the add-webhook dialog and handle HMAC secret and automation-user follow-up dialogs
  onAddWebhook(): void {
    const dialogRef = this.dialog.open(AddWebhookDialogComponent, {
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(
        (result: { webhook: WebhookSubscription; createAutomationUser: boolean } | undefined) => {
          if (result) {
            this.loadWebhooks();
            // Show HMAC secret dialog if secret was returned
            if (result.webhook.secret) {
              this.showHmacSecretDialog(result.webhook.secret);
            }
            // Open automation user creation dialog if requested
            if (result.createAutomationUser) {
              this.openCreateAutomationUserDialog(result.webhook.name);
            }
          }
        },
      );
  }

  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: open a modal displaying the one-time HMAC secret after webhook creation
  private showHmacSecretDialog(secret: string): void {
    this.dialog.open(HmacSecretDialogComponent, {
      width: '600px',
      disableClose: true,
      data: { secret },
    });
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: confirm and delete a webhook subscription, adjusting pagination if needed (reads DB)
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

  // SEM@8b0bb0df016a0e6d542fd365563a666e173d4ce6: open dialog to create an automation user and display its credential secret on success
  private openCreateAutomationUserDialog(webhookName: string): void {
    const dialogData: CreateAutomationUserDialogData = { suggestedName: webhookName };
    const dialogRef = this.dialog.open(CreateAutomationUserDialogComponent, {
      width: '500px',
      data: dialogData,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result: CreateAutomationAccountResponse | null) => {
        if (result) {
          const secretData: CredentialSecretDialogData = {
            clientId: result.client_credential.client_id,
            clientSecret: result.client_credential.client_secret,
          };
          this.dialog.open(CredentialSecretDialogComponent, {
            width: '600px',
            disableClose: true,
            data: secretData,
          });
        }
      });
  }

  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: map a webhook status string to its Material icon name (pure)
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

  // SEM@b8643f16acb6c8737803e96d52ba242ba11b46d2: format a webhook event list as a newline-delimited tooltip string (pure)
  getEventsTooltip(events: string[]): string {
    return events.join('\n');
  }

  // SEM@2d3671257056c457e73337441c53ba77f18eb793: copy a text value to the system clipboard, logging on failure
  copyToClipboard(text: string): void {
    const success = this.clipboard.copy(text);
    if (!success) {
      this.logger.error('Failed to copy to clipboard');
    }
  }

  // SEM@913973c2390b7180140950023b498e5c44ca2678: navigate away from the admin webhooks page to the appropriate landing route
  onClose(): void {
    navigateFromAdminPage(this.router, this.authService);
  }
}
