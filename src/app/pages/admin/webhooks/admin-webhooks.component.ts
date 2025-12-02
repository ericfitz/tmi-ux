import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
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
})
export class AdminWebhooksComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  webhooks: WebhookSubscription[] = [];
  filteredWebhooks: WebhookSubscription[] = [];
  filterText = '';
  loading = false;

  constructor(
    private webhookService: WebhookService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadWebhooks();

    this.filterSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadWebhooks(): void {
    this.loading = true;
    this.webhookService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: webhooks => {
          this.webhooks = webhooks;
          this.applyFilter();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  onFilterChange(value: string): void {
    this.filterText = value;
    this.filterSubject$.next(value);
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
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.loadWebhooks();
        }
      });
  }

  onDeleteWebhook(webhook: WebhookSubscription): void {
    const confirmed = confirm(`Are you sure you want to delete the webhook "${webhook.name}"?`);

    if (confirmed) {
      this.webhookService
        .delete(webhook.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Webhook deleted', { id: webhook.id });
            this.loadWebhooks();
          },
          error: error => {
            this.logger.error('Failed to delete webhook', error);
          },
        });
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

  onClose(): void {
    if (this.authService.isAdmin) {
      void this.router.navigate(['/admin']);
    } else {
      void this.router.navigate(['/dashboard']);
    }
  }
}
