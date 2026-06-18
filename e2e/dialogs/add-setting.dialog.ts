import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@39232dc427837c46e7571b200bef692d196006d9: E2E page object for the add-setting dialog; wraps form locators and actions
export class AddSettingDialog {
  private dialog: Locator;

  // SEM@39232dc427837c46e7571b200bef692d196006d9: bind the Playwright page and locate the dialog container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly keyInput = () => this.dialog.getByTestId('add-setting-key-input');
  readonly cancelButton = () => this.dialog.getByTestId('add-setting-cancel-button');
  readonly submitButton = () => this.dialog.getByTestId('add-setting-submit-button');

  // SEM@39232dc427837c46e7571b200bef692d196006d9: fill the setting key field in the dialog
  async fillKey(key: string) {
    await angularFill(this.keyInput(), key);
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: fill the setting value field in the dialog
  async fillValue(value: string) {
    await angularFill(this.dialog.locator('input[formcontrolname="value"]'), value);
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: fill the setting description field in the dialog
  async fillDescription(description: string) {
    await angularFill(this.dialog.locator('textarea[formcontrolname="description"]'), description);
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: click the dialog submit button to confirm setting creation
  async submit() {
    await this.submitButton().click();
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: click the dialog cancel button to dismiss without saving
  async cancel() {
    await this.cancelButton().click();
  }
}
