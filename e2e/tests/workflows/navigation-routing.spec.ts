import { test as unauthTest, expect } from '@playwright/test';
import { userTest, reviewerTest, adminTest } from '../../fixtures/auth-fixtures';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';
import { NavbarPage } from '../../pages/navbar.page';
import { ThreatModelFlow } from '../../flows/threat-model.flow';

// === Normal User Navigation ===

userTest.describe('Navigation & Routing (User)', () => {
  userTest.setTimeout(60000);

  userTest('deep link to a threat model', async ({ userPage }) => {
    const tmEdit = new TmEditPage(userPage);
    const tmFlow = new ThreatModelFlow(userPage);

    const tmName = `E2E Nav Test TM ${Date.now()}`;
    await tmFlow.createFromDashboard(tmName);

    const url = userPage.url();
    const tmIdMatch = url.match(/\/tm\/([a-f0-9-]+)/);
    expect(tmIdMatch).toBeTruthy();
    const tmId = tmIdMatch![1];

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await userPage.goto(`/tm/${tmId}`);
    await userPage.waitForLoadState('networkidle');

    await expect(tmEdit.tmName()).toHaveText(tmName, { timeout: 10000 });

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName);
  });

  userTest('deep link to nonexistent resource', async ({ userPage }) => {
    await userPage.goto('/tm/00000000-0000-0000-0000-000000000000');

    await userPage.waitForLoadState('networkidle');
    await userPage.waitForTimeout(2000);

    const currentUrl = userPage.url();
    expect(
      currentUrl.includes('/dashboard') ||
        currentUrl.includes('/tm/00000000-0000-0000-0000-000000000000'),
    ).toBeTruthy();
  });

  userTest('back/forward navigation', async ({ userPage }) => {
    const dashboard = new DashboardPage(userPage);
    const tmEdit = new TmEditPage(userPage);
    const tmFlow = new ThreatModelFlow(userPage);

    const tmName = `E2E Back/Fwd Test TM ${Date.now()}`;
    await tmFlow.createFromDashboard(tmName);
    await expect(tmEdit.tmName()).toHaveText(tmName);

    await userPage.goBack();
    await userPage.waitForURL(/\/dashboard/, { timeout: 10000 });
    await expect(dashboard.tmCards()).not.toHaveCount(0, { timeout: 10000 });

    await userPage.goForward();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(tmEdit.tmName()).toHaveText(tmName);

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await tmFlow.deleteFromDashboard(tmName);
  });

  userTest('navbar shows dashboard and intake links', async ({ userPage }) => {
    const navbar = new NavbarPage(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    // Normal user should NOT see triage or admin
    await expect(navbar.triageLink()).toHaveCount(0);
    await expect(navbar.adminLink()).toHaveCount(0);
  });

  userTest('navbar navigation works', async ({ userPage }) => {
    const navbar = new NavbarPage(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    await navbar.dashboardLink().click();
    await userPage.waitForURL(/\/dashboard/, { timeout: 10000 });
    expect(userPage.url()).toContain('/dashboard');

    await navbar.intakeLink().click();
    await userPage.waitForURL(/\/intake/, { timeout: 10000 });
    expect(userPage.url()).toContain('/intake');
  });
});

// === Auth Guards (no auth) ===

unauthTest.describe('Auth Guards', () => {
  unauthTest.setTimeout(60000);

  unauthTest('unauthenticated user redirected to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  unauthTest('unauthenticated user redirected from triage', async ({ page }) => {
    await page.goto('/triage');
    await page.waitForURL(
      url => url.pathname.includes('/login') || url.pathname.includes('/unauthorized'),
      { timeout: 10000 },
    );
    expect(page.url()).not.toContain('/triage');
  });
});

// === Reviewer Navigation ===

reviewerTest.describe('Navigation & Routing (Reviewer)', () => {
  reviewerTest.setTimeout(60000);

  reviewerTest('navbar shows triage link', async ({ reviewerPage }) => {
    const navbar = new NavbarPage(reviewerPage);

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    await expect(navbar.triageLink()).toBeVisible();
    // Reviewer should NOT see admin
    await expect(navbar.adminLink()).toHaveCount(0);
  });

  reviewerTest('reviewer can access triage page', async ({ reviewerPage }) => {
    await reviewerPage.goto('/triage');
    await reviewerPage.waitForLoadState('networkidle');
    expect(reviewerPage.url()).toContain('/triage');
  });

  reviewerTest('reviewer blocked from admin page', async ({ reviewerPage }) => {
    await reviewerPage.goto('/admin');
    await reviewerPage.waitForURL(
      url => url.pathname.includes('/unauthorized') || !url.pathname.includes('/admin'),
      { timeout: 10000 },
    );
    expect(reviewerPage.url()).not.toMatch(/\/admin(?!\/|$)/);
  });
});

// === Admin Navigation ===

adminTest.describe('Navigation & Routing (Admin)', () => {
  adminTest.setTimeout(60000);

  adminTest('navbar shows all links including admin', async ({ adminPage }) => {
    const navbar = new NavbarPage(adminPage);

    await adminPage.goto('/dashboard');
    await adminPage.waitForLoadState('networkidle');

    await expect(navbar.dashboardLink()).toBeVisible();
    await expect(navbar.intakeLink()).toBeVisible();
    await expect(navbar.triageLink()).toBeVisible();
    await expect(navbar.adminLink()).toBeVisible();
  });

  adminTest('admin can access admin page', async ({ adminPage }) => {
    await adminPage.goto('/admin');
    await adminPage.waitForLoadState('networkidle');
    expect(adminPage.url()).toContain('/admin');
  });

  adminTest('admin can access triage page', async ({ adminPage }) => {
    await adminPage.goto('/triage');
    await adminPage.waitForLoadState('networkidle');
    expect(adminPage.url()).toContain('/triage');
  });
});
