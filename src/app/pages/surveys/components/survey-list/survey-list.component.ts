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
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { LanguageService } from '../../../../i18n/language.service';
import { SurveyService } from '../../services/survey.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyListItem, SurveyResponseListItem } from '@app/types/survey.types';

/**
 * Survey list component for respondents
 * Displays active surveys available to fill out
 */
@Component({
  selector: 'app-survey-list',
  standalone: true,
  imports: [
    ...COMMON_IMPORTS,
    ...CORE_MATERIAL_IMPORTS,
    ...DATA_MATERIAL_IMPORTS,
    ...FEEDBACK_MATERIAL_IMPORTS,
    TranslocoModule,
  ],
  templateUrl: './survey-list.component.html',
  styleUrl: './survey-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SurveyListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private currentLocale = 'en-US';

  surveys: SurveyListItem[] = [];
  drafts: Map<string, SurveyResponseListItem[]> = new Map();
  loading = true;
  error: string | null = null;

  constructor(
    private surveyService: SurveyService,
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
    private languageService: LanguageService,
  ) {}

  ngOnInit(): void {
    this.languageService.currentLanguage$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(language => {
        this.currentLocale = language.code;
        this.cdr.markForCheck();
      });

    this.loadData();
  }

  /**
   * Load active templates and user's drafts
   */
  loadData(): void {
    this.loading = true;
    this.error = null;

    // Load active surveys
    this.surveyService
      .listActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.surveys = response.surveys;
          this.loadDrafts();
        },
        error: error => {
          this.error = this.transloco.translate('surveys.list.errorLoadingSurveys');
          this.loading = false;
          this.logger.error('Failed to load surveys', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Load user's draft responses
   */
  private loadDrafts(): void {
    this.responseService
      .listMine({ status: 'draft' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          // Group drafts by template
          this.drafts.clear();
          for (const draft of response.survey_responses) {
            const existing = this.drafts.get(draft.survey_id) ?? [];
            existing.push(draft);
            this.drafts.set(draft.survey_id, existing);
          }
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: error => {
          this.logger.error('Failed to load drafts', error);
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Get drafts for a specific template
   */
  getDrafts(surveyId: string): SurveyResponseListItem[] {
    return this.drafts.get(surveyId) ?? [];
  }

  /**
   * Start a new survey
   */
  startSurvey(survey: SurveyListItem): void {
    this.responseService
      .createDraft({ survey_id: survey.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          void this.router.navigate(['/intake', 'fill', survey.id, response.id]);
        },
        error: error => {
          this.logger.error('Failed to create draft', error);
        },
      });
  }

  /**
   * Continue an existing draft
   */
  continueDraft(draft: SurveyResponseListItem): void {
    void this.router.navigate(['/intake', 'fill', draft.survey_id, draft.id]);
  }

  /**
   * Delete a draft
   */
  deleteDraft(draft: SurveyResponseListItem, event: Event): void {
    event.stopPropagation();

    this.responseService
      .deleteDraft(draft.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loadDrafts();
        },
        error: error => {
          this.logger.error('Failed to delete draft', error);
        },
      });
  }

  /**
   * Navigate to my responses
   */
  viewMyResponses(): void {
    void this.router.navigate(['/intake', 'my-responses']);
  }

  /**
   * Format relative time for drafts
   * Uses Intl.RelativeTimeFormat for proper internationalization
   */
  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return this.transloco.translate('collaboration.justNow');
    } else if (diffMinutes < 60) {
      return this.formatIntlRelativeTime(-diffMinutes, 'minute');
    } else if (diffHours < 24) {
      return this.formatIntlRelativeTime(-diffHours, 'hour');
    } else {
      return this.formatIntlRelativeTime(-diffDays, 'day');
    }
  }

  /**
   * Format relative time using Intl.RelativeTimeFormat with fallback
   */
  private formatIntlRelativeTime(value: number, unit: 'minute' | 'hour' | 'day'): string {
    try {
      if (typeof Intl !== 'undefined' && Intl.RelativeTimeFormat) {
        const rtf = new Intl.RelativeTimeFormat(this.currentLocale, {
          numeric: 'auto',
          style: 'long',
        });
        return rtf.format(value, unit);
      }
    } catch {
      // Fallback if RelativeTimeFormat fails
    }

    const absValue = Math.abs(value);
    const pluralSuffix = absValue === 1 ? '' : 's';
    return `${absValue} ${unit}${pluralSuffix} ago`;
  }
}
