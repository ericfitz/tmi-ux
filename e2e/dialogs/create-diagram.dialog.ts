import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: E2E page object for the create diagram dialog
export class CreateDiagramDialog {
  private dialog: Locator;

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly typeSelect = () => this.dialog.getByTestId('diagram-type-select');
  readonly nameInput = () => this.dialog.getByTestId('diagram-name-input');
  readonly submitButton = () => this.dialog.getByTestId('create-diagram-submit');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the diagram name input field with a value (pure)
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: submit the create diagram dialog by clicking the submit button (pure)
  async submit() {
    await this.submitButton().click();
  }
}
