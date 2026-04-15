import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class CreateDiagramDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly typeSelect = () => this.dialog.getByTestId('diagram-type-select');
  readonly nameInput = () => this.dialog.getByTestId('diagram-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-diagram-submit');

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async submit() {
    await this.submitButton().click();
  }
}
