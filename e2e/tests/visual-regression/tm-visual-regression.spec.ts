import { userTest } from '../../fixtures/auth-fixtures';
import { takeThemeScreenshots } from '../../helpers/screenshot';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';
const SEEDED_ASSET = 'Seed Asset - User Database';
const SEEDED_DOC = 'Architecture Doc';
const SEEDED_REPO = 'Main Codebase';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('TM Visual Regression', () => {
  userTest.setTimeout(60000);

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator(
      '.mat-column-lastModified, .mat-column-created, .mat-column-statusLastChanged'
    );

    await takeThemeScreenshots(userPage, 'tm-dashboard', {
      mask: [timestamps],
    });
  });

  userTest('TM edit page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'tm-edit-page', {
      mask: [timestamps],
      fullPage: true,
    });
  });

  userTest('threat detail page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await new TmEditPage(userPage).threatRow(SEEDED_THREAT).click();
    await userPage.waitForURL(
      /\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/,
      { timeout: 10000 },
    );
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'tm-threat-detail', {
      mask: [timestamps],
      fullPage: true,
    });
  });

  userTest('asset editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('asset-row')
      .filter({ hasText: SEEDED_ASSET }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-asset-editor-dialog');

    await userPage.getByTestId('asset-cancel-button').click();
  });

  userTest('document editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('document-row')
      .filter({ hasText: SEEDED_DOC }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-document-editor-dialog');

    await userPage.getByTestId('document-cancel-button').click();
  });

  userTest('repository editor dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('repository-row')
      .filter({ hasText: SEEDED_REPO }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });

    await takeThemeScreenshots(userPage, 'tm-repository-editor-dialog');

    await userPage.getByTestId('repository-cancel-button').click();
  });

  userTest('note page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

    await userPage.getByTestId('note-row')
      .filter({ hasText: SEEDED_NOTE }).click();
    await userPage.waitForURL(
      /\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/,
      { timeout: 10000 },
    );
    await userPage.waitForLoadState('networkidle');

    const timestamps = userPage.locator('.info-value').filter({
      hasText: /\d{1,2}\/\d{1,2}\/\d{2,4}/,
    });

    await takeThemeScreenshots(userPage, 'tm-note-page', {
      mask: [timestamps],
      fullPage: true,
    });
  });
});
