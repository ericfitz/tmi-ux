import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class CreateTmDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-tm-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-tm-description-input');
  readonly frameworkSelect = () => this.dialog.getByTestId('create-tm-framework-select');
  readonly confidentialToggle = () => this.dialog.getByTestId('create-tm-confidential-toggle');
  readonly submitButton = () => this.dialog.getByTestId('create-tm-submit');

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  async selectFramework(framework: string) {
    await this.frameworkSelect().click();
    await this.page.locator('mat-option').filter({ hasText: framework }).click();
  }

  async setConfidential(enabled: boolean) {
    const toggle = this.confidentialToggle();
    // mat-slide-toggle uses a button role internally
    const button = toggle.locator('button[role="switch"]');
    const isChecked = (await button.getAttribute('aria-checked')) === 'true';
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async submit() {
    await this.submitButton().click();
  }
}
