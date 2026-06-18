import { Locator, Page } from '@playwright/test';

// SEM@59474862db1ccee537e9baf62e9f21022290763f: page-object for the responsible-parties dialog; wraps locators and actions
export class ResponsiblePartiesDialog {
  private dialog: Locator;

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: bind a Playwright Page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly partyRows = () => this.dialog.getByTestId('responsible-parties-row');
  readonly addButton = () => this.dialog.getByTestId('responsible-parties-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('responsible-parties-cancel-button');
  readonly saveButton = () => this.dialog.getByTestId('responsible-parties-save-button');

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: fetch the remove locator for a responsible party row by index (pure)
  removeButton(index: number) {
    return this.partyRows().nth(index).getByTestId('responsible-parties-remove-button');
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: submit the responsible parties dialog by clicking save
  async save() {
    await this.saveButton().click();
  }

  // SEM@59474862db1ccee537e9baf62e9f21022290763f: dismiss the responsible parties dialog by clicking cancel
  async cancel() {
    await this.cancelButton().click();
  }
}
