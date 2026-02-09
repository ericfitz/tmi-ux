import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyResponseService } from '../../../surveys/services/survey-response.service';
import { SurveyService } from '../../../surveys/services/survey.service';
import {
  SurveyResponseListItem,
  SurveyListItem,
  ResponseStatus,
  SurveyResponseFilter,
} from '@app/types/survey.types';

/**
 * Filter state for triage list
 */
interface TriageFilters {
  status: ResponseStatus | 'all';
  surveyId: string | null;
  searchTerm: string;
}

/**
 * Triage list component for viewing and managing all survey responses
 * Used by triage team to review and process responses
 */
@Component({
  selector: 'app-triage-list',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule, UserDisplayComponent],
  templateUrl: './triage-list.component.html',
  styleUrl: './triage-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TriageListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /** Table data source */
  dataSource = new MatTableDataSource<SurveyResponseListItem>([]);

  /** Selection model for bulk actions */
  selection = new SelectionModel<SurveyResponseListItem>(true, []);

  /** Displayed columns */
  displayedColumns = ['select', 'submitter', 'template', 'submitted_at', 'status', 'actions'];

  /** Available templates for filtering */
  surveys: SurveyListItem[] = [];

  /** Current filters */
  filters: TriageFilters = {
    status: 'all',
    surveyId: null,
    searchTerm: '',
  };

  /** Status options for filtering */
  statusOptions: { value: ResponseStatus | 'all'; labelKey: string }[] = [
    { value: 'all', labelKey: 'common.allStatuses' },
    { value: 'submitted', labelKey: 'surveys.status.submitted' },
    { value: 'needs_revision', labelKey: 'surveys.status.needsRevision' },
    { value: 'ready_for_review', labelKey: 'surveys.status.readyForReview' },
    { value: 'review_created', labelKey: 'surveys.status.reviewCreated' },
    { value: 'draft', labelKey: 'surveys.status.draft' },
  ];

  /** Pagination settings */
  totalResponses = 0;
  pageSize = 25;
  pageIndex = 0;

  /** Loading state */
  isLoading = false;

  /** Error message */
  error: string | null = null;

  constructor(
    private router: Router,
    private responseService: SurveyResponseService,
    private surveyService: SurveyService,
    private logger: LoggerService,
    private transloco: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.loadSurveys();
    this.loadResponses();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load available templates for filtering
   */
  private loadSurveys(): void {
    this.surveyService
      .listAdmin()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.surveys = response.surveys;
        },
        error: err => {
          this.logger.error('Failed to load surveys for filter', err);
        },
      });
  }

  /**
   * Load responses with current filters
   */
  loadResponses(): void {
    this.isLoading = true;
    this.error = null;

    const filter: SurveyResponseFilter = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
    };

    if (this.filters.status !== 'all') {
      filter.status = this.filters.status;
    }
    if (this.filters.surveyId) {
      filter.survey_id = this.filters.surveyId;
    }

    this.responseService
      .listAll(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.dataSource.data = response.survey_responses;
          this.totalResponses = response.total;
          this.isLoading = false;
          this.selection.clear();
        },
        error: err => {
          this.isLoading = false;
          this.error = this.transloco.translate('triage.list.errorLoadingResponses');
          this.logger.error('Failed to load triage responses', err);
        },
      });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadResponses();
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadResponses();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = {
      status: 'all',
      surveyId: null,
      searchTerm: '',
    };
    this.pageIndex = 0;
    this.loadResponses();
  }

  /**
   * Close triage and return to dashboard
   */
  onClose(): void {
    void this.router.navigate(['/dashboard']);
  }

  /**
   * Navigate to response detail
   */
  viewResponse(response: SurveyResponseListItem): void {
    void this.router.navigate(['/triage', response.id]);
  }

  /**
   * Check if all visible items are selected
   */
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows && numRows > 0;
  }

  /**
   * Toggle all selection
   */
  toggleAllRows(): void {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.data.forEach(row => this.selection.select(row));
    }
  }

  /**
   * Bulk approve selected responses
   */
  bulkApprove(): void {
    const selectedIds = this.selection.selected.map(s => s.id);
    if (selectedIds.length === 0) return;

    this.isLoading = true;
    let completed = 0;

    selectedIds.forEach(id => {
      this.responseService
        .approve(id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            completed++;
            if (completed === selectedIds.length) {
              this.loadResponses();
            }
          },
          error: err => {
            this.logger.error(`Failed to approve response ${id}`, err);
            completed++;
            if (completed === selectedIds.length) {
              this.loadResponses();
            }
          },
        });
    });
  }

  /**
   * Approve a single response
   */
  approveResponse(response: SurveyResponseListItem, event: Event): void {
    event.stopPropagation();

    this.responseService
      .approve(response.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadResponses();
        },
        error: err => {
          this.logger.error('Failed to approve response', err);
        },
      });
  }

  /**
   * Get the CSS class for a status chip
   */
  getStatusClass(status: ResponseStatus): string {
    const statusClasses: Record<ResponseStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      needs_revision: 'status-needs-revision',
      ready_for_review: 'status-ready-for-review',
      review_created: 'status-review-created',
    };
    return statusClasses[status] ?? '';
  }

  /**
   * Convert snake_case status to camelCase i18n key
   */
  getStatusKey(status: ResponseStatus): string {
    const keyMap: Record<ResponseStatus, string> = {
      draft: 'draft',
      submitted: 'submitted',
      needs_revision: 'needsRevision',
      ready_for_review: 'readyForReview',
      review_created: 'reviewCreated',
    };
    return keyMap[status] ?? status;
  }

  /**
   * Check if there are any active filters
   */
  get hasActiveFilters(): boolean {
    return this.filters.status !== 'all' || !!this.filters.surveyId || !!this.filters.searchTerm;
  }
}
