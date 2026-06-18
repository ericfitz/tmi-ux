import { Locator, Page } from '@playwright/test';

// SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: page object for the survey confidentiality dialog; select yes or no
export class SurveyConfidentialDialog {
  private dialog: Locator;

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: bind the survey confidential page object to the Playwright page (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly noButton = () =>
    this.dialog.getByTestId('confidential-no-button');
  readonly yesButton = () =>
    this.dialog.getByTestId('confidential-yes-button');

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: decline survey confidentiality by clicking the No button
  async selectNo() {
    await this.noButton().click();
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: confirm survey confidentiality by clicking the Yes button
  async selectYes() {
    await this.yesButton().click();
  }
}
