import { Locator, Page } from '@playwright/test';

export class AssetEditorDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly nameInput = () => this.dialog.getByTestId('asset-name-input');
  readonly descriptionInput = () => this.dialog.getByTestId('asset-description-input');
  readonly typeSelect = () => this.dialog.getByTestId('asset-type-select');
  readonly criticalityInput = () => this.dialog.getByTestId('asset-criticality-input');
  readonly classificationChips = () => this.dialog.getByTestId('asset-classification-chips');
  readonly sensitivityInput = () => this.dialog.getByTestId('asset-sensitivity-input');
  readonly includeReportCheckbox = () => this.dialog.getByTestId('asset-include-report-checkbox');
  readonly timmyCheckbox = () => this.dialog.getByTestId('asset-timmy-checkbox');
  readonly saveButton = () => this.dialog.getByTestId('asset-save-button');
  readonly cancelButton = () => this.dialog.getByTestId('asset-cancel-button');

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

  async fillCriticality(value: string) {
    await this.criticalityInput().fill(value);
  }

  async addClassification(value: string) {
    const chipInput = this.classificationChips().locator('input');
    await chipInput.fill(value);
    await chipInput.press('Enter');
  }

  async fillSensitivity(value: string) {
    await this.sensitivityInput().fill(value);
  }

  async save() {
    await this.saveButton().click();
  }

  async cancel() {
    await this.cancelButton().click();
  }
}
