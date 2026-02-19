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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Model } from 'survey-core';
import { SurveyModule } from 'survey-angular-ui';
import { MatCardModule } from '@angular/material/card';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { LoggerService } from '@app/core/services/logger.service';
import { ThemeService } from '@app/core/services/theme.service';
import { SurveyService } from '../../services/survey.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyDraftService } from '../../services/survey-draft.service';
import { SurveyThemeService } from '../../services/survey-theme.service';
import { SurveyResponse, SurveyJsonSchema, SurveyUIState } from '@app/types/survey.types';
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
    MatCardModule,
    SurveyModule,
    TranslocoModule,
    UserDisplayComponent,
  ],
  templateUrl: './survey-fill.component.html',
  styleUrl: './survey-fill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyFillComponent implements OnInit, OnDestroy {
  private destroyRef = inject(DestroyRef);
  private draftService = inject(SurveyDraftService);
  private themeService = inject(ThemeService);
  private surveyThemeService = inject(SurveyThemeService);
  private translocoService = inject(TranslocoService);

  surveyModel: Model | null = null;
  response: SurveyResponse | null = null;
  surveyJson: SurveyJsonSchema | null = null;

  loading = true;
  error: string | null = null;
  submitting = false;
  submitted = false;

  // Auto-save state
  isSaving$: Observable<boolean> = this.draftService.isSaving$;
  lastSaved$: Observable<Date | null> = this.draftService.lastSaved$;
  saveError$: Observable<string | null> = this.draftService.saveError$;

  private surveyId: string | null = null;
  private responseId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private responseService: SurveyResponseService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.surveyId = this.route.snapshot.paramMap.get('surveyId');
    this.responseId = this.route.snapshot.paramMap.get('responseId');

    if (!this.surveyId || !this.responseId) {
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
   * Load the survey response (which includes survey_json snapshot)
   */
  private loadSurvey(): void {
    this.loading = true;
    this.error = null;

    this.responseService
      .getById(this.responseId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.response = response;

          // Only draft and needs_revision statuses are editable
          if (response.status !== 'draft' && response.status !== 'needs_revision') {
            this.submitted = true;
            this.loading = false;
            this.cdr.markForCheck();
            return;
          }

          // Use the survey_json snapshot from the response if available
          if (response.survey_json) {
            this.surveyJson = response.survey_json;
            this.initializeSurvey();
            this.loading = false;
            this.cdr.markForCheck();
          } else {
            // Fallback: fetch from survey service
            this.loadSurveyJson(response.survey_id);
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
   * Fallback: load survey JSON from template service
   */
  private loadSurveyJson(surveyId: string): void {
    this.surveyService
      .getSurveyJson(surveyId)
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
    if (!this.surveyJson || !this.response) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Customize the complete button text
    this.surveyModel.completeText = this.translocoService.translate('intake.fill.submitResponses');

    // Apply TMI theme to SurveyJS
    this.surveyModel.applyTheme(
      this.surveyThemeService.getTheme(this.themeService.getCurrentTheme()),
    );

    // React to theme changes (light/dark, normal/colorblind)
    this.surveyThemeService.theme$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(theme => {
      if (this.surveyModel) {
        this.surveyModel.applyTheme(theme);
        this.cdr.markForCheck();
      }
    });

    // Restore draft data if exists
    if (this.response.answers && Object.keys(this.response.answers).length > 0) {
      this.surveyModel.data = this.response.answers;
    }

    // Restore UI state if exists
    if (this.response.ui_state) {
      this.surveyModel.currentPageNo = this.response.ui_state.currentPageNo;
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
      surveyId: this.surveyId,
      responseId: this.responseId,
    });
  }

  /**
   * Queue an auto-save operation
   */
  private queueAutoSave(): void {
    if (!this.surveyModel || !this.responseId) return;

    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: false,
    };

    /* eslint-disable @typescript-eslint/no-unsafe-argument -- SurveyJS Model.data is typed as any */
    this.draftService.queueSave(
      this.responseId,
      this.surveyModel.data,
      uiState,
      this.response?.survey_id,
    );
    /* eslint-enable @typescript-eslint/no-unsafe-argument */
  }

  /**
   * Handle survey completion (submit button clicked in survey)
   */
  private handleComplete(): void {
    if (!this.surveyModel || !this.responseId) return;

    this.submitting = true;
    this.cdr.markForCheck();

    // Save final data before submitting
    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: true,
    };

    // Save immediately, then submit
    this.draftService
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SurveyJS Model.data is typed as any
      .saveNow(this.responseId, this.surveyModel.data, uiState, this.response?.survey_id)
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
    this.responseService
      .submit(this.responseId!)
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
    if (!this.surveyModel || !this.responseId) {
      void this.router.navigate(['/intake']);
      return;
    }

    const uiState: SurveyUIState = {
      currentPageNo: this.surveyModel.currentPageNo,
      isCompleted: false,
    };

    this.draftService
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- SurveyJS Model.data is typed as any
      .saveNow(this.responseId, this.surveyModel.data, uiState, this.response?.survey_id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          void this.router.navigate(['/intake']);
        },
        error: () => {
          // Navigate anyway, draft will auto-save next time
          void this.router.navigate(['/intake']);
        },
      });
  }

  /**
   * View response details after completion
   */
  viewResponse(): void {
    void this.router.navigate(['/intake', 'response', this.responseId]);
  }

  /**
   * Start a new survey of the same type
   */
  startAnother(): void {
    void this.router.navigate(['/intake']);
  }

  /**
   * Go back to surveys list
   */
  goBack(): void {
    void this.router.navigate(['/intake']);
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
