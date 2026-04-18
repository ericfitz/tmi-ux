import { test, expect, BrowserContext, Dialog, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminUsersPage } from '../../pages/admin-users.page';
import { angularFill } from '../../helpers/angular-fill';

test.describe.serial('Admin Users Workflows', () => {
  test.setTimeout(90000);

  let context: BrowserContext;
  let page: Page;
  let adminUsersPage: AdminUsersPage;

  // Unique automation user per run; created in the create test and
  // cleaned up in the delete test.
  const automationUserName = `e2e_auto_${Date.now()}`;

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

  test('create automation user', async () => {
    await adminUsersPage.createAutomationButton().click();
    await expect(page.locator('mat-dialog-container')).toBeVisible({ timeout: 5000 });

    await angularFill(
      page.getByTestId('create-automation-user-name-input'),
      automationUserName,
    );

    await page.getByTestId('create-automation-user-submit').click();

    // The dialog closes, then a credential-secret dialog opens automatically
    await expect(page.getByTestId('credential-secret-dialog')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('credential-secret-done').click();
    await expect(page.locator('mat-dialog-container')).toBeHidden({ timeout: 5000 });

    // Filter down to the new user and assert the row appears
    await adminUsersPage.filterInput().fill(automationUserName);
    await page.waitForTimeout(500);
    await expect(adminUsersPage.row(automationUserName)).toBeVisible({ timeout: 10000 });
  });

  test('manage credentials — add an additional credential', async () => {
    await adminUsersPage.manageCredentialsButton(automationUserName).click();
    await expect(page.getByTestId('manage-credentials-dialog')).toBeVisible({ timeout: 5000 });

    // The creation flow already made one credential; verify the list has 1
    const initialRows = await page.getByTestId('manage-credentials-row').count();
    expect(initialRows).toBeGreaterThanOrEqual(1);

    await page.getByTestId('manage-credentials-add-button').click();
    await expect(page.getByTestId('create-credential-name-input')).toBeVisible({
      timeout: 5000,
    });

    await angularFill(
      page.getByTestId('create-credential-name-input'),
      `e2e-extra-cred-${Date.now()}`,
    );
    await page.getByTestId('create-credential-submit').click();

    // Secret dialog for the new credential
    await expect(page.getByTestId('credential-secret-dialog')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('credential-secret-done').click();

    // Back in manage-credentials dialog — row count should have increased
    await expect(page.getByTestId('manage-credentials-dialog')).toBeVisible({ timeout: 5000 });
    await expect
      .poll(async () => await page.getByTestId('manage-credentials-row').count(), {
        timeout: 5000,
      })
      .toBeGreaterThan(initialRows);
  });

  test('manage credentials — delete one credential', async () => {
    const before = await page.getByTestId('manage-credentials-row').count();
    expect(before).toBeGreaterThan(0);

    // Delete accepts a native confirm()
    const handler = (dialog: Dialog): void => void dialog.accept();
    page.once('dialog', handler);
    await page.getByTestId('manage-credentials-delete-button').first().click();

    await expect
      .poll(async () => await page.getByTestId('manage-credentials-row').count(), {
        timeout: 5000,
      })
      .toBeLessThan(before);

    // Close the dialog
    await page.getByTestId('manage-credentials-close').click();
    await expect(page.locator('mat-dialog-container')).toBeHidden({ timeout: 5000 });
  });

  test('transfer ownership opens the user picker and cancels cleanly', async () => {
    await adminUsersPage.moreButton(automationUserName).click();
    await expect(adminUsersPage.transferOwnershipItem()).toBeVisible({ timeout: 5000 });
    await adminUsersPage.transferOwnershipItem().dispatchEvent('click');

    // The UserPickerDialog renders inside a mat-dialog-container.
    // We don't complete the transfer (irreversible) — just assert it opens.
    await expect(page.locator('mat-dialog-container')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('mat-dialog-container')).toBeHidden({ timeout: 5000 });
  });

  test('delete automation user (cleanup)', async () => {
    // Re-filter in case the row is paginated off-screen
    await adminUsersPage.filterInput().fill(automationUserName);
    await page.waitForTimeout(500);

    await adminUsersPage.moreButton(automationUserName).click();
    await expect(adminUsersPage.deleteItem()).toBeVisible({ timeout: 5000 });

    const handler = (dialog: Dialog): void => void dialog.accept();
    page.once('dialog', handler);
    await adminUsersPage.deleteItem().dispatchEvent('click');

    await expect(adminUsersPage.row(automationUserName)).toHaveCount(0, { timeout: 10000 });
  });
});
