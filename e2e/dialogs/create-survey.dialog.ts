import { Locator, Page } from '@playwright/test';

export class CreateSurveyDialog {
  private dialog: Locator;

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

  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  async fillVersion(version: string) {
    await this.versionInput().clear();
    await this.versionInput().fill(version);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
