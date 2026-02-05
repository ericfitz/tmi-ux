import { Component, OnInit, OnDestroy, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { TranslocoModule } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveySubmissionService } from '../../../surveys/services/survey-submission.service';
import { SurveyTemplateService } from '../../../surveys/services/survey-template.service';
import {
  SurveySubmission,
  SurveyTemplate,
  SubmissionStatus,
  SurveySubmissionFilter,
} from '@app/types/survey.types';

/**
 * Filter state for triage list
 */
interface TriageFilters {
  status: SubmissionStatus | 'all';
  templateId: string | null;
  searchTerm: string;
}

/**
 * Triage list component for viewing and managing all survey submissions
 * Used by triage team to review and process submissions
 */
@Component({
  selector: 'app-triage-list',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './triage-list.component.html',
  styleUrl: './triage-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TriageListComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /** Table data source */
  dataSource = new MatTableDataSource<SurveySubmission>([]);

  /** Selection model for bulk actions */
  selection = new SelectionModel<SurveySubmission>(true, []);

  /** Displayed columns */
  displayedColumns = ['select', 'submitter', 'template', 'submitted_at', 'status', 'actions'];

  /** Available templates for filtering */
  templates: SurveyTemplate[] = [];

  /** Current filters */
  filters: TriageFilters = {
    status: 'all',
    templateId: null,
    searchTerm: '',
  };

  /** Status options for filtering */
  statusOptions: { value: SubmissionStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'in_review', label: 'In Review' },
    { value: 'pending_triage', label: 'Pending Triage' },
    { value: 'draft', label: 'Draft' },
  ];

  /** Pagination settings */
  totalSubmissions = 0;
  pageSize = 25;
  pageIndex = 0;

  /** Loading state */
  isLoading = false;

  /** Error message */
  error: string | null = null;

  constructor(
    private router: Router,
    private submissionService: SurveySubmissionService,
    private templateService: SurveyTemplateService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadSubmissions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load available templates for filtering
   */
  private loadTemplates(): void {
    this.templateService
      .list()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.templates = response.templates;
        },
        error: err => {
          this.logger.error('Failed to load templates for filter', err);
        },
      });
  }

  /**
   * Load submissions with current filters
   */
  loadSubmissions(): void {
    this.isLoading = true;
    this.error = null;

    const filter: SurveySubmissionFilter = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
    };

    if (this.filters.status !== 'all') {
      filter.status = this.filters.status;
    }
    if (this.filters.templateId) {
      filter.template_id = this.filters.templateId;
    }

    this.submissionService
      .listAll(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.dataSource.data = response.submissions;
          this.totalSubmissions = response.total;
          this.isLoading = false;
          this.selection.clear();
        },
        error: err => {
          this.isLoading = false;
          this.error = 'Failed to load submissions';
          this.logger.error('Failed to load triage submissions', err);
        },
      });
  }

  /**
   * Handle page change
   */
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadSubmissions();
  }

  /**
   * Handle filter change
   */
  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadSubmissions();
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = {
      status: 'all',
      templateId: null,
      searchTerm: '',
    };
    this.pageIndex = 0;
    this.loadSubmissions();
  }

  /**
   * Navigate to submission detail
   */
  viewSubmission(submission: SurveySubmission): void {
    void this.router.navigate(['/triage', submission.id]);
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
   * Bulk update status for selected submissions
   */
  bulkUpdateStatus(status: SubmissionStatus): void {
    const selectedIds = this.selection.selected.map(s => s.id);
    if (selectedIds.length === 0) return;

    this.isLoading = true;

    // Update each selected submission
    let completed = 0;
    selectedIds.forEach(id => {
      this.submissionService
        .updateStatus(id, status)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            completed++;
            if (completed === selectedIds.length) {
              this.loadSubmissions();
            }
          },
          error: err => {
            this.logger.error(`Failed to update status for submission ${id}`, err);
            completed++;
            if (completed === selectedIds.length) {
              this.loadSubmissions();
            }
          },
        });
    });
  }

  /**
   * Update status for a single submission
   */
  updateStatus(submission: SurveySubmission, status: SubmissionStatus, event: Event): void {
    event.stopPropagation();

    this.submissionService
      .updateStatus(submission.id, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadSubmissions();
        },
        error: err => {
          this.logger.error('Failed to update submission status', err);
        },
      });
  }

  /**
   * Get the CSS class for a status chip
   */
  getStatusClass(status: SubmissionStatus): string {
    const statusClasses: Record<SubmissionStatus, string> = {
      draft: 'status-draft',
      submitted: 'status-submitted',
      in_review: 'status-in-review',
      pending_triage: 'status-pending-triage',
    };
    return statusClasses[status] ?? '';
  }

  /**
   * Get display label for a status
   */
  getStatusLabel(status: SubmissionStatus): string {
    const labels: Record<SubmissionStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      in_review: 'In Review',
      pending_triage: 'Pending Triage',
    };
    return labels[status] ?? status;
  }

  /**
   * Check if there are any active filters
   */
  get hasActiveFilters(): boolean {
    return this.filters.status !== 'all' || !!this.filters.templateId || !!this.filters.searchTerm;
  }
}
