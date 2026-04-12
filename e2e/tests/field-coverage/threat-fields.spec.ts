import { expect } from '@playwright/test';
import { userTest } from '../../fixtures/auth-fixtures';
import { THREAT_FIELDS } from '../../schema/field-definitions';
import { DashboardPage } from '../../pages/dashboard.page';
import { TmEditPage } from '../../pages/tm-edit.page';

const SEEDED_TM = 'Seed TM - Full Fields';
const SEEDED_THREAT = 'Seed Threat - All Fields';

userTest.describe('Threat Field Coverage', () => {
  userTest.setTimeout(30000);

  for (const field of THREAT_FIELDS.filter(f => f.editable)) {
    userTest(`field: ${field.apiName}`, async ({ userPage }) => {
      await userPage.goto('/dashboard');
      await userPage.waitForLoadState('networkidle');
      await new DashboardPage(userPage).tmCard(SEEDED_TM).first().click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+/, { timeout: 10000 });

      const tmEdit = new TmEditPage(userPage);
      await tmEdit.threatRow(SEEDED_THREAT).click();
      await userPage.waitForURL(/\/tm\/[a-f0-9-]+\/threat\/[a-f0-9-]+/, { timeout: 10000 });

      const locator = userPage.locator(field.uiSelector);
      await expect(locator).toBeVisible({ timeout: 5000 });
    });
  }
});
