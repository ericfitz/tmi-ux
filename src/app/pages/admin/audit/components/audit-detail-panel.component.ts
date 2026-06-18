import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { TranslocoModule } from '@jsverse/transloco';
import { switchMap } from 'rxjs/operators';

import { LoggerService } from '@app/core/services/logger.service';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import {
  AuditEntry,
  AuditStream,
  SystemAuditEntry,
} from '@app/pages/admin/audit/models/admin-audit.model';

/**
 * Route-driven side panel showing one audit entry (system OR threat-model).
 * Rendered inside a parent view's `<router-outlet>` via a child route `:entryId`.
 * The route supplies `data.stream` to indicate which audit stream to use.
 */
@Component({
  selector: 'app-audit-detail-panel',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './audit-detail-panel.component.html',
  styleUrl: './audit-detail-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@bdc7912ec604dacec178423545047395c6eda4a2: route-driven side panel displaying a single audit entry for system or threat-model stream
export class AuditDetailPanelComponent implements OnInit {
  private readonly route: ActivatedRoute;
  private readonly router: Router;
  private readonly auditService: AdminAuditService;
  private readonly logger: LoggerService;
  private readonly destroyRef: DestroyRef;
  private readonly cdr: ChangeDetectorRef;

  /** Which audit stream this panel is showing — read from route data. */
  readonly stream: AuditStream;

  /** The resolved audit entry, or null when not yet loaded or on error. */
  entry: SystemAuditEntry | AuditEntry | null = null;

  /** True while the entry is being fetched. */
  loading = false;

  /** True when the entry was not found (404) or any fetch error occurred. */
  notFound = false;

  /** True briefly after the user copies the permalink URL. */
  copied = false;

  /** The current entryId from the route. */
  private _currentEntryId: string | null = null;

  // SEM@5581443329b5f5aa1c4acb36eae3a5b903c0619e: inject dependencies and read the audit stream from route data (pure)
  constructor() {
    this.route = inject(ActivatedRoute);
    this.router = inject(Router);
    this.auditService = inject(AdminAuditService);
    this.logger = inject(LoggerService);
    this.destroyRef = inject(DestroyRef);
    this.cdr = inject(ChangeDetectorRef);
    this.stream = (this.route.snapshot.data['stream'] as AuditStream) ?? 'system';
  }

  /** Type-safe accessor for system audit entries. */
  get systemEntry(): SystemAuditEntry | null {
    if (this.stream !== 'system') return null;
    return this.entry as SystemAuditEntry | null;
  }

  /** Type-safe accessor for threat-model audit entries. */
  get tmEntry(): AuditEntry | null {
    if (this.stream !== 'tm') return null;
    return this.entry as AuditEntry | null;
  }

  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: subscribe to route param changes and fetch the corresponding audit entry (mutates shared state)
  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(params => {
          const entryId = params.get('entryId') ?? '';
          this._currentEntryId = entryId;
          this.loading = true;
          this.notFound = false;
          this.entry = null;
          this.copied = false;
          this.cdr.markForCheck();

          return this.stream === 'system'
            ? this.auditService.getSystemEntry(entryId)
            : this.auditService.getTmEntry(entryId);
        }),
      )
      .subscribe({
        next: entry => {
          this.entry = entry;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err: unknown) => {
          this.loading = false;
          this.entry = null;
          this.notFound = true;

          if (err instanceof HttpErrorResponse && err.status === 404) {
            // Silently set not-found; no log noise for expected 404s
          } else {
            this.logger.error('Failed to load audit entry', err);
          }

          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Copies the absolute permalink URL of this entry to the clipboard.
   * URL = window.location.origin + router.url (the current route is already the permalink).
   */
  // SEM@5581443329b5f5aa1c4acb36eae3a5b903c0619e: copy the current audit entry's absolute URL to the clipboard (mutates shared state)
  copyPermalink(): void {
    const url = `${window.location.origin}${this.router.url}`;
    void navigator.clipboard.writeText(url);
    this.copied = true;
    this.cdr.markForCheck();
  }

  /**
   * Navigates to the parent list with this entry as the around-anchor,
   * allowing the user to see this entry in context.
   */
  // SEM@5581443329b5f5aa1c4acb36eae3a5b903c0619e: navigate to the audit list centered on the current entry via around query param
  viewInContext(): void {
    void this.router.navigate(['../'], {
      relativeTo: this.route,
      queryParams: { around: this._currentEntryId },
    });
  }

  /** Closes the detail panel by navigating back to the parent list. */
  // SEM@5581443329b5f5aa1c4acb36eae3a5b903c0619e: navigate back to the parent audit list, dismissing the detail panel
  close(): void {
    void this.router.navigate(['../'], { relativeTo: this.route });
  }
}
