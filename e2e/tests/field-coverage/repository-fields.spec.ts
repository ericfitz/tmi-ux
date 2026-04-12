import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { REPOSITORY_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_REPO = 'Main Codebase';

userTest.describe('Repository Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of REPOSITORY_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).first().click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      await userPage.getByTestId('repository-row').filter({ hasText: SEEDED_REPO }).click();

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });

      await userPage.getByTestId('repository-cancel-button').click();
    });
  }
});
