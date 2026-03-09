import { Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatPaginator, MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { PaginatorIntlService } from '@app/shared/services/paginator-intl.service';
import { LoggerService } from '@app/core/services/logger.service';
import { Language, LanguageService } from '@app/i18n/language.service';
import { ThreatModelAuthorizationService } from '../../services/threat-model-authorization.service';
import { AuditTrailService } from '../../services/audit-trail.service';
import {
  AuditChangeType,
  AuditEntry,
  AuditObjectType,
  AuditTrailListParams,
} from '../../models/audit-trail.model';
import { ThreatModel } from '../../models/threat-model.model';
import {
  RollbackConfirmationDialogComponent,
  RollbackConfirmationDialogData,
  RollbackConfirmationDialogResult,
} from '@app/shared/components/rollback-confirmation-dialog/rollback-confirmation-dialog.component';

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
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './audit-trail-page.component.html',
  styleUrls: ['./audit-trail-page.component.scss'],
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
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
  filterActorEmail = '';

  // Entity-scoped mode (when navigating from a sub-entity row)
  entityType: AuditObjectType | null = null;
  entityId: string | null = null;
  entityName: string | null = null;

  // Permissions
  canWrite = false;

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
    'rollback',
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private auditTrailService: AuditTrailService,
    private authorizationService: ThreatModelAuthorizationService,
    private languageService: LanguageService,
    private transloco: TranslocoService,
    private logger: LoggerService,
    private destroyRef: DestroyRef,
  ) {}

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

    // Permissions
    this.canWrite = this.authorizationService.canEdit();

    // Locale
    this.languageService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((language: Language) => {
        this.currentLocale = language.code;
      });

    this.loadEntries();
  }

  loadEntries(): void {
    if (!this.threatModel) return;

    this.loading = true;
    const params: AuditTrailListParams = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
    };

    if (this.filterObjectType) params.object_type = this.filterObjectType;
    if (this.filterChangeType) params.change_type = this.filterChangeType;
    if (this.filterActorEmail.trim()) params.actor_email = this.filterActorEmail.trim();

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

  onPageChange(event: { pageIndex: number; pageSize: number }): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }

  applyFilters(): void {
    this.pageIndex = 0;
    if (this.paginator) {
      this.paginator.pageIndex = 0;
    }
    this.loadEntries();
  }

  clearFilters(): void {
    this.filterObjectType = this.entityType || '';
    this.filterChangeType = '';
    this.filterActorEmail = '';
    this.applyFilters();
  }

  /** Format timestamp as relative or absolute depending on age */
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

  /** Check if an entry is eligible for rollback */
  canRollback(entry: AuditEntry): boolean {
    return this.canWrite && entry.version !== null;
  }

  /** Initiate rollback with confirmation dialog */
  onRollback(entry: AuditEntry): void {
    if (!this.threatModel || !this.canRollback(entry)) return;

    const dialogData: RollbackConfirmationDialogData = {
      entityName: entry.change_summary || entry.object_id,
      objectType: entry.object_type,
      version: entry.version!,
      changeSummary: entry.change_summary,
      timestamp: entry.created_at,
    };

    const dialogRef = this.dialog.open(RollbackConfirmationDialogComponent, {
      width: '500px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: RollbackConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.executeRollback(entry);
      }
    });
  }

  /** Navigate back to the threat model editor */
  goBack(): void {
    if (this.threatModel) {
      void this.router.navigate(['/tm', this.threatModel.id]);
    }
  }

  /** Get the translation key for an object type */
  getObjectTypeKey(objectType: AuditObjectType): string {
    return `common.objectTypes.${this.objectTypeToKey(objectType)}`;
  }

  /** Get the translation key for a change type */
  getChangeTypeKey(changeType: AuditChangeType): string {
    return `auditTrail.changeTypes.${changeType}`;
  }

  private executeRollback(entry: AuditEntry): void {
    if (!this.threatModel) return;

    this.auditTrailService
      .rollback(this.threatModel.id, entry.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open(
            this.transloco.translate('auditTrail.rollback.success'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
          this.loadEntries();
        },
        error: (error: { status?: number }) => {
          const message =
            error?.status === 410
              ? this.transloco.translate('auditTrail.rollback.versionPruned')
              : this.transloco.translate('auditTrail.rollback.error');
          this.snackBar.open(message, this.transloco.translate('common.close'), {
            duration: 5000,
          });
          this.logger.error('Rollback failed', error);
        },
      });
  }

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
