import { Locator, Page } from '@playwright/test';

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
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().click({ clickCount: 3 });
    await this.nameInput().pressSequentially(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().clear();
    await this.descriptionInput().pressSequentially(desc);
  }

  async save() {
    await this.saveButton().click();
  }
}
