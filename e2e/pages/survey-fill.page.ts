import { Page } from '@playwright/test';

// SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: Playwright page object exposing locators for the survey fill-in form (pure)
export class SurveyFillPage {
  // SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: bind Playwright page instance to the page object (pure)
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
