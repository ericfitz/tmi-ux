import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: E2E page object for the asset editor dialog; wraps form locators and actions
export class AssetEditorDialog {
  private dialog: Locator;

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: bind the Playwright page and locate the dialog container (pure)
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

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the asset name field in the dialog
  async fillName(name: string) {
    await angularFill(this.nameInput(), name);
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the asset description field in the dialog
  async fillDescription(desc: string) {
    await angularFill(this.descriptionInput(), desc);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: open the asset type dropdown and select the matching option
  async selectType(type: string) {
    await this.typeSelect().click();
    await this.page.locator('mat-option').filter({ hasText: type }).click();
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: fill the asset criticality field in the dialog
  async fillCriticality(value: string) {
    await angularFill(this.criticalityInput(), value);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: enter a classification tag into the asset chip input (pure)
  async addClassification(value: string) {
    const chipInput = this.classificationChips().locator('input');
    await chipInput.fill(value);
    await chipInput.press('Enter');
  }

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: populate the asset sensitivity field with a value (pure)
  async fillSensitivity(value: string) {
    await angularFill(this.sensitivityInput(), value);
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: submit the asset editor dialog by clicking the save button (pure)
  async save() {
    await this.saveButton().click();
  }

  // SEM@bece9afbb4283fefea5c408379d798698a5459d8: dismiss the asset editor dialog by clicking cancel (pure)
  async cancel() {
    await this.cancelButton().click();
  }
}
