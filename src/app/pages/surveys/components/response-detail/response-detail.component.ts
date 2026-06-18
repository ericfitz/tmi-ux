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
import { ThemeService } from '@app/core/services/theme.service';
import { SurveyService } from '../../services/survey.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyThemeService } from '../../services/survey-theme.service';
import { SurveyResponse, SurveyJsonSchema, ResponseStatus } from '@app/types/survey.types';
import { UserDisplayComponent } from '@app/shared/components/user-display/user-display.component';
import { ProjectService } from '@app/core/services/project.service';
import { loadSurveyJson } from '../../utils/survey-json.util';
import { environment } from '../../../../../environments/environment';

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
    UserDisplayComponent,
  ],
  templateUrl: './response-detail.component.html',
  styleUrl: './response-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// SEM@bda57c14c5f510b4c12a35bf845e1041df812b78: fetch and display a submitted survey response with its associated project
export class ResponseDetailComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private themeService = inject(ThemeService);
  private surveyThemeService = inject(SurveyThemeService);

  readonly showConfidential = environment.enableConfidentialThreatModels ?? false;

  surveyModel: Model | null = null;
  response: SurveyResponse | null = null;
  surveyJson: SurveyJsonSchema | null = null;
  projectName: string | null = null;

  loading = true;
  error: string | null = null;

  private responseId: string | null = null;

  // SEM@71aee0a369e6c4b7bc5f57e42795e1944b0ff573: inject routing, survey, response, project, logger, and change detection dependencies (pure)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private responseService: SurveyResponseService,
    private projectService: ProjectService,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  // SEM@6533b8b7b0c6db3a5ea574f65396fc0685f97573: resolve route response ID and trigger response load (mutates shared state)
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
  // SEM@71aee0a369e6c4b7bc5f57e42795e1944b0ff573: fetch a survey response by ID and populate the view model (reads DB)
  private loadResponse(): void {
    this.loading = true;
    this.error = null;

    this.responseService
      .getById(this.responseId!)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.response = response;

          // Resolve project name
          if (response.project_id) {
            this.loadProjectName(response.project_id);
          }

          // Use the survey_json snapshot from the response if available
          if (response.survey_json) {
            this.surveyJson = response.survey_json;
            this.initializeSurvey();
            this.loading = false;
            this.cdr.markForCheck();
          } else {
            // Fallback: fetch from template service
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
   * Fallback: load the survey JSON from template service
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
   * Resolve project name from project ID
   */
  // SEM@71aee0a369e6c4b7bc5f57e42795e1944b0ff573: fetch project name by ID and store it for display (reads DB)
  private loadProjectName(projectId: string): void {
    this.projectService
      .get(projectId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: project => {
          this.projectName = project.name;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Failed to load project', error);
          this.projectName = null;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Initialize the SurveyJS model in read-only mode
   */
  // SEM@3fe8590dd363fe4c1feac493886a2b5bc0610e88: build a read-only SurveyJS model from response data and apply the active theme (mutates shared state)
  private initializeSurvey(): void {
    if (!this.surveyJson || !this.response) return;

    // Create the survey model
    this.surveyModel = new Model(this.surveyJson);

    // Suppress SurveyJS built-in title/description (already shown in page header)
    this.surveyModel.showTitle = false;
    this.surveyModel['showDescription'] = false;

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
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: route the user back to the my-responses list (pure)
  goBack(): void {
    void this.router.navigate(['/intake', 'my-responses']);
  }

  /**
   * Get status display info
   */
  // SEM@feaf765d0e4f372d17e38da0bcda6854583b55f8: map a response status to its display label, color, and icon (pure)
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
  // SEM@b54b9814f8416ab22896148fea0d97a28da8f795: format a date string into a localized short date-time string (pure)
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
