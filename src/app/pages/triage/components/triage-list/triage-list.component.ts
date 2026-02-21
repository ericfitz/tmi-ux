import {
  AfterViewInit,
  Component,
  OnInit,
  OnDestroy,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
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
import {
  RevisionNotesDialogComponent,
  RevisionNotesDialogResult,
} from '../revision-notes-dialog/revision-notes-dialog.component';
import { environment } from '../../../../../environments/environment';

/**
 * Filter state for triage list
 */
interface TriageFilters {
  status: ResponseStatus | 'all';
  surveyId: string | null;
  searchTerm: string;
  isConfidential: boolean | null;
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
export class TriageListComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  /** Table data source */
  dataSource = new MatTableDataSource<SurveyResponseListItem>([]);

  /** Whether confidential feature is enabled */
  readonly showConfidential = environment.enableConfidentialThreatModels ?? false;

  /** Displayed columns */
  displayedColumns = this.showConfidential
    ? ['confidential', 'submitter', 'template', 'submitted_at', 'status', 'actions']
    : ['submitter', 'template', 'submitted_at', 'status', 'actions'];

  /** Available templates for filtering */
  surveys: SurveyListItem[] = [];

  /** Current filters */
  filters: TriageFilters = {
    status: 'submitted',
    surveyId: null,
    searchTerm: '',
    isConfidential: null,
  };

  /** Status options for the filter dropdown */
  filterStatusOptions: { value: ResponseStatus | 'all'; labelKey: string }[] = [
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
    private dialog: MatDialog,
  ) {}

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (
      item: SurveyResponseListItem,
      property: string,
    ): string | number => {
      switch (property) {
        case 'submitter':
          return (item.owner?.display_name || item.owner?.email || '').toLowerCase();
        case 'template':
          return (item.survey_name ?? '').toLowerCase();
        case 'submitted_at':
          return item.submitted_at ? new Date(item.submitted_at).getTime() : 0;
        case 'status':
          return item.status.toLowerCase();
        default:
          return '';
      }
    };
  }

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
      .listActive()
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
    if (this.filters.isConfidential !== null) {
      filter.is_confidential = this.filters.isConfidential;
    }

    this.responseService
      .listAll(filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          this.dataSource.data = response.survey_responses;
          this.totalResponses = response.total;
          this.isLoading = false;
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
      isConfidential: null,
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
   * Approve a response (submitted → ready_for_review)
   */
  approveResponse(response: SurveyResponseListItem): void {
    this.responseService
      .updateStatus(response.id, 'ready_for_review')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadResponses();
        },
        error: (err: unknown) => {
          this.logger.error('Failed to approve response', err);
        },
      });
  }

  /**
   * Open the revision notes dialog, then return for revision if confirmed
   */
  openRevisionDialogForRow(response: SurveyResponseListItem): void {
    const dialogRef = this.dialog.open<
      RevisionNotesDialogComponent,
      void,
      RevisionNotesDialogResult
    >(RevisionNotesDialogComponent, {
      width: '500px',
      disableClose: true,
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        if (result) {
          this.responseService
            .returnForRevision(response.id, result.notes)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: () => {
                this.loadResponses();
              },
              error: (err: unknown) => {
                this.logger.error('Failed to return response for revision', err);
              },
            });
        }
      });
  }

  /**
   * Create a threat model from a ready_for_review response
   */
  createThreatModel(response: SurveyResponseListItem): void {
    this.responseService
      .createThreatModel(response.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: result => {
          this.logger.info('Threat model created from response', {
            responseId: result.survey_response_id,
            threatModelId: result.threat_model_id,
          });
          void this.router.navigate(['/tm', result.threat_model_id]);
        },
        error: (err: unknown) => {
          this.logger.error('Failed to create threat model from response', err);
        },
      });
  }

  /**
   * Get CSS class for a status chip
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
    return (
      this.filters.status !== 'submitted' ||
      !!this.filters.surveyId ||
      !!this.filters.searchTerm ||
      this.filters.isConfidential !== null
    );
  }
}
