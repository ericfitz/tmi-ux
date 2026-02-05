import { Component, OnInit, ChangeDetectionStrategy, DestroyRef, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoModule } from '@jsverse/transloco';
import { Model } from 'survey-core';
import { SurveyModule } from 'survey-angular-ui';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyTemplateService } from '../../services/survey-template.service';
import { SurveySubmissionService } from '../../services/survey-submission.service';
import { SurveySubmission, SurveyJsonSchema, SubmissionStatus } from '@app/types/survey.types';

/**
 * Submission detail component
 * Read-only view of a submitted survey
 */
@Component({
  selector: 'app-submission-detail',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    SurveyModule,
    TranslocoModule,
  ],
  templateUrl: './submission-detail.component.html',
  styleUrl: './submission-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  surveyModel: Model | null = null;
  submission: SurveySubmission | null = null;
  surveyJson: SurveyJsonSchema | null = null;

  loading = true;
  error: string | null = null;

  private submissionId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: SurveyTemplateService,
    private submissionService: SurveySubmissionService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.submissionId = this.route.snapshot.paramMap.get('submissionId');

    if (!this.submissionId) {
      this.error = 'Invalid submission URL';
      this.loading = false;
      return;
    }

    this.loadSubmission();
  }

  /**
   * Load the submission and survey
   */
  private loadSubmission(): void {
    this.loading = true;
    this.error = null;

    this.submissionService
      .getById(this.submissionId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: submission => {
          this.submission = submission;
          this.loadSurveyJson(submission.template_id, submission.template_version);
        },
        error: error => {
          this.error = 'Failed to load submission';
          this.loading = false;
          this.logger.error('Failed to load submission', error);
        },
      });
  }

  /**
   * Load the survey JSON
   */
  private loadSurveyJson(templateId: string, version: number): void {
    this.templateService
      .getVersionJson(templateId, version)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: surveyJson => {
          this.surveyJson = surveyJson;
          this.initializeSurvey();
          this.loading = false;
        },
        error: error => {
          this.error = 'Failed to load survey';
          this.loading = false;
          this.logger.error('Failed to load survey JSON', error);
        },
      });
  }

  /**
   * Initialize the SurveyJS model in read-only mode
   */
  private initializeSurvey(): void {
    if (!this.surveyJson || !this.submission) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Set the data
    this.surveyModel.data = this.submission.data;

    // Set to read-only/display mode
    this.surveyModel.mode = 'display';

    // Show all questions at once
    this.surveyModel.showNavigationButtons = 'none';
    this.surveyModel.questionsOnPageMode = 'singlePage';

    this.logger.debug('Survey initialized in display mode', {
      submissionId: this.submissionId,
    });
  }

  /**
   * Navigate back to my submissions
   */
  goBack(): void {
    void this.router.navigate(['/surveys', 'my-submissions']);
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
  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
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
