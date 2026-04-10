import { Locator, Page } from '@playwright/test';

export class CreateTmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-tm-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-tm-submit');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async submit() {
    await this.submitButton().click();
  }
}
