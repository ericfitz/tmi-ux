import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: E2E page object for the create project dialog
export class CreateProjectDialog {
  private dialog: Locator;

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-project-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-project-description-input');
  readonly teamSelect = () => this.dialog.getByTestId('create-project-team-select');
  readonly uriInput = () => this.dialog.getByTestId('create-project-uri-input');
  readonly statusInput = () => this.dialog.getByTestId('create-project-status-select');
  readonly cancelButton = () => this.dialog.getByTestId('create-project-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('create-project-submit-button');

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the project name input field with a value (pure)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the project description input field with a value (pure)
  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: choose a team from the project team dropdown by name (pure)
  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the project URI input field with a value (pure)
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the project status field with a value (pure)
  async fillStatus(status: string) {
    await angularFill(this.statusInput(), status);
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: submit the create project dialog by clicking the submit button (pure)
  async submit() {
    await this.submitButton().click();
  }

  // SEM@3a9118c5db8177660c20240e60f82f5626388804: dismiss the create project dialog by clicking cancel (pure)
  async cancel() {
    await this.cancelButton().click();
  }
}
