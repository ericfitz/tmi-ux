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
      await this.confirmInput().clear();
      await this.confirmInput().pressSequentially('gone forever');
      // Dispatch input event to sync Angular's ngModel — pressSequentially fires
      // per-character key events but doesn't reliably trigger the (input) handler
      await this.confirmInput().dispatchEvent('input');
    }
    await expect(this.confirmButton()).toBeEnabled({ timeout: 5000 });
    await this.confirmButton().click();
  }
}
