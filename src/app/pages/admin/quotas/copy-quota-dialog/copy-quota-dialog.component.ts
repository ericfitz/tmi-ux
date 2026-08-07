import {
  Component,
  DestroyRef,
  Inject,
  inject,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, of, Subject, Observable } from 'rxjs';
import { catchError, debounceTime, map } from 'rxjs/operators';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { QuotaService } from '@app/core/services/quota.service';
import { LoggerService } from '@app/core/services/logger.service';
import { NotificationService } from '@app/shared/services/notification.service';
import { AdminUser } from '@app/types/user.types';
import { UserAPIQuota, WebhookQuota } from '@app/types/quota.types';

/** Source user whose quotas are being copied. */
export interface CopyQuotaDialogData {
  sourceUuid: string;
  sourceEmail: string;
  sourceName?: string | null;
  sourceProvider: string;
}

/**
 * Copy Quota Dialog Component
 *
 * Copies a source user's custom API and webhook quotas to another user.
 * Purely client-side composition: GETs the source's quotas, previews them
 * against the target's current values, then PUTs both to the target.
 *
 * A quota type the source has not customized (GET 404) is shown as
 * "system defaults" and is NOT copied — copying never materializes a
 * defaults-valued custom row on the target.
 */
@Component({
  selector: 'app-copy-quota-dialog',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
    ReactiveFormsModule,
  ],
  templateUrl: './copy-quota-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './copy-quota-dialog.component.scss',
})
export class CopyQuotaDialogComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private searchSubject$ = new Subject<string>();

  userSearchForm: FormGroup;

  users: AdminUser[] = [];
  filteredUsers: AdminUser[] = [];
  targetUser: AdminUser | null = null;
  searchingUsers = false;

  loadingSource = true;
  loadingTarget = false;
  loadError = false;
  copying = false;
  private _writeAttempted = false;

  sourceAPIQuota: UserAPIQuota | null = null;
  sourceWebhookQuota: WebhookQuota | null = null;
  targetAPIQuota: UserAPIQuota | null = null;
  targetWebhookQuota: WebhookQuota | null = null;

  constructor(
    public dialogRef: MatDialogRef<CopyQuotaDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: CopyQuotaDialogData,
    private fb: FormBuilder,
    private quotaService: QuotaService,
    private logger: LoggerService,
    private notificationService: NotificationService,
    private transloco: TranslocoService,
  ) {
    this.userSearchForm = this.fb.group({
      searchText: [''],
    });
  }

  /** True when the source has at least one custom quota type to copy. */
  get hasSomethingToCopy(): boolean {
    return this.sourceAPIQuota !== null || this.sourceWebhookQuota !== null;
  }

  ngOnInit(): void {
    this.searchSubject$
      .pipe(debounceTime(300), takeUntilDestroyed(this.destroyRef))
      .subscribe(searchText => {
        this.searchUsers(searchText);
      });

    forkJoin({
      api: this.fetchQuota(this.quotaService.getUserAPIQuota(this.data.sourceUuid)),
      webhook: this.fetchQuota(this.quotaService.getWebhookQuota(this.data.sourceUuid)),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ api, webhook }) => {
        this.sourceAPIQuota = api;
        this.sourceWebhookQuota = webhook;
        this.loadingSource = false;
      });
  }

  /**
   * Fetch a quota record, mapping 404 (user on system defaults) to null.
   * Any other failure sets loadError, which blocks copying.
   */
  private fetchQuota<T>(source$: Observable<T>): Observable<T | null> {
    return source$.pipe(
      catchError((error: { status?: number }) => {
        if (error?.status === 404) {
          return of(null);
        }
        this.logger.error('Failed to load quotas for copy', error);
        this.loadError = true;
        return of(null);
      }),
      map(value => value ?? null),
    );
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
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          // The source user is not a valid copy target
          this.users = response.users.filter(u => u.internal_uuid !== this.data.sourceUuid);
          this.filteredUsers = this.users;
          this.searchingUsers = false;
        },
        error: error => {
          this.logger.error('Failed to search users', error);
          this.searchingUsers = false;
        },
      });
  }

  onSelectTarget(user: AdminUser): void {
    this.targetUser = user;
    this.userSearchForm.patchValue({ searchText: user.email });
    this.filteredUsers = [];
    this.loadTargetQuotas(user.internal_uuid);
  }

  onClearTarget(): void {
    this.targetUser = null;
    this.targetAPIQuota = null;
    this.targetWebhookQuota = null;
    this.userSearchForm.patchValue({ searchText: '' });
    this.filteredUsers = [];
  }

  /** Fetch the target's current quotas so the preview shows what gets overwritten. */
  private loadTargetQuotas(internalUuid: string): void {
    this.loadingTarget = true;
    forkJoin({
      api: this.fetchQuota(this.quotaService.getUserAPIQuota(internalUuid)),
      webhook: this.fetchQuota(this.quotaService.getWebhookQuota(internalUuid)),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ api, webhook }) => {
        this.targetAPIQuota = api;
        this.targetWebhookQuota = webhook;
        this.loadingTarget = false;
      });
  }

  onCopy(): void {
    if (!this.targetUser || !this.hasSomethingToCopy || this.loadError || this.copying) {
      return;
    }

    this.copying = true;
    // From the first write attempt onward the target may have been mutated:
    // block ESC/backdrop dismissal and make every exit report "reload needed".
    this._writeAttempted = true;
    this.dialogRef.disableClose = true;
    const target = this.targetUser;
    const writes: Observable<{ ok: boolean; status?: number }>[] = [];

    if (this.sourceAPIQuota) {
      writes.push(
        this.quotaService
          .updateUserAPIQuota(target.internal_uuid, {
            max_requests_per_minute: this.sourceAPIQuota.max_requests_per_minute,
            max_requests_per_hour: this.sourceAPIQuota.max_requests_per_hour ?? null,
          })
          .pipe(this.captureWriteResult()),
      );
    }
    if (this.sourceWebhookQuota) {
      writes.push(
        this.quotaService
          .updateWebhookQuota(target.internal_uuid, {
            max_subscriptions: this.sourceWebhookQuota.max_subscriptions,
            max_events_per_minute: this.sourceWebhookQuota.max_events_per_minute,
            max_subscription_requests_per_minute:
              this.sourceWebhookQuota.max_subscription_requests_per_minute,
            max_subscription_requests_per_day:
              this.sourceWebhookQuota.max_subscription_requests_per_day,
          })
          .pipe(this.captureWriteResult()),
      );
    }

    // Each write captures its own error, so one failure can't cancel the
    // sibling request mid-flight and leave the server state indeterminate.
    forkJoin(writes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(results => {
        this.copying = false;
        const failed = results.filter(r => !r.ok);

        if (failed.length === 0) {
          this.logger.info('Quotas copied', {
            from: this.data.sourceUuid,
            to: target.internal_uuid,
          });
          this.notificationService.showSuccess(
            this.transloco.translate('admin.quotas.copyDialog.success', { email: target.email }),
          );
          this.dialogRef.close(true);
          return;
        }

        const status = failed.find(f => f.status !== undefined)?.status ?? null;
        this.notificationService.showError(
          status !== null
            ? this.transloco.translate('admin.quotas.copyDialog.failed', { status })
            : this.transloco.translate('admin.quotas.copyDialog.failedGeneric'),
        );
      });
  }

  /** Map a write to {ok} and capture its error so sibling writes always run to completion. */
  private captureWriteResult(): (source$: Observable<unknown>) => Observable<{
    ok: boolean;
    status?: number;
  }> {
    return source$ =>
      source$.pipe(
        map(() => ({ ok: true })),
        catchError((error: { status?: number }) => {
          this.logger.error('Failed to copy quotas', error);
          const status =
            typeof error?.status === 'number' && error.status > 0 ? error.status : undefined;
          return of({ ok: false, status });
        }),
      );
  }

  onCancel(): void {
    // After a write attempt the target may already be mutated — tell the
    // page to reload even though the admin is dismissing the dialog.
    this.dialogRef.close(this._writeAttempted);
  }
}
