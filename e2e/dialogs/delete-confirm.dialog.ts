import { Locator, Page } from '@playwright/test';

export class DeleteConfirmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly confirmInput = () => this.dialog.getByTestId('delete-confirm-input');
  readonly confirmButton = () => this.dialog.getByTestId('delete-confirm-button');

  async confirmDeletion() {
    await this.confirmInput().waitFor({ state: 'visible' });
    await this.confirmInput().fill('gone forever');
    await this.confirmButton().click();
  }
}
