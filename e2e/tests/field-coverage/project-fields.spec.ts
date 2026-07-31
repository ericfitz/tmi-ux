import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { PROJECT_FIELDS } from '../../schema/field-definitions';
import { FieldSkip, withoutSkipped } from '../../schema/field-skips';
import { ProjectsPage } from '../../pages/projects.page';

const SEEDED_PROJECT = 'Seed Project One';

const SKIPS: FieldSkip[] = [
  {
    apiName: 'responsible_parties',
    reason: 'covered-elsewhere',
    note:
      'project-workflows.spec.ts ("Responsible parties") drives ResponsiblePartiesDialog end to ' +
      "end. field-definitions.json's uiSelector for this field " +
      "('project-responsible-parties-button') does not match the real DOM testid " +
      "('projects-responsible-parties-item') — harmless while skipped, but would need fixing " +
      'before this field could ever be tested directly by this spec.',
  },
  {
    apiName: 'related_projects',
    reason: 'covered-elsewhere',
    note:
      'project-workflows.spec.ts ("Related projects") drives RelatedProjectsDialog end to end. ' +
      "Same stale-selector caveat: recorded uiSelector ('project-related-projects-button') " +
      "doesn't match the real DOM testid ('projects-related-projects-item').",
  },
  {
    apiName: 'metadata',
    reason: 'covered-elsewhere',
    note: 'project-workflows.spec.ts ("Project metadata") drives MetadataDialog end to end.',
  },
];

userTest.describe('Project Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of withoutSkipped(PROJECT_FIELDS, SKIPS)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/projects');
      await userPage.waitForLoadState('networkidle');

      // Open edit dialog for seeded project
      const projectsPage = new ProjectsPage(userPage);
      await projectsPage.editButton(SEEDED_PROJECT).click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

      // Verify the field element is visible
      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      // Close dialog
      await userPage.getByTestId('edit-project-cancel-button').click();
      await userPage.locator('mat-dialog-container').waitFor({ state: 'hidden' });
    });
  }
});
