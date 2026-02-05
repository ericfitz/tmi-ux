import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { TranslocoModule } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyTemplateService } from '@app/pages/surveys/services/survey-template.service';
import {
  SurveyTemplate,
  SurveyJsonSchema,
  SurveyQuestion,
  QuestionType,
} from '@app/types/survey.types';

/**
 * Configuration for available question types in the palette
 */
interface QuestionTypeConfig {
  type: QuestionType;
  label: string;
  icon: string;
  description: string;
}

/**
 * Template builder component for creating and editing survey templates
 * Provides a hybrid UI with drag-drop ordering and form-based property editing
 */
@Component({
  selector: 'app-template-builder',
  standalone: true,
  imports: [...COMMON_IMPORTS, ...ALL_MATERIAL_IMPORTS, TranslocoModule],
  templateUrl: './template-builder.component.html',
  styleUrl: './template-builder.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class TemplateBuilderComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  /** Template ID from route (null for new template) */
  templateId: string | null = null;

  /** Current template being edited */
  template: SurveyTemplate | null = null;

  /** Survey JSON being built */
  surveyJson: SurveyJsonSchema = {
    title: 'New Survey',
    description: '',
    pages: [
      {
        name: 'page1',
        title: 'Page 1',
        elements: [],
      },
    ],
  };

  /** Currently selected question for editing */
  selectedQuestion: SurveyQuestion | null = null;

  /** Index of selected question */
  selectedQuestionIndex: number = -1;

  /** Selected page index */
  selectedPageIndex: number = 0;

  /** Loading state */
  isLoading = false;

  /** Saving state */
  isSaving = false;

  /** Error message */
  error: string | null = null;

  /** Whether form has unsaved changes */
  hasUnsavedChanges = false;

  /** Available question types for the palette */
  questionTypes: QuestionTypeConfig[] = [
    { type: 'text', label: 'Text', icon: 'short_text', description: 'Single line text input' },
    { type: 'comment', label: 'Multiline', icon: 'notes', description: 'Multi-line text area' },
    {
      type: 'radiogroup',
      label: 'Radio Group',
      icon: 'radio_button_checked',
      description: 'Single choice from options',
    },
    {
      type: 'checkbox',
      label: 'Checkbox',
      icon: 'check_box',
      description: 'Multiple choice selection',
    },
    { type: 'boolean', label: 'Yes/No', icon: 'toggle_on', description: 'Boolean toggle' },
    {
      type: 'dropdown',
      label: 'Dropdown',
      icon: 'arrow_drop_down_circle',
      description: 'Dropdown selection',
    },
    { type: 'rating', label: 'Rating', icon: 'star_rate', description: 'Numeric rating scale' },
    { type: 'panel', label: 'Panel', icon: 'dashboard', description: 'Group questions in a panel' },
    {
      type: 'paneldynamic',
      label: 'Dynamic Panel',
      icon: 'dynamic_form',
      description: 'Repeatable panel group',
    },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private templateService: SurveyTemplateService,
    private logger: LoggerService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.templateId = params.get('templateId');
      if (this.templateId) {
        this.loadTemplate(this.templateId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load an existing template for editing
   */
  private loadTemplate(templateId: string): void {
    this.isLoading = true;
    this.error = null;

    this.templateService
      .getById(templateId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template: SurveyTemplate) => {
          this.template = template;
          this.loadTemplateVersion(templateId, template.current_version);
        },
        error: (err: unknown) => {
          this.isLoading = false;
          this.error = 'Failed to load template';
          this.logger.error('Failed to load template', err);
        },
      });
  }

  /**
   * Load the survey JSON for a specific version
   */
  private loadTemplateVersion(templateId: string, version: number): void {
    this.templateService
      .getVersionJson(templateId, version)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (surveyJson: SurveyJsonSchema) => {
          this.surveyJson = surveyJson;
          this.isLoading = false;
          this.logger.debug('Template loaded', { templateId, version });
        },
        error: (err: unknown) => {
          this.isLoading = false;
          this.error = 'Failed to load survey definition';
          this.logger.error('Failed to load survey JSON', err);
        },
      });
  }

  /**
   * Add a new question to the current page
   */
  addQuestion(type: QuestionType): void {
    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage) return;

    const questionCount = currentPage.elements?.length ?? 0;
    const newQuestion: SurveyQuestion = {
      type,
      name: `question${questionCount + 1}`,
      title: `Question ${questionCount + 1}`,
    };

    // Add default choices for choice-based questions
    if (['radiogroup', 'checkbox', 'dropdown'].includes(type)) {
      newQuestion.choices = ['Option 1', 'Option 2', 'Option 3'];
    }

    if (!currentPage.elements) {
      currentPage.elements = [];
    }
    currentPage.elements.push(newQuestion);

    // Select the new question
    this.selectedQuestion = newQuestion;
    this.selectedQuestionIndex = currentPage.elements.length - 1;
    this.hasUnsavedChanges = true;
  }

  /**
   * Select a question for editing
   */
  selectQuestion(question: SurveyQuestion, index: number): void {
    this.selectedQuestion = question;
    this.selectedQuestionIndex = index;
  }

  /**
   * Delete the selected question
   */
  deleteSelectedQuestion(): void {
    if (this.selectedQuestionIndex < 0) return;

    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage?.elements) return;

    currentPage.elements.splice(this.selectedQuestionIndex, 1);
    this.selectedQuestion = null;
    this.selectedQuestionIndex = -1;
    this.hasUnsavedChanges = true;
  }

  /**
   * Move question up in the list
   */
  moveQuestionUp(): void {
    if (this.selectedQuestionIndex <= 0) return;

    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage?.elements) return;

    const questions = currentPage.elements;
    const temp = questions[this.selectedQuestionIndex - 1];
    questions[this.selectedQuestionIndex - 1] = questions[this.selectedQuestionIndex];
    questions[this.selectedQuestionIndex] = temp;
    this.selectedQuestionIndex--;
    this.hasUnsavedChanges = true;
  }

  /**
   * Move question down in the list
   */
  moveQuestionDown(): void {
    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage?.elements) return;

    if (this.selectedQuestionIndex >= currentPage.elements.length - 1) return;

    const questions = currentPage.elements;
    const temp = questions[this.selectedQuestionIndex + 1];
    questions[this.selectedQuestionIndex + 1] = questions[this.selectedQuestionIndex];
    questions[this.selectedQuestionIndex] = temp;
    this.selectedQuestionIndex++;
    this.hasUnsavedChanges = true;
  }

  /**
   * Add a new page to the survey
   */
  addPage(): void {
    if (!this.surveyJson.pages) {
      this.surveyJson.pages = [];
    }
    const pageCount = this.surveyJson.pages.length;
    this.surveyJson.pages.push({
      name: `page${pageCount + 1}`,
      title: `Page ${pageCount + 1}`,
      elements: [],
    });
    this.selectedPageIndex = this.surveyJson.pages.length - 1;
    this.selectedQuestion = null;
    this.selectedQuestionIndex = -1;
    this.hasUnsavedChanges = true;
  }

  /**
   * Update survey metadata
   */
  updateSurveyTitle(title: string): void {
    this.surveyJson.title = title;
    this.hasUnsavedChanges = true;
  }

  updateSurveyDescription(description: string): void {
    this.surveyJson.description = description;
    this.hasUnsavedChanges = true;
  }

  /**
   * Save the template
   */
  save(): void {
    this.isSaving = true;
    this.error = null;

    const saveObservable = this.templateId
      ? this.templateService.update(this.templateId, {
          survey_json: this.surveyJson,
          change_summary: 'Updated via builder',
        })
      : this.templateService.create({
          name: this.surveyJson.title ?? 'Untitled Survey',
          description: this.surveyJson.description,
          survey_json: this.surveyJson,
        });

    saveObservable.pipe(takeUntil(this.destroy$)).subscribe({
      next: (template: SurveyTemplate) => {
        this.isSaving = false;
        this.hasUnsavedChanges = false;
        this.template = template;
        this.templateId = template.id;
        this.logger.info('Template saved', { id: template.id });

        // Navigate to edit URL if this was a new template
        if (!this.route.snapshot.paramMap.get('templateId')) {
          void this.router.navigate(['/admin/surveys', template.id], { replaceUrl: true });
        }
      },
      error: (err: unknown) => {
        this.isSaving = false;
        this.error = 'Failed to save template';
        this.logger.error('Failed to save template', err);
      },
    });
  }

  /**
   * Navigate back to template list
   */
  goBack(): void {
    void this.router.navigate(['/admin/surveys']);
  }

  /**
   * Get the current page elements
   */
  get currentPageElements(): SurveyQuestion[] {
    return this.surveyJson.pages?.[this.selectedPageIndex]?.elements ?? [];
  }

  /**
   * Check if we can move the selected question up
   */
  get canMoveUp(): boolean {
    return this.selectedQuestionIndex > 0;
  }

  /**
   * Check if we can move the selected question down
   */
  get canMoveDown(): boolean {
    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage?.elements) return false;
    return (
      this.selectedQuestionIndex >= 0 &&
      this.selectedQuestionIndex < currentPage.elements.length - 1
    );
  }

  /**
   * Get icon for a question type
   */
  getQuestionIcon(type: QuestionType): string {
    const config = this.questionTypes.find(q => q.type === type);
    return config?.icon ?? 'help_outline';
  }

  /**
   * Get choices text for the textarea editor
   */
  getChoicesText(): string {
    if (!this.selectedQuestion?.choices) return '';
    return this.selectedQuestion.choices.map(c => (typeof c === 'string' ? c : c.text)).join('\n');
  }

  /**
   * Update choices from textarea text input
   */
  updateChoicesFromText(text: string): void {
    if (!this.selectedQuestion) return;
    this.selectedQuestion.choices = text.split('\n').filter(c => c.trim());
    this.hasUnsavedChanges = true;
  }
}
