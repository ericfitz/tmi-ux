import { Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule } from '@jsverse/transloco';

import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Language, LanguageService } from '@app/i18n/language.service';
import { AuditTrailService } from '../../services/audit-trail.service';
import {
  AuditChangeType,
  AuditEntry,
  AuditObjectType,
  AuditTrailListParams,
} from '../../models/audit-trail.model';
import { ThreatModel } from '../../models/threat-model.model';

/** Threshold in days after which absolute time is shown instead of relative */
const RELATIVE_TIME_THRESHOLD_DAYS = 30;

@Component({
  selector: 'app-audit-trail-page',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    MatProgressSpinnerModule,
    TranslocoModule,
  ],
  templateUrl: './audit-trail-page.component.html',
  styleUrls: ['./audit-trail-page.component.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: display paginated audit trail entries for a threat model with filtering
export class AuditTrailPageComponent implements OnInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  threatModel: ThreatModel | undefined;
  entries: AuditEntry[] = [];
  loading = true;
  totalEntries = 0;
  pageIndex = 0;
  pageSize = 20;

  // Filters
  filterObjectType: AuditObjectType | '' = '';
  filterChangeType: AuditChangeType | '' = '';

  // Entity-scoped mode (when navigating from a sub-entity row)
  entityType: AuditObjectType | null = null;
  entityId: string | null = null;
  entityName: string | null = null;

  // Locale
  currentLocale = 'en-US';

  readonly objectTypeOptions: AuditObjectType[] = [
    'threat_model',
    'diagram',
    'threat',
    'asset',
    'document',
    'note',
    'repository',
  ];

  readonly changeTypeOptions: AuditChangeType[] = [
    'created',
    'updated',
    'patched',
    'deleted',
    'rolled_back',
    'restored',
  ];

  readonly displayedColumns: string[] = [
    'timestamp',
    'actor',
    'changeType',
    'objectType',
    'changeSummary',
  ];

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: inject audit trail, routing, language, and logger dependencies (pure)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auditTrailService: AuditTrailService,
    private languageService: LanguageService,
    private logger: LoggerService,
    private destroyRef: DestroyRef,
  ) {}

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: resolve threat model from route, read entity filter params, and load audit entries (reads DB)
  ngOnInit(): void {
    this.threatModel = this.route.snapshot.data['threatModel'] as ThreatModel | undefined;

    // Read entity-scoped query params
    const qp = this.route.snapshot.queryParams;
    if (qp['objectType'] && qp['objectId']) {
      this.entityType = qp['objectType'] as AuditObjectType;
      this.entityId = String(qp['objectId']);
      this.entityName = qp['entityName'] ? String(qp['entityName']) : null;
      this.filterObjectType = this.entityType;
    }

    // Locale
    this.languageService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((language: Language) => {
        this.currentLocale = language.code;
      });

    this.loadEntries();
  }

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: fetch a page of audit entries for the threat model applying active filters (reads DB)
  loadEntries(): void {
    if (!this.threatModel) return;

    this.loading = true;
    const params: AuditTrailListParams = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
    };

    if (this.filterObjectType) params.object_type = this.filterObjectType;
    if (this.filterChangeType) params.change_type = this.filterChangeType;

    const request$ =
      this.entityType && this.entityId
        ? this.auditTrailService.getEntityAuditTrail(
            this.threatModel.id,
            this.entityType,
            this.entityId,
            params,
          )
        : this.auditTrailService.getAuditTrail(this.threatModel.id, params);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(response => {
      this.entries = response.audit_entries;
      this.totalEntries = response.total;
      this.loading = false;
    });
  }

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: update page index and size then reload audit entries (reads DB)
  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: reset to first page and reload audit entries with current filter values (reads DB)
  applyFilters(): void {
    this.pageIndex = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadEntries();
  }

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: reset object-type and change-type filters to defaults and reload audit entries (reads DB)
  clearFilters(): void {
    this.filterObjectType = this.entityType || '';
    this.filterChangeType = '';
    this.applyFilters();
  }

  /** Format timestamp as relative or absolute depending on age */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: format a timestamp as relative or absolute based on age (pure)
  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays > RELATIVE_TIME_THRESHOLD_DAYS) {
      return date.toLocaleDateString(this.currentLocale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    return this.formatRelativeTime(diffMs);
  }

  /** Format absolute timestamp for tooltip */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: format a timestamp as a full locale-aware absolute datetime string (pure)
  formatAbsoluteTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleString(this.currentLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  }

  /** Navigate back to the threat model editor */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: navigate to the threat model editor for the current threat model
  goBack(): void {
    if (this.threatModel) {
      void this.router.navigate(['/tm', this.threatModel.id]);
    }
  }

  /** Get the translation key for an object type */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: convert an audit object type to its i18n translation key (pure)
  getObjectTypeKey(objectType: AuditObjectType): string {
    return `common.objectTypes.${this.objectTypeToKey(objectType)}`;
  }

  /** Get the translation key for a change type */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: convert an audit change type to its i18n translation key (pure)
  getChangeTypeKey(changeType: AuditChangeType): string {
    return `auditTrail.changeTypes.${changeType}`;
  }

  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: format a millisecond duration as a human-readable relative time string (pure)
  private formatRelativeTime(diffMs: number): string {
    const minutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) {
      return this.intlRelativeTime(0, 'minute');
    }
    if (minutes < 60) {
      return this.intlRelativeTime(-minutes, 'minute');
    }
    if (hours < 24) {
      return this.intlRelativeTime(-hours, 'hour');
    }
    return this.intlRelativeTime(-days, 'day');
  }

  /** Format relative time using Intl.RelativeTimeFormat with fallback */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: format a relative time value using Intl.RelativeTimeFormat with fallback (pure)
  private intlRelativeTime(value: number, unit: 'minute' | 'hour' | 'day'): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
        const rtf = new Intl.RelativeTimeFormat(this.currentLocale, {
          numeric: 'auto',
          style: 'long',
        });
        return rtf.format(value, unit);
      }
    } catch {
      this.logger.debugComponent('AuditTrail', 'RelativeTimeFormat not supported, using fallback');
    }
    const absValue = Math.abs(value);
    const pluralSuffix = absValue === 1 ? '' : 's';
    return `${absValue} ${unit}${pluralSuffix} ago`;
  }

  /** Map AuditObjectType to camelCase key for translation lookup */
  // SEM@1b37d30bbd47f44c71c4f078fb23f0e15f6bbc24: map an audit object type enum to its camelCase translation key (pure)
  private objectTypeToKey(objectType: AuditObjectType): string {
    const keyMap: Record<AuditObjectType, string> = {
      threat_model: 'threatModel',
      diagram: 'diagram',
      threat: 'threat',
      asset: 'asset',
      document: 'document',
      note: 'note',
      repository: 'repository',
    };
    return keyMap[objectType];
  }
}
