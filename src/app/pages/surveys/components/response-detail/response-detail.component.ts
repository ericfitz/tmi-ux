import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  DestroyRef,
  inject,
} from '@angular/core';
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
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyResponse, SurveyJsonSchema, ResponseStatus } from '@app/types/survey.types';

/**
 * Response detail component
 * Read-only view of a survey response
 */
@Component({
  selector: 'app-response-detail',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    SurveyModule,
    TranslocoModule,
  ],
  templateUrl: './response-detail.component.html',
  styleUrl: './response-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResponseDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  surveyModel: Model | null = null;
  response: SurveyResponse | null = null;
  surveyJson: SurveyJsonSchema | null = null;

  loading = true;
  error: string | null = null;

  private responseId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: SurveyTemplateService,
    private responseService: SurveyResponseService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.responseId = this.route.snapshot.paramMap.get('responseId');

    if (!this.responseId) {
      this.error = 'Invalid response URL';
      this.loading = false;
      return;
    }

    this.loadResponse();
  }

  /**
   * Load the response and survey
   */
  private loadResponse(): void {
    this.loading = true;
    this.error = null;

    this.responseService
      .getById(this.responseId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.response = response;

          // Use the survey_json snapshot from the response if available
          if (response.survey_json) {
            this.surveyJson = response.survey_json;
            this.initializeSurvey();
            this.loading = false;
            this.cdr.markForCheck();
          } else {
            // Fallback: fetch from template service
            this.loadSurveyJson(response.template_id);
          }
        },
        error: error => {
          this.error = 'Failed to load response';
          this.loading = false;
          this.logger.error('Failed to load response', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Fallback: load the survey JSON from template service
   */
  private loadSurveyJson(templateId: string): void {
    this.templateService
      .getSurveyJson(templateId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: surveyJson => {
          this.surveyJson = surveyJson;
          this.initializeSurvey();
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.error = 'Failed to load survey';
          this.loading = false;
          this.logger.error('Failed to load survey JSON', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Initialize the SurveyJS model in read-only mode
   */
  private initializeSurvey(): void {
    if (!this.surveyJson || !this.response) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Set the data
    this.surveyModel.data = this.response.answers;

    // Set to read-only/display mode
    this.surveyModel.mode = 'display';

    // Show all questions at once
    this.surveyModel.showNavigationButtons = 'none';
    this.surveyModel.questionsOnPageMode = 'singlePage';

    this.logger.debug('Survey initialized in display mode', {
      responseId: this.responseId,
    });
  }

  /**
   * Navigate back to my responses
   */
  goBack(): void {
    void this.router.navigate(['/surveys', 'my-responses']);
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
