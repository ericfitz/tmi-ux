import { Page } from '@playwright/test';

// SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: Playwright page object exposing locators for the survey list and draft items (pure)
export class SurveyListPage {
  // SEM@ca1d0abed3756a76ed4ddd81d7daf443a65eacdf: bind Playwright page instance to the page object (pure)
  constructor(private page: Page) {}

  readonly myResponsesButton = () =>
    this.page.getByTestId('survey-list-my-responses-button');
  readonly surveyCards = () =>
    this.page.getByTestId('survey-list-survey-card');
  readonly surveyCard = (name: string) =>
    this.surveyCards().filter({ hasText: name });
  readonly draftItems = () =>
    this.page.getByTestId('survey-list-draft-item');
  readonly draftItem = (name: string) =>
    this.draftItems().filter({ hasText: name });
  readonly draftDeleteButton = (name: string) =>
    this.draftItem(name).getByTestId('survey-list-draft-delete-button');
  readonly draftContinueButton = (name: string) =>
    this.surveyCard(name).getByTestId('survey-list-draft-continue-button');
  readonly startButton = (surveyName: string) =>
    this.surveyCard(surveyName).getByTestId('survey-list-start-button');
}
