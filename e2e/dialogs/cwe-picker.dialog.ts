import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

// SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: Playwright page object for the CWE picker dialog
export class CwePickerDialog {
  private dialog: Locator;

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: bind the dialog locator to the mat-dialog-container (pure)
  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly searchInput = () => this.dialog.getByTestId('cwe-picker-search-input');
  readonly items = () => this.dialog.getByTestId('cwe-picker-item');
  readonly addButton = () => this.dialog.getByTestId('cwe-picker-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('cwe-picker-cancel-button');

  // SEM@e4174ec5cf6766ca536e56619ce271101e2c9b46: filter CWE list by entering a search term and awaiting results
  async search(term: string) {
    await angularFill(this.searchInput(), term);
    // Wait for search results to update
    await this.dialog.page().waitForTimeout(500);
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: select the first CWE item in the picker dialog list
  async selectFirst() {
    await this.items().first().click();
  }

  // SEM@6884451ded990cae6e08c4f8e04b7f06931da57b: select a CWE item matching a given ID in the picker dialog list
  async selectById(cweId: string) {
    await this.items().filter({ hasText: cweId }).first().click();
  }

  // SEM@e15bebe5e59e4b6516150171ca189d73b0206f1c: confirm the selected CWE and dismiss the picker dialog
  async add() {
    await this.addButton().click();
  }
}
