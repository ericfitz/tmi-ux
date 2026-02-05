import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
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
import { SurveySubmissionService } from '../../services/survey-submission.service';
import { SurveySubmission, SubmissionStatus } from '@app/types/survey.types';

/**
 * My submissions component
 * Displays the user's survey submissions with status tracking
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

  submissions: SurveySubmission[] = [];
  filteredSubmissions: SurveySubmission[] = [];
  loading = true;
  error: string | null = null;

  statusFilter: SubmissionStatus | 'all' = 'all';

  readonly statusOptions: { value: SubmissionStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'in_review', label: 'In Review' },
    { value: 'pending_triage', label: 'Pending Triage' },
  ];

  readonly displayedColumns = ['template', 'status', 'created', 'modified', 'actions'];

  constructor(
    private submissionService: SurveySubmissionService,
    private router: Router,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.loadSubmissions();
  }

  /**
   * Load user's submissions
   */
  loadSubmissions(): void {
    this.loading = true;
    this.error = null;

    this.submissionService
      .listMine()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.submissions = response.submissions;
          this.applyFilter();
          this.loading = false;
        },
        error: error => {
          this.error = 'Failed to load submissions';
          this.loading = false;
          this.logger.error('Failed to load submissions', error);
        },
      });
  }

  /**
   * Apply status filter
   */
  applyFilter(): void {
    if (this.statusFilter === 'all') {
      this.filteredSubmissions = [...this.submissions];
    } else {
      this.filteredSubmissions = this.submissions.filter(s => s.status === this.statusFilter);
    }

    // Sort by modified date descending
    this.filteredSubmissions.sort(
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
   * View a submission
   */
  viewSubmission(submission: SurveySubmission): void {
    if (submission.status === 'draft') {
      void this.router.navigate(['/surveys', 'fill', submission.template_id, submission.id]);
    } else {
      void this.router.navigate(['/surveys', 'submission', submission.id]);
    }
  }

  /**
   * Continue a draft
   */
  continueDraft(submission: SurveySubmission): void {
    void this.router.navigate(['/surveys', 'fill', submission.template_id, submission.id]);
  }

  /**
   * Delete a draft
   */
  deleteDraft(submission: SurveySubmission): void {
    this.submissionService
      .deleteDraft(submission.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadSubmissions();
        },
        error: error => {
          this.logger.error('Failed to delete draft', error);
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
  getStatusInfo(status: SubmissionStatus): { label: string; color: string; icon: string } {
    const statusMap: Record<SubmissionStatus, { label: string; color: string; icon: string }> = {
      draft: { label: 'Draft', color: 'default', icon: 'edit_note' },
      submitted: { label: 'Submitted', color: 'primary', icon: 'send' },
      in_review: { label: 'In Review', color: 'accent', icon: 'rate_review' },
      pending_triage: { label: 'Pending Triage', color: 'warn', icon: 'pending_actions' },
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
