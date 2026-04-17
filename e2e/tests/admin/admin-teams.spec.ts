import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { AdminTeamsFlow } from '../../flows/admin-teams.flow';
import { AdminTeamsPage } from '../../pages/admin-teams.page';

test.describe.serial('Admin Teams Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let adminTeamsFlow: AdminTeamsFlow;
  let adminTeamsPage: AdminTeamsPage;

  const teamName = `E2E Admin Team ${Date.now()}`;
  const renamedName = `${teamName} Renamed`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    adminTeamsFlow = new AdminTeamsFlow(page);
    adminTeamsPage = new AdminTeamsPage(page);

    await new AuthFlow(page).loginAs('test-admin');
    await page.goto('/admin/teams');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('admin navigates to teams admin', async () => {
    await expect(adminTeamsPage.table()).toBeVisible({ timeout: 10000 });
  });

  test('search filters the list', async () => {
    await adminTeamsPage.searchInput().fill('nonexistent-xyz');
    await page.waitForTimeout(500);
    await expect(adminTeamsPage.rows()).toHaveCount(0, { timeout: 5000 });

    await adminTeamsPage.searchInput().clear();
    await page.waitForTimeout(500);
    const count = await adminTeamsPage.rows().count();
    expect(count).toBeGreaterThan(0);
  });

  test('create a team', async () => {
    await adminTeamsFlow.createTeam(teamName, 'initial desc');
    await expect(adminTeamsPage.row(teamName)).toBeVisible({ timeout: 10000 });
  });

  test('edit the team', async () => {
    await adminTeamsFlow.editTeam(teamName, renamedName);
    await expect(adminTeamsPage.row(renamedName)).toBeVisible({ timeout: 10000 });
  });

  test('open members dialog', async () => {
    await adminTeamsFlow.openMembers(renamedName);
  });

  test('open responsible parties dialog', async () => {
    await adminTeamsFlow.openResponsibleParties(renamedName);
  });

  test('open related teams dialog', async () => {
    await adminTeamsFlow.openRelatedTeams(renamedName);
  });

  test('open metadata dialog', async () => {
    await adminTeamsFlow.openMetadata(renamedName);
  });

  test('delete the team', async () => {
    await adminTeamsFlow.deleteTeam(renamedName);
    await expect(adminTeamsPage.row(renamedName)).toBeHidden({ timeout: 10000 });
  });
});
