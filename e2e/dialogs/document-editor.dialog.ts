import { Locator, Page } from '@playwright/test';

export class DocumentEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('document-name-input');
  readonly uriInput = () => this.dialog.getByTestId('document-uri-input');
  readonly descriptionInput = () => this.dialog.getByTestId('document-description-input');
  readonly includeReportCheckbox = () =>
    this.dialog.getByTestId('document-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('document-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('document-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('document-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
