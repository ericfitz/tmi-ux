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
import { MatSnackBar } from '@angular/material/snack-bar';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { MatTabsModule } from '@angular/material/tabs';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { ReviewerAssignmentListComponent } from '../reviewer-assignment-list/reviewer-assignment-list.component';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { LanguageService } from '@app/i18n/language.service';
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
import {
  getStatusClass as getStatusClassUtil,
  getStatusKey as getStatusKeyUtil,
} from '../../utils/triage-status.util';

/**
 * Filter state for triage list
 */
interface TriageFilters {
  status: ResponseStatus[];
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
  imports: [
    ...COMMON_IMPORTS,
    ...ALL_MATERIAL_IMPORTS,
    MatTabsModule,
    TranslocoModule,
    UserDisplayComponent,
    ReviewerAssignmentListComponent,
  ],
  templateUrl: './triage-list.component.html',
  styleUrl: './triage-list.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
// SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: list, filter, and triage survey responses with pagination and bulk actions
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
    status: ['submitted'],
    surveyId: null,
    searchTerm: '',
    isConfidential: null,
  };

  /** Status options for the filter dropdown */
  filterStatusOptions: { value: ResponseStatus; labelKey: string }[] = [
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

  /** Currently selected tab index */
  selectedTabIndex = 0;

  /** Count of unassigned threat models (from child component) */
  unassignedCount = 0;

  /** Current locale for date formatting */
  currentLocale = 'en-US';

  /** Loading state */
  isLoading = false;

  /** Error message */
  error: string | null = null;

  // SEM@198d9138cef09ed19e61938afc63adb0817f4bf2: inject services for routing, responses, surveys, dialogs, and i18n
  constructor(
    private router: Router,
    private snackBar: MatSnackBar,
    private responseService: SurveyResponseService,
    private surveyService: SurveyService,
    private logger: LoggerService,
    private transloco: TranslocoService,
    private dialog: MatDialog,
    private languageService: LanguageService,
  ) {}

  // SEM@73deaedb04565ca3211c5e684dcd6bd0ab3a6ef7: bind the paginator sort to the table data source with custom field accessors
  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (
      item: SurveyResponseListItem,
      property: string,
    ): string | number => {
      switch (property) {
        case 'submitter':
          return (item.owner?.display_name ?? item.owner?.email ?? '').toLowerCase();
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

  // SEM@198d9138cef09ed19e61938afc63adb0817f4bf2: subscribe to locale changes and fetch initial surveys and responses (reads DB)
  ngOnInit(): void {
    this.languageService.currentLanguage$.pipe(takeUntil(this.destroy$)).subscribe(language => {
      this.currentLocale = language.code;
    });

    this.loadSurveys();
    this.loadResponses();
  }

  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: complete the destroy subject to cancel all active subscriptions
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load available templates for filtering
   */
  // SEM@0e5772d077714bd5582bf75be3700bea2ce22891: fetch active survey templates for the filter dropdown (reads DB)
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
  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: fetch paginated survey responses matching current filters (reads DB)
  loadResponses(): void {
    this.isLoading = true;
    this.error = null;

    const filter: SurveyResponseFilter = {
      limit: this.pageSize,
      offset: this.pageIndex * this.pageSize,
    };

    if (this.filters.status.length > 0) {
      filter.status = this.filters.status.join(',');
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
  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: handle paginator page event and reload responses for the new page
  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadResponses();
  }

  /**
   * Handle filter change
   */
  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: reset to first page and reload responses when a filter changes
  onFilterChange(): void {
    this.pageIndex = 0;
    this.loadResponses();
  }

  /**
   * Clear all filters
   */
  // SEM@20f07620df60d6cb0702ab476f86bb23b1d8a4cd: reset all filters to defaults and reload the response list
  clearFilters(): void {
    this.filters = {
      status: ['submitted'],
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
  // SEM@88a897f1ac615c753d408fb92012a5c420c956e5: navigate away from triage to the dashboard
  onClose(): void {
    void this.router.navigate(['/dashboard']);
  }

  /**
   * Navigate to response detail
   */
  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: navigate to the detail view for a survey response
  viewResponse(response: SurveyResponseListItem): void {
    void this.router.navigate(['/triage', response.id]);
  }

  /**
   * Approve a response (submitted → ready_for_review)
   */
  // SEM@73937e4a1513478d01cfcb1f86ac74432d454fbc: update a survey response status to ready_for_review via the API (reads DB)
  approveResponse(response: SurveyResponseListItem): void {
    this.responseService
      .updateStatus(response.id, 'ready_for_review')
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.loadResponses();
          this.snackBar.open(
            this.transloco.translate('triage.messages.approveSuccess'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
        },
        error: (err: unknown) => {
          this.logger.error('Failed to approve response', err);
          this.snackBar.open(
            this.transloco.translate('triage.messages.approveError'),
            this.transloco.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Open the revision notes dialog, then return for revision if confirmed
   */
  // SEM@73937e4a1513478d01cfcb1f86ac74432d454fbc: open revision notes dialog and return a response for revision if confirmed (reads DB)
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
                this.snackBar.open(
                  this.transloco.translate('triage.messages.returnForRevisionSuccess'),
                  this.transloco.translate('common.close'),
                  { duration: 3000 },
                );
              },
              error: (err: unknown) => {
                this.logger.error('Failed to return response for revision', err);
                this.snackBar.open(
                  this.transloco.translate('triage.messages.returnForRevisionError'),
                  this.transloco.translate('common.close'),
                  { duration: 5000 },
                );
              },
            });
        }
      });
  }

  /**
   * Create a threat model from a ready_for_review response
   */
  // SEM@73937e4a1513478d01cfcb1f86ac74432d454fbc: build a threat model from a ready survey response and navigate to it (reads DB)
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
          this.snackBar.open(
            this.transloco.translate('triage.messages.createThreatModelSuccess'),
            this.transloco.translate('common.close'),
            { duration: 3000 },
          );
          void this.router.navigate(['/tm', result.threat_model_id]);
        },
        error: (err: unknown) => {
          this.logger.error('Failed to create threat model from response', err);
          this.snackBar.open(
            this.transloco.translate('triage.messages.createThreatModelError'),
            this.transloco.translate('common.close'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Get CSS class for a status chip
   */
  // SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: map a response status to its CSS class name (pure)
  getStatusClass(status: ResponseStatus): string {
    return getStatusClassUtil(status);
  }

  /**
   * Convert snake_case status to camelCase i18n key
   */
  // SEM@28965fbbc1cc05c2313c3368f6409ec77d7ae535: convert a survey response status to its camelCase i18n key (pure)
  getStatusKey(status: ResponseStatus): string {
    return getStatusKeyUtil(status);
  }

  /**
   * Check if there are any active filters
   */
  get hasActiveFilters(): boolean {
    const isDefaultStatus =
      this.filters.status.length === 1 && this.filters.status[0] === 'submitted';
    return (
      !isDefaultStatus ||
      !!this.filters.surveyId ||
      !!this.filters.searchTerm ||
      this.filters.isConfidential !== null
    );
  }
}
