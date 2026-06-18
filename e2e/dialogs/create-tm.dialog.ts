import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: Playwright page object for the create threat model dialog
export class CreateTmDialog {
  private dialog: Locator;

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the dialog locator to the mat-dialog-container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('create-tm-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('create-tm-description-input');
  readonly frameworkSelect = () => this.dialog.getByTestId('create-tm-framework-select');
  readonly confidentialToggle = () => this.dialog.getByTestId('create-tm-confidential-toggle');
  readonly submitButton = () => this.dialog.getByTestId('create-tm-submit');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the threat model name field in the create-tm dialog (pure)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the threat model description field in the create-tm dialog (pure)
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@f932ac504d5de8b835530e16f5421e320dee6e1c: select a framework option in the create-tm dialog dropdown
  async selectFramework(framework: string) {
    await this.frameworkSelect().click();
    await this.page.locator('mat-option').filter({ hasText: framework }).click();
  }

  // SEM@017a4458632f806c109c407be51706580490d509: toggle the confidential flag to the desired state in the create-tm dialog
  async setConfidential(enabled: boolean) {
    const toggle = this.confidentialToggle();
    // mat-slide-toggle uses a button role internally
    const button = toggle.locator('button[role="switch"]');
    const isChecked = (await button.getAttribute('aria-checked')) === 'true';
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: submit the create threat model dialog form
  async submit() {
    await this.submitButton().click();
  }
}
