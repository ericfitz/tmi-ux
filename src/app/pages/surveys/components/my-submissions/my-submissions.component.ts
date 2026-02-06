import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
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
 * My submissions component
 * Displays the user's survey responses with status tracking
 */
@Component({
  selector: 'app-my-submissions',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    ...FORM_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './my-submissions.component.html',
  styleUrl: './my-submissions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MySubmissionsComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  responses: SurveyResponseListItem[] = [];
  filteredResponses: SurveyResponseListItem[] = [];
  loading = true;
  error: string | null = null;

  statusFilter: ResponseStatus | 'all' = 'all';

  readonly statusOptions: { value: ResponseStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'needs_revision', label: 'Needs Revision' },
    { value: 'ready_for_review', label: 'Ready for Review' },
    { value: 'review_created', label: 'Review Created' },
  ];

  readonly displayedColumns = ['template', 'status', 'created', 'modified', 'actions'];

  constructor(
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

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
          this.error = 'Failed to load responses';
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
    if (this.statusFilter === 'all') {
      this.filteredResponses = [...this.responses];
    } else {
      this.filteredResponses = this.responses.filter(s => s.status === this.statusFilter);
    }

    // Sort by modified date descending
    this.filteredResponses.sort(
      (a, b) => new Date(b.modified_at).getTime() - new Date(a.modified_at).getTime(),
    );
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
      void this.router.navigate(['/surveys', 'fill', response.template_id, response.id]);
    } else {
      void this.router.navigate(['/surveys', 'submission', response.id]);
    }
  }

  /**
   * Continue a draft
   */
  continueDraft(response: SurveyResponseListItem): void {
    void this.router.navigate(['/surveys', 'fill', response.template_id, response.id]);
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
    void this.router.navigate(['/surveys']);
  }

  /**
   * Get status display info
   */
  getStatusInfo(status: ResponseStatus): { label: string; color: string; icon: string } {
    const statusMap: Record<ResponseStatus, { label: string; color: string; icon: string }> = {
      draft: { label: 'Draft', color: 'default', icon: 'edit_note' },
      submitted: { label: 'Submitted', color: 'primary', icon: 'send' },
      needs_revision: { label: 'Needs Revision', color: 'warn', icon: 'rate_review' },
      ready_for_review: { label: 'Ready for Review', color: 'accent', icon: 'pending_actions' },
      review_created: { label: 'Review Created', color: 'primary', icon: 'check_circle' },
    };
    return statusMap[status] ?? { label: status, color: 'default', icon: 'help' };
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
