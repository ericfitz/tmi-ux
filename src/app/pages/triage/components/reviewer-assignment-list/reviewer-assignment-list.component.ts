import {
  Component,
  OnInit,
  OnDestroy,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { UserPickerDialogComponent } from '@app/shared/components/user-picker-dialog/user-picker-dialog.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import {
  SecurityReviewerService,
  SecurityReviewerResult,
} from '@app/shared/services/security-reviewer.service';
import {
  ThreatModelService,
  ThreatModelListParams,
} from '../../../tm/services/threat-model.service';
import { TMListItem } from '../../../tm/models/tm-list-item.model';
import { User } from '../../../tm/models/threat-model.model';
import { AdminUser } from '@app/types/user.types';
import { getFieldKeysForFieldType, getFieldLabel } from '@app/shared/utils/field-value-helpers';

interface ReviewerFilters {
  searchTerm: string;
  /** 'all' or a specific status key */
  status: string;
  unassigned: boolean;
  securityReviewer: string;
  owner: string;
  createdAfter: string | null;
  createdBefore: string | null;
  modifiedAfter: string | null;
  modifiedBefore: string | null;
}

/**
 * Component for displaying and assigning security reviewers to unassigned threat models.
 * Shows threat models where status != 'closed' and security_reviewer is null.
 */
