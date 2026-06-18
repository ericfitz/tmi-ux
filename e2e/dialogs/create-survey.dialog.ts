import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: E2E page object for the create survey dialog
export class CreateSurveyDialog {
  private dialog: Locator;

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () =>
    this.dialog.getByTestId('create-survey-name-input');
  readonly versionInput = () =>
    this.dialog.getByTestId('create-survey-version-input');
  readonly cancelButton = () =>
    this.dialog.getByTestId('create-survey-cancel-button');
  readonly submitButton = () =>
    this.dialog.getByTestId('create-survey-submit-button');

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: populate the survey name input field with a value (pure)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@a2b11c7450c617ac1ba0c8f95c47efc49d0635c3: populate the survey version input field with a value (pure)
  async fillVersion(version: string) {
    await angularFill(this.versionInput(), version);
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: submit the create survey dialog by clicking the submit button (pure)
  async submit() {
    await this.submitButton().click();
  }

  // SEM@a220b6fd61643aac98cbaaebf893cc20e67b27f7: dismiss the create survey dialog by clicking cancel (pure)
  async cancel() {
    await this.cancelButton().click();
  }
}
