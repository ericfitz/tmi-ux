import { test, expect, BrowserContext, Page } from '@playwright/test';
import { AuthFlow } from '../../flows/auth.flow';
import { TeamFlow } from '../../flows/team.flow';
import { MetadataFlow } from '../../flows/metadata.flow';
import { TeamsPage } from '../../pages/teams.page';
import { EditTeamDialog } from '../../dialogs/edit-team.dialog';
import { TeamMembersDialog } from '../../dialogs/team-members.dialog';
import { ResponsiblePartiesDialog } from '../../dialogs/responsible-parties.dialog';
import { RelatedTeamsDialog } from '../../dialogs/related-teams.dialog';
import { MetadataDialog } from '../../dialogs/metadata.dialog';

test.describe.serial('Team Workflows', () => {
  test.setTimeout(60000);

  let context: BrowserContext;
  let page: Page;
  let teamFlow: TeamFlow;
  let teamsPage: TeamsPage;

  const testTeamName = `E2E Team ${Date.now()}`;
  const updatedTeamName = `${testTeamName} Updated`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    teamFlow = new TeamFlow(page);
    teamsPage = new TeamsPage(page);

    await new AuthFlow(page).loginAs('test-user');
  });

  test.afterAll(async () => {
    // Best-effort cleanup: delete the test team if it still exists
    try {
      await page.goto('/teams');
      await page.waitForLoadState('networkidle');
      const hasTeam = await teamsPage.teamRow(updatedTeamName).count();
      if (hasTeam > 0) {
        await teamFlow.deleteTeam(updatedTeamName);
      }
    } catch {
      /* best effort */
    }
    await context.close();
  });

  test('Team CRUD', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    // Create
    await teamFlow.createTeam({ name: testTeamName, status: 'Active' });
    await expect(teamsPage.teamRow(testTeamName)).toBeVisible({ timeout: 10000 });

    // Edit
    await teamFlow.editTeam(testTeamName, {
      name: updatedTeamName,
      description: 'E2E test team description',
    });
    await expect(teamsPage.teamRow(updatedTeamName)).toBeVisible({ timeout: 10000 });
    await expect(teamsPage.teamRow(testTeamName)).toHaveCount(0, { timeout: 5000 });

    // Delete
    await teamFlow.deleteTeam(updatedTeamName);
    await expect(teamsPage.teamRow(updatedTeamName)).toHaveCount(0, { timeout: 10000 });

    // Re-create for subsequent tests
    await teamFlow.createTeam({ name: updatedTeamName, status: 'Active' });
    await expect(teamsPage.teamRow(updatedTeamName)).toBeVisible({ timeout: 10000 });
  });

  test('Team members', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const membersDialog = new TeamMembersDialog(page);

    // Open members dialog
    await teamFlow.openMembers(updatedTeamName);

    // Add member — triggers UserPickerDialog
    await membersDialog.addButton().click();
    // Wait for UserPickerDialog to appear, search for test-reviewer, select with role
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    // Interaction with UserPickerDialog depends on its implementation
    // Select test-reviewer and engineering_lead role
    await page.waitForTimeout(500);

    // Save members
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await membersDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify member is present
    await teamFlow.openMembers(updatedTeamName);
    await expect(membersDialog.memberRows()).toHaveCount(1, { timeout: 5000 });

    // Remove member
    await membersDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await membersDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openMembers(updatedTeamName);
    await expect(membersDialog.memberRows()).toHaveCount(0, { timeout: 5000 });
    await membersDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Responsible parties', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const rpDialog = new ResponsiblePartiesDialog(page);

    // Open responsible parties dialog
    await teamFlow.openResponsibleParties(updatedTeamName);

    // Add responsible party — triggers UserPickerDialog
    await rpDialog.addButton().click();
    await page.locator('mat-dialog-container').last().waitFor({ state: 'visible' });
    await page.waitForTimeout(500);

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await teamFlow.openResponsibleParties(updatedTeamName);
    await expect(rpDialog.partyRows().first()).toBeVisible({ timeout: 5000 });

    // Remove
    await rpDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openResponsibleParties(updatedTeamName);
    await expect(rpDialog.partyRows()).toHaveCount(0, { timeout: 5000 });
    await rpDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Related teams', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const relatedDialog = new RelatedTeamsDialog(page);

    // Open related teams dialog
    await teamFlow.openRelatedTeams(updatedTeamName);

    // Add Seed Team Beta as dependency
    await teamFlow.addRelatedTeam('Seed Team Beta', 'dependency');

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows().first()).toBeVisible({ timeout: 5000 });
    await expect(relatedDialog.relatedRows().first()).toContainText('Seed Team Beta');

    // Remove
    await relatedDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PUT'
    );
    await relatedDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows()).toHaveCount(0, { timeout: 5000 });
    await relatedDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Team metadata', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const metadataFlow = new MetadataFlow(page);
    const metadataDialog = new MetadataDialog(page);

    // Open metadata dialog
    await teamFlow.openMetadata(updatedTeamName);

    // Add entry
    await metadataFlow.addEntry('env', 'prod');
    await metadataFlow.saveAndClose();

    // Reopen and verify
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.keyInput(0)).toHaveValue('env', { timeout: 5000 });
    await expect(metadataDialog.valueInput(0)).toHaveValue('prod');

    // Edit value
    await metadataFlow.editEntry(0, undefined, 'staging');
    await metadataFlow.saveAndClose();

    // Reopen and verify edit
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.valueInput(0)).toHaveValue('staging');

    // Delete
    await metadataFlow.deleteEntry(0);
    await metadataFlow.saveAndClose();

    // Reopen and verify empty
    await teamFlow.openMetadata(updatedTeamName);
    await expect(metadataDialog.rows()).toHaveCount(0, { timeout: 5000 });
    await metadataDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });
});
