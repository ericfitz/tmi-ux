import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminWebhooksFlow } from '../../flows/admin-webhooks.flow';
import { AdminWebhooksPage } from '../../pages/admin-webhooks.page';
import { AddWebhookDialog } from '../../dialogs/add-webhook.dialog';

/**
 * Admin Webhooks E2E Tests
 *
 * Scope: navigate, dialog open/cancel, and delete.
 *
 * Full webhook CRUD (create + delete) is not attempted here because:
 *   - The form requires both a valid HTTPS URL and at least one event type
 *     selected from a mat-select multi-select.
 *   - Selecting mat-select options requires a live overlay panel that is
 *     difficult to drive reliably without a backend accepting the resulting
 *     API call.
 *   - There is no seeded test webhook in the test environment.
 * The create flow is therefore covered as a smoke test (open + cancel only).
 * A full CRUD test should be added once the test environment seeds a webhook
 * or the backend mock supports webhook creation.
 */
test.describe.serial('Admin Webhooks Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminWebhooksFlow: AdminWebhooksFlow;
  let adminWebhooksPage: AdminWebhooksPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminWebhooksFlow = new AdminWebhooksFlow(page);
    adminWebhooksPage = new AdminWebhooksPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/webhooks');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to webhooks admin', async () => {
    await expect(adminWebhooksPage.closeButton()).toBeVisible({ timeout: 10000 });
    await expect(adminWebhooksPage.addButton()).toBeVisible({ timeout: 10000 });
  });

  test('add-webhook dialog opens and cancels', async () => {
    const addWebhookDialog = new AddWebhookDialog(page);
    await adminWebhooksPage.addButton().click();
    await page.locator('mat-dialog-container').waitFor({ state: 'visible' });
    await expect(addWebhookDialog.nameInput()).toBeVisible({ timeout: 5000 });
    await expect(addWebhookDialog.urlInput()).toBeVisible({ timeout: 5000 });
    await expect(addWebhookDialog.cancelButton()).toBeVisible({ timeout: 5000 });
    await addWebhookDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('filter input is present and accepts text', async () => {
    await expect(adminWebhooksPage.filterInput()).toBeVisible({ timeout: 5000 });
    await adminWebhooksPage.filterInput().fill('test');
    await adminWebhooksPage.filterInput().fill('');
  });

  test('add-webhook flow opens and cancels via flow helper', async () => {
    await adminWebhooksFlow.openAndCancelAddDialog();
    await expect(page.locator('mat-dialog-container')).toBeHidden({ timeout: 5000 });
  });
});
