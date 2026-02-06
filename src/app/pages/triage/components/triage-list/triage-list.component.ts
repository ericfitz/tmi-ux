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
import { SurveyResponseService } from '../../../surveys/services/survey-response.service';
import { SurveyTemplateService } from '../../../surveys/services/survey-template.service';
import {
  SurveyResponseListItem,
  SurveyTemplateListItem,
  ResponseStatus,
  SurveyResponseFilter,
} from '@app/types/survey.types';

/**
 * Filter state for triage list
 */
interface TriageFilters {
  status: ResponseStatus | 'all';
  templateId: string | null;
  searchTerm: string;
}

/**
 * Triage list component for viewing and managing all survey responses
 * Used by triage team to review and process responses
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
  dataSource = new MatTableDataSource<SurveyResponseListItem>([]);

  /** Selection model for bulk actions */
  selection = new SelectionModel<SurveyResponseListItem>(true, []);

  /** Displayed columns */
  displayedColumns = ['select', 'submitter', 'template', 'submitted_at', 'status', 'actions'];

  /** Available templates for filtering */
  templates: SurveyTemplateListItem[] = [];

  /** Current filters */
  filters: TriageFilters = {
    status: 'all',
    templateId: null,
    searchTerm: '',
  };

  /** Status options for filtering */
  statusOptions: { value: ResponseStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'needs_revision', label: 'Needs Revision' },
    { value: 'ready_for_review', label: 'Ready for Review' },
    { value: 'review_created', label: 'Review Created' },
    { value: 'draft', label: 'Draft' },
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
    private templateService: SurveyTemplateService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadTemplates();
    this.loadResponses();
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
      .listAdmin()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.templates = response.survey_templates;
        },
        error: err => {
          this.logger.error('Failed to load templates for filter', err);
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
    if (this.filters.templateId) {
      filter.template_id = this.filters.templateId;
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
          this.error = 'Failed to load responses';
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
      templateId: null,
      searchTerm: '',
    };
    this.pageIndex = 0;
    this.loadResponses();
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
   * Get display label for a status
   */
  getStatusLabel(status: ResponseStatus): string {
    const labels: Record<ResponseStatus, string> = {
      draft: 'Draft',
      submitted: 'Submitted',
      needs_revision: 'Needs Revision',
      ready_for_review: 'Ready for Review',
      review_created: 'Review Created',
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
