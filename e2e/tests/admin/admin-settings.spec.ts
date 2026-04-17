import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminSettingsFlow } from '../../flows/admin-settings.flow';
import { AdminSettingsPage } from '../../pages/admin-settings.page';
import { AddSettingDialog } from '../../dialogs/add-setting.dialog';

test.describe.serial('Admin Settings Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminSettingsFlow: AdminSettingsFlow;
  let adminSettingsPage: AdminSettingsPage;

  const settingKey = `e2e_admin_setting_${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminSettingsFlow = new AdminSettingsFlow(page);
    adminSettingsPage = new AdminSettingsPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/settings');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to settings admin', async () => {
    await expect(adminSettingsPage.table()).toBeVisible({ timeout: 10000 });
  });

  test('create a setting', async () => {
    await adminSettingsFlow.createSetting(settingKey, 'e2e_value', 'E2E test setting');
    await expect(adminSettingsPage.row(settingKey)).toBeVisible({ timeout: 10000 });
  });

  test('add-setting dialog opens and cancels', async () => {
    const addSettingDialog = new AddSettingDialog(page);
    await adminSettingsPage.addButton().click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await addSettingDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('delete a setting', async () => {
    await adminSettingsFlow.deleteSetting(settingKey);
    await expect(adminSettingsPage.row(settingKey)).toBeHidden({ timeout: 10000 });
  });
});
