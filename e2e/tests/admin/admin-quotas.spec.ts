import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminQuotasPage } from '../../pages/admin-quotas.page';

test.describe.serial('Admin Quotas Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminQuotasPage: AdminQuotasPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminQuotasPage = new AdminQuotasPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/quotas');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to quotas admin', async () => {
    await expect(adminQuotasPage.closeButton()).toBeVisible({ timeout: 10000 });
    await expect(adminQuotasPage.usersSection()).toBeVisible({ timeout: 10000 });
    await expect(adminQuotasPage.webhooksSection()).toBeVisible({ timeout: 10000 });
  });

  test('users add-quota dialog opens and cancels', async () => {
    await adminQuotasPage.usersAddButton().click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await expect(adminQuotasPage.addQuotaCancelButton()).toBeVisible({ timeout: 5000 });
    await adminQuotasPage.addQuotaCancelButton().click();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });
});
