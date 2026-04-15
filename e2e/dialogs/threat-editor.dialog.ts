import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

export class ThreatEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('threat-editor-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('threat-editor-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('threat-editor-type-select');
  readonly severitySelect = () => this.dialog.getByTestId('threat-editor-severity-select');
  readonly saveButton = () => this.dialog.getByTestId('threat-editor-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('threat-editor-cancel-button');

  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  async save() {
    await this.saveButton().click();
  }
}
