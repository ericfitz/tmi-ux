import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

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
    await angularFill(this.nameInput(), name);
  }

  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  async selectTeam(teamName: string) {
    await this.teamSelect().click();
    await this.page.locator('mat-option').filter({ hasText: teamName }).click();
  }

  async fillUri(uri: string) {
    await angularFill(this.uriInput(), uri);
  }

  async fillStatus(status: string) {
    await angularFill(this.statusInput(), status);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
