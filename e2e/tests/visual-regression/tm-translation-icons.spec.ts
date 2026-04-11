import { userTest } from '../../fixtures/auth-fixtures';
import { assertNoMissingTranslations } from '../../helpers/translation-scanner';
import { assertIconsRendered } from '../../helpers/icon-checker';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';
const SEEDED_ASSET = 'Seed Asset - User Database';
const SEEDED_DOC = 'Architecture Doc';
const SEEDED_REPO = 'Main Codebase';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('TM Translation & Icon Integrity', () => {
  userTest.setTimeout(30000);

  userTest('dashboard', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('TM edit page', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.waitForLoadState('networkidle');
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('threat page', async ({ userPage }) => {
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
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
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
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
  });

  userTest('asset dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('asset-row')
      .filter({ hasText: SEEDED_ASSET }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('asset-cancel-button').click();
  });

  userTest('document dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('document-row')
      .filter({ hasText: SEEDED_DOC }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('document-cancel-button').click();
  });

  userTest('repository dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('repository-row')
      .filter({ hasText: SEEDED_REPO }).click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('repository-cancel-button').click();
  });

  userTest('metadata dialog', async ({ userPage }) => {
    await userPage.goto('/dashboard');
    await userPage.waitForLoadState('networkidle');
    await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
    await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });
    await userPage.getByTestId('tm-metadata-button').click();
    await userPage.locator('mat-dialog-container')
      .waitFor({ state: 'visible' });
    await assertNoMissingTranslations(userPage);
    await assertIconsRendered(userPage);
    await userPage.getByTestId('metadata-cancel-button').click();
  });
});
