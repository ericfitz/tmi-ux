/**
 * Dashboard Component
 *
 * This component provides the main dashboard interface for threat model management and overview.
 * It displays threat model lists, collaboration sessions, and provides navigation to editing features.
 *
 * Key functionality:
 * - Displays comprehensive list of available threat models with search and filtering
 * - Shows active collaboration sessions with real-time updates
 * - Provides threat model creation, editing, and deletion capabilities
 * - Handles navigation to threat model editing and diagram creation workflows
 * - Manages threat model sharing and collaboration features
 * - Supports internationalization for multi-language threat model management
 * - Provides responsive design for various screen sizes and devices
 * - Implements role-based access control for threat model operations
 * - Shows threat model metadata and status information
 * - Supports bulk operations and batch processing for threat models
 */

import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Observable, Subject, Subscription } from 'rxjs';
import {
  take,
  map,
  filter,
  switchMap,
  debounceTime,
  distinctUntilChanged,
  takeUntil,
} from 'rxjs/operators';
import { MatPaginator, MatPaginatorIntl, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LanguageService } from '../../i18n/language.service';
import { ThreatModel } from '../tm/models/threat-model.model';
import { TMListItem } from '../tm/models/tm-list-item.model';
import { ThreatModelService, ThreatModelListParams } from '../tm/services/threat-model.service';
import { ThreatModelValidatorService } from '../tm/validation/threat-model-validator.service';
import {
  CollaborationSessionService,
  CollaborationSession,
} from '../../core/services/collaboration-session.service';
import { LoggerService } from '../../core/services/logger.service';
import { SvgCacheService } from '../tm/services/svg-cache.service';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  DeleteConfirmationDialogComponent,
  DeleteConfirmationDialogData,
  DeleteConfirmationDialogResult,
} from '@app/shared/components/delete-confirmation-dialog/delete-confirmation-dialog.component';
import {
  CreateThreatModelDialogComponent,
  CreateThreatModelDialogResult,
} from './create-threat-model-dialog/create-threat-model-dialog.component';
import { AuthService } from '../../auth/services/auth.service';
import { UserPreferencesService } from '../../core/services/user-preferences.service';
import { PaginatorIntlService } from '../../shared/services/paginator-intl.service';
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGINATION_QUERY_PARAMS,
} from '../../types/pagination.types';
import {
  calculateOffset,
  parsePaginationFromUrl,
  adjustPageAfterDeletion,
} from '../../shared/utils/pagination.util';
import { UserDisplayComponent } from '../../shared/components/user-display/user-display.component';
import { FieldOption, getFieldOptions } from '../../shared/utils/field-value-helpers';
import {
  DashboardFilters,
  computeDefaultFilters,
  createDefaultFilters,
  hasActiveFilters as hasActiveServerFilters,
  hasAdvancedFilters as hasAdvancedServerFilters,
} from './dashboard-filter.model';
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    MatDatepickerModule,
    MatNativeDateModule,
    TranslocoModule,
    UserDisplayComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MatPaginatorIntl, useClass: PaginatorIntlService }],
})
// SEM@e2fbc45e03d8471569c0ba4d4f2d8d25008f8a5d: list, filter, search, and manage threat models on the main dashboard
export class DashboardComponent implements OnInit, OnDestroy, AfterViewInit {
  threatModels: TMListItem[] = [];
  dataSource = new MatTableDataSource<TMListItem>([]);

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  // Pagination state
  pageIndex = 0;
  pageSize = DEFAULT_PAGE_SIZE;
  totalItems = 0;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  // View mode
  dashboardListView = false;
  displayedColumns: string[] = [
    'collaborationIndicator',
    'name',
    'lastModified',
    'status',
    'statusLastChanged',
    'owner',
    'created',
    'actions',
  ];

  // Client-side search (renamed from "filter")
  searchText = '';
  private searchChanged$ = new Subject<string>();

  // Server-side filters
  filters: DashboardFilters = createDefaultFilters();
  showAdvancedFilters = false;
  statusOptions: FieldOption[] = [];

  // Debounced subjects for server-side text filter inputs
  private nameFilterChanged$ = new Subject<string>();
  private descriptionFilterChanged$ = new Subject<string>();
  private ownerFilterChanged$ = new Subject<string>();
  private securityReviewerFilterChanged$ = new Subject<string>();
  private issueUriFilterChanged$ = new Subject<string>();

