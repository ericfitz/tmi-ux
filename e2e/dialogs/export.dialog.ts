import { Locator, Page } from '@playwright/test';

export class ExportDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly saveButton = () => this.dialog.getByTestId('export-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('export-cancel-button');
  readonly retryButton = () => this.dialog.getByTestId('export-retry-button');
  readonly status = () => this.dialog.getByTestId('export-status');

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
