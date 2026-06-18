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
import { ProjectPickerComponent } from '@app/shared/components/project-picker/project-picker.component';
import { LoggerService } from '@app/core/services/logger.service';
import { ThemeService } from '@app/core/services/theme.service';
import { SurveyService } from '../../services/survey.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyDraftService } from '../../services/survey-draft.service';
import { SurveyThemeService } from '../../services/survey-theme.service';
import { SurveyResponse, SurveyJsonSchema, SurveyUIState } from '@app/types/survey.types';
import { loadSurveyJson } from '../../utils/survey-json.util';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';

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
    ProjectPickerComponent,
  ],
  templateUrl: './survey-fill.component.html',
  styleUrl: './survey-fill.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@bda57c14c5f510b4c12a35bf845e1041df812b78: render and manage an editable survey form with auto-save and submit
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

  readonly showConfidential = environment.enableConfidentialThreatModels ?? false;

  // Auto-save state
  isSaving$: Observable<boolean> = this.draftService.isSaving$;
  lastSaved$: Observable<Date | null> = this.draftService.lastSaved$;
  saveError$: Observable<string | null> = this.draftService.saveError$;

  private surveyId: string | null = null;
  private responseId: string | null = null;

  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: inject route, router, services, and change detector (pure)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private responseService: SurveyResponseService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: resolve route params and trigger survey response load (mutates shared state)
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

  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: clear draft service state on component teardown (mutates shared state)
  ngOnDestroy(): void {
    this.draftService.clearState();
  }

  /**
   * Load the survey response (which includes survey_json snapshot)
   */
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch an editable survey response by ID and populate the view model (reads DB)
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
  // SEM@bda57c14c5f510b4c12a35bf845e1041df812b78: fetch survey JSON template as fallback when response snapshot is absent (reads DB)
  private loadSurveyJson(surveyId: string): void {
    loadSurveyJson(
      { surveyService: this.surveyService, destroyRef: this.destroyRef, logger: this.logger },
      surveyId,
      surveyJson => {
        this.surveyJson = surveyJson;
        this.initializeSurvey();
        this.loading = false;
        this.cdr.markForCheck();
      },
      () => {
        this.error = 'Failed to load survey';
        this.loading = false;
        this.cdr.markForCheck();
      },
    );
  }

  /**
   * Initialize the SurveyJS model
   */
  // SEM@3fe8590dd363fe4c1feac493886a2b5bc0610e88: build an editable SurveyJS model with auto-save hooks and apply the active theme (mutates shared state)
  private initializeSurvey(): void {
    if (!this.surveyJson || !this.response) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Suppress SurveyJS built-in title/description (already shown in page header)
    this.surveyModel.showTitle = false;
    this.surveyModel['showDescription'] = false;

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
  // SEM@460788d1a27cc01214df67533d368460b11f3568: schedule a debounced draft save of current survey answers and UI state (mutates shared state)
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
  // SEM@460788d1a27cc01214df67533d368460b11f3568: save final draft then submit the survey response on completion event (reads DB)
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
  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: submit the survey response to the API and update submission state (reads DB)
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
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: save the current draft and navigate away without submitting (reads DB)
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
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: route the user to the response detail view after submission (pure)
  viewResponse(): void {
    void this.router.navigate(['/intake', 'response', this.responseId]);
  }

  /**
   * Start a new survey of the same type
   */
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: navigate to the intake route to begin a new survey
  startAnother(): void {
    void this.router.navigate(['/intake']);
  }

  /**
   * Go back to surveys list
   */
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: navigate to the intake route to return to the survey list
  goBack(): void {
    void this.router.navigate(['/intake']);
  }

  /**
   * Handle project picker selection change
   */
  // SEM@a30ab0ed0d92d3e5c1845cd361839fd8ad1843d0: update the survey response's project association, reverting on error (mutates shared state)
  onProjectChange(projectId: string | null): void {
    if (!this.response || !this.responseId) return;

    const previousProjectId = this.response.project_id ?? null;
    this.response.project_id = projectId;

    this.responseService
      .patchProjectId(this.responseId, projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: updated => {
          if (this.response) {
            this.response.project_id = updated.project_id;
            this.cdr.markForCheck();
          }
        },
        error: error => {
          this.logger.error('Failed to update project', error);
          if (this.response) {
            this.response.project_id = previousProjectId;
            this.cdr.markForCheck();
          }
        },
      });
  }

  /**
   * Format date for display
   */
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: format a date as a localized HH:MM time string (pure)
  formatTime(date: Date | null): string {
    if (!date) return '';
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
