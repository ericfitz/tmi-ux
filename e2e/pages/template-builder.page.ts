import { Page } from '@playwright/test';

export class TemplateBuilderPage {
  constructor(private page: Page) {}

  readonly saveButton = () =>
    this.page.getByTestId('builder-save-button');
  readonly deleteButton = () =>
    this.page.getByTestId('builder-delete-button');
  readonly closeButton = () =>
    this.page.getByTestId('builder-close-button');
  readonly surveyName = () =>
    this.page.getByTestId('builder-survey-name');
  readonly surveyVersion = () =>
    this.page.getByTestId('builder-survey-version');
  readonly surveyTitle = () =>
    this.page.getByTestId('builder-survey-title');
  readonly surveyDescription = () =>
    this.page.getByTestId('builder-survey-description');
  readonly addQuestionButton = (type: string) =>
    this.page.getByTestId(`builder-add-question-${type}`);
  readonly questionItems = () =>
    this.page.getByTestId('builder-question-item');
  readonly questionItem = (name: string) =>
    this.questionItems().filter({ hasText: name });
  readonly questionMoveUp = (name: string) =>
    this.questionItem(name).getByTestId('builder-question-move-up');
  readonly questionDelete = () =>
    this.page.getByTestId('builder-question-delete');
  readonly questionName = () =>
    this.page.getByTestId('builder-question-name');
  readonly questionTitle = () =>
    this.page.getByTestId('builder-question-title');
  readonly questionDescription = () =>
    this.page.getByTestId('builder-question-description');
  readonly questionRequired = () =>
    this.page.getByTestId('builder-question-required');
  readonly questionChoices = () =>
    this.page.getByTestId('builder-question-choices');
  readonly questionVisibleIf = () =>
    this.page.getByTestId('builder-question-visible-if');
  readonly questionEnableIf = () =>
    this.page.getByTestId('builder-question-enable-if');
  readonly questionRequiredIf = () =>
    this.page.getByTestId('builder-question-required-if');
  readonly questionTmField = () =>
    this.page.getByTestId('builder-question-tm-field');
  readonly pagePrev = () =>
    this.page.getByTestId('builder-page-prev');
  readonly pageNext = () =>
    this.page.getByTestId('builder-page-next');
  readonly pageAdd = () =>
    this.page.getByTestId('builder-page-add');
  readonly pageDelete = () =>
    this.page.getByTestId('builder-page-delete');
}
