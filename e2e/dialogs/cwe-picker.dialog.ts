import { Locator, Page } from '@playwright/test';

export class CwePickerDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container');
  }

  readonly searchInput = () => this.dialog.getByTestId('cwe-picker-search-input');
  readonly items = () => this.dialog.getByTestId('cwe-picker-item');
  readonly addButton = () => this.dialog.getByTestId('cwe-picker-add-button');
  readonly cancelButton = () => this.dialog.getByTestId('cwe-picker-cancel-button');

  async search(term: string) {
    await this.searchInput().waitFor({ state: 'visible' });
    await this.searchInput().clear();
    await this.searchInput().pressSequentially(term);
    // Wait for search results to update
    await this.dialog.page().waitForTimeout(500);
  }

  async selectFirst() {
    await this.items().first().click();
  }

  async selectById(cweId: string) {
    await this.items().filter({ hasText: cweId }).first().click();
  }

  async add() {
    await this.addButton().click();
  }
}
