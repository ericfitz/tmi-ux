import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class AddSettingDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly keyInput = () => this.dialog.getByTestId('add-setting-key-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-setting-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-setting-submit-button');

  async fillKey(key: string) {
    await angularFill(this.keyInput(), key);
  }

  async fillValue(value: string) {
    await angularFill(this.dialog.locator('input[formcontrolname="value"]'), value);
  }

  async fillDescription(description: string) {
    await angularFill(this.dialog.locator('textarea[formcontrolname="description"]'), description);
  }

  async submit() {
    await this.submitButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
