import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';

test.describe.serial('Admin Linked Accounts Dialog', () => {
  test.setTimeout(90000);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('linked-accounts dialog opens, loads, and shows the primary identity', async () => {
    // Open the kebab menu on the first row that offers the linked-accounts
    // item (automation accounts do not).
    const rows = page.getByTestId('users-row');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });

    const rowCount = await rows.count();
    let opened = false;
    for (let i = 0; i < rowCount; i++) {
      await rows.nth(i).getByTestId('users-more-button').click();
      const item = page.getByTestId('users-linked-accounts-item');
      if (await item.isVisible()) {
        await item.click();
        opened = true;
        break;
      }
      // Close the menu for an automation row and try the next one.
      await page.keyboard.press('Escape');
    }
    expect(opened).toBe(true);

    const dialog = page.getByTestId('linked-accounts-dialog');
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // The load must resolve (spinner gone) and render at least the
    // synthesized primary row with its non-removable chip.
    await expect(dialog.locator('mat-spinner')).toBeHidden({ timeout: 10000 });
    const identityRows = page.getByTestId('linked-accounts-row');
    await expect(identityRows.first()).toBeVisible({ timeout: 10000 });
    await expect(identityRows.first().locator('mat-chip')).toBeVisible();

    // The primary row must not offer an unlink action.
    await expect(identityRows.first().locator('button')).toHaveCount(0);

    await page.getByTestId('linked-accounts-close').click();
    await expect(dialog).toBeHidden();
  });
});
