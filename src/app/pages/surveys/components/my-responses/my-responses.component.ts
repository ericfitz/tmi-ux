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
export class MyResponsesComponent implements OnInit, AfterViewInit {
  private destroyRef = inject(DestroyRef);

  @ViewChild(MatSort) sort!: MatSort;

  responses: SurveyResponseListItem[] = [];
  dataSource = new MatTableDataSource<SurveyResponseListItem>([]);
  loading = true;
  error: string | null = null;

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

  constructor(
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
  ) {}

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

  ngOnInit(): void {
    this.loadResponses();
  }

  /**
   * Load user's responses
   */
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
  onFilterChange(): void {
    this.applyFilter();
  }

  /**
   * View a response
   */
  viewResponse(response: SurveyResponseListItem): void {
    if (response.status === 'draft' || response.status === 'needs_revision') {
      void this.router.navigate(['/intake', 'fill', response.survey_id, response.id]);
    } else {
      void this.router.navigate(['/intake', 'response', response.id]);
    }
  }

  /**
   * Continue a draft
   */
  continueDraft(response: SurveyResponseListItem): void {
    void this.router.navigate(['/intake', 'fill', response.survey_id, response.id]);
  }

  /**
   * Delete a draft
   */
  deleteDraft(response: SurveyResponseListItem): void {
    this.responseService
      .deleteDraft(response.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
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
  goBack(): void {
    void this.router.navigate(['/intake']);
  }

  /**
   * Get status display info
   */
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
