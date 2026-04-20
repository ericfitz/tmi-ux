import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { ProjectFlow } from '../../flows/project.flow';
import { TeamFlow } from '../../flows/team.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { ProjectsPage } from '../../pages/projects.page';
import { ResponsiblePartiesDialog } from '../../dialogs/responsible-parties.dialog';
import { RelatedProjectsDialog } from '../../dialogs/related-projects.dialog';
import { MetadataDialog } from '../../dialogs/metadata.dialog';

test.describe.serial('Project Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let projectFlow: ProjectFlow;
  let projectsPage: ProjectsPage;
  let teamFlow: TeamFlow;

  const testProjectName = `E2E Project ${Date.now()}`;
  const updatedProjectName = `${testProjectName} Updated`;
  // The server requires the team creator (or an administrator) to delete a
  // project. Create a dedicated test team owned by test-user so project CRUD
  // exercises the full lifecycle without requiring admin privileges.
  const testTeamName = `E2E Project Team ${Date.now()}`;
  const altTeamName = `E2E Project Team Alt ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    projectFlow = new ProjectFlow(page);
    projectsPage = new ProjectsPage(page);
    teamFlow = new TeamFlow(page);

    await new AuthFlow(page).loginAs('test-user');

    // Create two teams owned by test-user so the full project lifecycle runs.
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');
    await teamFlow.createTeam({ name: testTeamName });
    await teamFlow.createTeam({ name: altTeamName });
  });

  test.afterAll(async () => {
    try {
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      const hasProject = await projectsPage.projectRow(updatedProjectName).count();
      if (hasProject > 0) {
        await projectFlow.deleteProject(updatedProjectName);
      }
    } catch {
      /* best effort */
    }
    try {
      await page.goto('/teams');
      await page.waitForLoadState('networkidle');
      await teamFlow.deleteTeam(testTeamName);
      await teamFlow.deleteTeam(altTeamName);
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('Project CRUD', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Create
    await projectFlow.createProject({
      name: testProjectName,
      team: testTeamName,
      status: 'active',
    });
    await expect(projectsPage.projectRow(testProjectName)).toBeVisible({ timeout: 10000 });

    // Edit
    await projectFlow.editProject(testProjectName, {
      name: updatedProjectName,
      status: 'Planning',
    });
    await expect(projectsPage.projectRow(updatedProjectName)).toBeVisible({ timeout: 10000 });
    await expect(projectsPage.projectRow(testProjectName)).toHaveCount(0, { timeout: 5000 });

    // Delete (requires team-creator; test-user owns testTeamName)
    await projectFlow.deleteProject(updatedProjectName);
    await expect(projectsPage.projectRow(updatedProjectName)).toHaveCount(0, { timeout: 10000 });

    // Re-create for subsequent tests
    await projectFlow.createProject({
      name: updatedProjectName,
      team: testTeamName,
    });
    await expect(projectsPage.projectRow(updatedProjectName)).toBeVisible({ timeout: 10000 });
  });

  test('Project-team linkage', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Verify project shows the primary team in the team column
    const projectRow = projectsPage.projectRow(updatedProjectName);
    await expect(projectRow).toContainText(testTeamName);

    // Edit to change team to the alt team
    await projectFlow.editProject(updatedProjectName, { team: altTeamName });

    await expect(projectsPage.projectRow(updatedProjectName)).toContainText(altTeamName, {
      timeout: 10000,
    });

    // Change back to primary for other tests
    await projectFlow.editProject(updatedProjectName, { team: testTeamName });
    await expect(projectsPage.projectRow(updatedProjectName)).toContainText(testTeamName, {
      timeout: 10000,
    });
  });

  test('Responsible parties', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const rpDialog = new ResponsiblePartiesDialog(page);

    // Open responsible parties dialog
    await projectFlow.openResponsibleParties(updatedProjectName);

    // Add responsible party
    await rpDialog.addButton().click();
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await projectFlow.openResponsibleParties(updatedProjectName);
    await expect(rpDialog.partyRows().first()).toBeVisible({ timeout: 5000 });

    // Remove
    await rpDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await projectFlow.openResponsibleParties(updatedProjectName);
    await expect(rpDialog.partyRows()).toHaveCount(0, { timeout: 5000 });
    await rpDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Related projects', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const relatedDialog = new RelatedProjectsDialog(page);

    // Open related projects dialog
    await projectFlow.openRelatedProjects(updatedProjectName);

    // Add Seed Project Two as related
    await projectFlow.addRelatedProject('Seed Project Two', 'related');

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await projectFlow.openRelatedProjects(updatedProjectName);
    await expect(relatedDialog.relatedRows().first()).toBeVisible({ timeout: 5000 });
    await expect(relatedDialog.relatedRows().first()).toContainText('Seed Project Two');

    // Remove
    await relatedDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/projects/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await projectFlow.openRelatedProjects(updatedProjectName);
    await expect(relatedDialog.relatedRows()).toHaveCount(0, { timeout: 5000 });
    await relatedDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Project metadata', async () => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // Open metadata dialog
    await projectFlow.openMetadata(updatedProjectName);

    // Add entry
    await metadataFlow.addEntry('env', 'prod');
    await metadataFlow.saveAndClose();

    // Reopen and verify
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.keyInput(0)).toHaveValue('env', { timeout: 5000 });
    await expect(metadataDialog.valueInput(0)).toHaveValue('prod');

    // Edit value
    await metadataFlow.editEntry(0, undefined, 'staging');
    await metadataFlow.saveAndClose();

    // Reopen and verify edit
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.valueInput(0)).toHaveValue('staging');

    // Delete
    await metadataFlow.deleteEntry(0);
    await metadataFlow.saveAndClose();

    // Reopen and verify empty
    await projectFlow.openMetadata(updatedProjectName);
    await expect(metadataDialog.rows()).toHaveCount(0, { timeout: 5000 });
    await metadataDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });
});
