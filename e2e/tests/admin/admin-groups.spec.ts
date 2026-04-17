import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminGroupsFlow } from '../../flows/admin-groups.flow';
import { AdminGroupsPage } from '../../pages/admin-groups.page';
import { AddGroupDialog } from '../../dialogs/add-group.dialog';

test.describe.serial('Admin Groups Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminGroupsFlow: AdminGroupsFlow;
  let adminGroupsPage: AdminGroupsPage;

  const groupName = `E2E Admin Group ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminGroupsFlow = new AdminGroupsFlow(page);
    adminGroupsPage = new AdminGroupsPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/groups');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to groups admin', async () => {
    await expect(adminGroupsPage.table()).toBeVisible({ timeout: 10000 });
  });

  test('create a group', async () => {
    await adminGroupsFlow.createGroup(groupName, 'E2E test group');
    await expect(adminGroupsPage.row(groupName)).toBeVisible({ timeout: 10000 });
  });

  test('add-group dialog opens and cancels', async () => {
    const addGroupDialog = new AddGroupDialog(page);
    await adminGroupsPage.addButton().click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await addGroupDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('delete a group', async () => {
    await adminGroupsFlow.deleteGroup(groupName);
    await expect(adminGroupsPage.row(groupName)).toBeHidden({ timeout: 10000 });
  });
});
