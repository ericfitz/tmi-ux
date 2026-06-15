import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  inject,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

import { COMMON_IMPORTS, CORE_MATERIAL_IMPORTS } from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import {
  AuditColumnDef,
  AuditEntry,
  AuditPageRequest,
  TmAuditFilter,
} from '@app/pages/admin/audit/models/admin-audit.model';
import { AuditFilterBarComponent } from '@app/pages/admin/audit/components/audit-filter-bar.component';
import { AuditTableComponent } from '@app/pages/admin/audit/components/audit-table.component';

/** TM filter query-param keys recognised from the URL. */
const TM_FILTER_KEYS: (keyof TmAuditFilter)[] = [
  'actor_email',
  'actor_provider',
  'created_after',
  'created_before',
  'change_type',
  'object_type',
  'threat_model_id',
];

/**
 * Threat-model audit view: owns state, composes the filter bar, audit table,
 * and a router-outlet for the detail panel child route.
 * Query params are mirrored to/from the URL for bookmarkability.
 * No export capability (unlike the system audit view).
 */
@Component({
  selector: 'app-tm-audit-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    TranslocoModule,
    RouterOutlet,
    AuditFilterBarComponent,
    AuditTableComponent,
  ],
  templateUrl: './tm-audit-view.component.html',
  styleUrl: './tm-audit-view.component.scss',
})
export class TmAuditViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auditService = inject(AdminAuditService);
  private logger = inject(LoggerService);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  // ── Public state (used by template and tests) ────────────────────────────

  filter: TmAuditFilter = {};
  rows: AuditEntry[] = [];
  total = 0;
  nextCursor: string | null = null;
  prevCursor: string | null = null;
  loading = false;
  hasError = false;
  anchorId: string | null = null;

  /** The most recent page request, replayed by retry. */
  private lastPage: AuditPageRequest = {};

  readonly limit = 50;
  readonly stream = 'tm' as const;

  readonly columns: AuditColumnDef[] = [
    {
      key: 'created_at',
      headerKey: 'admin.audit.columns.timestamp',
      cell: (r: Record<string, unknown>) => (r['created_at'] as string | undefined) ?? '',
    },
    {
      key: 'actor',
      headerKey: 'admin.audit.columns.actor',
      cell: (r: Record<string, unknown>) => {
        const a = r['actor'] as { display_name?: string; email?: string } | undefined;
        return a?.display_name || a?.email || '';
      },
    },
    {
      key: 'threat_model',
      headerKey: 'admin.audit.columns.threatModel',
      cell: (r: Record<string, unknown>) => (r['threat_model_id'] as string | undefined) ?? '',
    },
    {
      key: 'object',
      headerKey: 'admin.audit.columns.object',
      cell: (r: Record<string, unknown>) => {
        const t = (r['object_type'] as string | undefined) ?? '';
        const id = (r['object_id'] as string | undefined) ?? '';
        return `${t} ${id}`.trim();
      },
    },
    {
      key: 'change_type',
      headerKey: 'admin.audit.columns.changeType',
      cell: (r: Record<string, unknown>) => (r['change_type'] as string | undefined) ?? '',
    },
    {
      key: 'change_summary',
      headerKey: 'admin.audit.columns.changeSummary',
      cell: (r: Record<string, unknown>) => (r['change_summary'] as string | undefined) ?? '',
    },
  ];

  // ── Lifecycle ────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Read initial state from a snapshot so we don't create a reload loop.
    // Then subscribe to queryParamMap for subsequent navigation changes
    // (e.g. the detail panel's "view in context" sets `around`).
    const snapshot = this.route.snapshot.queryParams as Record<string, string>;
    this._applyQueryParams(snapshot);

    const around = snapshot['around'];
    if (around) {
      this.anchorId = around;
      this.load({ around, limit: this.limit });
    } else {
      this.load({ limit: this.limit });
    }

    // Subscribe for subsequent param changes (detail panel sets `around`).
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(paramMap => {
      const newAround = paramMap.get('around');
      // Rebuild filter from current params
      const params: Record<string, string> = {};
      paramMap.keys.forEach(k => {
        const v = paramMap.get(k);
        if (v !== null) params[k] = v;
      });
      const newFilter = this._buildFilter(params);
      const filterChanged =
        JSON.stringify(newFilter) !== JSON.stringify(this.filter) || newAround !== this.anchorId;

      if (!filterChanged) return; // guard against the initial emit

      this.filter = newFilter;
      if (newAround) {
        this.anchorId = newAround;
        this.load({ around: newAround, limit: this.limit });
      } else {
        this.anchorId = null;
        this.load({ limit: this.limit });
      }
    });
  }

  // ── Event handlers ───────────────────────────────────────────────────────

  /** Called by the filter bar when any filter value changes. */
  onFilterChange(f: TmAuditFilter): void {
    this.filter = f;
    this.anchorId = null;
    this.load({ limit: this.limit });
    this.updateUrl();
  }

  /** Navigate to an older (earlier) page using the next cursor. Leaves around mode. */
  onOlder(): void {
    this.anchorId = null;
    this.load({ cursor: this.nextCursor ?? undefined });
    this.updateUrl();
  }

  /** Navigate to a newer (later) page using the prev cursor. Leaves around mode. */
  onNewer(): void {
    this.anchorId = null;
    this.load({ cursor: this.prevCursor ?? undefined });
    this.updateUrl();
  }

  /** Navigate into the detail panel for the clicked row. */
  onRowClick(e: { id: string }): void {
    void this.router.navigate([e.id], { relativeTo: this.route });
  }

  /** Retry the most recent load, preserving the current page position. */
  onRetry(): void {
    this.load(this.lastPage);
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Load a page of entries; sets loading/error state and triggers change detection. */
  private load(page: AuditPageRequest): void {
    this.lastPage = page;
    this.loading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    this.auditService
      .listTm(this.filter, { ...page, limit: this.limit })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: resp => {
          this.rows = resp.entries;
          this.total = resp.total;
          this.nextCursor = resp.next_cursor ?? null;
          this.prevCursor = resp.prev_cursor ?? null;
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (e: unknown) => {
          this.hasError = true;
          this.loading = false;
          this.logger.error('Failed to load threat-model audit entries', e);
          this.cdr.markForCheck();
        },
      });
  }

  /** Mirror the current filter (without cursor/around) to the URL. */
  private updateUrl(): void {
    const queryParams: Record<string, string | undefined> = {};
    for (const key of TM_FILTER_KEYS) {
      queryParams[key] = this.filter[key];
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  /** Extract filter values from a raw query-params map. */
  private _buildFilter(params: Record<string, string>): TmAuditFilter {
    const f: TmAuditFilter = {};
    for (const key of TM_FILTER_KEYS) {
      const v = params[key];
      if (v) (f as Record<string, string>)[key] = v;
    }
    return f;
  }

  /** Apply snapshot query params to `this.filter` (without triggering a reload). */
  private _applyQueryParams(params: Record<string, string>): void {
    this.filter = this._buildFilter(params);
  }
}
