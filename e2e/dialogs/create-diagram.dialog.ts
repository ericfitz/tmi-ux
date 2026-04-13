import { Locator, Page } from '@playwright/test';

export class CreateDiagramDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly typeSelect = () => this.dialog.getByTestId('diagram-type-select');
  readonly nameInput = () => this.dialog.getByTestId('diagram-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-diagram-submit');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().click({ clickCount: 3 });
    await this.nameInput().pressSequentially(name);
  }

  async submit() {
    await this.submitButton().click();
  }
}
