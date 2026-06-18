import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: E2E page object for the metadata key-value editor dialog (pure)
export class MetadataDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind Playwright page and locate the metadata dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly addButton = () => this.dialog.getByTestId('metadata-add-button');
  readonly saveButton = () => this.dialog.getByTestId('metadata-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('metadata-cancel-button');
  readonly keyInputs = () => this.dialog.getByTestId('metadata-key-input');
  readonly valueInputs = () => this.dialog.getByTestId('metadata-value-input');
  readonly deleteButtons = () => this.dialog.getByTestId('metadata-delete-button');
  readonly rows = () => this.dialog.locator('tr.mat-mdc-row');

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the key input field at the given row index (pure)
  keyInput(index: number): Locator {
    return this.keyInputs().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the value input field at the given row index (pure)
  valueInput(index: number): Locator {
    return this.valueInputs().nth(index);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: fetch the delete button for the metadata row at the given index (pure)
  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  // SEM@b040dc0c1400a4a5bfc238295aa021aa0a18c4a7: add a metadata key-value row and fill both fields in the dialog
  async addEntry(key: string, value: string) {
    await this.addButton().click();
    const lastIndex = (await this.keyInputs().count()) - 1;
    await this.keyInput(lastIndex).waitFor({ state: 'visible' });
    await this.fillInput(this.keyInput(lastIndex), key);
    await this.fillInput(this.valueInput(lastIndex), value);
  }

  /**
   * Sets an input value for metadata dialog inputs.
   * Uses angularFill() which sets the value atomically to avoid
   * Angular change detection race conditions.
   */
  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill a dialog input field atomically to avoid Angular change detection races
  async fillInput(locator: Locator, value: string) {
    await angularFill(locator, value);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the metadata dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the metadata dialog by clicking the cancel button
  async cancel() {
    await this.cancelButton().click();
  }
}
