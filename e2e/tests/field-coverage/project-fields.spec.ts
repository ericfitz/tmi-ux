import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { PROJECT_FIELDS } from '../../schema/field-definitions';
import { ProjectsPage } from '../../pages/projects.page';

const SEEDED_PROJECT = 'Seed Project One';

// Fields tested via workflow tests or not direct form inputs in the edit dialog
const SKIP_FIELDS = [
  'responsible_parties',
  'related_projects',
  'metadata',
];

userTest.describe('Project Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of PROJECT_FIELDS.filter(f => !SKIP_FIELDS.includes(f.apiName))) {
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
