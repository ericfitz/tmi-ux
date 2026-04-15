import { Locator, Page } from '@playwright/test';

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
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().fill(description);
  }

  async fillEmail(email: string) {
    await this.emailInput().fill(email);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
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
