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
    { type: 'panel', label: 'Panel', icon: 'dashboard', description: 'Group questions in a panel' },
    {
      type: 'paneldynamic',
      label: 'Dynamic Panel',
      icon: 'dynamic_form',
      description: 'Repeatable panel group',
    },
  ];

  /** Available TM field paths for question mapping */
  tmFieldOptions: { value: TmFieldPath; label: string }[] = [
    { value: 'name', label: 'Threat Model Name' },
    { value: 'description', label: 'Threat Model Description' },
    { value: 'issue_uri', label: 'Issue Tracking URL' },
    { value: 'metadata.{key}', label: 'Custom Metadata' },
    { value: 'assets[].name', label: 'Asset Name' },
    { value: 'assets[].description', label: 'Asset Description' },
    { value: 'assets[].type', label: 'Asset Type' },
    { value: 'documents[].name', label: 'Document Name' },
    { value: 'documents[].uri', label: 'Document URL' },
    { value: 'repositories[].name', label: 'Repository Name' },
    { value: 'repositories[].uri', label: 'Repository URL' },
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
      title: `New ${this.getQuestionTypeLabel(type)}`,
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
