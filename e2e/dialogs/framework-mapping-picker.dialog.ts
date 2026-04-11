import { Locator, Page } from '@playwright/test';

export class FrameworkMappingPickerDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly checkboxes = () => this.dialog.getByTestId('framework-mapping-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('framework-mapping-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('framework-mapping-cancel-button');

  checkbox(name: string): Locator {
    return this.checkboxes().filter({ hasText: name });
  }

  async toggleMapping(name: string) {
    await this.checkbox(name).click();
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
