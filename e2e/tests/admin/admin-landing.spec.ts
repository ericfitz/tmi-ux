import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminLandingPage } from '../../pages/admin-landing.page';

const ADMIN_SECTION_ACTIONS = [
  'users',
  'groups',
  'teams',
  'projects',
  'quotas',
  'webhooks',
  'addons',
  'settings',
  'surveys',
];

test.describe.serial('Admin Landing Page', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminLanding: AdminLandingPage;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminLanding = new AdminLandingPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin sees all 9 section cards', async () => {
    for (const action of ADMIN_SECTION_ACTIONS) {
      await expect(adminLanding.sectionCard(action)).toBeVisible({ timeout: 10000 });
    }
  });

  test('each section card routes to its sub-page', async () => {
    for (const action of ADMIN_SECTION_ACTIONS) {
      await adminLanding.sectionCard(action).click();
      await page.waitForURL(new RegExp(`/admin/${action}`), { timeout: 10000 });
      await page.goBack();
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Admin landing guard', () => {
  test.setTimeout(60000);

  test('non-admin user is denied /admin', async ({ browser }) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await new AuthFlow(p).loginAs('test-user');
    await p.goto('/admin');
    await expect(p).not.toHaveURL(/\/admin$/, { timeout: 10000 });
    await ctx.close();
  });
});
