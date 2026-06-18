import { Locator, Page } from '@playwright/test';

// SEM@bece9afbb4283fefea5c408379d798698a5459d8: E2E page object for the export dialog with save/cancel/retry (pure)
export class ExportDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly saveButton = () => this.dialog.getByTestId('export-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('export-cancel-button');
  readonly retryButton = () => this.dialog.getByTestId('export-retry-button');
  readonly status = () => this.dialog.getByTestId('export-status');

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the export dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the export dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
