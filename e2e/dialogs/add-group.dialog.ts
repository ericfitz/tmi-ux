import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class AddGroupDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('add-group-name-input');
  readonly identifierInput = () => this.dialog.getByTestId('add-group-identifier-input');
  readonly descriptionInput = () => this.dialog.getByTestId('add-group-description-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-group-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-group-submit-button');

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillDescription(description: string) {
    await angularFill(this.descriptionInput(), description);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
