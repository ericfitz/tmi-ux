import { Dialog, expect, Page } from '@playwright/test';
import { AdminSettingsPage } from '../pages/admin-settings.page';
import { AddSettingDialog } from '../dialogs/add-setting.dialog';

// SEM@39232dc427837c46e7571b200bef692d196006d9: E2E flow helper orchestrating create and delete on admin settings page
export class AdminSettingsFlow {
  private adminSettingsPage: AdminSettingsPage;
  private addSettingDialog: AddSettingDialog;

  // SEM@39232dc427837c46e7571b200bef692d196006d9: build page object and dialog handle for the admin settings flow (pure)
  constructor(private page: Page) {
    this.adminSettingsPage = new AdminSettingsPage(page);
    this.addSettingDialog = new AddSettingDialog(page);
  }

  // SEM@39232dc427837c46e7571b200bef692d196006d9: create an application setting via the admin UI dialog and wait for close
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

  // SEM@39232dc427837c46e7571b200bef692d196006d9: delete an application setting via the admin UI, accepting the confirmation dialog
  async deleteSetting(key: string) {
    await this.adminSettingsPage.moreButton(key).click();
    // SEM@39232dc427837c46e7571b200bef692d196006d9: accept a browser native confirmation dialog (pure)
    const dialogHandler = (dialog: Dialog) => void dialog.accept();
    this.page.once('dialog', dialogHandler);
    await this.adminSettingsPage.deleteItem().dispatchEvent('click');
  }
}
