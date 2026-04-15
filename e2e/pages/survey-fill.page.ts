import { Page } from '@playwright/test';

export class SurveyFillPage {
  constructor(private page: Page) {}

  readonly saveButton = () =>
    this.page.getByTestId('survey-fill-save-button');
  readonly closeButton = () =>
    this.page.getByTestId('survey-fill-close-button');
  readonly saveExitButton = () =>
    this.page.getByTestId('survey-fill-save-exit-button');
  readonly viewResponseButton = () =>
    this.page.getByTestId('survey-fill-view-response-button');
  readonly startAnotherButton = () =>
    this.page.getByTestId('survey-fill-start-another-button');
  readonly saveStatus = () =>
    this.page.getByTestId('survey-fill-status');
  readonly revisionNotes = () =>
    this.page.getByTestId('survey-fill-revision-notes');
}
