import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { QuotaService } from '@app/core/services/quota.service';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminUser } from '@app/types/user.types';
import { DEFAULT_USER_API_QUOTA, DEFAULT_WEBHOOK_QUOTA } from '@app/types/quota.types';

/**
 * Add Quota Dialog Component
 *
 * Allows administrators to add custom quotas for a user by searching for the user
 * and configuring both API and webhook quotas.
 */
@Component({
  selector: 'app-add-quota-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ReactiveFormsModule,
  ],
  templateUrl: './add-quota-dialog.component.html',
  styleUrl: './add-quota-dialog.component.scss',
})
export class AddQuotaDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject$ = new Subject<string>();

  userSearchForm: FormGroup;
  quotaForm: FormGroup;

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  selectedUser: AdminUser | null = null;
  searchingUsers = false;
  saving = false;

  readonly defaultUserAPIQuota = DEFAULT_USER_API_QUOTA;
  readonly defaultWebhookQuota = DEFAULT_WEBHOOK_QUOTA;

  constructor(
    public dialogRef: MatDialogRef<AddQuotaDialogComponent>,
    private fb: FormBuilder,
    private quotaService: QuotaService,
    private logger: LoggerService,
  ) {
    this.userSearchForm = this.fb.group({
      searchText: [''],
    });

    this.quotaForm = this.fb.group({
      // User API Quotas
      max_requests_per_minute: [
        this.defaultUserAPIQuota.max_requests_per_minute,
        [Validators.required, Validators.min(1)],
      ],
      max_requests_per_hour: [this.defaultUserAPIQuota.max_requests_per_hour, Validators.min(1)],
      // Webhook Quotas
      max_subscriptions: [
        this.defaultWebhookQuota.max_subscriptions,
        [Validators.required, Validators.min(1)],
      ],
      max_events_per_minute: [
        this.defaultWebhookQuota.max_events_per_minute,
        [Validators.required, Validators.min(1)],
      ],
      max_subscription_requests_per_minute: [
        this.defaultWebhookQuota.max_subscription_requests_per_minute,
        [Validators.required, Validators.min(1)],
      ],
      max_subscription_requests_per_day: [
        this.defaultWebhookQuota.max_subscription_requests_per_day,
        [Validators.required, Validators.min(1)],
      ],
    });
  }

  ngOnInit(): void {
    this.searchSubject$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(searchText => {
      this.searchUsers(searchText);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchChange(value: string): void {
    this.searchSubject$.next(value);
  }

  searchUsers(searchText: string): void {
    if (!searchText || searchText.length < 2) {
      this.filteredUsers = [];
      return;
    }

    this.searchingUsers = true;
    this.quotaService
      .listUsers({ email: searchText, limit: 20 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.users = response.users;
          this.filteredUsers = response.users;
          this.searchingUsers = false;
        },
        error: error => {
          this.logger.error('Failed to search users', error);
          this.searchingUsers = false;
        },
      });
  }

  onSelectUser(user: AdminUser): void {
    this.selectedUser = user;
    this.userSearchForm.patchValue({ searchText: user.email });
    this.filteredUsers = [];
  }

  onClearUser(): void {
    this.selectedUser = null;
    this.userSearchForm.patchValue({ searchText: '' });
    this.filteredUsers = [];
  }

  onSave(): void {
    if (!this.selectedUser || this.quotaForm.invalid) {
      return;
    }

    this.saving = true;
    const formValue = this.quotaForm.value as {
      max_requests_per_minute: number;
      max_requests_per_hour: number | null;
      max_subscriptions: number;
      max_events_per_minute: number;
      max_subscription_requests_per_minute: number;
      max_subscription_requests_per_day: number;
    };

    // Create both quotas concurrently
    const userAPIQuota$ = this.quotaService.updateUserAPIQuota(this.selectedUser.internal_uuid, {
      max_requests_per_minute: formValue.max_requests_per_minute,
      max_requests_per_hour: formValue.max_requests_per_hour || null,
    });

    const webhookQuota$ = this.quotaService.updateWebhookQuota(this.selectedUser.internal_uuid, {
      max_subscriptions: formValue.max_subscriptions,
      max_events_per_minute: formValue.max_events_per_minute,
      max_subscription_requests_per_minute: formValue.max_subscription_requests_per_minute,
      max_subscription_requests_per_day: formValue.max_subscription_requests_per_day,
    });

    // Wait for both to complete
    userAPIQuota$.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        webhookQuota$.pipe(takeUntil(this.destroy$)).subscribe({
          next: () => {
            this.logger.info('Quotas created successfully', {
              userId: this.selectedUser?.internal_uuid,
            });
            this.saving = false;
            this.dialogRef.close(true);
          },
          error: error => {
            this.logger.error('Failed to create webhook quota', error);
            this.saving = false;
          },
        });
      },
      error: error => {
        this.logger.error('Failed to create user API quota', error);
        this.saving = false;
      },
    });
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
