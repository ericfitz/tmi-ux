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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { AdminAuditService } from '@app/pages/admin/audit/admin-audit.service';
import {
  AuditColumnDef,
  AuditExportFormat,
  AuditPageRequest,
  SystemAuditEntry,
  SystemAuditFilter,
} from '@app/pages/admin/audit/models/admin-audit.model';
import { AuditFilterBarComponent } from '@app/pages/admin/audit/components/audit-filter-bar.component';
import { AuditTableComponent } from '@app/pages/admin/audit/components/audit-table.component';
import { downloadBlob } from '@app/shared/utils/blob-download.util';

/** System filter query-param keys recognised from the URL. */
const SYSTEM_FILTER_KEYS: (keyof SystemAuditFilter)[] = [
  'actor_email',
  'actor_provider',
  'created_after',
  'created_before',
  'http_method',
  'path_prefix',
  'field_path',
];

/**
 * System audit view: owns state, composes the filter bar, audit table,
 * and a router-outlet for the detail panel child route.
 * Query params are mirrored to/from the URL for bookmarkability.
 */
@Component({
  selector: 'app-system-audit-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    MatSnackBarModule,
    TranslocoModule,
    RouterOutlet,
    AuditFilterBarComponent,
    AuditTableComponent,
  ],
  templateUrl: './system-audit-view.component.html',
  styleUrl: './system-audit-view.component.scss',
})
// SEM@bdc7912ec604dacec178423545047395c6eda4a2: display, filter, paginate, and export the system admin audit log (mutates shared state)
export class SystemAuditViewComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auditService = inject(AdminAuditService);
  private logger = inject(LoggerService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private transloco = inject(TranslocoService);

  // ── Public state (used by template and tests) ────────────────────────────

  filter: SystemAuditFilter = {};
  rows: SystemAuditEntry[] = [];
  total = 0;
  nextCursor: string | null = null;
  prevCursor: string | null = null;
  loading = false;
  hasError = false;
  anchorId: string | null = null;

  /** The most recent page request, replayed by retry. */
  private lastPage: AuditPageRequest = {};

  readonly limit = 50;
  readonly stream = 'system' as const;

  readonly columns: AuditColumnDef[] = [
    {
      key: 'created_at',
      headerKey: 'admin.audit.columns.timestamp',
      cell: (r: Record<string, unknown>) => (r['created_at'] as string | null | undefined) ?? '',
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
      key: 'request',
      headerKey: 'admin.audit.columns.request',
      cell: (r: Record<string, unknown>) => {
        const method = (r['http_method'] as string | null | undefined) ?? '';
        const path = (r['http_path'] as string | null | undefined) ?? '';
        return `${method} ${path}`.trim();
      },
    },
    {
      key: 'field_path',
      headerKey: 'admin.audit.columns.fieldPath',
      cell: (r: Record<string, unknown>) => (r['field_path'] as string | null | undefined) ?? '',
    },
    {
      key: 'change_summary',
      headerKey: 'admin.audit.columns.changeSummary',
      cell: (r: Record<string, unknown>) =>
        (r['change_summary'] as string | null | undefined) ?? '',
    },
  ];

  // ── Lifecycle ────────────────────────────────────────────────────────────

  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: initialize audit view from URL query params and subscribe to param changes (mutates shared state)
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
  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: apply a new audit filter and reload the first page (mutates shared state)
  onFilterChange(f: SystemAuditFilter): void {
    this.filter = f;
    this.anchorId = null;
    this.load({ limit: this.limit });
    this.updateUrl();
  }

  /** Navigate to an older (earlier) page using the next cursor. Leaves around mode. */
  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: navigate to the next (older) audit log page via cursor (mutates shared state)
  onOlder(): void {
    this.anchorId = null;
    this.load({ cursor: this.nextCursor ?? undefined });
    this.updateUrl();
  }

  /** Navigate to a newer (later) page using the prev cursor. Leaves around mode. */
  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: navigate to the previous (newer) audit log page via cursor (mutates shared state)
  onNewer(): void {
    this.anchorId = null;
    this.load({ cursor: this.prevCursor ?? undefined });
    this.updateUrl();
  }

  /** Navigate into the detail panel for the clicked row. */
  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: route to the audit entry detail panel for the clicked row
  onRowClick(e: { id: string }): void {
    void this.router.navigate([e.id], { relativeTo: this.route });
  }

  /** Retry the most recent load, preserving the current page position. */
  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: retry the most recent audit page load after an error (mutates shared state)
  onRetry(): void {
    this.load(this.lastPage);
  }

  /** Export the current filtered view in the chosen format. */
  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: fetch and download the filtered system audit log in the chosen format
  onExport(format: AuditExportFormat): void {
    const timestamp = new Date().toISOString();
    const ext = format === 'csv' ? 'csv' : 'ndjson';
    const filename = `system-audit-${timestamp}.${ext}`;

    this.auditService
      .exportSystem(this.filter, format)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob: Blob) => {
          downloadBlob(blob, filename);
        },
        error: (e: unknown) => {
          this.logger.error('Failed to export system audit', e);
          this.snackBar.open(
            this.transloco.translate('admin.audit.export.error'),
            this.transloco.translate('common.dismiss'),
            { duration: 5000 },
          );
        },
      });
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /** Load a page of entries; sets loading/error state and triggers change detection. */
  // SEM@bdc7912ec604dacec178423545047395c6eda4a2: fetch a page of system audit entries and update component state (mutates shared state)
  private load(page: AuditPageRequest): void {
    this.lastPage = page;
    this.loading = true;
    this.hasError = false;
    this.cdr.markForCheck();

    this.auditService
      .listSystem(this.filter, { ...page, limit: this.limit })
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
          this.logger.error('Failed to load system audit entries', e);
          this.cdr.markForCheck();
        },
      });
  }

  /** Mirror the current filter (without cursor/around) to the URL. */
  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: sync the current audit filter to the URL query params without reloading
  private updateUrl(): void {
    const queryParams: Record<string, string | undefined> = {};
    for (const key of SYSTEM_FILTER_KEYS) {
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
  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: parse system audit filter values from a raw query-params map (pure)
  private _buildFilter(params: Record<string, string>): SystemAuditFilter {
    const f: SystemAuditFilter = {};
    for (const key of SYSTEM_FILTER_KEYS) {
      const v = params[key];
      if (v) (f as Record<string, string>)[key] = v;
    }
    return f;
  }

  /** Apply snapshot query params to `this.filter` (without triggering a reload). */
  // SEM@3693bdce12f3ecf112bc73a8942becbc4e0c60da: initialize the active filter from URL query params without reloading (mutates shared state)
  private _applyQueryParams(params: Record<string, string>): void {
    this.filter = this._buildFilter(params);
  }
}
