import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { TEAM_FIELDS } from '../../schema/field-definitions';
import { TeamsPage } from '../../pages/teams.page';

const SEEDED_TEAM = 'Seed Team Alpha';

// Fields tested via workflow tests or not direct form inputs in the edit dialog
const SKIP_FIELDS = [
  'members',
  'responsible_parties',
  'related_teams',
  'metadata',
];

userTest.describe('Team Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of TEAM_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/teams');
      await userPage.waitForLoadState('networkidle');

      // Open edit dialog for seeded team
      const teamsPage = new TeamsPage(userPage);
      await teamsPage.editButton(SEEDED_TEAM).click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

      // Verify the field element is visible
      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Close dialog
      await userPage.getByTestId('edit-team-cancel-button').click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    });
  }
});
