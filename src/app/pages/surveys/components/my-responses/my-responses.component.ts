import {
  AfterViewInit,
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  ViewChild,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
  FORM_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyResponseListItem, ResponseStatus } from '@app/types/survey.types';

/**
 * My responses component
 * Displays the user's survey responses with status tracking
 */
@Component({
  selector: 'app-my-responses',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './my-responses.component.html',
  styleUrl: './my-responses.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: display and manage the current user's survey responses with filtering and actions
export class MyResponsesComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatSort) sort!: MatSort;

  responses: SurveyResponseListItem[] = [];
  dataSource = new MatTableDataSource<SurveyResponseListItem>([]);
  loading = true;
  error: string | null = null;
  private _deleteInProgress = false;

  statusFilter: ResponseStatus[] = [
    'draft',
    'submitted',
    'needs_revision',
    'ready_for_review',
    'review_created',
  ];

  readonly statusOptions: { value: ResponseStatus; labelKey: string }[] = [
    { value: 'draft', labelKey: 'surveys.status.draft' },
    { value: 'submitted', labelKey: 'surveys.status.submitted' },
    { value: 'needs_revision', labelKey: 'surveys.status.needsRevision' },
    { value: 'ready_for_review', labelKey: 'surveys.status.readyForReview' },
    { value: 'review_created', labelKey: 'surveys.status.reviewCreated' },
  ];

  readonly displayedColumns = ['template', 'status', 'created', 'modified', 'actions'];

  // SEM@bc18a88f5e89ecbe67e43a913ff61de18fa5860a: inject services needed to fetch, navigate, log, and translate survey responses (pure)
  constructor(
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
  ) {}

  // SEM@5285fcec42154b0b377e4669a8dac28afa2f2f9f: wire the sort control and custom sort accessor to the response table data source (mutates shared state)
  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (
      item: SurveyResponseListItem,
      property: string,
    ): string | number => {
      switch (property) {
        case 'template':
          return (item.survey_name ?? '').toLowerCase();
        case 'status':
          return item.status.toLowerCase();
        case 'created':
          return new Date(item.created_at).getTime();
        case 'modified':
          return new Date(item.modified_at ?? item.created_at).getTime();
        default:
          return '';
      }
    };
  }

  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: trigger initial fetch of the user's survey responses on component init
  ngOnInit(): void {
    this.loadResponses();
  }

  /**
   * Load user's responses
   */
  // SEM@bc18a88f5e89ecbe67e43a913ff61de18fa5860a: fetch the current user's survey response list and populate the filtered table (reads DB)
  loadResponses(): void {
    this.loading = true;
    this.error = null;

    this.responseService
      .listMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.responses = response.survey_responses;
          this.applyFilter();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.error = this.transloco.translate('surveys.responses.errorLoadingResponses');
          this.loading = false;
          this.logger.error('Failed to load responses', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Apply status filter
   */
  // SEM@5285fcec42154b0b377e4669a8dac28afa2f2f9f: filter the displayed survey responses by the selected status values (mutates shared state)
  applyFilter(): void {
    if (this.statusFilter.length === 0 || this.statusFilter.length === this.statusOptions.length) {
      this.dataSource.data = [...this.responses];
    } else {
      this.dataSource.data = this.responses.filter(s => this.statusFilter.includes(s.status));
    }
  }

  /**
   * Handle filter change
   */
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: re-apply the status filter when the user's filter selection changes (mutates shared state)
  onFilterChange(): void {
    this.applyFilter();
  }

  /**
   * View a response
   */
  // SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: route to the fill or read-only view of a survey response based on its status
  viewResponse(response: SurveyResponseListItem): void {
    if (this._deleteInProgress) {
      return;
    }
    if (response.status === 'draft' || response.status === 'needs_revision') {
      void this.router.navigate(['/intake', 'fill', response.survey_id, response.id]);
    } else {
      void this.router.navigate(['/intake', 'response', response.id]);
    }
  }

  /**
   * Continue a draft
   */
  // SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: route to the survey fill page to resume editing a draft response
  continueDraft(response: SurveyResponseListItem): void {
    if (this._deleteInProgress) {
      return;
    }
    void this.router.navigate(['/intake', 'fill', response.survey_id, response.id]);
  }

  /**
   * Delete a draft
   */
  // SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: delete a draft survey response and reload the response list
  deleteDraft(response: SurveyResponseListItem, event: Event): void {
    event.stopPropagation();
    this._deleteInProgress = true;

    this.responseService
      .deleteDraft(response.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this._deleteInProgress = false;
        }),
      )
      .subscribe({
        next: () => {
          this.loadResponses();
        },
        error: error => {
          this.logger.error('Failed to delete draft', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Navigate back to surveys
   */
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: navigate to the intake survey list page (mutates shared state)
  goBack(): void {
    void this.router.navigate(['/intake']);
  }

  /**
   * Get status display info
   */
  // SEM@bc18a88f5e89ecbe67e43a913ff61de18fa5860a: map a survey response status to its display label, color, and icon (pure)
  getStatusInfo(status: ResponseStatus): { labelKey: string; color: string; icon: string } {
    const statusMap: Record<ResponseStatus, { labelKey: string; color: string; icon: string }> = {
      draft: { labelKey: 'surveys.status.draft', color: 'default', icon: 'edit_note' },
      submitted: { labelKey: 'surveys.status.submitted', color: 'primary', icon: 'send' },
      needs_revision: {
        labelKey: 'surveys.status.needsRevision',
        color: 'warn',
        icon: 'rate_review',
      },
      ready_for_review: {
        labelKey: 'surveys.status.readyForReview',
        color: 'accent',
        icon: 'pending_actions',
      },
      review_created: {
        labelKey: 'surveys.status.reviewCreated',
        color: 'primary',
        icon: 'check_circle',
      },
    };
    return statusMap[status] ?? { labelKey: status, color: 'default', icon: 'help' };
  }

  /**
   * Format date for display
   */
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: format an ISO date string as a localized short date (pure)
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Format date with time
   */
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: format an ISO date string as a localized date and time (pure)
  formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
