import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { TranslocoModule } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveySubmissionService } from '../../../surveys/services/survey-submission.service';
import { SurveyTemplateService } from '../../../surveys/services/survey-template.service';
import { SurveySubmission, SurveyJsonSchema, SubmissionStatus } from '@app/types/survey.types';

/**
 * Status timeline entry
 */
interface StatusTimelineEntry {
  status: string;
  label: string;
  timestamp: string | null;
  isActive: boolean;
  isCompleted: boolean;
}

/**
 * Triage detail component for viewing a single submission
 * Allows status changes and TM creation from survey data
 */
@Component({
  selector: 'app-triage-detail',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './triage-detail.component.html',
  styleUrl: './triage-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TriageDetailComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Submission being viewed */
  submission: SurveySubmission | null = null;

  /** Survey JSON definition */
  surveyJson: SurveyJsonSchema | null = null;

  /** Loading state */
  isLoading = false;

  /** Error message */
  error: string | null = null;

  /** Whether status update is in progress */
  isUpdatingStatus = false;

  /** Available status transitions */
  availableStatuses: { value: SubmissionStatus; label: string; icon: string }[] = [];

  /** Status timeline */
  statusTimeline: StatusTimelineEntry[] = [];

  /** Formatted survey responses for display */
  formattedResponses: { question: string; answer: string; name: string }[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private submissionService: SurveySubmissionService,
    private templateService: SurveyTemplateService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap(params => {
          const submissionId = params.get('submissionId');
          if (!submissionId) {
            throw new Error('No submission ID provided');
          }
          this.isLoading = true;
          this.error = null;
          return this.submissionService.getById(submissionId);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe({
        next: submission => {
          this.submission = submission;
          this.updateAvailableStatuses(submission.status);
          this.buildStatusTimeline(submission);
          this.loadSurveyDefinition(submission.template_id, submission.template_version);
        },
        error: err => {
          this.isLoading = false;
          this.error = 'Failed to load submission';
          this.logger.error('Failed to load triage submission', err);
        },
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load the survey JSON definition to render responses
   */
  private loadSurveyDefinition(templateId: string, version: number): void {
    this.templateService
      .getVersionJson(templateId, version)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: surveyJson => {
          this.surveyJson = surveyJson;
          this.formatResponses(surveyJson);
          this.isLoading = false;
        },
        error: err => {
          this.isLoading = false;
          this.logger.error('Failed to load survey definition', err);
          // Still show submission data even without the definition
          this.formatResponsesWithoutDefinition();
        },
      });
  }

  /**
   * Format survey responses for display using survey definition
   */
  private formatResponses(surveyJson: SurveyJsonSchema): void {
    if (!this.submission?.data) {
      this.formattedResponses = [];
      return;
    }

    const responses: { question: string; answer: string; name: string }[] = [];
    const data = this.submission.data;

    // Walk through all pages and elements to maintain order
    for (const page of surveyJson.pages ?? []) {
      for (const element of page.elements ?? []) {
        if (element.name && data[element.name] !== undefined) {
          responses.push({
            name: element.name,
            question: element.title ?? element.name,
            answer: this.formatAnswer(data[element.name]),
          });
        }
      }
    }

    this.formattedResponses = responses;
  }

  /**
   * Format responses without a definition (raw key/value display)
   */
  private formatResponsesWithoutDefinition(): void {
    if (!this.submission?.data) {
      this.formattedResponses = [];
      return;
    }

    this.formattedResponses = Object.entries(this.submission.data).map(([key, value]) => ({
      name: key,
      question: key,
      answer: this.formatAnswer(value),
    }));
  }

  /**
   * Format a single answer value for display
   */
  private formatAnswer(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return (value as unknown[]).map(v => String(v)).join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return JSON.stringify(value);
  }

  /**
   * Determine available status transitions
   */
  private updateAvailableStatuses(currentStatus: SubmissionStatus): void {
    const transitions: Record<
      SubmissionStatus,
      { value: SubmissionStatus; label: string; icon: string }[]
    > = {
      draft: [],
      submitted: [{ value: 'in_review', label: 'Mark In Review', icon: 'rate_review' }],
      in_review: [
        { value: 'pending_triage', label: 'Mark Pending Triage', icon: 'pending_actions' },
        { value: 'submitted', label: 'Return to Submitted', icon: 'undo' },
      ],
      pending_triage: [{ value: 'in_review', label: 'Return to In Review', icon: 'undo' }],
    };

    this.availableStatuses = transitions[currentStatus] ?? [];
  }

  /**
   * Build status timeline
   */
  private buildStatusTimeline(submission: SurveySubmission): void {
    const statuses: { key: SubmissionStatus; label: string }[] = [
      { key: 'draft', label: 'Draft' },
      { key: 'submitted', label: 'Submitted' },
      { key: 'in_review', label: 'In Review' },
      { key: 'pending_triage', label: 'Pending Triage' },
    ];

    const statusOrder: Record<SubmissionStatus, number> = {
      draft: 0,
      submitted: 1,
      in_review: 2,
      pending_triage: 3,
    };

    const currentIndex = statusOrder[submission.status];

    this.statusTimeline = statuses.map((s, index) => ({
      status: s.key,
      label: s.label,
      timestamp: this.getTimestampForStatus(submission, s.key),
      isActive: index === currentIndex,
      isCompleted: index < currentIndex,
    }));
  }

  /**
   * Get timestamp for a status from the submission
   */
  private getTimestampForStatus(
    submission: SurveySubmission,
    status: SubmissionStatus,
  ): string | null {
    switch (status) {
      case 'draft':
        return submission.created_at;
      case 'submitted':
        return submission.submitted_at ?? null;
      case 'in_review':
        return submission.reviewed_at ?? null;
      default:
        return null;
    }
  }

  /**
   * Update the submission status
   */
  updateStatus(newStatus: SubmissionStatus): void {
    if (!this.submission) return;

    this.isUpdatingStatus = true;

    this.submissionService
      .updateStatus(this.submission.id, newStatus)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: updatedSubmission => {
          this.submission = updatedSubmission;
          this.updateAvailableStatuses(updatedSubmission.status);
          this.buildStatusTimeline(updatedSubmission);
          this.isUpdatingStatus = false;
          this.logger.info('Submission status updated', {
            id: updatedSubmission.id,
            status: newStatus,
          });
        },
        error: err => {
          this.isUpdatingStatus = false;
          this.logger.error('Failed to update submission status', err);
        },
      });
  }

  /**
   * Navigate to create a threat model from this submission
   * For now, navigates to TM creation with prefilled data
   */
  createThreatModel(): void {
    if (!this.submission) return;
    // For now, navigate to TM list. The full TM creation flow from survey data
    // will be implemented when the TM creation API supports pre-population.
    this.logger.info('Create TM from submission', { submissionId: this.submission.id });
    void this.router.navigate(['/tm']);
  }

  /**
   * Navigate back to triage list
   */
  goBack(): void {
    void this.router.navigate(['/triage']);
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
   * Get CSS class for a status
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
}
