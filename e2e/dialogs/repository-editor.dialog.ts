import { Locator, Page } from '@playwright/test';

export class RepositoryEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('repository-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('repository-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('repository-type-select');
  readonly uriInput = () => this.dialog.getByTestId('repository-uri-input');
  readonly refTypeSelect = () => this.dialog.getByTestId('repository-ref-type-select');
  readonly refValueInput = () => this.dialog.getByTestId('repository-ref-value-input');
  readonly subPathInput = () => this.dialog.getByTestId('repository-sub-path-input');
  readonly includeReportCheckbox = () =>
    this.dialog.getByTestId('repository-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('repository-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('repository-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('repository-cancel-button');

  async fillName(name: string) {
    await this.nameInput().waitFor({ state: 'visible' });
    await this.nameInput().fill(name);
  }

  async fillDescription(desc: string) {
    await this.descriptionInput().fill(desc);
  }

  async selectType(type: string) {
    await this.typeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  async fillUri(uri: string) {
    await this.uriInput().fill(uri);
  }

  async selectRefType(refType: string) {
    await this.refTypeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: refType }).click();
  }

  async fillRefValue(value: string) {
    await this.refValueInput().fill(value);
  }

  async fillSubPath(path: string) {
    await this.subPathInput().fill(path);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
