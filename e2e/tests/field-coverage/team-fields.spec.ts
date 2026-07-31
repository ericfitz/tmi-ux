import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { TEAM_FIELDS } from '../../schema/field-definitions';
import { FieldSkip, withoutSkipped } from '../../schema/field-skips';
import { TeamsPage } from '../../pages/teams.page';

const SEEDED_TEAM = 'Seed Team Alpha';

const SKIPS: FieldSkip[] = [
  {
    apiName: 'members',
    reason: 'covered-elsewhere',
    note:
      'team-workflows.spec.ts ("Team members") drives TeamMembersDialog end to end (add, save, ' +
      "remove). Note field-definitions.json's uiSelector for this field " +
      "('[data-testid=\\'team-members-button\\']') does not match the real DOM testid " +
      "('teams-members-button', plural) — harmless while skipped, but would need fixing before " +
      'this field could ever be tested directly by this spec.',
  },
  {
    apiName: 'responsible_parties',
    reason: 'covered-elsewhere',
    note:
      'team-workflows.spec.ts ("Responsible parties") drives ResponsiblePartiesDialog end to ' +
      'end. Same stale-selector caveat as members: the recorded uiSelector ' +
      "('team-responsible-parties-button') doesn't match the real DOM testid " +
      "('teams-responsible-parties-item').",
  },
  {
    apiName: 'related_teams',
    reason: 'covered-elsewhere',
    note:
      'team-workflows.spec.ts ("Related teams") drives RelatedTeamsDialog end to end. Same ' +
      "stale-selector caveat: recorded uiSelector ('team-related-teams-button') doesn't match " +
      "the real DOM testid ('teams-related-teams-item').",
  },
  {
    apiName: 'metadata',
    reason: 'covered-elsewhere',
    note: 'team-workflows.spec.ts ("Team metadata") drives MetadataDialog end to end.',
  },
];

userTest.describe('Team Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of withoutSkipped(TEAM_FIELDS, SKIPS)) {
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
