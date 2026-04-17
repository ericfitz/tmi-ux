import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminProjectsFlow } from '../../flows/admin-projects.flow';
import { AdminProjectsPage } from '../../pages/admin-projects.page';

test.describe.serial('Admin Projects Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminProjectsFlow: AdminProjectsFlow;
  let adminProjectsPage: AdminProjectsPage;

  const projectName = `E2E Admin Project ${Date.now()}`;
  const renamedName = `${projectName} Renamed`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminProjectsFlow = new AdminProjectsFlow(page);
    adminProjectsPage = new AdminProjectsPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/projects');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to projects admin', async () => {
    await expect(adminProjectsPage.table()).toBeVisible({ timeout: 10000 });
  });

  test('name filter narrows the list', async () => {
    await adminProjectsPage.nameFilter().fill('nonexistent-xyz');
    await page.waitForTimeout(500);
    await expect(adminProjectsPage.rows()).toHaveCount(0, { timeout: 5000 });

    await adminProjectsPage.clearFiltersButton().click();
    await page.waitForTimeout(500);
    const count = await adminProjectsPage.rows().count();
    expect(count).toBeGreaterThan(0);
  });

  test('create a project', async () => {
    await adminProjectsFlow.createProject(projectName, 'initial desc');
    await expect(adminProjectsPage.row(projectName)).toBeVisible({ timeout: 10000 });
  });

  test('edit the project', async () => {
    await adminProjectsFlow.editProject(projectName, renamedName);
    await expect(adminProjectsPage.row(renamedName)).toBeVisible({ timeout: 10000 });
  });

  test('open responsible parties dialog', async () => {
    await adminProjectsFlow.openResponsibleParties(renamedName);
  });

  test('open related projects dialog', async () => {
    await adminProjectsFlow.openRelatedProjects(renamedName);
  });

  test('open metadata dialog', async () => {
    await adminProjectsFlow.openMetadata(renamedName);
  });

  test('delete the project', async () => {
    await adminProjectsFlow.deleteProject(renamedName);
    await expect(adminProjectsPage.row(renamedName)).toBeHidden({ timeout: 10000 });
  });
});
