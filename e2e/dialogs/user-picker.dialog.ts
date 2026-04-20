import { Locator, Page } from '@playwright/test';
import { angularFill } from '../helpers/angular-fill';

/**
 * Helper for the shared UserPickerDialog. The picker appears on top of an
 * existing dialog, so we scope to `.last()` when multiple `mat-dialog-container`
 * elements are open.
 */
export class UserPickerDialog {
  private dialog: Locator;

  constructor(private page: Page) {
    this.dialog = page.locator('mat-dialog-container').last();
  }

  readonly searchInput = () => this.dialog.getByTestId('user-picker-search');
  readonly roleSelect = () => this.dialog.getByTestId('user-picker-role-select');
  readonly confirmButton = () => this.dialog.getByTestId('user-picker-confirm');
  readonly cancelButton = () => this.dialog.getByTestId('user-picker-cancel');

  /**
   * Type in the search, wait for the matching option to populate, click it,
   * and (optionally) pick a role, then confirm.
   */
  async pickUser(email: string, role?: string): Promise<void> {
    await this.searchInput().waitFor({ state: 'visible', timeout: 5000 });
    await angularFill(this.searchInput(), email);

    const option = this.page.locator(`[data-testid="user-picker-option-${email}"]`);
    await option.first().waitFor({ state: 'visible', timeout: 5000 });
    await option.first().click();

    if (role) {
      await this.roleSelect().click();
      const panel = this.page.locator('.cdk-overlay-pane .mat-mdc-select-panel');
      await panel.first().waitFor({ state: 'visible', timeout: 5000 });
      const roleOption = panel.locator(`[data-testid="user-picker-role-${role}"]`);
      await roleOption.first().waitFor({ state: 'visible', timeout: 5000 });
      await roleOption.first().click();
      await panel.first().waitFor({ state: 'hidden', timeout: 5000 });
    }

    await this.confirmButton().click();
  }
}
