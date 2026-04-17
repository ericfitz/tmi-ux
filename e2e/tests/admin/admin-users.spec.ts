import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminUsersPage } from '../../pages/admin-users.page';

test.describe.serial('Admin Users Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminUsersPage: AdminUsersPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminUsersPage = new AdminUsersPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to users admin', async () => {
    await expect(adminUsersPage.table()).toBeVisible({ timeout: 10000 });
    const count = await adminUsersPage.rows().count();
    expect(count).toBeGreaterThan(0);
  });

  test('filter narrows the list', async () => {
    const initialCount = await adminUsersPage.rows().count();
    expect(initialCount).toBeGreaterThan(0);

    await adminUsersPage.filterInput().fill('nonexistent-xyz-filter');
    await page.waitForTimeout(500);
    const filteredCount = await adminUsersPage.rows().count();
    expect(filteredCount).toBe(0);

    await adminUsersPage.filterInput().fill('');
    await page.waitForTimeout(500);
    const restoredCount = await adminUsersPage.rows().count();
    expect(restoredCount).toBeGreaterThan(0);
  });

  test('automation-only toggle filters correctly', async () => {
    const allCount = await adminUsersPage.rows().count();

    await adminUsersPage.automationToggle().click();
    await page.waitForTimeout(500);
    const automationCount = await adminUsersPage.rows().count();
    expect(automationCount).toBeLessThanOrEqual(allCount);

    await adminUsersPage.automationToggle().click();
    await page.waitForTimeout(500);
    const restoredCount = await adminUsersPage.rows().count();
    expect(restoredCount).toBe(allCount);
  });

  test('more menu opens with transfer and delete items', async () => {
    await adminUsersPage.rows().first().getByTestId('users-more-button').click();
    await expect(adminUsersPage.transferOwnershipItem()).toBeVisible({ timeout: 5000 });
    await expect(adminUsersPage.deleteItem()).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(adminUsersPage.transferOwnershipItem()).toBeHidden({ timeout: 5000 });
  });

  test('create automation user dialog opens', async () => {
    await adminUsersPage.createAutomationButton().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('mat-dialog-container')).toBeHidden({ timeout: 5000 });
  });
});
