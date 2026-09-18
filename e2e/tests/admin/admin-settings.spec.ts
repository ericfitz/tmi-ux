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
    // The table pages client-side, so the new row may sit on a later page: filter to it
    await adminSettingsPage.filterInput().fill(settingKey);
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

  test('sorts by key and pages client-side', async () => {
    const keyHeader = adminSettingsPage.table().locator('th[mat-sort-header]').first();
    const firstKey = () => adminSettingsPage.rows().first().locator('.setting-key').innerText();
    const rangeLabel = adminSettingsPage.paginator().locator('.mat-mdc-paginator-range-label');
    const readTotal = async () =>
      Number((await rangeLabel.innerText()).match(/of (\d+)/)?.[1] ?? 0);
    await adminSettingsPage.filterInput().fill('');
    await expect.poll(readTotal).toBeGreaterThan(1);
    const total = await readTotal();

    await keyHeader.click();
    await expect(keyHeader).toHaveAttribute('aria-sort', 'ascending');
    const asc = await firstKey();
    await keyHeader.click();
    await expect(keyHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(adminSettingsPage.rows().first().locator('.setting-key')).not.toHaveText(asc);
    const desc = await firstKey();
    expect(asc.toLowerCase() < desc.toLowerCase(), `asc=${asc} desc=${desc}`).toBe(true);

    // The table is client-side: the paginator must slice the rows it renders
    await adminSettingsPage.paginator().locator('mat-select').click();
    await page.getByRole('option', { name: '10', exact: true }).click();
    await expect(adminSettingsPage.rows()).toHaveCount(Math.min(10, total));
    if (total > 10) {
      await adminSettingsPage.paginator().getByRole('button', { name: 'Next page' }).click();
      await expect(rangeLabel).toHaveText(/^\s*11 /);
      expect(await firstKey()).not.toBe(desc);
    }
  });
});
