import { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  readonly createTmButton = () =>
    this.page.getByTestId('create-threat-model-button');

  readonly tmCards = () =>
    this.page.getByTestId('threat-model-card');

  tmCard(name: string) {
    return this.tmCards().filter({ hasText: name });
  }

  tmDeleteButton(name: string) {
    return this.tmCard(name).getByTestId('threat-model-delete-button');
  }
}
