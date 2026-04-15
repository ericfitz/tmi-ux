import { Locator, Page } from '@playwright/test';

export class ResponsiblePartiesDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly partyRows = () => this.dialog.getByTestId('responsible-parties-row');
  readonly addButton = () => this.dialog.getByTestId('responsible-parties-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('responsible-parties-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('responsible-parties-save-button');

  removeButton(index: number) {
    return this.partyRows().nth(index).getByTestId('responsible-parties-remove-button');
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
