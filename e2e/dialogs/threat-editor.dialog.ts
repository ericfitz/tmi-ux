import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: page object wrapping the threat editor dialog for E2E tests (pure)
export class ThreatEditorDialog {
  private dialog: Locator;

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the dialog locator to the mat-dialog-container element (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('threat-editor-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('threat-editor-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('threat-editor-type-select');
  readonly severitySelect = () => this.dialog.getByTestId('threat-editor-severity-select');
  readonly saveButton = () => this.dialog.getByTestId('threat-editor-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('threat-editor-cancel-button');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the threat name input with the given value
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the threat description input with the given value
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: submit the threat editor dialog by clicking the save button
  async save() {
    await this.saveButton().click();
  }
}
