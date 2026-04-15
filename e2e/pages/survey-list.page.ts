import { Page } from '@playwright/test';

export class SurveyListPage {
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
