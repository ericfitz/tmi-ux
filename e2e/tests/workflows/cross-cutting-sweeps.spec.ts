import { test as unauthTest } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';

const PUBLIC_ROUTES = ['/login', '/unauthorized', '/about', '/tos', '/privacy'];
const USER_ROUTES = ['/intake', '/dashboard'];
const REVIEWER_ROUTES = ['/dashboard', '/triage'];
const ADMIN_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/teams',
  '/admin/projects',
  '/admin/groups',
  '/admin/quotas',
  '/admin/webhooks',
  '/admin/settings',
];

// ============================================================
// Sweep 1 — Translation Completeness
// ============================================================

unauthTest.describe('Cross-Cutting Sweeps — Translations — Public', () => {
  unauthTest.setTimeout(60000);

  for (const route of PUBLIC_ROUTES) {
    unauthTest(`translations — public ${route}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await assertNoMissingTranslations(page);
      } finally {
        await context.close();
      }
    });
  }
});

userTest.describe('Cross-Cutting Sweeps — Translations — User', () => {
  userTest.setTimeout(60000);

  for (const route of USER_ROUTES) {
    userTest(`translations — user ${route}`, async ({ userPage }) => {
      await userPage.goto(route);
      await userPage.waitForLoadState('networkidle');
      await assertNoMissingTranslations(userPage);
    });
  }
});

reviewerTest.describe('Cross-Cutting Sweeps — Translations — Reviewer', () => {
  reviewerTest.setTimeout(60000);

  for (const route of REVIEWER_ROUTES) {
    reviewerTest(`translations — reviewer ${route}`, async ({ reviewerPage }) => {
      await reviewerPage.goto(route);
      await reviewerPage.waitForLoadState('networkidle');
      await assertNoMissingTranslations(reviewerPage);
    });
  }
});

adminTest.describe('Cross-Cutting Sweeps — Translations — Admin', () => {
  adminTest.setTimeout(60000);

  for (const route of ADMIN_ROUTES) {
    adminTest(`translations — admin ${route}`, async ({ adminPage }) => {
      await adminPage.goto(route);
      await adminPage.waitForLoadState('networkidle');
      // The /admin/settings page renders server configuration identifiers
      // (e.g. "auth.cookie.domain") that match the transloco key regex but
      // are legitimate data values. Exclude the key display spans.
      await assertNoMissingTranslations(adminPage, {
        ignoreSelectors: ['.setting-key'],
      });
    });
  }
});

// ============================================================
// Sweep 2 — Icon Integrity
// ============================================================

unauthTest.describe('Cross-Cutting Sweeps — Icon Integrity — Public', () => {
  unauthTest.setTimeout(60000);

  for (const route of PUBLIC_ROUTES) {
    unauthTest(`icons — public ${route}`, async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        await assertIconsRendered(page);
      } finally {
        await context.close();
      }
    });
  }
});

userTest.describe('Cross-Cutting Sweeps — Icon Integrity — User', () => {
  userTest.setTimeout(60000);

  for (const route of USER_ROUTES) {
    userTest(`icons — user ${route}`, async ({ userPage }) => {
      await userPage.goto(route);
      await userPage.waitForLoadState('networkidle');
      await assertIconsRendered(userPage);
    });
  }
});

reviewerTest.describe('Cross-Cutting Sweeps — Icon Integrity — Reviewer', () => {
  reviewerTest.setTimeout(60000);

  for (const route of REVIEWER_ROUTES) {
    reviewerTest(`icons — reviewer ${route}`, async ({ reviewerPage }) => {
      await reviewerPage.goto(route);
      await reviewerPage.waitForLoadState('networkidle');
      await assertIconsRendered(reviewerPage);
    });
  }
});

adminTest.describe('Cross-Cutting Sweeps — Icon Integrity — Admin', () => {
  adminTest.setTimeout(60000);

  for (const route of ADMIN_ROUTES) {
    adminTest(`icons — admin ${route}`, async ({ adminPage }) => {
      await adminPage.goto(route);
      await adminPage.waitForLoadState('networkidle');
      await assertIconsRendered(adminPage);
    });
  }
});
