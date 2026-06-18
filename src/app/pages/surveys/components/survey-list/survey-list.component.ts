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
import { finalize } from 'rxjs';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { MatDialog } from '@angular/material/dialog';
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
import { SurveyConfidentialDialogComponent } from '../survey-confidential-dialog/survey-confidential-dialog.component';
import { environment } from '../../../../../environments/environment';

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
// SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: display available survey templates and the user's in-progress drafts
export class SurveyListComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private currentLocale = 'en-US';

  surveys: SurveyListItem[] = [];
  drafts: Map<string, SurveyResponseListItem[]> = new Map();
  loading = true;
  error: string | null = null;
  private _deleteInProgress = false;

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: inject services needed to load surveys, manage drafts, and route (pure)
  constructor(
    private surveyService: SurveyService,
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
    private transloco: TranslocoService,
    private languageService: LanguageService,
    private dialog: MatDialog,
  ) {}

  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: subscribe to locale changes and fetch initial survey and draft data
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
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: fetch active survey templates then trigger draft loading (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: fetch the user's draft responses and group them by survey template (reads DB)
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
  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: return cached draft responses for a given survey template (pure)
  getDrafts(surveyId: string): SurveyResponseListItem[] {
    return this.drafts.get(surveyId) ?? [];
  }

  /**
   * Start a new survey
   * If confidential threat models feature is enabled, prompts for confidentiality first
   */
  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: create a new draft response and navigate to the survey fill page
  startSurvey(survey: SurveyListItem): void {
    if (environment.enableConfidentialThreatModels) {
      const dialogRef = this.dialog.open(SurveyConfidentialDialogComponent, {
        width: '450px',
        maxWidth: '90vw',
      });

      dialogRef
        .afterClosed()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((isConfidential: boolean | undefined) => {
          if (isConfidential === undefined) {
            return; // Dialog was dismissed
          }
          this.createDraftAndNavigate(survey, isConfidential);
        });
    } else {
      this.createDraftAndNavigate(survey, false);
    }
  }

  // SEM@6b35da8ffade83ef6579f36d41c97823a2565785: create a draft survey response with confidentiality flag then navigate to fill it
  private createDraftAndNavigate(survey: SurveyListItem, isConfidential: boolean): void {
    this.responseService
      .createDraft({ survey_id: survey.id, is_confidential: isConfidential })
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
  // SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: navigate to fill an existing draft response, guarded against concurrent deletes
  continueDraft(draft: SurveyResponseListItem): void {
    if (this._deleteInProgress) {
      return;
    }
    void this.router.navigate(['/intake', 'fill', draft.survey_id, draft.id]);
  }

  /**
   * Delete a draft
   */
  // SEM@784529f3f6b1e5e06e660d4dc5b92aebddd8ee23: delete a draft response and reload the draft list (mutates shared state)
  deleteDraft(draft: SurveyResponseListItem, event: Event): void {
    event.stopPropagation();
    this._deleteInProgress = true;

    this.responseService
      .deleteDraft(draft.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this._deleteInProgress = false;
        }),
      )
      .subscribe({
        next: () => {
          this.loadDrafts();
        },
        error: error => {
          this.logger.error('Failed to delete draft', error);
          this.cdr.markForCheck();
        },
      });
  }

  /**
   * Navigate to my responses
   */
  // SEM@dad0c81f4d87ea8457ac6ef32b1aedf685dc20ad: navigate to the user's submitted survey responses page
  viewMyResponses(): void {
    void this.router.navigate(['/intake', 'my-responses']);
  }

  /**
   * Format relative time for drafts
   * Uses Intl.RelativeTimeFormat for proper internationalization
   */
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: convert a date string to a localized human-readable relative time label (pure)
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
  // SEM@9c800b8e11599d4cacaebf3db0b01bc0e8e5c25e: format a numeric time delta as a localized relative time string with fallback (pure)
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
