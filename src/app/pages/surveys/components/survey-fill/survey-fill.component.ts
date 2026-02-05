import {
  Component,
  OnInit,
  OnDestroy,
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
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyTemplateService } from '../../services/survey-template.service';
import { SurveySubmissionService } from '../../services/survey-submission.service';
import { SurveyDraftService } from '../../services/survey-draft.service';
import { SurveySubmission, SurveyJsonSchema, SurveyUIState } from '@app/types/survey.types';
import { Observable } from 'rxjs';

/**
 * Survey fill component
 * Renders a SurveyJS survey and handles draft auto-save
 */
@Component({
  selector: 'app-survey-fill',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    SurveyModule,
    TranslocoModule,
  ],
  templateUrl: './survey-fill.component.html',
  styleUrl: './survey-fill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyFillComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private draftService = inject(SurveyDraftService);

  surveyModel: Model | null = null;
  submission: SurveySubmission | null = null;
  surveyJson: SurveyJsonSchema | null = null;

  loading = true;
  error: string | null = null;
  submitting = false;
  submitted = false;

  // Auto-save state
  isSaving$: Observable<boolean> = this.draftService.isSaving$;
  lastSaved$: Observable<Date | null> = this.draftService.lastSaved$;
  saveError$: Observable<string | null> = this.draftService.saveError$;

  private templateId: string | null = null;
  private submissionId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: SurveyTemplateService,
    private submissionService: SurveySubmissionService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.templateId = this.route.snapshot.paramMap.get('templateId');
    this.submissionId = this.route.snapshot.paramMap.get('submissionId');

    if (!this.templateId || !this.submissionId) {
      this.error = 'Invalid survey URL';
      this.loading = false;
      return;
    }

    this.loadSurvey();
  }

  ngOnDestroy(): void {
    this.draftService.clearState();
  }

  /**
   * Load the survey template and submission
   */
  private loadSurvey(): void {
    this.loading = true;
    this.error = null;

    // Load submission first to get the template version
    this.submissionService
      .getById(this.submissionId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: submission => {
          this.submission = submission;

          // Check if already submitted
          if (submission.status !== 'draft') {
            this.submitted = true;
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }

          // Load the survey JSON for the specific version
          this.loadSurveyJson(submission.template_id, submission.template_version);
        },
        error: error => {
          this.error = 'Failed to load submission';
          this.loading = false;
          this.logger.error('Failed to load submission', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Load the survey JSON schema
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
   * Initialize the SurveyJS model
   */
  private initializeSurvey(): void {
    if (!this.surveyJson || !this.submission) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Restore draft data if exists
    if (this.submission.data && Object.keys(this.submission.data).length > 0) {
      this.surveyModel.data = this.submission.data;
    }

    // Restore UI state if exists
    if (this.submission.ui_state) {
      this.surveyModel.currentPageNo = this.submission.ui_state.currentPageNo;
    }

    // Set up auto-save on value changes
    this.surveyModel.onValueChanged.add(() => {
      this.queueAutoSave();
    });

    // Set up auto-save on page changes
    this.surveyModel.onCurrentPageChanged.add(() => {
      this.queueAutoSave();
    });

    // Handle survey completion
    this.surveyModel.onComplete.add(() => {
      this.handleComplete();
    });

    this.logger.debug('Survey initialized', {
      templateId: this.templateId,
      submissionId: this.submissionId,
    });
  }

  /**
   * Queue an auto-save operation
   */
  private queueAutoSave(): void {
    if (!this.surveyModel || !this.submissionId) return;

    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: false,
    };

    this.draftService.queueSave(this.submissionId, this.surveyModel.data, uiState);
  }

  /**
   * Handle survey completion (submit button clicked in survey)
   */
  private handleComplete(): void {
    if (!this.surveyModel || !this.submissionId) return;

    this.submitting = true;
    this.cdr.markForCheck();

    // Save final data before submitting
    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: true,
    };

    // Save immediately, then submit
    this.draftService
      .saveNow(this.submissionId, this.surveyModel.data, uiState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitSurvey();
        },
        error: error => {
          this.submitting = false;
          this.logger.error('Failed to save before submit', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Submit the survey
   */
  private submitSurvey(): void {
    this.submissionService
      .submit(this.submissionId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.submitted = true;
          this.submitting = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.submitting = false;
          this.logger.error('Failed to submit survey', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Save and exit (without submitting)
   */
  saveAndExit(): void {
    if (!this.surveyModel || !this.submissionId) {
      void this.router.navigate(['/surveys']);
      return;
    }

    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: false,
    };

    this.draftService
      .saveNow(this.submissionId, this.surveyModel.data, uiState)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/surveys']);
        },
        error: () => {
          // Navigate anyway, draft will auto-save next time
          void this.router.navigate(['/surveys']);
        },
      });
  }

  /**
   * View submission details after completion
   */
  viewSubmission(): void {
    void this.router.navigate(['/surveys', 'submission', this.submissionId]);
  }

  /**
   * Start a new survey of the same type
   */
  startAnother(): void {
    void this.router.navigate(['/surveys']);
  }

  /**
   * Go back to surveys list
   */
  goBack(): void {
    void this.router.navigate(['/surveys']);
  }

  /**
   * Format date for display
   */
  formatTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
