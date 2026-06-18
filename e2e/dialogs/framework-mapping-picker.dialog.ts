import { Locator, Page } from '@playwright/test';

// SEM@bece9afbb4283fefea5c408379d798698a5459d8: E2E page object for the framework mapping picker dialog (pure)
export class FrameworkMappingPickerDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly checkboxes = () => this.dialog.getByTestId('framework-mapping-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('framework-mapping-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('framework-mapping-cancel-button');

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: locate a framework mapping checkbox by its label text (pure)
  checkbox(name: string): Locator {
    return this.checkboxes().filter({ hasText: name });
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: toggle a framework mapping checkbox by its label text
  async toggleMapping(name: string) {
    await this.checkbox(name).click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the framework mapping picker dialog by clicking save
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the framework mapping picker dialog by clicking cancel
  async cancel() {
    await this.cancelButton().click();
  }
}
