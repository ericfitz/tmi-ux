import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { NOTE_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_NOTE = 'Review Notes';

userTest.describe('Note Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of NOTE_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      await userPage.getByTestId('note-row').filter({ hasText: SEEDED_NOTE }).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/note\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      await userPage.getByTestId('note-close-button').click();
    });
  }
});
