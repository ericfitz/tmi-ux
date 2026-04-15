import { userTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { TeamsPage } from '../../pages/teams.page';
import { ProjectsPage } from '../../pages/projects.page';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TEAM = 'Seed Team Alpha';
const SEEDED_PROJECT = 'Seed Project One';

userTest.describe('Team/Project Visual Regression', () => {
  userTest.setTimeout(60000);

  userTest('teams list', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-modified');

    await takeThemeScreenshots(userPage, 'teams-list', {
      mask: [timestamps],
    });
  });

  userTest('create team dialog', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    await new TeamsPage(userPage).addButton().click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'create-team-dialog');

    await userPage.getByTestId('create-team-cancel-button').click();
  });

  userTest('edit team dialog', async ({ userPage }) => {
    await userPage.goto('/teams');
    await userPage.waitForLoadState('networkidle');

    await new TeamsPage(userPage).editButton(SEEDED_TEAM).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'edit-team-dialog', {
      mask: [timestamps],
    });

    await userPage.getByTestId('edit-team-cancel-button').click();
  });

  userTest('projects list', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.mat-column-modified');

    await takeThemeScreenshots(userPage, 'projects-list', {
      mask: [timestamps],
    });
  });

  userTest('create project dialog', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    await new ProjectsPage(userPage).addButton().click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'create-project-dialog');

    await userPage.getByTestId('create-project-cancel-button').click();
  });

  userTest('edit project dialog', async ({ userPage }) => {
    await userPage.goto('/projects');
    await userPage.waitForLoadState('networkidle');

    await new ProjectsPage(userPage).editButton(SEEDED_PROJECT).click();
    await userPage.locator('mat-dialog-container').waitFor({ state: 'visible' });

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'edit-project-dialog', {
      mask: [timestamps],
    });

    await userPage.getByTestId('edit-project-cancel-button').click();
  });

  userTest('dashboard with advanced filters', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    // Open advanced filters
    await new DashboardPage(userPage).moreFiltersButton().click();
    await userPage.waitForTimeout(300);

    const timestamps = userPage.locator(
      '.mat-column-lastModified, .mat-column-created, .mat-column-statusLastChanged'
    );
    const collabIndicators = userPage.locator('.collab-indicator-icon, .collaboration-info');

    await takeThemeScreenshots(userPage, 'dashboard-advanced-filters', {
      mask: [timestamps, collabIndicators],
      fullPage: true,
    });
  });
});