  private destroy$ = new Subject<void>();

  // Collaboration session mapping
  currentSessionMap = new Map<string, CollaborationSession[]>();
  expandedTmId: string | null = null;

  // Observable streams
  collaborationSessions$!: Observable<CollaborationSession[]>;

  // Loading state
  isLoadingThreatModels = true;
  isImporting = false;

  private subscription: Subscription | null = null;
  private languageSubscription: Subscription | null = null;
  private collaborationSessionsSubscription: Subscription | null = null;
  private currentLocale: string = 'en-US';

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: inject dashboard dependencies including router, services, and dialog (mutates shared state)
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private threatModelService: ThreatModelService,
    private validator: ThreatModelValidatorService,
    private languageService: LanguageService,
    private collaborationSessionService: CollaborationSessionService,
    private logger: LoggerService,
    private svgCacheService: SvgCacheService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
    private authService: AuthService,
    private userPreferencesService: UserPreferencesService,
  ) {}

  // SEM@e2fbc45e03d8471569c0ba4d4f2d8d25008f8a5d: initialize filters, subscriptions, and data load from URL params and user role (mutates shared state)
  ngOnInit(): void {
    // Load view preference from localStorage
    this.loadViewPreference();

    // Initialize status options for multi-select dropdown
    this.statusOptions = getFieldOptions('threatModels.status', this.transloco);

    // Clear SVG caches when initializing dashboard to ensure fresh start
    this.svgCacheService.clearAllCaches();

    // Subscribe to collaboration session polling since we need session data on dashboard
    this.collaborationSessionService.subscribeToSessionPolling();

    // Initialize observable streams
    this.collaborationSessions$ = this.collaborationSessionService.sessions$;

    // Build session-to-TM map and re-sort when sessions change
    this.collaborationSessionsSubscription = this.collaborationSessions$.subscribe(sessions => {
      this.currentSessionMap = new Map<string, CollaborationSession[]>();
      for (const session of sessions) {
        const existing = this.currentSessionMap.get(session.threatModelId) || [];
        existing.push(session);
        this.currentSessionMap.set(session.threatModelId, existing);
      }
      this.applyLocalSearch();
      this.cdr.detectChanges();
    });

    // Initialize pagination and filter state from URL query params
    this.route.queryParams.pipe(take(1)).subscribe(params => {
      const paginationState = parsePaginationFromUrl(params, DEFAULT_PAGE_SIZE);
      this.pageIndex = paginationState.pageIndex;
      this.pageSize = paginationState.pageSize;

      // Parse client-side search from URL
      this.searchText = (params[PAGINATION_QUERY_PARAMS.SEARCH] as string | undefined) || '';

      // Parse server-side filters from URL
      this.filters.name = (params[PAGINATION_QUERY_PARAMS.NAME] as string | undefined) || '';
      this.filters.description =
        (params[PAGINATION_QUERY_PARAMS.DESCRIPTION] as string | undefined) || '';
      this.filters.owner = (params[PAGINATION_QUERY_PARAMS.OWNER] as string | undefined) || '';
      this.filters.securityReviewer =
        (params[PAGINATION_QUERY_PARAMS.SECURITY_REVIEWER] as string | undefined) || '';
      this.filters.issueUri =
        (params[PAGINATION_QUERY_PARAMS.ISSUE_URI] as string | undefined) || '';
      const statusParam = params[PAGINATION_QUERY_PARAMS.STATUS] as string | undefined;
      this.filters.statuses = statusParam ? statusParam.split(',') : [];
      this.filters.createdAfter =
        (params[PAGINATION_QUERY_PARAMS.CREATED_AFTER] as string | undefined) || null;
      this.filters.createdBefore =
        (params[PAGINATION_QUERY_PARAMS.CREATED_BEFORE] as string | undefined) || null;
      this.filters.modifiedAfter =
        (params[PAGINATION_QUERY_PARAMS.MODIFIED_AFTER] as string | undefined) || null;
      this.filters.modifiedBefore =
        (params[PAGINATION_QUERY_PARAMS.MODIFIED_BEFORE] as string | undefined) || null;
      this.filters.statusUpdatedAfter =
        (params[PAGINATION_QUERY_PARAMS.STATUS_UPDATED_AFTER] as string | undefined) || null;
      this.filters.statusUpdatedBefore =
        (params[PAGINATION_QUERY_PARAMS.STATUS_UPDATED_BEFORE] as string | undefined) || null;

      // Apply role-based defaults on fresh visit (no filter/search params in URL).
      if (!this.hasAnyFilterOrSearchParam(params)) {
        this.applyRoleBasedDefaults();
      }

      // Auto-expand advanced filters if any are present in URL
      if (hasAdvancedServerFilters(this.filters, this.isSecurityReviewer)) {
        this.showAdvancedFilters = true;
      }

      this.loadData();
    });

    // Set up debounced client-side search
    this.searchChanged$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        this.searchText = value;
        this.applyLocalSearch();
        this.updateUrl();
        this.cdr.detectChanges();
      });

    // Set up debounced server-side text filter inputs
    this.setupDebouncedServerFilter(this.nameFilterChanged$, value => {
      this.filters.name = value;
    });
    this.setupDebouncedServerFilter(this.descriptionFilterChanged$, value => {
      this.filters.description = value;
    });
    this.setupDebouncedServerFilter(this.ownerFilterChanged$, value => {
      this.filters.owner = value;
    });
    this.setupDebouncedServerFilter(this.securityReviewerFilterChanged$, value => {
      this.filters.securityReviewer = value;
    });
    this.setupDebouncedServerFilter(this.issueUriFilterChanged$, value => {
      this.filters.issueUri = value;
    });

    // Subscribe to language changes to refresh date formatting
    this.languageSubscription = this.languageService.currentLanguage$.subscribe(language => {
      this.currentLocale = language.code;
      // Re-initialize status options with updated language
      this.statusOptions = getFieldOptions('threatModels.status', this.transloco);
      this.cdr.detectChanges();
    });
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: unsubscribe all subscriptions and stop collaboration session polling
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.subscription) {
      this.subscription.unsubscribe();
    }
    if (this.languageSubscription) {
      this.languageSubscription.unsubscribe();
    }
    if (this.collaborationSessionsSubscription) {
      this.collaborationSessionsSubscription.unsubscribe();
    }

    // Unsubscribe from collaboration session polling when leaving dashboard
    this.collaborationSessionService.unsubscribeFromSessionPolling();
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: wire sort and custom sort ordering that pins active-session threat models first
  ngAfterViewInit(): void {
    // Set up sorting after view is initialized
    this.dataSource.sort = this.sort;

    // Custom sorting accessor to handle nested properties and date columns
    this.dataSource.sortingDataAccessor = (item: TMListItem, property: string): string | number =>
      this._getSortValue(item, property);

    // Override sortData to always float active-session TMs to the top
    this.dataSource.sortData = (data: TMListItem[], sort: MatSort): TMListItem[] => {
      if (!sort.active || sort.direction === '') {
        return [...data].sort((a, b) => {
          const aHas = this.currentSessionMap.has(a.id) ? 0 : 1;
          const bHas = this.currentSessionMap.has(b.id) ? 0 : 1;
          return aHas - bHas;
        });
      }

      return [...data].sort((a, b) => {
        const aHas = this.currentSessionMap.has(a.id) ? 0 : 1;
        const bHas = this.currentSessionMap.has(b.id) ? 0 : 1;
        if (aHas !== bHas) return aHas - bHas;

        const aVal = this.dataSource.sortingDataAccessor(a, sort.active);
        const bVal = this.dataSource.sortingDataAccessor(b, sort.active);
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sort.direction === 'asc' ? cmp : -cmp;
      });
    };
  }

  // --- Search and filter handlers ---

  /** Handle client-side search input changes */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: dispatch debounced client-side search text change (mutates shared state)
  onSearchChange(value: string): void {
    this.searchChanged$.next(value);
  }

  /** Clear just the client-side search text */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: reset client-side search text and refresh the filtered list (mutates shared state)
  clearSearch(): void {
    this.searchText = '';
    this.applyLocalSearch();
    this.updateUrl();
    this.cdr.detectChanges();
  }

  /** Handle debounced server-side text filter input changes */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: dispatch a name filter value change to the debounced server filter stream (mutates shared state)
  onNameFilterChange(value: string): void {
    this.nameFilterChanged$.next(value);
  }

  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: dispatch a description filter value change to the debounced server filter stream (mutates shared state)
  onDescriptionFilterChange(value: string): void {
    this.descriptionFilterChanged$.next(value);
  }

  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: dispatch an owner filter value change to the debounced server filter stream (mutates shared state)
  onOwnerFilterChange(value: string): void {
    this.ownerFilterChanged$.next(value);
  }

  // SEM@4839694781b597b553d09d3892002a8098fcb0e5: dispatch a security reviewer filter value change to the debounced server filter stream (mutates shared state)
  onSecurityReviewerFilterChange(value: string): void {
    this.securityReviewerFilterChanged$.next(value);
  }

  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: dispatch an issue URI filter value change to the debounced server filter stream (mutates shared state)
  onIssueUriFilterChange(value: string): void {
    this.issueUriFilterChanged$.next(value);
  }

  /** Handle immediate server-side filter changes (dropdowns, date pickers) */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: handle an immediate server filter change by reloading the first page and syncing the URL (mutates shared state)
  onServerFilterChange(): void {
    this.pageIndex = 0;
    this.loadData();
    this.updateUrl();
  }

  /** Clear all server-side filters and client-side search */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: reset all filters and search text, reload the first page, and sync the URL (mutates shared state)
  clearAllFilters(): void {
    this.searchText = '';
    this.filters = createDefaultFilters();
    this.pageIndex = 0;
    this.loadData();
    this.updateUrl();
  }

  /** Whether any server-side filters are active */
  get hasActiveFilters(): boolean {
    return hasActiveServerFilters(this.filters);
  }

  /** Whether any advanced (non-primary) filters are active */
  get hasAdvancedFilters(): boolean {
    return hasAdvancedServerFilters(this.filters, this.isSecurityReviewer);
  }

  /** True if the current user is a security reviewer (drives primary-row layout). */
  get isSecurityReviewer(): boolean {
    return this.authService.isSecurityReviewer;
  }

  /** Whether any filter or search is active (for empty state) */
  get hasAnyFilterOrSearch(): boolean {
    return this.searchText.trim() !== '' || this.hasActiveFilters;
  }

  // --- Threat model operations ---

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: open a creation dialog and navigate to the new threat model on confirmation
  createThreatModel(): void {
    const dialogRef = this.dialog.open(CreateThreatModelDialogComponent, {
      width: '500px',
      maxWidth: '90vw',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: CreateThreatModelDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.authService.userProfile$
          .pipe(
            filter(profile => profile !== null),
            take(1),
            switchMap(() =>
              this.threatModelService.createThreatModel(
                result.name,
                result.description,
                result.framework,
                undefined,
                result.isConfidential,
              ),
            ),
          )
          .subscribe(model => {
            void this.router.navigate(['/tm', model.id]);
          });
      });
  }

  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: navigate to the threat model editor for a given threat model ID
  openThreatModel(id: string): void {
    void this.router.navigate(['/tm', id]);
  }

  /**
   * Format a date according to the current locale
   */
  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: format a date string as a locale-aware date, returning an em dash for null (pure)
  formatDate(date: string | null | undefined): string {
    if (!date) {
      return '—';
    }

    const dateObj = new Date(date);

    if (isNaN(dateObj.getTime())) {
      this.logger.warn('Invalid date provided to formatDate', { date });
      return '—';
    }

    return new Intl.DateTimeFormat(this.currentLocale, {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).format(dateObj);
  }

  /**
   * Format session start time as a relative time string
   */
  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: format a session start time as a human-readable relative or absolute time (pure)
  formatSessionTime(startedAt: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - startedAt.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) {
      return this.transloco.translate('collaboration.justNow');
    } else if (diffMinutes < 60) {
      return this.formatRelativeTime(-diffMinutes, 'minute');
    } else if (diffHours < 24) {
      return this.formatRelativeTime(-diffHours, 'hour');
    } else {
      return new Intl.DateTimeFormat(this.currentLocale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(startedAt);
    }
  }

  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: format a numeric time offset as a locale-aware relative time string (pure)
  private formatRelativeTime(value: number, unit: 'minute' | 'hour'): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
        const rtf = new Intl.RelativeTimeFormat(this.currentLocale, {
          numeric: 'auto',
          style: 'long',
        });
        return rtf.format(value, unit);
      }
    } catch {
      // Fallback if RelativeTimeFormat fails
    }

    const absValue = Math.abs(value);
    const unitText = unit === 'minute' ? 'minute' : 'hour';
    const pluralSuffix = absValue === 1 ? '' : 's';
    return `${absValue} ${unitText}${pluralSuffix} ago`;
  }

  // SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: confirm and delete a threat model, adjusting pagination and reloading the list
  deleteThreatModel(id: string, event: MouseEvent): void {
    event.stopPropagation();

    const threatModel = this.threatModels.find(tm => tm.id === id);
    if (!threatModel) {
      this.logger.error('Threat model not found for deletion', { id });
      return;
    }

    const dialogData: DeleteConfirmationDialogData = {
      id: threatModel.id,
      name: threatModel.name,
      objectType: 'threatModel',
    };

    const dialogRef = this.dialog.open(DeleteConfirmationDialogComponent, {
      width: '700px',
      data: dialogData,
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result: DeleteConfirmationDialogResult | undefined) => {
      if (result?.confirmed) {
        this.threatModelService.deleteThreatModel(id).subscribe({
          next: success => {
            if (success) {
              this.snackBar.open(
                this.transloco.translate('threatModels.deleteSuccess', {
                  name: threatModel.name,
                }),
                this.transloco.translate('common.close'),
                { duration: 3000 },
              );

              const itemsOnPageAfterDelete = this.threatModels.length - 1;
              const newTotal = this.totalItems - 1;
              this.pageIndex = adjustPageAfterDeletion(
                this.pageIndex,
                itemsOnPageAfterDelete,
                newTotal,
              );

              this.loadData();
              this.updateUrl();
            }
          },
          error: error => {
            this.logger.error('Error deleting threat model', error);
            this.snackBar.open(
              this.transloco.translate('threatModels.deleteError', {
                error: getErrorMessage(error),
              }),
              this.transloco.translate('common.close'),
              { duration: 5000 },
            );
          },
        });
      }
    });
  }

  // SEM@58199797d1f701be76b302f0560d7259f90f6825: return active collaboration sessions for a given threat model (pure)
  getSessionsForTm(tmId: string): CollaborationSession[] {
    return this.currentSessionMap.get(tmId) || [];
  }

  // SEM@58199797d1f701be76b302f0560d7259f90f6825: return whether a threat model has any active collaboration sessions (pure)
  hasActiveSessions(tmId: string): boolean {
    return this.currentSessionMap.has(tmId);
  }

  // SEM@58199797d1f701be76b302f0560d7259f90f6825: toggle expanded row state for a threat model in the list (mutates shared state)
  toggleRowExpansion(tmId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expandedTmId = this.expandedTmId === tmId ? null : tmId;
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: reload the current page of threat models from the server
  refreshThreatModels(): void {
    this.loadData();
  }

  // --- Private helpers ---

  /**
   * True if the URL query params contain any filter or search value.
   * Pagination params (PAGE, SIZE) do NOT count — only filter/search presence
   * determines whether defaults apply on fresh visit.
   */
  // SEM@81a32062eea63fd38be41293a7faaafddd14eef1: return whether URL query params contain any filter or search value, excluding pagination (pure)
  private hasAnyFilterOrSearchParam(params: Params): boolean {
    const keys = [
      PAGINATION_QUERY_PARAMS.SEARCH,
      PAGINATION_QUERY_PARAMS.NAME,
      PAGINATION_QUERY_PARAMS.DESCRIPTION,
      PAGINATION_QUERY_PARAMS.OWNER,
      PAGINATION_QUERY_PARAMS.SECURITY_REVIEWER,
      PAGINATION_QUERY_PARAMS.ISSUE_URI,
      PAGINATION_QUERY_PARAMS.STATUS,
      PAGINATION_QUERY_PARAMS.CREATED_AFTER,
      PAGINATION_QUERY_PARAMS.CREATED_BEFORE,
      PAGINATION_QUERY_PARAMS.MODIFIED_AFTER,
      PAGINATION_QUERY_PARAMS.MODIFIED_BEFORE,
      PAGINATION_QUERY_PARAMS.STATUS_UPDATED_AFTER,
      PAGINATION_QUERY_PARAMS.STATUS_UPDATED_BEFORE,
    ];
    return keys.some(k => typeof params[k] === 'string' && params[k].length > 0);
  }

  /**
   * Apply role-based default filters and push them into the URL so refresh is stable.
   * No-op if the user profile is not yet available.
   */
  // SEM@4839694781b597b553d09d3892002a8098fcb0e5: set default filters based on the current user's role and sync to the URL (mutates shared state)
  private applyRoleBasedDefaults(): void {
    const userEmail = this.authService.userEmail;
    if (!userEmail) {
      return;
    }
    this.filters = computeDefaultFilters(userEmail, this.authService.isSecurityReviewer);
    this.updateUrl();
  }

  // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: extract a sortable scalar value from a threat model list item for a given column (pure)
  private _getSortValue(item: TMListItem, property: string): string | number {
    // SEM@618b8d0249e05a55c21a5669e27afa77b21d0145: convert a nullable date string to a numeric timestamp for sorting (pure)
    const dateAccessor = (field: string | null | undefined): number =>
      field ? new Date(field).getTime() : 0;

    const accessors: Record<string, () => string | number> = {
      name: () => item.name?.toLowerCase() || '',
      description: () => item.description?.toLowerCase() || '',
      lastModified: () => dateAccessor(item.modified_at),
      status: () => item.status?.toLowerCase() || '',
      statusLastChanged: () => dateAccessor(item.status_updated),
      owner: () =>
        item.owner?.display_name?.toLowerCase() || item.owner?.email?.toLowerCase() || '',
      created: () => dateAccessor(item.created_at),
    };

    return accessors[property]?.() ?? '';
  }

  /**
   * Set up a debounced subscription for a server-side text filter input.
   */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: subscribe a subject to debounced server filter updates, reloading data and syncing URL on change (mutates shared state)
  private setupDebouncedServerFilter(
    subject: Subject<string>,
    setter: (value: string) => void,
  ): void {
    subject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        setter(value);
        this.pageIndex = 0;
        this.loadData();
        this.updateUrl();
      });
  }

  /**
   * Load threat models data with pagination and server-side filters.
   */
  // SEM@4839694781b597b553d09d3892002a8098fcb0e5: fetch a paginated, filtered page of threat models from the server and update component state
  private loadData(): void {
    this.isLoadingThreatModels = true;
    this.cdr.detectChanges();

    const offset = calculateOffset(this.pageIndex, this.pageSize);

    const params: ThreatModelListParams = {
      limit: this.pageSize,
      offset,
    };

    // Map server-side filters to API params
    if (this.filters.name.trim()) params.name = this.filters.name.trim();
    if (this.filters.description.trim()) params.description = this.filters.description.trim();
    if (this.filters.owner.trim()) params.owner = this.filters.owner.trim();
    if (this.filters.securityReviewer.trim())
      params.security_reviewer = this.filters.securityReviewer.trim();
    if (this.filters.issueUri.trim()) params.issue_uri = this.filters.issueUri.trim();
    if (this.filters.statuses.length > 0) params.status = this.filters.statuses.join(',');
    if (this.filters.createdAfter) params.created_after = this.filters.createdAfter;
    if (this.filters.createdBefore) params.created_before = this.filters.createdBefore;
    if (this.filters.modifiedAfter) params.modified_after = this.filters.modifiedAfter;
    if (this.filters.modifiedBefore) params.modified_before = this.filters.modifiedBefore;
    if (this.filters.statusUpdatedAfter)
      params.status_updated_after = this.filters.statusUpdatedAfter;
    if (this.filters.statusUpdatedBefore)
      params.status_updated_before = this.filters.statusUpdatedBefore;

    this.threatModelService.fetchThreatModels(params).subscribe(response => {
      this.threatModels = response.threat_models || [];
      this.totalItems = response.total;
      this.applyLocalSearch();
      this.isLoadingThreatModels = false;
      this.cdr.detectChanges();
    });
  }

  // SEM@c6d9d4bbcb88860a9e3f045f032a755e2782182a: handle pagination change by updating page state, reloading data, and syncing the URL (mutates shared state)
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadData();
    this.updateUrl();
  }

  /**
   * Update URL query parameters to reflect current pagination, search, and filter state.
   * Only includes non-default values to keep URLs clean.
   */
  // SEM@4839694781b597b553d09d3892002a8098fcb0e5: sync current pagination, search, and filter state into the URL query parameters (mutates shared state)
  private updateUrl(): void {
    const queryParams: Params = {};

    // Pagination
    if (this.pageIndex > 0) {
      queryParams[PAGINATION_QUERY_PARAMS.PAGE] = String(this.pageIndex);
    }
    if (this.pageSize !== DEFAULT_PAGE_SIZE) {
      queryParams[PAGINATION_QUERY_PARAMS.SIZE] = String(this.pageSize);
    }

    // Client-side search
    if (this.searchText.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.SEARCH] = this.searchText.trim();
    }

    // Server-side filters
    if (this.filters.name.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.NAME] = this.filters.name.trim();
    }
    if (this.filters.description.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.DESCRIPTION] = this.filters.description.trim();
    }
    if (this.filters.owner.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.OWNER] = this.filters.owner.trim();
    }
    if (this.filters.securityReviewer.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.SECURITY_REVIEWER] = this.filters.securityReviewer.trim();
    }
    if (this.filters.issueUri.trim()) {
      queryParams[PAGINATION_QUERY_PARAMS.ISSUE_URI] = this.filters.issueUri.trim();
    }
    if (this.filters.statuses.length > 0) {
      queryParams[PAGINATION_QUERY_PARAMS.STATUS] = this.filters.statuses.join(',');
    }
    if (this.filters.createdAfter) {
      queryParams[PAGINATION_QUERY_PARAMS.CREATED_AFTER] = this.filters.createdAfter;
    }
    if (this.filters.createdBefore) {
      queryParams[PAGINATION_QUERY_PARAMS.CREATED_BEFORE] = this.filters.createdBefore;
    }
    if (this.filters.modifiedAfter) {
      queryParams[PAGINATION_QUERY_PARAMS.MODIFIED_AFTER] = this.filters.modifiedAfter;
    }
    if (this.filters.modifiedBefore) {
      queryParams[PAGINATION_QUERY_PARAMS.MODIFIED_BEFORE] = this.filters.modifiedBefore;
    }
    if (this.filters.statusUpdatedAfter) {
      queryParams[PAGINATION_QUERY_PARAMS.STATUS_UPDATED_AFTER] = this.filters.statusUpdatedAfter;
    }
    if (this.filters.statusUpdatedBefore) {
      queryParams[PAGINATION_QUERY_PARAMS.STATUS_UPDATED_BEFORE] = this.filters.statusUpdatedBefore;
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: '',
      replaceUrl: true,
    });
  }

  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: navigate to a diagram's collaboration session by diagram ID
  openCollaborationSession(diagramId: string): void {
    this.collaborationSessions$
      .pipe(
        take(1),
        map(sessions => sessions.find(session => session.diagramId === diagramId)),
      )
      .subscribe(session => {
        if (!session) {
          this.logger.error('Collaboration session not found', { diagramId });
          return;
        }

        void this.router.navigate(['/tm', session.threatModelId, 'dfd', diagramId], {
          queryParams: {
            joinCollaboration: 'true',
          },
        });
      });
  }

  // SEM@0bcd08b2b9d7e58cab0d45d983d79c4a0aebe381: prompt user to select a JSON file and import a threat model
  async import(): Promise<void> {
    try {
      let fileHandle: FileSystemFileHandle;
      let file: File;

      if ('showOpenFilePicker' in window) {
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'JSON files',
              accept: {
                'application/json': ['.json'],
              },
            },
          ],
          excludeAcceptAllOption: false,
        });

        fileHandle = handle;
        file = await fileHandle.getFile();
      } else {
        file = await this.selectFileViaInput();
      }

      // Reject oversized files to prevent memory exhaustion
      const MAX_IMPORT_SIZE = 10 * 1024 * 1024; // 10 MB
      if (file.size > MAX_IMPORT_SIZE) {
        this.showError(this.transloco.translate('threatModels.fileSizeExceeded', { maxSize: 10 }));
        return;
      }

      const content = await file.text();
      const threatModelData = JSON.parse(content) as Record<string, unknown>;

      await this.importThreatModel(threatModelData);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      this.logger.error('Failed to load threat model from file', error);
    }
  }

  // SEM@32d7e22c36935dfe9252dabace7cd08023f1173d: fetch a user-selected JSON file via a hidden file input element (pure)
  private selectFileViaInput(): Promise<File> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';

      input.onchange = event => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('No file selected'));
        }
      };

      input.oncancel = () => {
        reject(new DOMException('User cancelled file selection', 'AbortError'));
      };

      input.click();
    });
  }

  // SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: validate and store a threat model payload, then navigate to it (reads DB)
  private async importThreatModel(data: Record<string, unknown>): Promise<void> {
    this.isImporting = true;
    try {
      if (typeof data['id'] !== 'string' || typeof data['name'] !== 'string') {
        this.showError(this.transloco.translate('threatModels.importFormatError'));
        return;
      }

      const validationResult = this.validator.validate(data as unknown as ThreatModel);
      if (!validationResult.valid) {
        this.logger.error('Threat model validation failed', validationResult.errors);
        this.showError(
          this.transloco.translate('threatModels.importValidationError', {
            errors: validationResult.errors.map(e => e.message).join(', '),
          }),
        );
        return;
      }

      if (validationResult.warnings.length > 0) {
        this.logger.warn('Threat model has validation warnings', validationResult.warnings);
      }

      const result = await this.threatModelService
        .importThreatModel(data as Partial<ThreatModel> & { id: string; name: string })
        .toPromise();

      if (result) {
        this.navigateToImportedModel(result.model);
      }
    } catch (error) {
      this.logger.error('Failed to import threat model', error);
      this.showError(
        this.transloco.translate('threatModels.importError', {
          error: getErrorMessage(error),
        }),
      );
    } finally {
      this.isImporting = false;
    }
  }

  // SEM@0bcd08b2b9d7e58cab0d45d983d79c4a0aebe381: notify the user of import success and route to the new threat model
  private navigateToImportedModel(model: ThreatModel): void {
    this.snackBar.open(
      this.transloco.translate('threatModels.importSuccess', { name: model.name }),
      this.transloco.translate('common.close'),
      { duration: 3000 },
    );

    void this.router.navigate(['/tm', model.id]);
  }

  // SEM@0bcd08b2b9d7e58cab0d45d983d79c4a0aebe381: display an error message to the user via snack bar
  private showError(message: string): void {
    this.snackBar.open(message, this.transloco.translate('common.close'), {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: fetch the saved dashboard view preference and apply it (reads DB)
  private loadViewPreference(): void {
    const prefs = this.userPreferencesService.getPreferences();
    this.dashboardListView = prefs.dashboardListView;
  }

  // SEM@475447f9dd60d5ee2995b4b85ea1a4cf4d3972b7: toggle between list and grid view, persisting the preference (mutates shared state)
  toggleViewMode(): void {
    this.dashboardListView = !this.dashboardListView;

    this.userPreferencesService.updatePreferences({
      dashboardListView: this.dashboardListView,
    });

    this.cdr.detectChanges();
  }

  /**
   * Apply client-side search and collaboration-session-first sorting.
   * This operates on the already-fetched (server-filtered) threat models.
   */
  // SEM@2878e13b8ddba5a0430504d19654a3570f619a6c: filter and sort threat models by search text, active sessions first (mutates shared state)
  private applyLocalSearch(): void {
    const search = this.searchText.toLowerCase().trim();
    let filtered: TMListItem[];

    if (!search) {
      filtered = [...this.threatModels];
    } else {
      filtered = this.threatModels.filter(
        tm =>
          tm.name?.toLowerCase().includes(search) ||
          tm.description?.toLowerCase().includes(search) ||
          tm.owner?.display_name?.toLowerCase().includes(search) ||
          tm.owner?.email?.toLowerCase().includes(search) ||
          tm.status?.toLowerCase().includes(search),
      );
    }

    // Sort: TMs with active sessions first, preserving relative order within groups
    filtered.sort((a, b) => {
      const aHasSession = this.currentSessionMap.has(a.id) ? 0 : 1;
      const bHasSession = this.currentSessionMap.has(b.id) ? 0 : 1;
      return aHasSession - bHasSession;
    });

    this.dataSource.data = filtered;
  }

  /** Get filtered threat models for card view */
  get filteredThreatModels(): TMListItem[] {
    return this.dataSource.data;
  }
}
