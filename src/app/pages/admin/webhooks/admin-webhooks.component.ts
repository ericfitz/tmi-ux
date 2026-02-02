import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
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
import { HmacSecretDialogComponent } from './hmac-secret-dialog/hmac-secret-dialog.component';

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
export class AdminWebhooksComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
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

    this.filterSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applyFilter();
      });
  }

  loadWebhooks(): void {
    this.loading = true;
    this.webhookService
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.webhooks = response.subscriptions;
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
            this.loadWebhooks();
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
      void this.router.navigate(['/dashboard']);
    }
  }
}
