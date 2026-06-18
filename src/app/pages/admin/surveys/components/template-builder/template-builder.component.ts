import { Component, OnInit, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { getErrorMessage } from '@app/shared/utils/http-error.utils';

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
// SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: build and edit survey templates with question palette and page management (mutates shared state)
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

  // SEM@96c34d433bdf8694a9679b9d7e88dddcc1d5563f: inject routing, survey, logger, i18n, and snackbar dependencies (pure)
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private surveyService: SurveyService,
    private logger: LoggerService,
    private translocoService: TranslocoService,
    private snackBar: MatSnackBar,
  ) {}

  // SEM@f650732a10e522d28e3c52ea94237d13f4fe5ec1: subscribe to route params and fetch existing survey template if ID present
  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.surveyId = params.get('surveyId');
      if (this.surveyId) {
        this.loadTemplate(this.surveyId);
      }
    });
  }

  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: complete the destroy subject to unsubscribe all active observables (mutates shared state)
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /**
   * Load an existing template for editing (single fetch — template includes survey_json)
   */
  // SEM@c9c830326d3b87fb4b5140d374f4a52df631c454: fetch a survey template by ID and populate the editor state (reads DB)
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
  // SEM@c9c830326d3b87fb4b5140d374f4a52df631c454: append a new question of given type to the selected panel or current page (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: return the active panel question or its parent panel for the current selection (pure)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: return the child elements array for a static or dynamic panel question (pure)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: compute a unique question name not already used in the survey schema (pure)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: aggregate all question names across all pages into a set (pure)
  private collectQuestionNames(schema: SurveyJsonSchema, names: Set<string>): void {
    for (const page of schema.pages ?? []) {
      this.collectElementNames(page.elements ?? [], names);
    }
  }

  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: recursively collect question names from a flat or nested element list (pure)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: resolve the i18n label key for a given question type (pure)
  private getQuestionTypeLabel(type: QuestionType): string {
    const config = this.questionTypes.find(q => q.type === type);
    return config?.label ?? type;
  }

  /**
   * Select a question for editing
   */
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: set a question as the active selection for property editing (mutates shared state)
  selectQuestion(question: SurveyQuestion, index: number, parent?: SurveyQuestion): void {
    this.selectedQuestion = question;
    this.selectedQuestionIndex = index;
    this.selectedParentPanel = parent ?? null;
  }

  /**
   * Delete the selected question
   */
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: remove the currently selected question from its container (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: return the elements array that contains the currently selected question (pure)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: swap the selected question with the preceding sibling in its container (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: swap the selected question with the following sibling in its container (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: navigate to the preceding survey page and clear the question selection (mutates shared state)
  previousPage(): void {
    if (this.selectedPageIndex > 0) {
      this.selectedPageIndex--;
      this.clearSelection();
    }
  }

  /**
   * Navigate to the next page
   */
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: navigate to the following survey page and clear the question selection (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: deselect the active question and reset selection state (mutates shared state)
  private clearSelection(): void {
    this.selectedQuestion = null;
    this.selectedQuestionIndex = -1;
    this.selectedParentPanel = null;
  }

  /**
   * Delete the current page from the survey
   */
  // SEM@0b4b1722d16bd0c53063693240a274bd578e11fb: remove the current survey page, refusing if it is the only page (mutates shared state)
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
  // SEM@3893145ca948e6e76cfe14e3cc690c3e1c2932fc: append a new blank page to the survey and navigate to it (mutates shared state)
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
   * Update template name
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: update the survey template's display name and mark unsaved changes (mutates shared state)
  updateTemplateName(name: string): void {
    if (this.template) {
      this.template.name = name;
      this.hasUnsavedChanges = true;
    }
  }

  /**
   * Update template version
   */
  // SEM@6297e6cb099bef2dccad14f9ce7b634369834014: update the survey template's version string and mark unsaved changes (mutates shared state)
  updateTemplateVersion(version: string): void {
    if (this.template) {
      this.template.version = version;
      this.hasUnsavedChanges = true;
    }
  }

  /**
   * Update survey metadata
   */
  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: update the survey JSON title field and mark unsaved changes (mutates shared state)
  updateSurveyTitle(title: string): void {
    this.surveyJson.title = title;
    this.hasUnsavedChanges = true;
  }

  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: update the survey template description and mark unsaved changes (mutates shared state)
  updateSurveyDescription(description: string): void {
    this.surveyJson.description = description;
    this.hasUnsavedChanges = true;
  }

  /**
   * Save the template
   */
  // SEM@c9c830326d3b87fb4b5140d374f4a52df631c454: store the current survey template, creating or updating via API
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
   * Delete the current survey after confirmation
   */
  // SEM@199afb71dcd141f16d7dad3caaa1b7a3d6c17ce5: delete the current survey template after user confirmation, then navigate away
  deleteSurvey(): void {
    if (!this.surveyId || !this.template) return;

    const item = this.translocoService.translate('common.objectTypes.survey');
    const message = this.translocoService.translate('common.confirmDelete', {
      item,
      name: this.template.name,
    });

    if (!confirm(message)) return;

    this.surveyService
      .deleteSurvey(this.surveyId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          void this.router.navigate(['/admin/surveys']);
        },
        error: (error: unknown) => {
          const errorMessage = getErrorMessage(error);
          this.snackBar.open(
            this.translocoService.translate('adminSurveys.deleteError', { error: errorMessage }),
            this.translocoService.translate('common.dismiss'),
            { duration: 5000 },
          );
        },
      });
  }

  /**
   * Navigate back to template list
   */
  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: navigate to the survey template list page
  goBack(): void {
    void this.router.navigate(['/admin/surveys']);
  }

  /**
   * Open SurveyJS conditional logic documentation in a new tab
   */
  // SEM@af8cee3f989d4b8f5d65230963d62a5bbe79f0e6: open the SurveyJS conditional logic documentation in a new browser tab
  openConditionHelp(): void {
    window.open(
      'https://surveyjs.io/form-library/documentation/design-survey/conditional-logic',
      '_blank',
    );
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
  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: map a question type to its display icon name (pure)
  getQuestionIcon(type: QuestionType): string {
    const config = this.questionTypes.find(q => q.type === type);
    return config?.icon ?? 'help_outline';
  }

  /**
   * Get choices text for the textarea editor
   */
  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: format the selected question's choices as a newline-delimited string (pure)
  getChoicesText(): string {
    if (!this.selectedQuestion?.choices) return '';
    return this.selectedQuestion.choices.map(c => (typeof c === 'string' ? c : c.text)).join('\n');
  }

  /**
   * Update choices from textarea text input
   */
  // SEM@47259dcc3bd1f66f245714931e1330a50558a80a: parse newline-delimited text and update the selected question's choices (mutates shared state)
  updateChoicesFromText(text: string): void {
    if (!this.selectedQuestion) return;
    this.selectedQuestion.choices = text.split('\n').filter(c => c.trim());
    this.hasUnsavedChanges = true;
  }

  /**
   * Get the currently selected TM field path, or empty string for "None"
   */
  // SEM@388c5937657a71aaa51d5d6f21eb026eebd834c6: return the threat-model field path mapped to the selected question, or empty string (pure)
  getSelectedTmFieldPath(): string {
    return this.selectedQuestion?.mapsToTmField?.path ?? '';
  }

  /**
   * Update the TM field mapping when the dropdown changes
   */
  // SEM@388c5937657a71aaa51d5d6f21eb026eebd834c6: update the selected question's threat-model field mapping from the dropdown value (mutates shared state)
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
  // SEM@388c5937657a71aaa51d5d6f21eb026eebd834c6: update the metadata key on the selected question's threat-model field mapping (mutates shared state)
  updateTmFieldMetadataKey(key: string): void {
    if (!this.selectedQuestion?.mapsToTmField) return;
    this.selectedQuestion.mapsToTmField.metadataKey = key;
    this.hasUnsavedChanges = true;
  }
}
