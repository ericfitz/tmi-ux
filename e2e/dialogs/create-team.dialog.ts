import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: E2E page object for the create team dialog
export class CreateTeamDialog {
  private dialog: Locator;

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-team-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-team-description-input');
  readonly emailInput = () => this.dialog.getByTestId('create-team-email-input');
  readonly uriInput = () => this.dialog.getByTestId('create-team-uri-input');
  readonly statusSelect = () => this.dialog.getByTestId('create-team-status-select');
  readonly cancelButton = () => this.dialog.getByTestId('create-team-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('create-team-submit-button');

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the team name field in the create-team dialog (pure)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the team description field in the create-team dialog (pure)
  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the team email field in the create-team dialog (pure)
  async fillEmail(email: string) {
    await angularFill(this.emailInput(), email);
  }

  // SEM@e39d6bc80f404f961466ab734d8f0db2cea5bdea: populate the team URI field in the create-team dialog (pure)
  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: select a team status option in the create-team dialog dropdown
  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: submit the create-team dialog form
  async submit() {
    await this.submitButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: dismiss the create-team dialog without saving
  async cancel() {
    await this.cancelButton().click();
  }
}
