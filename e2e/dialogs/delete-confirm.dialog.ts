import { expect, Locator, Page } from '@playwright/test';

export class DeleteConfirmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly confirmInput = () => this.dialog.getByTestId('delete-confirm-input');
  readonly confirmButton = () => this.dialog.getByTestId('delete-confirm-button');

  async confirmDeletion() {
    await this.confirmButton().waitFor({ state: 'visible' });
    // Typed confirmation is only required for some object types (not documents/repositories)
    if (await this.confirmInput().isVisible()) {
      await this.confirmInput().fill('gone forever');
    }
    await expect(this.confirmButton()).toBeEnabled({ timeout: 5000 });
    await this.confirmButton().click();
  }
}
