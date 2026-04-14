import { Locator, Page } from '@playwright/test';

export class MetadataDialog {
  private dialog: Locator;

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

  keyInput(index: number): Locator {
    return this.keyInputs().nth(index);
  }

  valueInput(index: number): Locator {
    return this.valueInputs().nth(index);
  }

  deleteButton(index: number): Locator {
    return this.deleteButtons().nth(index);
  }

  async addEntry(key: string, value: string) {
    await this.addButton().click();
    const lastIndex = (await this.keyInputs().count()) - 1;
    await this.keyInput(lastIndex).waitFor({ state: 'visible' });
    await this.fillInput(this.keyInput(lastIndex), key);
    await this.fillInput(this.valueInput(lastIndex), value);
  }

  /**
   * Sets an input value for metadata dialog inputs.
   * Uses Playwright's fill() which dispatches input events that the
   * component's (input) handler processes to update the model.
   */
  async fillInput(locator: Locator, value: string) {
    await locator.waitFor({ state: 'visible' });
    await locator.fill(value);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
