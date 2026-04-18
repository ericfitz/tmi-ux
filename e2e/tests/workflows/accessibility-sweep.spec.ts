import { test as unauthTest } from '@playwright/test';
import {
  userTest,
  reviewerTest,
  adminTest,
} from '../../fixtures/auth-fixtures';
import {
  assertAccessibility,
  assertColorContrast,
  assertKeyboardFocusable,
} from '../../helpers/accessibility';

unauthTest.describe('Accessibility Sweep — Public', () => {
  unauthTest.setTimeout(120000);

  unauthTest('accessibility — public /login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');
      await assertAccessibility(page);
    } finally {
      await context.close();
    }
  });
});

userTest.describe('Accessibility Sweep — User', () => {
  userTest.setTimeout(120000);

  userTest('accessibility — user /intake', async ({ userPage }) => {
    await userPage.goto('/intake');
    await userPage.waitForLoadState('networkidle');
    await assertAccessibility(userPage);
  });
});

reviewerTest.describe('Accessibility Sweep — Reviewer', () => {
  reviewerTest.setTimeout(120000);

  reviewerTest('accessibility — reviewer /dashboard', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await assertAccessibility(reviewerPage);
  });

  reviewerTest('accessibility — reviewer /triage', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await assertAccessibility(reviewerPage);
  });
});

adminTest.describe('Accessibility Sweep — Admin', () => {
  adminTest.setTimeout(120000);

  adminTest('accessibility — admin /admin', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');
    await assertAccessibility(adminPage);
  });
});

reviewerTest.describe('Accessibility Sweep — Keyboard Focus', () => {
  reviewerTest.setTimeout(120000);

  reviewerTest('keyboard focusable — /dashboard', async ({ reviewerPage }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await assertKeyboardFocusable(reviewerPage);
  });

  reviewerTest('keyboard focusable — /triage', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    await assertKeyboardFocusable(reviewerPage);
  });
});

reviewerTest.describe('Accessibility Sweep — Color Contrast', () => {
  reviewerTest.setTimeout(180000);

  reviewerTest('color contrast — /dashboard across all theme modes', async ({
    reviewerPage,
  }) => {
    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await assertColorContrast(reviewerPage);
  });
});
