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
import { QuotaService } from '@app/core/services/quota.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AuthService } from '@app/auth/services/auth.service';
import {
  EnrichedUserAPIQuota,
  EnrichedWebhookQuota,
  DEFAULT_USER_API_QUOTA,
  DEFAULT_WEBHOOK_QUOTA,
} from '@app/types/quota.types';
import { AddQuotaDialogComponent } from './add-quota-dialog/add-quota-dialog.component';

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
  ],
  templateUrl: './admin-quotas.component.html',
  styleUrl: './admin-quotas.component.scss',
})
export class AdminQuotasComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private filterSubject$ = new Subject<string>();

  userAPIQuotas: EditableUserAPIQuota[] = [];
  webhookQuotas: EditableWebhookQuota[] = [];
  filteredUserAPIQuotas: EditableUserAPIQuota[] = [];
  filteredWebhookQuotas: EditableWebhookQuota[] = [];

  filterText = '';
  loadingUserAPI = false;
  loadingWebhook = false;

  readonly defaultUserAPIQuota = DEFAULT_USER_API_QUOTA;
  readonly defaultWebhookQuota = DEFAULT_WEBHOOK_QUOTA;

  constructor(
    private quotaService: QuotaService,
    private router: Router,
    private dialog: MatDialog,
    private logger: LoggerService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.loadAllQuotas();

    this.filterSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.applyFilter();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadAllQuotas(): void {
    this.loadUserAPIQuotas();
    this.loadWebhookQuotas();
  }

  loadUserAPIQuotas(): void {
    this.loadingUserAPI = true;
    this.quotaService
      .listEnrichedUserAPIQuotas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: quotas => {
          this.userAPIQuotas = quotas.map(quota => ({
            ...quota,
            editing: false,
            saving: false,
          }));
          this.applyFilter();
          this.loadingUserAPI = false;
          this.logger.info('User API quotas loaded', { count: quotas.length });
        },
        error: error => {
          this.logger.error('Failed to load user API quotas', error);
          this.loadingUserAPI = false;
        },
      });
  }

  loadWebhookQuotas(): void {
    this.loadingWebhook = true;
    this.quotaService
      .listEnrichedWebhookQuotas()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: quotas => {
          this.webhookQuotas = quotas.map(quota => ({
            ...quota,
            editing: false,
            saving: false,
          }));
          this.applyFilter();
          this.loadingWebhook = false;
          this.logger.info('Webhook quotas loaded', { count: quotas.length });
        },
        error: error => {
          this.logger.error('Failed to load webhook quotas', error);
          this.loadingWebhook = false;
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
      width: '700px',
      disableClose: false,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
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
      .pipe(takeUntil(this.destroy$))
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
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('User API quota deleted', { userId: quota.user_id });
            this.loadUserAPIQuotas();
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
      .pipe(takeUntil(this.destroy$))
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
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.logger.info('Webhook quota deleted', { userId: quota.owner_id });
            this.loadWebhookQuotas();
          },
          error: error => {
            this.logger.error('Failed to delete webhook quota', error);
          },
        });
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
