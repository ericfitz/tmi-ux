import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class CreateTeamDialog {
  private dialog: Locator;

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

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  async fillEmail(email: string) {
    await angularFill(this.emailInput(), email);
  }

  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  async selectStatus(status: string) {
    await this.statusSelect().click();
    await this.page.locator('mat-option').filter({ hasText: status }).click();
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
