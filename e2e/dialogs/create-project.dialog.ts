import { Locator, Page } from '@playwright/test';

export class CreateProjectDialog {
  private dialog: Locator;

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

  async fillName(name: string) {
    await this.nameInput().fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput().fill(description);
  }

  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillStatus(status: string) {
    await this.statusInput().fill(status);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
