import { Dialog, expect, Page } from '@playwright/test';
import { AdminSettingsPage } from '../pages/admin-settings.page';
import { AddSettingDialog } from '../dialogs/add-setting.dialog';

export class AdminSettingsFlow {
  private adminSettingsPage: AdminSettingsPage;
  private addSettingDialog: AddSettingDialog;

  constructor(private page: Page) {
    this.adminSettingsPage = new AdminSettingsPage(page);
    this.addSettingDialog = new AddSettingDialog(page);
  }

  async createSetting(key: string, value: string, description?: string) {
    await this.adminSettingsPage.addButton().click();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await this.addSettingDialog.fillKey(key);
    await this.addSettingDialog.fillValue(value);
    if (description) {
      await this.addSettingDialog.fillDescription(description);
    }
    await this.addSettingDialog.submitButton().waitFor({ state: 'visible' });
    await expect(this.addSettingDialog.submitButton()).toBeEnabled({ timeout: 5000 });
    await this.addSettingDialog.submit();
    await this.page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  }

  async deleteSetting(key: string) {
    await this.adminSettingsPage.moreButton(key).click();
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminSettingsPage.deleteItem().dispatchEvent('click');
  }
}
