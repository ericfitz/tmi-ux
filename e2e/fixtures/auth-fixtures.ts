import { test as base, Page } from '@playwright/test';
import { AuthFlow } from '../flows/auth.flow';

/**
 * Creates an authenticated browser context for the given user.
 * Each fixture gets its own BrowserContext (isolated cookies/storage).
 */
async function createAuthenticatedPage(
  browser: import('@playwright/test').Browser,
  userId: string,
): Promise<{ page: Page; cleanup: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await new AuthFlow(page).loginAs(userId);
  return {
    page,
    cleanup: async () => ctx.close(),
  };
}

/**
 * Test fixture authenticated as a normal user (test-user).
 */
export const userTest = base.extend<{ userPage: Page }>({
  userPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-user');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture authenticated as a security reviewer (test-reviewer).
 */
export const reviewerTest = base.extend<{ reviewerPage: Page }>({
  reviewerPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-reviewer');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture authenticated as an admin (test-admin).
 */
export const adminTest = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-admin');
    await use(page);
    await cleanup();
  },
});

/**
 * Test fixture with all three roles for cross-role workflow tests.
 * Each role gets its own BrowserContext (separate sessions).
 */
export const multiRoleTest = base.extend<{
  userPage: Page;
  reviewerPage: Page;
  adminPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-user');
    await use(page);
    await cleanup();
  },
  reviewerPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-reviewer');
    await use(page);
    await cleanup();
  },
  adminPage: async ({ browser }, use) => {
    const { page, cleanup } = await createAuthenticatedPage(browser, 'test-admin');
    await use(page);
    await cleanup();
  },
});

export { expect } from '@playwright/test';
