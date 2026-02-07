import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { COMMON_IMPORTS, ALL_MATERIAL_IMPORTS } from '@app/shared/imports';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { LoggerService } from '@app/core/services/logger.service';
import { SurveyService } from '@app/pages/surveys/services/survey.service';
import {
  Survey,
  SurveyJsonSchema,
  SurveyQuestion,
  QuestionType,
  TmFieldPath,
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
  surveyId: string | null = null;

  /** Current template being edited */
  template: Survey | null = null;

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

  /** Index of selected question within its parent container */
  selectedQuestionIndex: number = -1;

  /** Parent panel of the selected question (null if top-level) */
  selectedParentPanel: SurveyQuestion | null = null;

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

  /** Available question types for the palette (label/description are transloco keys) */
  questionTypes: QuestionTypeConfig[] = [
    {
      type: 'text',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.text',
      icon: 'short_text',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.text',
    },
    {
      type: 'comment',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.comment',
      icon: 'notes',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.comment',
    },
    {
      type: 'radiogroup',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.radiogroup',
      icon: 'radio_button_checked',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.radiogroup',
    },
    {
      type: 'checkbox',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.checkbox',
      icon: 'check_box',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.checkbox',
    },
    {
      type: 'boolean',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.boolean',
      icon: 'toggle_on',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.boolean',
    },
    {
      type: 'dropdown',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.dropdown',
      icon: 'arrow_drop_down_circle',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.dropdown',
    },
    {
      type: 'panel',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.panel',
      icon: 'dashboard',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.panel',
    },
    {
      type: 'paneldynamic',
      label: 'adminSurveys.templateBuilder.questionTypeLabels.paneldynamic',
      icon: 'dynamic_form',
      description: 'adminSurveys.templateBuilder.questionTypeDescriptions.paneldynamic',
    },
  ];

  /** Available TM field paths for question mapping (label values are transloco keys) */
  tmFieldOptions: { value: TmFieldPath; label: string }[] = [
    { value: 'name', label: 'adminSurveys.templateBuilder.tmFieldLabels.name' },
    { value: 'description', label: 'adminSurveys.templateBuilder.tmFieldLabels.description' },
    { value: 'issue_uri', label: 'adminSurveys.templateBuilder.tmFieldLabels.issueUri' },
    { value: 'metadata.{key}', label: 'adminSurveys.templateBuilder.tmFieldLabels.metadataKey' },
    { value: 'assets[].name', label: 'adminSurveys.templateBuilder.tmFieldLabels.assetName' },
    {
      value: 'assets[].description',
      label: 'adminSurveys.templateBuilder.tmFieldLabels.assetDescription',
    },
    { value: 'assets[].type', label: 'adminSurveys.templateBuilder.tmFieldLabels.assetType' },
    {
      value: 'documents[].name',
      label: 'adminSurveys.templateBuilder.tmFieldLabels.documentName',
    },
    { value: 'documents[].uri', label: 'adminSurveys.templateBuilder.tmFieldLabels.documentUrl' },
    {
      value: 'repositories[].name',
      label: 'adminSurveys.templateBuilder.tmFieldLabels.repositoryName',
    },
    {
      value: 'repositories[].uri',
      label: 'adminSurveys.templateBuilder.tmFieldLabels.repositoryUrl',
    },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private logger: LoggerService,
    private translocoService: TranslocoService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.surveyId = params.get('surveyId');
      if (this.surveyId) {
        this.loadTemplate(this.surveyId);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load an existing template for editing (single fetch — template includes survey_json)
   */
  private loadTemplate(surveyId: string): void {
    this.isLoading = true;
    this.error = null;

    this.surveyService
      .getByIdAdmin(surveyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (template: Survey) => {
          this.template = template;
          this.surveyJson = template.survey_json;
          this.isLoading = false;
          this.logger.debug('Template loaded', { surveyId, version: template.version });
        },
        error: (err: unknown) => {
          this.isLoading = false;
          this.error = this.translocoService.translate(
            'adminSurveys.templateBuilder.failedToLoadTemplate',
          );
          this.logger.error('Failed to load template', err);
        },
      });
  }

  /**
   * Add a new question. If a panel is selected, adds as a child of that panel.
   * Otherwise adds to the current page's top-level elements.
   */
  addQuestion(type: QuestionType): void {
    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    if (!currentPage) return;

    // Determine the target container: a selected panel or the page
    const targetPanel = this.getSelectedPanel();
    const targetContainer = targetPanel ? this.getPanelChildren(targetPanel) : currentPage.elements;

    if (!targetContainer) return;

    const newQuestion: SurveyQuestion = {
      type,
      name: this.generateQuestionName(),
      title: `New ${this.translocoService.translate(this.getQuestionTypeLabel(type))}`,
    };

    // Add default choices for choice-based questions
    if (['radiogroup', 'checkbox', 'dropdown'].includes(type)) {
      newQuestion.choices = ['Option 1', 'Option 2', 'Option 3'];
    }

    // Initialize child array for panel types
    if (type === 'panel') {
      newQuestion.elements = [];
    }
    if (type === 'paneldynamic') {
      newQuestion.templateElements = [];
    }

    targetContainer.push(newQuestion);

    // Select the new question
    this.selectedQuestion = newQuestion;
    this.selectedQuestionIndex = targetContainer.length - 1;
    this.selectedParentPanel = targetPanel;
    this.hasUnsavedChanges = true;
  }

  /**
   * Get the selected panel if the current selection is a panel type,
   * or the parent panel if a child question is selected.
   */
  private getSelectedPanel(): SurveyQuestion | null {
    if (!this.selectedQuestion) return null;
    if (this.selectedQuestion.type === 'panel' || this.selectedQuestion.type === 'paneldynamic') {
      return this.selectedQuestion;
    }
    return this.selectedParentPanel;
  }

  /**
   * Get the children array of a panel question
   */
  private getPanelChildren(panel: SurveyQuestion): SurveyQuestion[] {
    if (panel.type === 'paneldynamic') {
      if (!panel.templateElements) panel.templateElements = [];
      return panel.templateElements;
    }
    if (!panel.elements) panel.elements = [];
    return panel.elements;
  }

  /**
   * Generate a unique question name
   */
  private generateQuestionName(): string {
    const existingNames = new Set<string>();
    this.collectQuestionNames(this.surveyJson, existingNames);
    let counter = existingNames.size + 1;
    while (existingNames.has(`question${counter}`)) {
      counter++;
    }
    return `question${counter}`;
  }

  /**
   * Collect all question names recursively
   */
  private collectQuestionNames(schema: SurveyJsonSchema, names: Set<string>): void {
    for (const page of schema.pages ?? []) {
      this.collectElementNames(page.elements ?? [], names);
    }
  }

  private collectElementNames(elements: SurveyQuestion[], names: Set<string>): void {
    for (const el of elements) {
      names.add(el.name);
      if (el.elements) this.collectElementNames(el.elements, names);
      if (el.templateElements) this.collectElementNames(el.templateElements, names);
    }
  }

  /**
   * Get label for a question type
   */
  private getQuestionTypeLabel(type: QuestionType): string {
    const config = this.questionTypes.find(q => q.type === type);
    return config?.label ?? type;
  }

  /**
   * Select a question for editing
   */
  selectQuestion(question: SurveyQuestion, index: number, parent?: SurveyQuestion): void {
    this.selectedQuestion = question;
    this.selectedQuestionIndex = index;
    this.selectedParentPanel = parent ?? null;
  }

  /**
   * Delete the selected question
   */
  deleteSelectedQuestion(): void {
    if (this.selectedQuestionIndex < 0) return;

    const container = this.getSelectedContainer();
    if (!container) return;

    container.splice(this.selectedQuestionIndex, 1);
    this.selectedQuestion = null;
    this.selectedQuestionIndex = -1;
    this.selectedParentPanel = null;
    this.hasUnsavedChanges = true;
  }

  /**
   * Get the elements array containing the currently selected question
   */
  private getSelectedContainer(): SurveyQuestion[] | null {
    if (this.selectedParentPanel) {
      return this.getPanelChildren(this.selectedParentPanel);
    }
    const currentPage = this.surveyJson.pages?.[this.selectedPageIndex];
    return currentPage?.elements ?? null;
  }

  /**
   * Move question up in the list
   */
  moveQuestionUp(): void {
    if (this.selectedQuestionIndex <= 0) return;

    const container = this.getSelectedContainer();
    if (!container) return;

    const temp = container[this.selectedQuestionIndex - 1];
    container[this.selectedQuestionIndex - 1] = container[this.selectedQuestionIndex];
    container[this.selectedQuestionIndex] = temp;
    this.selectedQuestionIndex--;
    this.hasUnsavedChanges = true;
  }

  /**
   * Move question down in the list
   */
  moveQuestionDown(): void {
    const container = this.getSelectedContainer();
    if (!container) return;

    if (this.selectedQuestionIndex >= container.length - 1) return;

    const temp = container[this.selectedQuestionIndex + 1];
    container[this.selectedQuestionIndex + 1] = container[this.selectedQuestionIndex];
    container[this.selectedQuestionIndex] = temp;
    this.selectedQuestionIndex++;
    this.hasUnsavedChanges = true;
  }

  /**
   * Navigate to the previous page
   */
  previousPage(): void {
    if (this.selectedPageIndex > 0) {
      this.selectedPageIndex--;
      this.clearSelection();
    }
  }

  /**
   * Navigate to the next page
   */
  nextPage(): void {
    const pageCount = this.surveyJson.pages?.length ?? 0;
    if (this.selectedPageIndex < pageCount - 1) {
      this.selectedPageIndex++;
      this.clearSelection();
    }
  }

  /**
   * Clear the current question selection
   */
  private clearSelection(): void {
    this.selectedQuestion = null;
    this.selectedQuestionIndex = -1;
    this.selectedParentPanel = null;
  }

  /**
   * Delete the current page from the survey
   */
  deletePage(): void {
    const pages = this.surveyJson.pages;
    if (!pages || pages.length <= 1) return;

    pages.splice(this.selectedPageIndex, 1);
    if (this.selectedPageIndex >= pages.length) {
      this.selectedPageIndex = pages.length - 1;
    }
    this.clearSelection();
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
    this.clearSelection();
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

    const saveObservable = this.surveyId
      ? this.surveyService.update(this.surveyId, {
          name: this.template?.name ?? this.surveyJson.title ?? 'Untitled Survey',
          version: this.template?.version ?? '1',
          survey_json: this.surveyJson,
          description: this.template?.description,
          status: this.template?.status,
          settings: this.template?.settings,
        })
      : this.surveyService.create({
          name: this.surveyJson.title ?? 'Untitled Survey',
          version: '1',
          description: this.surveyJson.description,
          survey_json: this.surveyJson,
        });

    saveObservable.pipe(takeUntil(this.destroy$)).subscribe({
      next: (template: Survey) => {
        this.isSaving = false;
        this.hasUnsavedChanges = false;
        this.template = template;
        this.surveyId = template.id;
        this.logger.info('Template saved', { id: template.id });

        // Navigate to edit URL if this was a new template
        if (!this.route.snapshot.paramMap.get('surveyId')) {
          void this.router.navigate(['/admin/surveys', template.id], { replaceUrl: true });
        }
      },
      error: (err: unknown) => {
        this.isSaving = false;
        this.error = this.translocoService.translate(
          'adminSurveys.templateBuilder.failedToSaveTemplate',
        );
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
    const container = this.getSelectedContainer();
    if (!container) return false;
    return this.selectedQuestionIndex >= 0 && this.selectedQuestionIndex < container.length - 1;
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

  /**
   * Get the currently selected TM field path, or empty string for "None"
   */
  getSelectedTmFieldPath(): string {
    return this.selectedQuestion?.mapsToTmField?.path ?? '';
  }

  /**
   * Update the TM field mapping when the dropdown changes
   */
  updateTmFieldPath(path: string): void {
    if (!this.selectedQuestion) return;

    if (!path) {
      delete this.selectedQuestion.mapsToTmField;
    } else {
      this.selectedQuestion.mapsToTmField = {
        path: path as TmFieldPath,
        ...(path === 'metadata.{key}'
          ? { metadataKey: this.selectedQuestion.mapsToTmField?.metadataKey ?? '' }
          : {}),
      };
    }
    this.hasUnsavedChanges = true;
  }

  /**
   * Update the metadata key for metadata.{key} mappings
   */
  updateTmFieldMetadataKey(key: string): void {
    if (!this.selectedQuestion?.mapsToTmField) return;
    this.selectedQuestion.mapsToTmField.metadataKey = key;
    this.hasUnsavedChanges = true;
  }
}
