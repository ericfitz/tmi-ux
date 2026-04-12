import { expect } from '@playwright/test';
import { userTest, reviewerTest, multiRoleTest } from '../../fixtures/auth-fixtures';
import { ThreatModelFlow } from '../../flows/threat-model.flow';
import { PermissionsFlow } from '../../flows/permissions.flow';
import { CreateTmDialog } from '../../dialogs/create-tm.dialog';
import { ExportDialog } from '../../dialogs/export.dialog';
import { TmEditPage } from '../../pages/tm-edit.page';
import { ThreatPage } from '../../pages/threat-page.page';
import { DashboardPage } from '../../pages/dashboard.page';

/**
 * Opens the details kebab menu (more_vert) in the TM edit page header.
 *
 * The kebab trigger button has no data-testid, so we locate it by scoping to
 * the `.details-card` mat-card and finding the `more_vert` icon button within
 * its `.action-buttons` container. This avoids matching the many other
 * `more_vert` buttons in assets, documents, threats, and diagram row sections.
 */
async function openDetailsKebab(page: import('@playwright/test').Page) {
  await page
    .locator('.details-card .action-buttons button')
    .filter({ has: page.locator('mat-icon:text("more_vert")') })
    .click();
}

userTest.describe('TM Workflows - Single Role', () => {
  userTest.setTimeout(120000);

  userTest('framework selection (STRIDE)', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const createDialog = new CreateTmDialog(userPage);
    const dashboard = new DashboardPage(userPage);
    const testName = `E2E STRIDE TM ${Date.now()}`;

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await dashboard.createTmButton().click();
    await createDialog.fillName(testName);
    await createDialog.selectFramework('STRIDE');
    await createDialog.submit();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await expect(userPage.getByTestId('tm-framework-select')).toContainText('STRIDE');

    // Cleanup
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await tmFlow.deleteFromDashboard(testName);
    } catch {
      /* best effort */
    }
  });

  userTest('export dialog', async ({ userPage }) => {
    const exportDialog = new ExportDialog(userPage);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    const tmCard = userPage.getByTestId('threat-model-card').filter({ hasText: 'Seed TM' });
    await tmCard.first().click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    // The export button is inside the details kebab menu — open the menu first
    await openDetailsKebab(userPage);
    await userPage.getByTestId('tm-export-button').click();

    await exportDialog.status().waitFor({ state: 'visible' });
    await expect(exportDialog.saveButton()).toBeVisible({ timeout: 10000 });
    await exportDialog.cancel();
  });

  userTest('project association and dashboard filter', async ({ userPage }) => {
    const tmFlow = new ThreatModelFlow(userPage);
    const dashboard = new DashboardPage(userPage);
    const testName = `E2E Project TM ${Date.now()}`;

    await tmFlow.createFromDashboard(testName);

    // Project picker is a custom component — click the inner mat-select.
    // Selecting a project auto-saves (PUT or PATCH).
    const projectSaveResponse = userPage.waitForResponse(
      resp =>
        resp.url().includes('/threat_models/') &&
        (resp.request().method() === 'PUT' || resp.request().method() === 'PATCH'),
    );
    await userPage.getByTestId('tm-project-select').locator('mat-select').click();
    await userPage.locator('mat-option').filter({ hasText: 'Seed Project One' }).first().click();
    await projectSaveResponse;

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await expect(dashboard.tmCard(testName)).toBeVisible({ timeout: 10000 });

    try {
      await tmFlow.deleteFromDashboard(testName);
    } catch {
      /* best effort */
    }
  });
});

reviewerTest.describe('TM Workflows - Reviewer Role', () => {
  reviewerTest.setTimeout(120000);

  reviewerTest('reviewer edits assigned TM', async ({ reviewerPage }) => {
    const dashboard = new DashboardPage(reviewerPage);
    const tmEdit = new TmEditPage(reviewerPage);
    const threatPage = new ThreatPage(reviewerPage);

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await dashboard.tmCard('Seed TM - Full Fields').first().click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await expect(tmEdit.tmName()).toContainText('Seed TM');

    await tmEdit.threatRow('Seed Threat - All Fields').click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });
    await expect(threatPage.nameInput()).toBeVisible();

    await reviewerPage.goBack();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+(\?.*)?$/, { timeout: 10000 });
  });
});

multiRoleTest.describe('TM Workflows - Cross Role', () => {
  multiRoleTest.setTimeout(180000);

  multiRoleTest('owner shares TM with reviewer', async ({ userPage, reviewerPage }) => {
    const userTmFlow = new ThreatModelFlow(userPage);
    const testName = `E2E Share TM ${Date.now()}`;

    await userTmFlow.createFromDashboard(testName);

    // Open the details kebab menu first, then click permissions
    await openDetailsKebab(userPage);
    await userPage.getByTestId('tm-permissions-button').click();
    const permissionsFlow = new PermissionsFlow(userPage);
    await permissionsFlow.addPermission('user', 'TMI Provider', 'test-reviewer', 'writer');
    await permissionsFlow.saveAndClose();

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    const reviewerDashboard = new DashboardPage(reviewerPage);
    await reviewerDashboard.tmCard(testName).click();
    await reviewerPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await expect(reviewerPage.getByTestId('threat-model-name')).toContainText(testName);

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await userTmFlow.deleteFromDashboard(testName);
    } catch {
      /* best effort */
    }
  });

  multiRoleTest('confidential TM visibility', async ({ userPage, reviewerPage }) => {
    const createDialog = new CreateTmDialog(userPage);
    const userDashboard = new DashboardPage(userPage);
    const userTmFlow = new ThreatModelFlow(userPage);
    const reviewerDashboard = new DashboardPage(reviewerPage);
    const testName = `E2E Confidential TM ${Date.now()}`;

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await userDashboard.createTmButton().click();
    await createDialog.fillName(testName);
    await createDialog.setConfidential(true);
    await createDialog.submit();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await expect(userPage.getByTestId('tm-confidential-badge')).toBeVisible();

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await expect(reviewerDashboard.tmCard(testName)).toHaveCount(0, { timeout: 5000 });

    // Open the details kebab menu first, then click permissions
    await openDetailsKebab(userPage);
    await userPage.getByTestId('tm-permissions-button').click();
    const permissionsFlow = new PermissionsFlow(userPage);
    await permissionsFlow.addPermission('user', 'TMI Provider', 'test-reviewer', 'reader');
    await permissionsFlow.saveAndClose();

    await reviewerPage.goto('/dashboard');
    await reviewerPage.waitForLoadState('networkidle');
    await expect(reviewerDashboard.tmCard(testName)).toHaveCount(1, { timeout: 10000 });

    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    try {
      await userTmFlow.deleteFromDashboard(testName);
    } catch {
      /* best effort */
    }
  });
});
