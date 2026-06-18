import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
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
// SEM@e7dd6955882ba4be469447e879cf0576655cd710: dialog for selecting a user and setting API and webhook quotas
export class AddQuotaDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
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

  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: initialize user search and quota forms with default values (pure)
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

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: subscribe to debounced search input to trigger user search (mutates shared state)
  ngOnInit(): void {
    this.searchSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(searchText => {
        this.searchUsers(searchText);
      });
  }

  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: dispatch a user search query to the debounce subject (mutates shared state)
  onSearchChange(value: string): void {
    this.searchSubject$.next(value);
  }

  // SEM@6155a2a9e7c211bc53a925f06c0fa0e1aa3b4ec2: fetch users matching email search text and populate the suggestion list (reads DB)
  searchUsers(searchText: string): void {
    if (!searchText || searchText.length < 2) {
      this.filteredUsers = [];
      return;
    }

    this.searchingUsers = true;
    this.quotaService
      .listUsers({ email: searchText, limit: 20 })
      .pipe(takeUntilDestroyed(this.destroyRef))
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

  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: store the chosen user and populate the search field with their email (mutates shared state)
  onSelectUser(user: AdminUser): void {
    this.selectedUser = user;
    this.userSearchForm.patchValue({ searchText: user.email });
    this.filteredUsers = [];
  }

  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: clear the selected user and reset the search field (mutates shared state)
  onClearUser(): void {
    this.selectedUser = null;
    this.userSearchForm.patchValue({ searchText: '' });
    this.filteredUsers = [];
  }

  // SEM@e7dd6955882ba4be469447e879cf0576655cd710: store API and webhook quotas for the selected user and close the dialog (reads DB)
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
    userAPIQuota$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        webhookQuota$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => {
            this.logger.info('Quotas created successfully', {
              internalUuid: this.selectedUser?.internal_uuid,
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

  // SEM@65afaf0b87a37250bf4e27116c95afdfd3ffc43f: close the dialog without saving (pure)
  onCancel(): void {
    this.dialogRef.close();
  }
}
