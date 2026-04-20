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
  const relatedTeamName = `E2E Related Team ${Date.now()}`;

  test.beforeAll(async ({ browser }, testInfo) => {
    testInfo.setTimeout(60000);
    context = await browser.newContext();
    page = await context.newPage();
    teamFlow = new TeamFlow(page);
    teamsPage = new TeamsPage(page);

    // Team members / responsible-parties use the admin-only user search API,
    // so run team CRUD as an administrator.
    await new AuthFlow(page).loginAs('test-admin');
  });

  test.afterAll(async () => {
    try {
      await page.goto('/teams');
      await page.waitForLoadState('networkidle');
      for (const name of [updatedTeamName, relatedTeamName]) {
        const count = await teamsPage.teamRow(name).count();
        if (count > 0) {
          await teamFlow.deleteTeam(name);
        }
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

    // Pick a user in the UserPickerDialog — adds a row to the members table
    await teamFlow.addMember('test-reviewer@tmi.local', 'engineering_lead');

    // Save members
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await membersDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify the new member is present alongside the team creator
    await teamFlow.openMembers(updatedTeamName);
    const reviewerRow = membersDialog
      .memberRows()
      .filter({ hasText: 'test-reviewer@tmi.local' });
    await expect(reviewerRow).toHaveCount(1, { timeout: 5000 });
    const initialCount = await membersDialog.memberRows().count();

    // Remove the reviewer row
    await reviewerRow.getByTestId('team-members-remove-button').click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await membersDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed (one less than before)
    await teamFlow.openMembers(updatedTeamName);
    await expect(membersDialog.memberRows()).toHaveCount(initialCount - 1, { timeout: 5000 });
    await membersDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Responsible parties', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    const rpDialog = new ResponsiblePartiesDialog(page);

    // Open responsible parties dialog
    await teamFlow.openResponsibleParties(updatedTeamName);

    // Pick a user — the responsible-parties picker also requires a role
    await teamFlow.addResponsibleParty('test-reviewer@tmi.local', 'engineering_lead');

    // Save
    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify the new party is present
    await teamFlow.openResponsibleParties(updatedTeamName);
    const reviewerParty = rpDialog.partyRows().filter({ hasText: 'test-reviewer@tmi.local' });
    await expect(reviewerParty).toHaveCount(1, { timeout: 5000 });
    const initialCount = await rpDialog.partyRows().count();

    // Remove just the reviewer row
    await reviewerParty.getByTestId('responsible-parties-remove-button').click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await rpDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openResponsibleParties(updatedTeamName);
    await expect(rpDialog.partyRows()).toHaveCount(initialCount - 1, { timeout: 5000 });
    await rpDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });
  });

  test('Related teams', async () => {
    await page.goto('/teams');
    await page.waitForLoadState('networkidle');

    // Create a second team owned by the current user for the relationship.
    await teamFlow.createTeam({ name: relatedTeamName, status: 'Active' });
    await expect(teamsPage.teamRow(relatedTeamName)).toBeVisible({ timeout: 10000 });

    const relatedDialog = new RelatedTeamsDialog(page);

    await teamFlow.openRelatedTeams(updatedTeamName);
    await teamFlow.addRelatedTeam(relatedTeamName, 'dependency');

    const responsePromise = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await relatedDialog.save();
    await responsePromise;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Reopen and verify
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows().first()).toBeVisible({ timeout: 5000 });
    await expect(relatedDialog.relatedRows().first()).toContainText(relatedTeamName);

    // Remove
    await relatedDialog.removeButton(0).click();
    const removeResponse = page.waitForResponse(
      resp => resp.url().includes('/teams/') && resp.request().method() === 'PATCH'
    );
    await relatedDialog.save();
    await removeResponse;
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Verify removed
    await teamFlow.openRelatedTeams(updatedTeamName);
    await expect(relatedDialog.relatedRows()).toHaveCount(0, { timeout: 5000 });
    await relatedDialog.cancel();
    await page.locator('mat-dialog-container').waitFor({ state: 'hidden' });

    // Cleanup
    try {
      await teamFlow.deleteTeam(relatedTeamName);
    } catch {
      /* best effort */
    }
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
