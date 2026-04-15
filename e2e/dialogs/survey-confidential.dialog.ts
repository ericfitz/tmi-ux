import { Locator, Page } from '@playwright/test';

export class SurveyConfidentialDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly noButton = () =>
    this.dialog.getByTestId('confidential-no-button');
  readonly yesButton = () =>
    this.dialog.getByTestId('confidential-yes-button');

  async selectNo() {
    await this.noButton().click();
  }

  async selectYes() {
    await this.yesButton().click();
  }
}
