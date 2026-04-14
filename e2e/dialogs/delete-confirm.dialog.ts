import { expect, Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class DeleteConfirmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly confirmInput = () => this.dialog.getByTestId('delete-confirm-input');
  readonly confirmButton = () => this.dialog.getByTestId('delete-confirm-button');

  async confirmDeletion() {
    await this.confirmButton().waitFor({ state: 'visible' });
    // Typed confirmation is only required for some object types (not documents/repositories).
    // The input renders inside an @if block that may take an extra change detection cycle,
    // so we wait for it rather than using an instant isVisible() check.
    try {
      await this.confirmInput().waitFor({ state: 'visible', timeout: 2000 });
      await angularFill(this.confirmInput(), 'gone forever');
    } catch {
      // Input not present — typed confirmation not required for this object type
    }
    await expect(this.confirmButton()).toBeEnabled({ timeout: 5000 });
    await this.confirmButton().click();
  }
}
