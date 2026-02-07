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
import { TranslocoModule } from '@jsverse/transloco';
import {
  COMMON_IMPORTS,
  CORE_MATERIAL_IMPORTS,
  DATA_MATERIAL_IMPORTS,
  FEEDBACK_MATERIAL_IMPORTS,
} from '@app/shared/imports';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyTemplateService } from '../../services/survey-template.service';
import { SurveyResponseService } from '../../services/survey-response.service';
import { SurveyTemplateListItem, SurveyResponseListItem } from '@app/types/survey.types';

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

  templates: SurveyTemplateListItem[] = [];
  drafts: Map<string, SurveyResponseListItem[]> = new Map();
  loading = true;
  error: string | null = null;

  constructor(
    private templateService: SurveyTemplateService,
    private responseService: SurveyResponseService,
    private router: Router,
    private logger: LoggerService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  /**
   * Load active templates and user's drafts
   */
  loadData(): void {
    this.loading = true;
    this.error = null;

    // Load active templates
    this.templateService
      .listActive()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          this.templates = response.survey_templates;
          this.loadDrafts();
        },
        error: error => {
          this.error = 'Failed to load surveys';
          this.loading = false;
          this.logger.error('Failed to load survey templates', error);
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
            const existing = this.drafts.get(draft.template_id) ?? [];
            existing.push(draft);
            this.drafts.set(draft.template_id, existing);
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
  getDrafts(templateId: string): SurveyResponseListItem[] {
    return this.drafts.get(templateId) ?? [];
  }

  /**
   * Start a new survey
   */
  startSurvey(template: SurveyTemplateListItem): void {
    this.responseService
      .createDraft({ template_id: template.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          void this.router.navigate(['/surveys', 'fill', template.id, response.id]);
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
    void this.router.navigate(['/surveys', 'fill', draft.template_id, draft.id]);
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
    void this.router.navigate(['/surveys', 'my-responses']);
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
   * Format relative time for drafts
   */
  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'just now';
    } else if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }
  }
}