@Component({
  selector: 'app-reviewer-assignment-list',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...ALL_MATERIAL_IMPORTS,
    TranslocoModule,
    UserDisplayComponent,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './reviewer-assignment-list.component.html',
  styleUrl: './reviewer-assignment-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
  animations: [
    trigger('detailExpand', [
      state('void', style({ height: '0', opacity: '0', overflow: 'hidden' })),
      state('*', style({ height: '*', opacity: '1' })),
      transition('void <=> *', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})
export class ReviewerAssignmentListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Emits the count of unassigned threat models for the parent tab badge */
  @Output() countChange = new EventEmitter<number>();

  /** Table data source */
  dataSource = new MatTableDataSource<TMListItem>([]);

  /** Displayed columns */
  displayedColumns = ['name', 'owner', 'status', 'created_at', 'reviewer_select', 'actions'];

  /** Security reviewer options */
  reviewerMode: 'dropdown' | 'picker' | 'loading' = 'loading';
  reviewerOptions: User[] = [];

  /** Per-row reviewer selection */
  selectedReviewers = new Map<string, User | null>();

  /** Pagination (server-side) */
  totalUnassigned = 0;
  pageSize = 25;
  pageIndex = 0;

  /** Loading state */
  isLoading = false;

  /** Set of TM IDs currently being assigned */
  isAssigning = new Set<string>();

  /** Error message */
  error: string | null = null;

  /** Bound compareReviewers for mat-select */
  compareReviewers: (a: User | null, b: User | null) => boolean;

  /** Filter state */
  filters: ReviewerFilters = {
    searchTerm: '',
    status: 'all',
    unassigned: true,
    securityReviewer: '',
    owner: '',
    createdAfter: null,
    createdBefore: null,
    modifiedAfter: null,
    modifiedBefore: null,
  };

  /** Status filter options */
  filterStatusOptions: { value: string; label: string }[] = [];

  /** Advanced filters visibility */
  showAdvancedFilters = false;

  /** Debounced subjects for text inputs */
  private searchChanged$ = new Subject<string>();
  private securityReviewerChanged$ = new Subject<string>();
  private ownerChanged$ = new Subject<string>();

  constructor(
    private router: Router,
    private threatModelService: ThreatModelService,
    private securityReviewerService: SecurityReviewerService,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {
    this.compareReviewers = (a, b) => this.securityReviewerService.compareReviewers(a, b);
  }

  ngOnInit(): void {
    // Build status filter options
    const statuses = getFieldKeysForFieldType('threatModels.status').filter(s => s !== 'closed');
    this.filterStatusOptions = [
      { value: 'all', label: this.transloco.translate('common.allStatuses') },
      ...statuses.map(s => ({
        value: s,
        label: getFieldLabel(s, 'threatModels.status', this.transloco),
      })),
    ];

    // Set up debounced text filters
    this.setupDebouncedFilter(this.searchChanged$, value => {
      this.filters.searchTerm = value;
    });
    this.setupDebouncedFilter(this.securityReviewerChanged$, value => {
      this.filters.securityReviewer = value;
    });
    this.setupDebouncedFilter(this.ownerChanged$, value => {
      this.filters.owner = value;
    });

    this.loadReviewerOptions();
    this.loadThreatModels();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load security reviewer dropdown options via shared service.
   */
  private loadReviewerOptions(): void {
    this.securityReviewerService
      .loadReviewerOptions()
      .pipe(takeUntil(this.destroy$))
      .subscribe((result: SecurityReviewerResult) => {
        if (result.mode === 'dropdown') {
          this.reviewerOptions = result.reviewers;
          this.reviewerMode = 'dropdown';
        } else {
          this.reviewerMode = 'picker';
        }
        this.cdr.detectChanges();
      });
  }

  private setupDebouncedFilter(subject: Subject<string>, setter: (value: string) => void): void {
    subject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(value => {
        setter(value);
        this.pageIndex = 0;
        this.loadThreatModels();
      });
  }

  /**
   * Load threat models from the server using current filter state.
   */
  loadThreatModels(): void {
    this.isLoading = true;
    this.error = null;

    const nonClosedStatuses = getFieldKeysForFieldType('threatModels.status')
      .filter(s => s !== 'closed')
      .join(',');

    const params: ThreatModelListParams = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
      status: this.filters.status === 'all' ? nonClosedStatuses : this.filters.status,
    };

    if (this.filters.searchTerm.trim()) {
      params.name = this.filters.searchTerm.trim();
    }

    if (this.filters.unassigned) {
      params.security_reviewer = 'is:null';
    } else if (this.filters.securityReviewer.trim()) {
      params.security_reviewer = this.filters.securityReviewer.trim();
    }

    if (this.filters.owner.trim()) {
      params.owner = this.filters.owner.trim();
    }

    if (this.filters.createdAfter) params.created_after = this.filters.createdAfter;
    if (this.filters.createdBefore) params.created_before = this.filters.createdBefore;
    if (this.filters.modifiedAfter) params.modified_after = this.filters.modifiedAfter;
    if (this.filters.modifiedBefore) params.modified_before = this.filters.modifiedBefore;

    this.threatModelService
      .fetchThreatModels(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.dataSource.data = response.threat_models;
          this.totalUnassigned = response.total;
          this.countChange.emit(this.totalUnassigned);
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: err => {
          this.isLoading = false;
          this.error = this.transloco.translate('triage.reviewerAssignment.errorLoading');
          this.logger.error('Failed to load threat models', err);
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Handle search text input changes (debounced).
   */
  onSearchChange(value: string): void {
    this.searchChanged$.next(value);
  }

  /**
   * Handle security reviewer filter text changes (debounced).
   */
  onSecurityReviewerChange(value: string): void {
    this.securityReviewerChanged$.next(value);
  }

  /**
   * Handle owner filter text changes (debounced).
   */
  onOwnerChange(value: string): void {
    this.ownerChanged$.next(value);
  }

  /**
   * Handle immediate filter changes (e.g., select, checkbox).
   */
  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadThreatModels();
  }

  /**
   * Handle unassigned checkbox change.
   */
  onUnassignedChange(checked: boolean): void {
    this.filters.unassigned = checked;
    if (checked) {
      this.filters.securityReviewer = '';
    }
    this.onFilterChange();
  }

  /**
   * Clear all filters and reload.
   */
  clearFilters(): void {
    this.filters = {
      searchTerm: '',
      status: 'all',
      unassigned: true,
      securityReviewer: '',
      owner: '',
      createdAfter: null,
      createdBefore: null,
      modifiedAfter: null,
      modifiedBefore: null,
    };
    this.showAdvancedFilters = false;
    this.pageIndex = 0;
    this.loadThreatModels();
  }

  /** True when any filter deviates from its default value */
  get hasActiveFilters(): boolean {
    return (
      this.filters.searchTerm !== '' ||
      this.filters.status !== 'all' ||
      !this.filters.unassigned ||
      this.filters.securityReviewer !== '' ||
      this.filters.owner !== '' ||
      this.filters.createdAfter !== null ||
      this.filters.createdBefore !== null ||
      this.filters.modifiedAfter !== null ||
      this.filters.modifiedBefore !== null
    );
  }

  /** True when any advanced filter has a value */
  get hasAdvancedFilters(): boolean {
    return (
      this.filters.owner !== '' ||
      this.filters.createdAfter !== null ||
      this.filters.createdBefore !== null ||
      this.filters.modifiedAfter !== null ||
      this.filters.modifiedBefore !== null
    );
  }

  /**
   * Handle page change.
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadThreatModels();
  }

  /**
   * Handle reviewer selection from dropdown for a specific row.
   */
  onReviewerSelected(tmId: string, reviewer: User | null): void {
    this.selectedReviewers.set(tmId, reviewer);
  }

  /**
   * Open user picker dialog for a specific row (picker mode fallback).
   */
  openReviewerPicker(tmId: string): void {
    const dialogRef = this.dialog.open(UserPickerDialogComponent, {
      data: {
        title: this.transloco.translate('triage.reviewerAssignment.selectReviewer'),
      },
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((selectedAdminUser: AdminUser | undefined) => {
        if (selectedAdminUser) {
          const user: User = {
            principal_type: 'user',
            provider: selectedAdminUser.provider,
            provider_id: selectedAdminUser.provider_user_id,
            email: selectedAdminUser.email,
            display_name: selectedAdminUser.name,
          };
          this.selectedReviewers.set(tmId, user);
          this.cdr.detectChanges();
        }
      });
  }

  /**
   * Assign the selected reviewer to a threat model.
   */
  assignReviewer(tmId: string, reviewer: User): void {
    this.isAssigning.add(tmId);
    this.cdr.detectChanges();

    this.threatModelService
      .patchThreatModel(tmId, { security_reviewer: reviewer })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isAssigning.delete(tmId);
          this.selectedReviewers.delete(tmId);
          this.loadThreatModels();
          this.cdr.detectChanges();
        },
        error: err => {
          this.isAssigning.delete(tmId);
          this.logger.error('Failed to assign reviewer', err);
          this.cdr.detectChanges();
        },
      });
  }

  /**
   * Assign the current user as reviewer ("Assign to Me").
   */
  assignToMe(tmId: string): void {
    const me = this.securityReviewerService.getCurrentUserAsReviewer();
    if (me) {
      this.assignReviewer(tmId, me);
    }
  }

  /**
   * Navigate to threat model detail/edit page.
   */
  viewThreatModel(tm: TMListItem): void {
    void this.router.navigate(['/tm', tm.id]);
  }

  /**
   * Get a localized label for a threat model status value.
   */
  getStatusLabel(status: string | null | undefined): string {
    if (!status) return '';
    return getFieldLabel(status, 'threatModels.status', this.transloco);
  }

  /**
   * Get CSS class for a threat model status chip.
   */
  getStatusClass(status: string | null | undefined): string {
    if (!status) return '';
    return `status-${status}`;
  }

  /**
   * Get the display text for a selected reviewer in picker mode.
   */
  getSelectedReviewerDisplay(tmId: string): string | null {
    const reviewer = this.selectedReviewers.get(tmId);
    if (!reviewer) return null;
    return reviewer.display_name || reviewer.email;
  }
}
